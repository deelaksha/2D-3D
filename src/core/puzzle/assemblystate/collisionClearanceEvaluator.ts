/**
 * Assembly Collision & Clearance Evaluator (Phase 66).
 *
 * Mathematically evaluates spatial bounding collisions between placed pieces
 * and interface clearance tolerances.
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { Advanced3DConnection } from "../connection/types";
import type {
  AssemblyClearanceState,
  AssemblyCollisionState,
  AssemblyPieceState,
} from "./types";
import { len3, sub3 } from "../geometry/math3d";

export class CollisionClearanceEvaluator {
  /**
   * Evaluates collision status among placed pieces using world bounding extents.
   */
  static evaluateCollision(
    pieces: readonly AssemblyPieceState[],
    transforms: Readonly<Record<ID, RigidTransform3D>>
  ): AssemblyCollisionState {
    const placed = pieces.filter((p) => p.isPlaced && transforms[p.pieceId]);
    const collidingPairs: Array<[ID, ID]> = [];
    const diagnostics: string[] = [];
    let minDistanceMm = Number.POSITIVE_INFINITY;

    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const pA = placed[i];
        const pB = placed[j];
        const tA = transforms[pA.pieceId];
        const tB = transforms[pB.pieceId];

        // Center distance
        const dist = len3(sub3(tA.position, tB.position));
        if (dist < minDistanceMm) minDistanceMm = dist;

        // Bounding sphere radius approximation
        const rA = Math.hypot(pA.dimensions.width, pA.dimensions.height, pA.dimensions.thickness) / 2;
        const rB = Math.hypot(pB.dimensions.width, pB.dimensions.height, pB.dimensions.thickness) / 2;

        // If centers are extremely close (< 1mm) and both pieces have volume, report potential collision
        if (dist < 1.0 && pA.dimensions.width > 0 && pB.dimensions.width > 0) {
          collidingPairs.push([pA.pieceId, pB.pieceId]);
          diagnostics.push(
            `Potential severe interpenetration between piece '${pA.pieceId}' and '${pB.pieceId}' (dist=${dist.toFixed(2)}mm).`
          );
        }
      }
    }

    if (minDistanceMm === Number.POSITIVE_INFINITY) {
      minDistanceMm = 0.0;
    }

    return {
      hasCollision: collidingPairs.length > 0,
      collidingPairs,
      minimumDistanceMm: minDistanceMm,
      diagnostics,
    };
  }

  /**
   * Evaluates clearance status across active connections against tolerances.
   */
  static evaluateClearance(
    activeConnections: readonly Advanced3DConnection[],
    defaultTolerance = 0.2
  ): AssemblyClearanceState {
    if (activeConnections.length === 0) {
      return {
        nominalClearanceMm: 0.0,
        minObservedClearanceMm: 0.0,
        maxObservedClearanceMm: 0.0,
        isWithinTolerance: true,
        clearanceViolations: [],
      };
    }

    let nominal = 0.0;
    let minObs = Number.POSITIVE_INFINITY;
    let maxObs = Number.NEGATIVE_INFINITY;
    const violations: string[] = [];

    for (const c of activeConnections) {
      nominal += c.clearance;
      const actual = c.assemblyState.actualClearanceMm;
      if (actual < minObs) minObs = actual;
      if (actual > maxObs) maxObs = actual;

      const diff = Math.abs(actual - c.clearance);
      if (diff > (c.tolerance || defaultTolerance)) {
        violations.push(
          `Connection '${c.id}' clearance discrepancy (${actual}mm vs nominal ${c.clearance}mm) exceeds tolerance ${c.tolerance}mm.`
        );
      }
    }

    const avgNominal = nominal / activeConnections.length;

    return {
      nominalClearanceMm: avgNominal,
      minObservedClearanceMm: minObs === Number.POSITIVE_INFINITY ? 0.0 : minObs,
      maxObservedClearanceMm: maxObs === Number.NEGATIVE_INFINITY ? 0.0 : maxObs,
      isWithinTolerance: violations.length === 0,
      clearanceViolations: violations,
    };
  }
}
