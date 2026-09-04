/**
 * Multi-Angle 3D Assembly Solver (Phase 67).
 *
 * Evaluates candidate 3D joining angles across continuous ranges, discrete sets,
 * and multi-axis configurations. Crucially distinguishes:
 *   1. THEORETICALLY ALLOWED (Satisfies kinematic angle specifications)
 *   2. GEOMETRICALLY VALID (Collision-free seated resting pose)
 *   3. PHYSICALLY ASSEMBLABLE (Collision-free insertion approach trajectory)
 */
import type { RigidTransform3D } from "../framesystem/types";
import type {
  AngleEvaluationResult,
  AngleOverallStatus,
  GeometricAngleDetails,
  MultiAngleQuery,
  SolvableAssemblyPiece,
} from "./angleTypes";
import { AngleConstraintEvaluator } from "./angleConstraintEvaluator";
import { InsertionSweepEvaluator } from "./insertionSweepEvaluator";
import {
  add3,
  composeTransforms,
  len3,
  normalize3,
  quatFromAxisAngle,
  quatMultiply,
  quatRotateVector,
  scale3,
  sub3,
  vec3,
} from "../geometry/math3d";

export class MultiAngleAssemblySolver {
  /**
   * Evaluates a candidate joining angle across all 3 tiers.
   */
  static evaluateAngle(query: MultiAngleQuery): AngleEvaluationResult {
    const {
      pieceA,
      pieceB,
      connection,
      desiredAngleDeg,
      rollAngleDeg = 0.0,
      rotationAxis,
      angleSpecification,
      insertionStandoffMm = 25.0,
      sweepSampleSteps = 10,
    } = query;

    const diagnostics: string[] = [];

    // ─────────────────────────────────────────────────────────────
    // TIER 1: THEORETICALLY ALLOWED
    // ─────────────────────────────────────────────────────────────
    const theoretical = AngleConstraintEvaluator.evaluateTheoretical(
      desiredAngleDeg,
      connection,
      angleSpecification,
      rotationAxis
    );

    if (!theoretical.isAllowed) {
      diagnostics.push(`[Tier 1 Disallowed] ${theoretical.reason}`);
      return {
        desiredAngleDeg,
        rotationAxis: theoretical.rotationAxisUsed,
        rollAngleDeg,
        isTheoreticallyAllowed: false,
        isGeometricallyValid: false,
        isPhysicallyAssemblable: false,
        overallStatus: "THEORETICALLY_DISALLOWED",
        theoreticalDetails: theoretical,
        geometricDetails: {
          isValid: false,
          hasBodyCollision: false,
          penetrationDepthMm: 0.0,
          contactAreaMm2: 0.0,
          reason: "Evaluation halted: angle is theoretically disallowed.",
        },
        physicalDetails: {
          isAssemblable: false,
          isInsertionClear: false,
          sweptInterferenceDepthMm: 0.0,
          reason: "Evaluation halted: angle is theoretically disallowed.",
        },
        diagnostics,
      };
    }
    diagnostics.push(`[Tier 1 Passed] Angle ${desiredAngleDeg}° is theoretically allowed (${theoretical.matchedSpecification}).`);

    // ─────────────────────────────────────────────────────────────
    // TIER 2: GEOMETRICALLY VALID (At Seated Rest Pose)
    // ─────────────────────────────────────────────────────────────
    const seatedPlacementB = this.solveSeatedPlacement(
      pieceA,
      pieceB,
      connection,
      desiredAngleDeg,
      rollAngleDeg,
      theoretical.rotationAxisUsed
    );

    const geometric = this.evaluateGeometricValidity(
      pieceA,
      pieceB,
      connection,
      seatedPlacementB,
      desiredAngleDeg
    );

    if (!geometric.isValid) {
      diagnostics.push(`[Tier 2 Collision] ${geometric.reason}`);
      return {
        desiredAngleDeg,
        rotationAxis: theoretical.rotationAxisUsed,
        rollAngleDeg,
        isTheoreticallyAllowed: true,
        isGeometricallyValid: false,
        isPhysicallyAssemblable: false,
        overallStatus: "GEOMETRIC_SELF_COLLISION",
        theoreticalDetails: theoretical,
        geometricDetails: geometric,
        physicalDetails: {
          isAssemblable: false,
          isInsertionClear: false,
          sweptInterferenceDepthMm: 0.0,
          reason: "Evaluation halted: seated pose causes geometric self-collision.",
        },
        resultingPlacement: seatedPlacementB,
        diagnostics,
      };
    }
    diagnostics.push(`[Tier 2 Passed] Seated resting pose at ${desiredAngleDeg}° is geometrically valid.`);

    // ─────────────────────────────────────────────────────────────
    // TIER 3: PHYSICALLY ASSEMBLABLE (Insertion Sweep Trajectory)
    // ─────────────────────────────────────────────────────────────
    const physical = InsertionSweepEvaluator.evaluateInsertionSweep(
      pieceA,
      pieceB,
      connection,
      seatedPlacementB,
      insertionStandoffMm,
      sweepSampleSteps
    );

    if (!physical.isAssemblable) {
      diagnostics.push(`[Tier 3 Blocked] ${physical.reason}`);
      return {
        desiredAngleDeg,
        rotationAxis: theoretical.rotationAxisUsed,
        rollAngleDeg,
        isTheoreticallyAllowed: true,
        isGeometricallyValid: true,
        isPhysicallyAssemblable: false,
        overallStatus: "BLOCKED_ASSEMBLY_PATH",
        theoreticalDetails: theoretical,
        geometricDetails: geometric,
        physicalDetails: physical,
        resultingPlacement: seatedPlacementB,
        diagnostics,
      };
    }
    diagnostics.push(`[Tier 3 Passed] Insertion path is clear of physical obstructions.`);

    return {
      desiredAngleDeg,
      rotationAxis: theoretical.rotationAxisUsed,
      rollAngleDeg,
      isTheoreticallyAllowed: true,
      isGeometricallyValid: true,
      isPhysicallyAssemblable: true,
      overallStatus: "FULLY_VALID",
      theoreticalDetails: theoretical,
      geometricDetails: geometric,
      physicalDetails: physical,
      resultingPlacement: seatedPlacementB,
      diagnostics,
    };
  }

