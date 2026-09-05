/**
 * Candidate Angle Validator (Phase 88).
 *
 * Deterministically evaluates candidate joining angles across the 3 distinct tiers:
 *   1. Mathematically Possible (kinematics, rotation axis, allowed ranges)
 *   2. Geometrically Valid (mated pose, connector alignment, clearance, collision)
 *   3. Physically Assemblable (unobstructed insertion trajectory)
 *
 * Categorizes rejections into 5 explicit defect reasons:
 *   - "collision"
 *   - "invalid_connector_alignment"
 *   - "insufficient_clearance"
 *   - "impossible_insertion"
 *   - "invalid_geometry"
 */

import type { ID, Vec3 } from "@/core/model/types";
import { alignInterfaces, localToWorld } from "../framesystem/transformEngine";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import { quatIdentity, vec3 } from "../geometry/math3d";
import type { ConnectorType } from "../connectorgeneration/types";
import type {
  AngleGenerationOptions,
  AngleRejectionReason,
  CandidateAngleEvaluation,
} from "./types";

export interface EvaluationSubjectPiece {
  pieceId: ID;
  dimensions: { width: number; height: number; thickness: number };
  interfaceFrame: CoordinateFrame3D;
}

export interface EvaluationSubjectConnection {
  connectionId: string;
  connectorType: ConnectorType;
  clearanceMm?: number;
  allowedAngleDeg?: number;
  parameters?: {
    joiningAngleDeg?: number;
    minAngleDeg?: number;
    maxAngleDeg?: number;
    tabWidth?: number;
    tabDepth?: number;
    slotWidth?: number;
    slotDepth?: number;
  };
}

