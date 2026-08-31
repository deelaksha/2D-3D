/**
 * Connection Compatibility Engine.
 *
 * Evaluates 7 core physical, geometric, and kinematic compatibility criteria:
 * 1. Interface Types
 * 2. Profiles
 * 3. Joining Angles
 * 4. Insertion Directions
 * 5. Clearances
 * 6. Degrees of Freedom (DOF)
 * 7. Physical Relationships
 */
import type {
  CompatibilityCheckDetail,
  CompatibilityEvaluationContext,
  ConnectionCompatibilityCheckKind,
  ConnectionCompatibilityReport,
  ExtensibleCompatibilityRule,
} from "./types";
import { localToWorld } from "../framesystem/transformEngine";
import { dot3, len3, sub3 } from "../geometry/math3d";

export class ConnectionCompatibilityEngine {
  private customRules: ExtensibleCompatibilityRule[] = [];

  registerCustomRule(rule: ExtensibleCompatibilityRule): void {
    this.customRules.push(rule);
  }

  /* ------------------------------------------------------------------ */
  /* 1. Interface Type & Gender Role Check                              */
  /* ------------------------------------------------------------------ */
  checkTypeCompatibility(ctx: CompatibilityEvaluationContext): CompatibilityCheckDetail {
    const { interfaceA, interfaceB } = ctx;
    const genderA = interfaceA.compatibility?.genderRole ?? "neutral";
    const genderB = interfaceB.compatibility?.genderRole ?? "neutral";

    let satisfied = true;
    let score = 1.0;
    let message = "Interface types and gender roles are compatible.";

    if (genderA === "insert" && genderB === "insert") {
      satisfied = false;
      score = 0.0;
      message = "Incompatible interface gender roles: insert-insert (male-male) pairing rejected.";
    } else if (genderA === "receiver" && genderB === "receiver") {
      satisfied = false;
      score = 0.0;
      message = "Incompatible interface gender roles: receiver-receiver (female-female) pairing rejected.";
    } else if (interfaceA.interfaceType !== interfaceB.interfaceType && interfaceA.interfaceType !== "custom") {
      // Complementary type check (e.g. tab + slot)
      const isComplementary =
        (interfaceA.interfaceType === "tab" && interfaceB.interfaceType === "slot") ||
        (interfaceA.interfaceType === "slot" && interfaceB.interfaceType === "tab");
      if (!isComplementary) {
        score = 0.7;
        message = `Interface type mismatch ('${interfaceA.interfaceType}' vs '${interfaceB.interfaceType}').`;
      }
    }

    return {
      checkKind: "type",
      satisfied,
      score,
      message,
      diagnosticInfo: { genderA, genderB, typeA: interfaceA.interfaceType, typeB: interfaceB.interfaceType },
    };
  }

  /* ------------------------------------------------------------------ */
  /* 2. Profile Compatibility Check                                     */
  /* ------------------------------------------------------------------ */
  checkProfileCompatibility(ctx: CompatibilityEvaluationContext): CompatibilityCheckDetail {
    const { interfaceA, interfaceB } = ctx;
    const profA = interfaceA.profile;
    const profB = interfaceB.profile;

    if (!profA || !profB) {
      return {
        checkKind: "profile",
        satisfied: true,
        score: 1.0,
        message: "Profile specifications not defined, assuming default compatibility.",
      };
    }

    let satisfied = true;
    let score = 1.0;
    let message = "Interface profiles are compatible.";

    const widthDiff = Math.abs((profA.width ?? 0) - (profB.width ?? 0));
    const tol = interfaceA.tolerance ?? profA.clearance ?? 0.5;

    if (widthDiff > tol * 2) {
      satisfied = false;
      score = 0.3;
      message = `Profile width mismatch: interface A (${profA.width}mm) vs interface B (${profB.width}mm) exceeds tolerance ${tol}mm.`;
    }

    return {
      checkKind: "profile",
      satisfied,
      score,
      message,
      diagnosticInfo: { widthA: profA.width ?? 0, widthB: profB.width ?? 0, widthDiff },
    };
  }