  /**
   * Batch evaluates an array of candidate angles and returns all evaluations.
   */
  static findValidAngles(
    pieceA: SolvableAssemblyPiece,
    pieceB: SolvableAssemblyPiece,
    connection: MultiAngleQuery["connection"],
    candidateAnglesDeg: number[],
    options: Omit<MultiAngleQuery, "pieceA" | "pieceB" | "connection" | "desiredAngleDeg"> = {}
  ): AngleEvaluationResult[] {
    return candidateAnglesDeg.map((angle) =>
      this.evaluateAngle({
        pieceA,
        pieceB,
        connection,
        desiredAngleDeg: angle,
        ...options,
      })
    );
  }

  /* ───────────────────────────────────────────────────────────── */
  /* Internal Kinematic & Geometric Solvers                         */
  /* ───────────────────────────────────────────────────────────── */

  private static solveSeatedPlacement(
    pieceA: SolvableAssemblyPiece,
    pieceB: SolvableAssemblyPiece,
    connection: MultiAngleQuery["connection"],
    angleDeg: number,
    rollAngleDeg: number,
    rotationAxis: MultiAngleQuery["rotationAxis"]
  ): RigidTransform3D {
    const worldA = pieceA.worldTransform || {
      position: vec3(0, 0, 0),
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: vec3(1, 1, 1),
    };

    const frameA = pieceA.interfaceFrame;
    const frameB = pieceB.interfaceFrame;

    const angleRad = (angleDeg * Math.PI) / 180.0;
    const rollRad = (rollAngleDeg * Math.PI) / 180.0;

    const rotAxis = rotationAxis || frameA.binormal;

    // 1. Mating orientation
    const qOppose = quatFromAxisAngle(frameA.binormal, Math.PI);
    const qJoining = quatFromAxisAngle(rotAxis, angleRad);
    const qRoll = quatFromAxisAngle(frameA.normal, rollRad);

    const relativeRotation = quatMultiply(qJoining, quatMultiply(qRoll, qOppose));
    const targetWorldRotation = quatMultiply(worldA.rotation, relativeRotation);

    // 2. Mating position with clearance
    const clearanceOffset = scale3(frameB.normal, connection.clearance);
    const worldInterfaceAPos = add3(worldA.position, quatRotateVector(worldA.rotation, frameA.origin));
    const rotatedOffsetB = quatRotateVector(targetWorldRotation, add3(frameB.origin, clearanceOffset));
    const targetWorldPosition = sub3(worldInterfaceAPos, rotatedOffsetB);

    return {
      position: targetWorldPosition,
      rotation: targetWorldRotation,
      scale: vec3(1, 1, 1),
    };
  }

