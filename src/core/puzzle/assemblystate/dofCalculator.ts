/**
 * Kinematic Degree-of-Freedom (DOF) Calculator (Phase 66).
 *
 * Computes remaining unconstrained translational and rotational degrees of freedom
 * for each piece based on active connection topologies and joint behaviors.
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { Advanced3DConnection } from "../connection/types";
import type { AssemblyPieceState, PieceDOF } from "./types";
import { vec3 } from "../geometry/math3d";

export class DofCalculator {
  /**
   * Computes degrees of freedom for all pieces in the assembly.
   */
  static computeDOFs(
    pieces: readonly AssemblyPieceState[],
    activeConnections: readonly Advanced3DConnection[],
    anchoredPieceId?: ID
  ): Record<ID, PieceDOF> {
    const dofs: Record<ID, PieceDOF> = {};

    // 1. Determine anchor piece (defaults to first placed piece)
    const placedPieces = pieces.filter((p) => p.isPlaced);
    const anchorId = anchoredPieceId || placedPieces[0]?.pieceId;

    for (const p of pieces) {
      if (!p.isPlaced) {
        // Unplaced piece is unconstrained in virtual staging
        dofs[p.pieceId] = {
          pieceId: p.pieceId,
          translationalDOF: 3,
          rotationalDOF: 3,
          allowedTranslationAxes: [vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)],
          allowedRotationAxes: [vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)],
          isFullyConstrained: false,
        };
        continue;
      }

      if (p.pieceId === anchorId) {
        // Anchored base piece is completely locked in world space
        dofs[p.pieceId] = {
          pieceId: p.pieceId,
          translationalDOF: 0,
          rotationalDOF: 0,
          allowedTranslationAxes: [],
          allowedRotationAxes: [],
          isFullyConstrained: true,
        };
        continue;
      }

      // Find active connections involving this piece
      const pieceConns = activeConnections.filter(
        (c) => c.interfaceA.pieceId === p.pieceId || c.interfaceB.pieceId === p.pieceId
      );

      if (pieceConns.length === 0) {
        // Placed floating without active connections
        dofs[p.pieceId] = {
          pieceId: p.pieceId,
          translationalDOF: 3,
          rotationalDOF: 3,
          allowedTranslationAxes: [vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)],
          allowedRotationAxes: [vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)],
          isFullyConstrained: false,
        };
        continue;
      }

      // Aggregate constraints from connections
      let hasFixedOrLocking = false;
      const allowedRot: Vec3[] = [];
      const allowedTrans: Vec3[] = [];

      for (const conn of pieceConns) {
        switch (conn.behavior) {
          case "FIXED":
          case "INTERLOCK":
          case "SNAP":
            hasFixedOrLocking = true;
            break;

          case "HINGE":
            allowedRot.push(...conn.allowedRotationAxes);
            break;

          case "SLIDING":
            allowedTrans.push(...conn.allowedTranslationAxes);
            break;

          case "ROTATIONAL":
            allowedRot.push(...conn.allowedRotationAxes);
            break;

          case "CUSTOM":
            allowedRot.push(...conn.allowedRotationAxes);
            allowedTrans.push(...conn.allowedTranslationAxes);
            break;
        }
      }

      if (hasFixedOrLocking || pieceConns.length >= 2) {
        // Multi-joint or fixed joint locks the rigid body completely
        dofs[p.pieceId] = {
          pieceId: p.pieceId,
          translationalDOF: 0,
          rotationalDOF: 0,
          allowedTranslationAxes: [],
          allowedRotationAxes: [],
          isFullyConstrained: true,
        };
      } else {
        dofs[p.pieceId] = {
          pieceId: p.pieceId,
          translationalDOF: allowedTrans.length,
          rotationalDOF: allowedRot.length,
          allowedTranslationAxes: allowedTrans,
          allowedRotationAxes: allowedRot,
          isFullyConstrained: allowedTrans.length === 0 && allowedRot.length === 0,
        };
      }
    }

    return dofs;
  }
}