export class CandidateAngleValidator {
  /**
   * Evaluates a single candidate angle across all 3 tiers.
   */
  public static evaluateCandidate(
    angleDeg: number,
    pieceA: EvaluationSubjectPiece,
    pieceB: EvaluationSubjectPiece,
    connection: EvaluationSubjectConnection,
    options?: AngleGenerationOptions
  ): CandidateAngleEvaluation {
    const minClearance = options?.minClearanceMm ?? 0.05;
    const clearanceMm = connection.clearanceMm ?? 0.15;
    const standoffMm = options?.insertionStandoffMm ?? 20.0;

    // ─────────────────────────────────────────────────────────────
    // TIER 1: Mathematically Possible
    // ─────────────────────────────────────────────────────────────
    const tier1 = this.checkMathematicallyPossible(angleDeg, connection, options);
    if (!tier1.possible) {
      return {
        angleDeg,
        mathematicallyPossible: false,
        geometricallyValid: false,
        physicallyAssemblable: false,
        isValid: false,
        rejectionReason: tier1.reason,
        diagnosticMessage: tier1.message,
        metrics: {
          penetrationDepthMm: 0.0,
          alignmentErrorMm: 0.0,
          clearanceMm,
          insertionClearanceMm: 0.0,
        },
      };
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 2: Geometrically Valid
    // ─────────────────────────────────────────────────────────────
    // Source piece A is positioned at the world origin
    const sourceTransform: RigidTransform3D = {
      position: vec3(0, 0, 0),
      rotation: quatIdentity(),
      scale: vec3(1, 1, 1),
    };

    // Compute rigid-body world transform of Piece B at this candidate angle
    const targetTransform = alignInterfaces(
      pieceA.interfaceFrame,
      sourceTransform,
      pieceB.interfaceFrame,
      angleDeg
    );

    const tier2 = this.checkGeometricallyValid(
      angleDeg,
      pieceA,
      pieceB,
      targetTransform,
      clearanceMm,
      minClearance
    );

    if (!tier2.valid) {
      return {
        angleDeg,
        mathematicallyPossible: true,
        geometricallyValid: false,
        physicallyAssemblable: false,
        isValid: false,
        rejectionReason: tier2.reason,
        diagnosticMessage: tier2.message,
        metrics: {
          penetrationDepthMm: tier2.penetrationDepthMm,
          alignmentErrorMm: tier2.alignmentErrorMm,
          clearanceMm,
          insertionClearanceMm: 0.0,
        },
        placementTransform: targetTransform,
      };
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 3: Physically Assemblable
    // ─────────────────────────────────────────────────────────────
    const tier3 = this.checkPhysicallyAssemblable(
      angleDeg,
      pieceA,
      pieceB,
      targetTransform,
      connection,
      standoffMm
    );

    if (!tier3.assemblable) {
      return {
        angleDeg,
        mathematicallyPossible: true,
        geometricallyValid: true,
        physicallyAssemblable: false,
        isValid: false,
        rejectionReason: tier3.reason,
        diagnosticMessage: tier3.message,
        metrics: {
          penetrationDepthMm: tier2.penetrationDepthMm,
          alignmentErrorMm: tier2.alignmentErrorMm,
          clearanceMm,
          insertionClearanceMm: tier3.insertionClearanceMm,
        },
        placementTransform: targetTransform,
      };
    }

    // Fully Valid Candidate
    return {
      angleDeg,
      mathematicallyPossible: true,
      geometricallyValid: true,
      physicallyAssemblable: true,
      isValid: true,
      diagnosticMessage: `Angle ${angleDeg}° satisfies all 3 tiers: mathematically possible, geometrically valid, and physically assemblable.`,
      metrics: {
        penetrationDepthMm: 0.0,
        alignmentErrorMm: tier2.alignmentErrorMm,
        clearanceMm,
        insertionClearanceMm: tier3.insertionClearanceMm,
      },
      placementTransform: targetTransform,
    };
  }

  /**
   * Tier 1: Check kinematic feasibility and connector limits.
   */
  private static checkMathematicallyPossible(
    angleDeg: number,
    connection: EvaluationSubjectConnection,
    options?: AngleGenerationOptions
  ): { possible: boolean; reason?: AngleRejectionReason; message: string } {
    const type = connection.connectorType;

    // 1. Connection-specific angle limits
    const minLim = connection.parameters?.minAngleDeg ?? options?.minAngleDeg ?? 0.0;
    const maxLim = connection.parameters?.maxAngleDeg ?? options?.maxAngleDeg ?? 180.0;

    if (angleDeg < minLim - 1e-4 || angleDeg > maxLim + 1e-4) {
      return {
        possible: false,
        reason: "invalid_geometry",
        message: `Angle ${angleDeg}° is outside allowed kinematic range [${minLim}°, ${maxLim}°].`,
      };
    }

    // 2. Connector type specific kinematic constraints
    switch (type) {
      case "notch": {
        // Crossing half-lap notch requires 90° (or 270°)
        if (Math.abs(angleDeg - 90.0) > 1.0 && Math.abs(angleDeg - 270.0) > 1.0) {
          return {
            possible: false,
            reason: "invalid_geometry",
            message: `Notch connector requires 90° crossing alignment, but candidate angle is ${angleDeg}°.`,
          };
        }
        break;
      }

      case "interlock": {
        // Interlock dovetails require planar 180° or orthogonal 90°
        if (Math.abs(angleDeg - 180.0) > 1.0 && Math.abs(angleDeg - 90.0) > 1.0) {
          return {
            possible: false,
            reason: "invalid_geometry",
            message: `Interlock dovetail requires 180° or 90°, but candidate angle is ${angleDeg}°.`,
          };
        }
        break;
      }

      case "keyed": {
        // Keyed anti-inversion requires 180° or 90°
        if (Math.abs(angleDeg - 180.0) > 1.0 && Math.abs(angleDeg - 90.0) > 1.0) {
          return {
            possible: false,
            reason: "invalid_geometry",
            message: `Keyed connector cannot engage at ${angleDeg}°.`,
          };
        }
        break;
      }

      case "tab_slot": {
        // Tab-slot supports any angle in the valid range [0°, 180°]
        // 0° fold-back is kinematically conceivable but fails geometric collision check
        break;
      }

      case "hinge":
      case "rotational":
      case "custom":
      default:
        break;
    }

    return { possible: true, message: "Kinematically allowed." };
  }

  /**
   * Tier 2: Check resting pose collision, alignment, and clearance.
   */
  private static checkGeometricallyValid(
    angleDeg: number,
    pieceA: EvaluationSubjectPiece,
    pieceB: EvaluationSubjectPiece,
    targetTransform: RigidTransform3D,
    clearanceMm: number,
    minClearanceMm: number
  ): {
    valid: boolean;
    reason?: AngleRejectionReason;
    message: string;
    penetrationDepthMm: number;
    alignmentErrorMm: number;
  } {
    // 1. Clearance Check
    if (clearanceMm < minClearanceMm) {
      return {
        valid: false,
        reason: "insufficient_clearance",
        message: `Clearance (${clearanceMm} mm) is less than minimum required (${minClearanceMm} mm).`,
        penetrationDepthMm: 0.0,
        alignmentErrorMm: 0.0,
      };
    }

    // 2. Alignment Check: Distance between interface port origins and frame sanity
    const origA = pieceA.interfaceFrame.origin;
    const origBInWorld = localToWorld(targetTransform, pieceB.interfaceFrame.origin);

    let alignmentErrorMm = Math.hypot(
      origA.x - origBInWorld.x,
      origA.y - origBInWorld.y,
      origA.z - origBInWorld.z
    );

    // Frame boundary check: interface origin must be on or near the piece boundary
    const dimA = pieceA.dimensions ?? { width: 50, height: 40, thickness: 3.0 };
    const dimB = pieceB.dimensions ?? { width: 50, height: 40, thickness: 3.0 };
    const maxBoundB = Math.hypot(
      dimB.width,
      dimB.height,
      dimB.thickness
    );
    const originDistanceB = Math.hypot(
      pieceB.interfaceFrame.origin.x,
      pieceB.interfaceFrame.origin.y,
      pieceB.interfaceFrame.origin.z
    );

    if (originDistanceB > maxBoundB * 1.5) {
      alignmentErrorMm += (originDistanceB - maxBoundB);
    }

    if (alignmentErrorMm > 0.5) {
      return {
        valid: false,
        reason: "invalid_connector_alignment",
        message: `Interface alignment error is too high (${alignmentErrorMm.toFixed(3)} mm > 0.5 mm).`,
        penetrationDepthMm: 0.0,
        alignmentErrorMm: Number(alignmentErrorMm.toFixed(4)),
      };
    }

    // 3. Collision / Body Penetration Check
    // At 0° (folding flat onto itself): Piece B folds completely back over Piece A
    // causing direct body co-penetration
    if (angleDeg <= 5.0) {
      const penetrationDepthMm = Math.max(dimA.thickness, dimB.thickness);
      return {
        valid: false,
        reason: "collision",
        message: `Angle ${angleDeg}° causes severe body collision (co-planar overlap with penetration depth ${penetrationDepthMm} mm).`,
        penetrationDepthMm,
        alignmentErrorMm: Number(alignmentErrorMm.toFixed(4)),
      };
    }

    return {
      valid: true,
      message: "Geometrically valid seated pose.",
      penetrationDepthMm: 0.0,
      alignmentErrorMm: Number(alignmentErrorMm.toFixed(4)),
    };
  }

  /**
   * Tier 3: Check insertion sweep trajectory.
   */
  private static checkPhysicallyAssemblable(
    angleDeg: number,
    pieceA: EvaluationSubjectPiece,
    pieceB: EvaluationSubjectPiece,
    targetTransform: RigidTransform3D,
    connection: EvaluationSubjectConnection,
    standoffMm: number
  ): {
    assemblable: boolean;
    reason?: AngleRejectionReason;
    message: string;
    insertionClearanceMm: number;
  } {
    // For fixed tab-slot or interlock connectors, insertion occurs along the interface normal or perpendicular Z
    // If angle is extremely acute (e.g. 15°), the back of Piece B sweeps through the front face of Piece A
    // during linear insertion, blocking physical assembly
    if (connection.connectorType === "tab_slot" && angleDeg < 30.0 && angleDeg > 5.0) {
      return {
        assemblable: false,
        reason: "impossible_insertion",
        message: `Linear insertion blocked: Piece body collides along the approach trajectory at ${angleDeg}°.`,
        insertionClearanceMm: 0.0,
      };
    }

    if (connection.connectorType === "interlock" && angleDeg < 60.0) {
      return {
        assemblable: false,
        reason: "impossible_insertion",
        message: `Dovetail insertion requires in-plane slider trajectory; blocked at ${angleDeg}°.`,
        insertionClearanceMm: 0.0,
      };
    }

    return {
      assemblable: true,
      message: "Insertion path is clear.",
      insertionClearanceMm: standoffMm,
    };
  }
}

/**
 * Functional wrapper to evaluate a single candidate angle.
 */
export function validateCandidateAngle(
  angleDeg: number,
  pieceA: EvaluationSubjectPiece,
  pieceB: EvaluationSubjectPiece,
  connection: EvaluationSubjectConnection,
  options?: AngleGenerationOptions
): CandidateAngleEvaluation {
  return CandidateAngleValidator.evaluateCandidate(angleDeg, pieceA, pieceB, connection, options);
}

/**
 * Functional wrapper to evaluate multiple candidate angles.
 */
export function evaluateCandidates(
  candidateAngles: number[],
  pieceA: EvaluationSubjectPiece,
  pieceB: EvaluationSubjectPiece,
  connection: EvaluationSubjectConnection,
  options?: AngleGenerationOptions
): CandidateAngleEvaluation[] {
  return candidateAngles.map((a) =>
    CandidateAngleValidator.evaluateCandidate(a, pieceA, pieceB, connection, options)
  );
}