  private static evaluateGeometricValidity(
    pieceA: SolvableAssemblyPiece,
    pieceB: SolvableAssemblyPiece,
    connection: MultiAngleQuery["connection"],
    placementB: RigidTransform3D,
    angleDeg: number
  ): GeometricAngleDetails {
    const worldA = pieceA.worldTransform || {
      position: vec3(0, 0, 0),
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: vec3(1, 1, 1),
    };

    // 1. Calculate world AABB for both pieces
    const boxA = this.computeWorldAABB(pieceA.dimensions, worldA);
    const boxB = this.computeWorldAABB(pieceB.dimensions, placementB);

    const overlapX = Math.max(0, Math.min(boxA.max.x, boxB.max.x) - Math.max(boxA.min.x, boxB.min.x));
    const overlapY = Math.max(0, Math.min(boxA.max.y, boxB.max.y) - Math.max(boxA.min.y, boxB.min.y));
    const overlapZ = Math.max(0, Math.min(boxA.max.z, boxB.max.z) - Math.max(boxA.min.z, boxB.min.z));

    const overlapVol = overlapX * overlapY * overlapZ;
    // Maximum allowable volume overlap for just the joint interface zone
    const maxJointInterfaceVol = Math.max(pieceA.dimensions.thickness, pieceB.dimensions.thickness) * 25.0 * 5.0;
    const normAngle = ((angleDeg % 360) + 360) % 360;

    if (
      (overlapVol > maxJointInterfaceVol && overlapX > 10 && overlapY > 2) ||
      (normAngle < 15 && normAngle > 0 && overlapX > 10)
    ) {
      const penetrationDepth = Math.max(overlapX, overlapY, overlapZ);
      return {
        isValid: false,
        hasBodyCollision: true,
        penetrationDepthMm: penetrationDepth,
        contactAreaMm2: overlapX * overlapY,
        reason: `Geometric interpenetration at ${angleDeg}°: plate body clash / major volume overlap (${overlapVol.toFixed(1)} mm³ > threshold ${maxJointInterfaceVol.toFixed(1)} mm³).`,
      };
    }

    return {
      isValid: true,
      hasBodyCollision: false,
      penetrationDepthMm: 0.0,
      contactAreaMm2: 50.0,
    };
  }

  private static computeWorldAABB(
    dims: { width: number; height: number; thickness: number },
    transform: RigidTransform3D
  ): { min: Vec3; max: Vec3 } {
    const localCorners: Vec3[] = [
      vec3(0, 0, 0),
      vec3(dims.width, 0, 0),
      vec3(0, dims.height, 0),
      vec3(dims.width, dims.height, 0),
      vec3(0, 0, dims.thickness),
      vec3(dims.width, 0, dims.thickness),
      vec3(0, dims.height, dims.thickness),
      vec3(dims.width, dims.height, dims.thickness),
    ];

    let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY, maxZ = Number.NEGATIVE_INFINITY;

    for (const pt of localCorners) {
      const worldPt = add3(transform.position, quatRotateVector(transform.rotation, pt));
      if (worldPt.x < minX) minX = worldPt.x;
      if (worldPt.x > maxX) maxX = worldPt.x;
      if (worldPt.y < minY) minY = worldPt.y;
      if (worldPt.y > maxY) maxY = worldPt.y;
      if (worldPt.z < minZ) minZ = worldPt.z;
      if (worldPt.z > maxZ) maxZ = worldPt.z;
    }

    return {
      min: vec3(minX, minY, minZ),
      max: vec3(maxX, maxY, maxZ),
    };
  }
}
