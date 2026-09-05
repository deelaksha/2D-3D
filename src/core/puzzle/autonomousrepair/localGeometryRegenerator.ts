/**
 * Local Geometry Regenerator (Phase 91).
 *
 * Implements non-destructive, local-first parametric repair:
 * When connector C07 fails:
 *   - Adjusts C07 parameters (slot width, clearance, angle, etc.)
 *   - Regenerates only the affected interfaces on piece A and piece B
 *   - Updates piece profiles and solids for the affected pieces locally
 *   - Leaves all other pieces completely untouched.
 *
 * Strictly avoids raw mesh editing.
 */

import type { ConvertedPuzzle3D, GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import { SolidExtruder } from "../piece3d/solidExtruder";
import { InterfaceAligner } from "../assembly3d/interfaceAligner";
import type { RigidTransform3D } from "../framesystem/types";
import type { ParameterModification } from "./types";

export class LocalGeometryRegenerator {
  /**
   * Applies modifications locally to the affected connection and its mating pieces.
   */
  public static applyLocalRepair(
    puzzle: ConvertedPuzzle3D,
    modifications: ParameterModification[],
    pieceTransforms: Record<string, RigidTransform3D>,
    appliedAngles: Record<string, number>
  ): {
    repairedPuzzle: ConvertedPuzzle3D;
    updatedTransforms: Record<string, RigidTransform3D>;
    updatedAngles: Record<string, number>;
  } {
    // Clone puzzle structure shallowly with deep piece/connection copies for modified items
    const updatedConnections: RetainedConnection3D[] = puzzle.connections.map((c) => ({
      ...c,
      parameters: { ...c.parameters },
    }));

    const updatedPieces: GeneratedPiece3D[] = puzzle.pieces.map((p) => ({
      ...p,
      interfaces: p.interfaces.map((i) => ({
        ...i,
        profile: i.profile ? { ...i.profile } : undefined,
        localFrame: { ...i.localFrame },
      })),
      profile: {
        ...p.profile,
        localBounds: { ...p.profile.localBounds },
        localVertices: [...p.profile.localVertices],
      },
      connectorParameters: [...p.connectorParameters],
    }));

    const updatedTransforms: Record<string, RigidTransform3D> = { ...pieceTransforms };
    const updatedAngles: Record<string, number> = { ...appliedAngles };

    const affectedConnectionIds = new Set<string>();
    const affectedPieceIds = new Set<string>();

    for (const mod of modifications) {
      // 1. Connection-level modification
      const targetConn = updatedConnections.find((c) => c.connectionId === mod.entityId);
      if (targetConn) {
        affectedConnectionIds.add(targetConn.connectionId);
        affectedPieceIds.add(targetConn.pieceAId);
        affectedPieceIds.add(targetConn.pieceBId);

        if (mod.parameterName === "clearanceMm") {
          targetConn.clearanceMm = Number(mod.newValue);
          if (targetConn.parameters) {
            targetConn.parameters.clearance = Number(mod.newValue);
          }
        } else if (mod.parameterName === "slotWidth") {
          if (targetConn.parameters) {
            targetConn.parameters.slotWidth = Number(mod.newValue);
          }
        } else if (mod.parameterName === "tabWidth") {
          if (targetConn.parameters) {
            targetConn.parameters.tabWidth = Number(mod.newValue);
          }
        } else if (mod.parameterName === "tabDepth") {
          if (targetConn.parameters) {
            targetConn.parameters.tabDepth = Number(mod.newValue);
          }
        } else if (mod.parameterName === "slotDepth") {
          if (targetConn.parameters) {
            targetConn.parameters.slotDepth = Number(mod.newValue);
          }
        } else if (mod.parameterName === "joiningAngleDeg") {
          const angle = Number(mod.newValue);
          targetConn.allowedAngleDeg = angle;
          if (targetConn.parameters) {
            targetConn.parameters.joiningAngleDeg = angle;
          }
          updatedAngles[targetConn.connectionId] = angle;
        } else if (mod.parameterName === "connectorType") {
          targetConn.connectorType = mod.newValue as any;
        } else if (mod.parameterName === "interfaceAId") {
          targetConn.interfaceAId = String(mod.newValue);
        } else if (mod.parameterName === "interfaceBId") {
          targetConn.interfaceBId = String(mod.newValue);
        }
      }

      // 2. Piece-level modification
      const targetPiece = updatedPieces.find((p) => p.pieceId === mod.entityId);
      if (targetPiece) {
        affectedPieceIds.add(targetPiece.pieceId);

        if (mod.parameterName === "thickness") {
          targetPiece.thickness = Number(mod.newValue);
          // Re-extrude solid representation with new thickness
          targetPiece.solid = SolidExtruder.extrudeToSolid(
            targetPiece.pieceId,
            targetPiece.profile,
            targetPiece.thickness,
            targetPiece.material?.id ?? "cardboard_stock",
            0.68
          );
        } else if (mod.parameterName === "isClosed") {
          targetPiece.profile.isClosed = Boolean(mod.newValue);
        }
      }
    }

    // Synchronize interface profiles on affected pieces
    for (const connId of affectedConnectionIds) {
      const conn = updatedConnections.find((c) => c.connectionId === connId);
      if (!conn) continue;

      const pA = updatedPieces.find((p) => p.pieceId === conn.pieceAId);
      const pB = updatedPieces.find((p) => p.pieceId === conn.pieceBId);

      if (pA) {
        const ifaceA = pA.interfaces.find((i) => i.id === conn.interfaceAId);
        if (ifaceA && ifaceA.profile) {
          if (conn.parameters?.tabWidth) ifaceA.profile.width = conn.parameters.tabWidth;
          if (conn.parameters?.tabDepth) ifaceA.profile.depth = conn.parameters.tabDepth;
          if (conn.clearanceMm) {
            ifaceA.profile.clearance = conn.clearanceMm;
            ifaceA.tolerance = conn.clearanceMm;
          }
        }
      }

      if (pB) {
        const ifaceB = pB.interfaces.find((i) => i.id === conn.interfaceBId);
        if (ifaceB && ifaceB.profile) {
          if (conn.parameters?.slotWidth) ifaceB.profile.width = conn.parameters.slotWidth;
          if (conn.parameters?.slotDepth) ifaceB.profile.depth = conn.parameters.slotDepth;
          if (conn.clearanceMm) {
            ifaceB.profile.clearance = conn.clearanceMm;
            ifaceB.tolerance = conn.clearanceMm;
          }
        }
      }

      // Re-align affected target piece transform if source piece is placed
      if (pA && pB && updatedTransforms[pA.pieceId]) {
        const angle = updatedAngles[conn.connectionId] ?? conn.allowedAngleDeg ?? 180.0;
        try {
          const mating = InterfaceAligner.alignTargetPiece(
            pA,
            updatedTransforms[pA.pieceId],
            pB,
            conn,
            {
              defaultJoiningAngleDeg: angle,
              angleOverrides: { [conn.connectionId]: angle },
            }
          );
          updatedTransforms[pB.pieceId] = mating.targetWorldTransform;
        } catch {
          // If alignment fails during partial update, assembly solver will handle full re-assembly
        }
      }
    }

    const repairedPuzzle: ConvertedPuzzle3D = {
      ...puzzle,
      pieces: updatedPieces,
      connections: updatedConnections,
    };

    return {
      repairedPuzzle,
      updatedTransforms,
      updatedAngles,
    };
  }
}