  /* ------------------------------------------------------------------ */
  /* 3. Joining Angle Validity Check                                    */
  /* ------------------------------------------------------------------ */
  checkAngleValidity(ctx: CompatibilityEvaluationContext): CompatibilityCheckDetail {
    const angle = ctx.joiningAngleDeg ?? 90.0;
    const metaA = ctx.interfaceA.metadata as any;
    let rangeA = metaA?.allowedAngleRange;
    if (typeof rangeA === "string") {
      try {
        rangeA = JSON.parse(rangeA);
      } catch {
        rangeA = undefined;
      }
    }
    if (!rangeA && metaA?.minAngleDeg !== undefined && metaA?.maxAngleDeg !== undefined) {
      rangeA = { minAngleDeg: metaA.minAngleDeg, maxAngleDeg: metaA.maxAngleDeg };
    }

    let satisfied = true;
    let score = 1.0;
    let message = `Joining angle (${angle}°) is valid.`;

    if (rangeA) {
      const { minAngleDeg, maxAngleDeg } = rangeA;
      if (angle < minAngleDeg - 0.5 || angle > maxAngleDeg + 0.5) {
        satisfied = false;
        score = 0.0;
        message = `Joining angle (${angle}°) is outside allowed angle range [${minAngleDeg}°, ${maxAngleDeg}°].`;
      }
    }

    return {
      checkKind: "angle",
      satisfied,
      score,
      message,
      diagnosticInfo: { angle, minAngle: rangeA?.minAngleDeg, maxAngle: rangeA?.maxAngleDeg },
    };
  }

  /* ------------------------------------------------------------------ */
  /* 4. Insertion Direction Validity Check                               */
  /* ------------------------------------------------------------------ */
  checkInsertionDirectionValidity(ctx: CompatibilityEvaluationContext): CompatibilityCheckDetail {
    const vecA = ctx.insertionVectorA ?? { x: 1, y: 0, z: 0 };
    const vecB = ctx.insertionVectorB ?? { x: -1, y: 0, z: 0 };

    const dot = dot3(vecA, vecB);
    const satisfied = dot <= -0.5 || Math.abs(dot) <= 1.0;

    return {
      checkKind: "insertion",
      satisfied,
      score: satisfied ? 1.0 : 0.2,
      message: satisfied
        ? "Insertion direction vectors are aligned."
        : `Insertion direction misaligned (dot product: ${dot.toFixed(2)}).`,
      diagnosticInfo: { dot },
    };
  }

  /* ------------------------------------------------------------------ */
  /* 5. Clearance Validity Check                                        */
  /* ------------------------------------------------------------------ */
  checkClearanceValidity(ctx: CompatibilityEvaluationContext): CompatibilityCheckDetail {
    const clearance = ctx.clearanceMm ?? ctx.interfaceA.tolerance ?? 0.15;
    const minClearance = 0.05;
    const maxClearance = 1.0;

    const satisfied = clearance >= minClearance && clearance <= maxClearance;

    return {
      checkKind: "clearance",
      satisfied,
      score: satisfied ? 1.0 : 0.4,
      message: satisfied
        ? `Clearance (${clearance.toFixed(2)}mm) is within valid bounds [${minClearance}, ${maxClearance}].`
        : `Clearance (${clearance.toFixed(2)}mm) is outside recommended range.`,
      diagnosticInfo: { clearance },
    };
  }

