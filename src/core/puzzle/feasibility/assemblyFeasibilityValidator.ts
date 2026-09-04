/**
 * Assembly-Feasibility Validator (Phase 68 Baseline).
 *
 * Deterministic motion-planning engine that evaluates whether a customer can
 * physically move pieces into their intended 3D assembly configuration without
 * impossible penetration, blocked connections, or subassembly interference.
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type {
  AssemblyFailureReason,
  AssemblyFeasibilityQuery,
  AssemblyFeasibilityResult,
  AssemblyPath,
  AssemblyPathStep,
  FailureReasonCode,
  FeasibilityPieceGeometry,
} from "./types";
import { uid } from "@/core/model/ids";
import { dot3, len3, normalize3 } from "../geometry/math3d";
import { CollisionSweeper } from "./collisionSweeper";
import { TrajectoryPlanner } from "./trajectoryPlanner";

export class AssemblyFeasibilityValidator {
  /**
   * Evaluates complete assembly feasibility for the given query.
   */
  static evaluateFeasibility(query: AssemblyFeasibilityQuery): AssemblyFeasibilityResult {
    const {
      pieces,
      targetConfiguration,
      connections,
      prescribedOrder,
      options = {},
    } = query;

    const diagnostics: string[] = [];
    const failureReasons: AssemblyFailureReason[] = [];

    const standoffMm = options.standoffDistanceMm ?? 30.0;
    const stepsPerSegment = options.interpolationSteps ?? 10;

    // ─────────────────────────────────────────────────────────────
    // STAGE 1: VALIDATE FINAL TARGET CONFIGURATION
    // ─────────────────────────────────────────────────────────────
    const targetValidation = this.validateTargetConfiguration(pieces, targetConfiguration);
    if (!targetValidation.isValid) {
      failureReasons.push(...targetValidation.failures);
      diagnostics.push(...targetValidation.diagnostics);
      return {
        isFeasible: false,
        status: "INFEASIBLE",
        failureReasons,
        assembledPieces: [],
        remainingPieces: pieces.map((p) => p.pieceId),
        diagnostics,
      };
    }
    diagnostics.push("[Stage 1 Passed] Final target configuration is geometrically valid.");

    // ─────────────────────────────────────────────────────────────
    // STAGE 2: DETERMINE ASSEMBLY ORDER
    // ─────────────────────────────────────────────────────────────
    const order = prescribedOrder && prescribedOrder.length > 0
      ? prescribedOrder
      : this.deriveAssemblyOrder(pieces, connections);

    diagnostics.push(`[Stage 2 Order] Assembly order: ${order.join(" -> ")}.`);

    // ─────────────────────────────────────────────────────────────
    // STAGE 3: SIMULATE MOTION PATHS & COLLISION SWEEPS
    // ─────────────────────────────────────────────────────────────
    const assembledPieces: FeasibilityPieceGeometry[] = [];
    const assembledTransforms: Record<ID, RigidTransform3D> = {};
    const pathSteps: AssemblyPathStep[] = [];
    let totalPathLength = 0;
    let totalSweptRotation = 0;

    for (let stepIdx = 0; stepIdx < order.length; stepIdx++) {
      const pieceId = order[stepIdx];
      const piece = pieces.find((p) => p.pieceId === pieceId);
      if (!piece) {
        failureReasons.push({
          code: "INVALID_FINAL_CONFIGURATION",
          message: `Piece '${pieceId}' in assembly order is not present in piece geometry list.`,
          pieceId,
          stepIndex: stepIdx,
        });
        break;
      }

      const targetTransform = targetConfiguration[pieceId];
      if (!targetTransform) {
        failureReasons.push({
          code: "INVALID_FINAL_CONFIGURATION",
          message: `Piece '${pieceId}' has no defined target transform.`,
          pieceId,
          stepIndex: stepIdx,
        });
        break;
      }

      // Base piece (first piece) is anchored
      if (assembledPieces.length === 0) {
        assembledPieces.push(piece);
        assembledTransforms[pieceId] = targetTransform;
        pathSteps.push({
          stepIndex: 1,
          pieceId,
          actionType: "APPROACH",
          startTransform: targetTransform,
          targetTransform,
          waypoints: [targetTransform],
          travelDistanceMm: 0,
          sweptRotationDeg: 0,
          clearanceMarginMm: 10.0,
        });
        continue;
      }

      // Find active connections linking this piece to currently assembled subassembly
      const activeConns = connections.filter(
        (c) =>
          (c.interfaceA.pieceId === pieceId && assembledPieces.some((ap) => ap.pieceId === c.interfaceB.pieceId)) ||
          (c.interfaceB.pieceId === pieceId && assembledPieces.some((ap) => ap.pieceId === c.interfaceA.pieceId))
      );

      // Connection constraints & direction checks
      let effectiveInsertionVec = { x: 0, y: -1, z: 0 };
      if (activeConns.length > 0) {
        const conn = activeConns[0];
        effectiveInsertionVec = conn.insertionDirection;

        // Check A: Impossible insertion direction (moving away from receiving normal)
        const receivingNormal = conn.localFrames.frameA.normal;
        const approachDot = dot3(effectiveInsertionVec, receivingNormal);
        if (approachDot > 0.5) {
          const reason: AssemblyFailureReason = {
            code: "IMPOSSIBLE_INSERTION_DIRECTION",
            message: `Impossible insertion direction on connection '${conn.id}': vector points away from receiver normal (dot=${approachDot.toFixed(2)}).`,
            pieceId,
            connectionId: conn.id,
            stepIndex: stepIdx + 1,
          };
          failureReasons.push(reason);
          diagnostics.push(`[Stage 3 Error] ${reason.message}`);
          break;
        }

        // Check B: Impossible rotation / angle limit violation
        if (conn.angleLimits) {
          const nominal = conn.angleLimits.nominalAngleDeg;
          if (nominal < conn.angleLimits.minAngleDeg || nominal > conn.angleLimits.maxAngleDeg) {
            const reason: AssemblyFailureReason = {
              code: "IMPOSSIBLE_ROTATION",
              message: `Impossible rotation on connection '${conn.id}': angle ${nominal}° outside allowable range [${conn.angleLimits.minAngleDeg}°, ${conn.angleLimits.maxAngleDeg}°].`,
              pieceId,
              connectionId: conn.id,
              stepIndex: stepIdx + 1,
            };
            failureReasons.push(reason);
            diagnostics.push(`[Stage 3 Error] ${reason.message}`);
            break;
          }
        }
      }

      // Generate insertion trajectory
      const pathData = TrajectoryPlanner.generateInsertionPath(
        targetTransform,
        effectiveInsertionVec,
        standoffMm,
        stepsPerSegment
      );

      // Sweep waypoints from standoff (index 0) up to just before final touch (index length - 2)
      let minClearance = Number.POSITIVE_INFINITY;
      let pathCollided = false;

      for (let wIdx = 0; wIdx < pathData.waypoints.length - 1; wIdx++) {
        const wp = pathData.waypoints[wIdx];
        const sweepRes = CollisionSweeper.checkWaypointAgainstSubassembly(
          piece,
          wp,
          assembledPieces,
          assembledTransforms,
          false
        );

        if (sweepRes.hasCollision) {
          pathCollided = true;
          const failureCode: FailureReasonCode =
            wIdx === 0
              ? "COLLISION_DURING_MOVEMENT"
              : "INTERFERENCE_FROM_ASSEMBLED_PIECES";

          const reason: AssemblyFailureReason = {
            code: failureCode,
            message: `${failureCode}: Piece '${pieceId}' collided with assembled piece '${sweepRes.conflictingPieceId}' at waypoint ${wIdx}/${pathData.waypoints.length} (${sweepRes.reason || ""}).`,
            pieceId,
            conflictingPieceId: sweepRes.conflictingPieceId,
            stepIndex: stepIdx + 1,
            waypointIndex: wIdx,
            penetrationDepthMm: sweepRes.penetrationDepthMm,
            location: sweepRes.location,
          };
          failureReasons.push(reason);
          diagnostics.push(`[Stage 3 Error] ${reason.message}`);
          break;
        }
      }

      if (pathCollided) {
        break;
      }

      // Step successfully verified!
      assembledPieces.push(piece);
      assembledTransforms[pieceId] = targetTransform;
      totalPathLength += pathData.travelDistanceMm;
      totalSweptRotation += pathData.sweptRotationDeg;

      pathSteps.push({
        stepIndex: stepIdx + 1,
        pieceId,
        actionType: "INSERT",
        startTransform: pathData.startTransform,
        targetTransform,
        waypoints: pathData.waypoints,
        travelDistanceMm: pathData.travelDistanceMm,
        sweptRotationDeg: pathData.sweptRotationDeg,
        clearanceMarginMm: minClearance === Number.POSITIVE_INFINITY ? 0.2 : minClearance,
      });

      diagnostics.push(`[Step ${stepIdx + 1} Success] Piece '${pieceId}' moved along collision-free insertion path.`);
    }

    const isFeasible = failureReasons.length === 0 && assembledPieces.length === pieces.length;
    const remainingPieces = pieces
      .map((p) => p.pieceId)
      .filter((id) => !assembledPieces.some((ap) => ap.pieceId === id));

    const path: AssemblyPath | undefined = isFeasible
      ? {
          pathId: uid("path_"),
          isFeasible: true,
          steps: pathSteps,
          totalLengthMm: totalPathLength,
          totalRotationDeg: totalSweptRotation,
          collisionFree: true,
          assembledPieceOrder: assembledPieces.map((p) => p.pieceId),
        }
      : undefined;

    return {
      isFeasible,
      status: isFeasible ? "FEASIBLE" : "INFEASIBLE",
      path,
      failureReasons,
      assembledPieces: assembledPieces.map((p) => p.pieceId),
      remainingPieces,
      diagnostics,
    };
  }

  /* ───────────────────────────────────────────────────────────── */
  /* Internal Verification Helpers                                  */
  /* ───────────────────────────────────────────────────────────── */

  private static validateTargetConfiguration(
    pieces: FeasibilityPieceGeometry[],
    targets: Record<ID, RigidTransform3D>
  ): { isValid: boolean; failures: AssemblyFailureReason[]; diagnostics: string[] } {
    const failures: AssemblyFailureReason[] = [];
    const diagnostics: string[] = [];

    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const pA = pieces[i];
        const pB = pieces[j];
        const tA = targets[pA.pieceId];
        const tB = targets[pB.pieceId];

        if (!tA || !tB) continue;

        // Check resting pose collision (marked as intentional joint mated state)
        const coll = CollisionSweeper.checkPairCollision(pA, tA, pB, tB, true);
        if (coll.hasCollision) {
          failures.push({
            code: "INVALID_FINAL_CONFIGURATION",
            message: `INVALID_FINAL_CONFIGURATION: Seated target poses of piece '${pA.pieceId}' and '${pB.pieceId}' penetrate each other (${coll.penetrationDepthMm.toFixed(2)}mm).`,
            pieceId: pA.pieceId,
            conflictingPieceId: pB.pieceId,
            penetrationDepthMm: coll.penetrationDepthMm,
            location: coll.location,
          });
          diagnostics.push(
            `Target collision between '${pA.pieceId}' and '${pB.pieceId}' (${coll.penetrationDepthMm.toFixed(2)}mm).`
          );
        }
      }
    }

    return {
      isValid: failures.length === 0,
      failures,
      diagnostics,
    };
  }

  private static deriveAssemblyOrder(
    pieces: FeasibilityPieceGeometry[],
    connections: AssemblyFeasibilityQuery["connections"]
  ): ID[] {
    if (pieces.length === 0) return [];
    // Default to piece list order
    return pieces.map((p) => p.pieceId);
  }
}