  /* ------------------------------------------------------------------ */
  /* 6. Degrees of Freedom (DOF) Satisfaction Check                      */
  /* ------------------------------------------------------------------ */
  checkDOFValidity(ctx: CompatibilityEvaluationContext): CompatibilityCheckDetail {
    const dofA = ctx.interfaceA.allowedDOF;
    const proposedTransDOF = ctx.proposedTranslationDOF ?? 0;
    const proposedRotDOF = ctx.proposedRotationDOF ?? 0;

    let satisfied = true;
    let score = 1.0;
    let message = "Required degrees of freedom are satisfied.";

    if (dofA) {
      const allowedTransCount = (dofA.translation.x ? 1 : 0) + (dofA.translation.y ? 1 : 0) + (dofA.translation.z ? 1 : 0);
      const allowedRotCount = (dofA.rotation.rx ? 1 : 0) + (dofA.rotation.ry ? 1 : 0) + (dofA.rotation.rz ? 1 : 0);

      if (proposedTransDOF > allowedTransCount) {
        satisfied = false;
        score = 0.5;
        message = `Translation DOF violation: proposed ${proposedTransDOF} exceeds allowed ${allowedTransCount}.`;
      }
      if (proposedRotDOF > allowedRotCount) {
        satisfied = false;
        score = 0.5;
        message = `Rotation DOF violation: proposed ${proposedRotDOF} exceeds allowed ${allowedRotCount}.`;
      }
    }

    return {
      checkKind: "dof",
      satisfied,
      score,
      message,
      diagnosticInfo: { proposedTransDOF, proposedRotDOF },
    };
  }

  /* ------------------------------------------------------------------ */
  /* 7. Physical Relationship Validity Check                             */
  /* ------------------------------------------------------------------ */
  checkPhysicalRelationshipValidity(ctx: CompatibilityEvaluationContext): CompatibilityCheckDetail {
    const frameA = ctx.interfaceA.localFrame;
    const frameB = ctx.interfaceB.localFrame;
    const tA = ctx.transformA;
    const tB = ctx.transformB;

    if (!frameA || !frameB || !tA || !tB) {
      return {
        checkKind: "physical",
        satisfied: true,
        score: 1.0,
        message: "Spatial transforms not provided, skipping physical position check.",
      };
    }

    const worldA = localToWorld(tA, frameA.origin);
    const worldB = localToWorld(tB, frameB.origin);

    const dist = len3(sub3(worldA, worldB));
    const satisfied = dist <= 2.0;

    return {
      checkKind: "physical",
      satisfied,
      score: satisfied ? 1.0 : Math.max(0, 1.0 - dist / 10),
      message: satisfied
        ? `Mated interface ports are spatially aligned (${dist.toFixed(2)}mm distance).`
        : `Mated interface ports are physically separated by ${dist.toFixed(2)}mm > 2.0mm.`,
      diagnosticInfo: { distance: dist },
    };
  }

  /* ------------------------------------------------------------------ */
  /* Main Pipeline Evaluation                                           */
  /* ------------------------------------------------------------------ */
  evaluateCompatibility(ctx: CompatibilityEvaluationContext): ConnectionCompatibilityReport {
    const typeCheck = this.checkTypeCompatibility(ctx);
    const profileCheck = this.checkProfileCompatibility(ctx);
    const angleCheck = this.checkAngleValidity(ctx);
    const insertionCheck = this.checkInsertionDirectionValidity(ctx);
    const clearanceCheck = this.checkClearanceValidity(ctx);
    const dofCheck = this.checkDOFValidity(ctx);
    const physicalCheck = this.checkPhysicalRelationshipValidity(ctx);

    const checks: Record<ConnectionCompatibilityCheckKind, CompatibilityCheckDetail> = {
      type: typeCheck,
      profile: profileCheck,
      angle: angleCheck,
      insertion: insertionCheck,
      clearance: clearanceCheck,
      dof: dofCheck,
      physical: physicalCheck,
    };

    const diagnostics: string[] = [];
    let totalScore = 0;
    const keys = Object.keys(checks) as ConnectionCompatibilityCheckKind[];

    for (const key of keys) {
      const c = checks[key];
      totalScore += c.score;
      diagnostics.push(`[${c.checkKind.toUpperCase()}] ${c.message}`);
    }

    // Execute extensible custom rules
    for (const rule of this.customRules) {
      const customRes = rule.evaluate(ctx);
      if (customRes) {
        diagnostics.push(`[CUSTOM RULE: ${rule.name}] ${customRes.message}`);
        if (!customRes.satisfied) {
          checks[customRes.checkKind] = customRes;
        }
      }
    }

    const isCompatible = keys.every((k) => checks[k].satisfied);
    const overallScore = totalScore / keys.length;

    return {
      isCompatible,
      overallScore,
      checks,
      diagnostics,
    };
  }
}
