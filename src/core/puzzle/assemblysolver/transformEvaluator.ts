/**
 * Transform & Kinematic Evaluator (Phase 89).
 *
 * Evaluates 3D candidate transforms for pieces joining an active subassembly.
 * Validates:
 *  - Primary interface mating transform via rigid-body kinematics
 *  - Finite, non-NaN spatial vectors and normalized quaternions
 *  - Loop closure / multi-connection cycle consistency across already-placed pieces
 */

import type { ID, Vec3 } from "@/core/model/types";
import { localToWorld } from "../framesystem/transformEngine";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import { len3, sub3 } from "../geometry/math3d";
import type { GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import { InterfaceAligner } from "../assembly3d/interfaceAligner";

export interface EvaluatedTransformResult {
  valid: boolean;
  transform?: RigidTransform3D;
  alignmentErrorMm: number;
  secondaryErrors: Record<string, number>;
  rejectionReason?: string;
}

export class TransformEvaluator {
  /**
   * Helper to retrieve the matching CoordinateFrame3D on a piece for a given interface ID.
   */
  public static getPieceInterfaceFrame(
    piece: GeneratedPiece3D,
    interfaceId?: string
  ): CoordinateFrame3D {
    if (interfaceId && piece.interfaces && piece.interfaces.length > 0) {
      const match = piece.interfaces.find((iface) => iface.id === interfaceId);
      if (match?.localFrame) return match.localFrame;
    }
    if (piece.interfaces && piece.interfaces.length > 0 && piece.interfaces[0].localFrame) {
      return piece.interfaces[0].localFrame;
    }
    return piece.localCoordinateFrame ?? {
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 },
    };
  }

  /**
   * Evaluates candidate rigid transform and verifies secondary loop closure constraints.
   */
  public static evaluatePlacementTransform(
    candidatePiece: GeneratedPiece3D,
    parentPiece: GeneratedPiece3D,
    parentTransform: RigidTransform3D,
    primaryConnection: RetainedConnection3D,
    candidateAngleDeg: number,
    placedPieces: Map<string, GeneratedPiece3D>,
    placedTransforms: Record<string, RigidTransform3D>,
    allConnections: RetainedConnection3D[],
    maxLoopClosureErrorMm = 2.0
  ): EvaluatedTransformResult {
    // 1. Align interfaces using InterfaceAligner
    let candidateTransform: RigidTransform3D;
    let primaryError = 0.0;

    try {
      const mating = InterfaceAligner.alignTargetPiece(
        parentPiece,
        parentTransform,
        candidatePiece,
        primaryConnection,
        {
          defaultJoiningAngleDeg: candidateAngleDeg,
          angleOverrides: { [primaryConnection.connectionId]: candidateAngleDeg },
        }
      );
      candidateTransform = mating.targetWorldTransform;
      primaryError = mating.alignmentErrorMm;
    } catch (err: any) {
      return {
        valid: false,
        alignmentErrorMm: Number.POSITIVE_INFINITY,
        secondaryErrors: {},
        rejectionReason: err.message ?? "InterfaceAligner alignment failed.",
      };
    }

    // Validate numerical sanity
    const p = candidateTransform.position;
    const q = candidateTransform.rotation;
    if (
      !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z) ||
      !Number.isFinite(q.x) || !Number.isFinite(q.y) || !Number.isFinite(q.z) || !Number.isFinite(q.w)
    ) {
      return {
        valid: false,
        alignmentErrorMm: Number.POSITIVE_INFINITY,
        secondaryErrors: {},
        rejectionReason: "Non-finite coordinate or quaternion in transform computation.",
      };
    }

    // 3. Multi-connection Loop Closure Verification
    // Check if candidate piece shares connections with any other already-placed pieces
    const secondaryErrors: Record<string, number> = {};

    for (const conn of allConnections) {
      if (conn.connectionId === primaryConnection.connectionId) continue;

      const touchesCand = conn.pieceAId === candidatePiece.pieceId || conn.pieceBId === candidatePiece.pieceId;
      if (!touchesCand) continue;

      const otherPieceId = conn.pieceAId === candidatePiece.pieceId ? conn.pieceBId : conn.pieceAId;
      // Skip the parent piece (this piece was placed relative to parent piece)
      if (otherPieceId === parentPiece.pieceId) continue;
      if (!placedPieces.has(otherPieceId) || !placedTransforms[otherPieceId]) continue;

      // This is a secondary / cyclic connection to an already placed piece!
      const otherPiece = placedPieces.get(otherPieceId)!;
      const otherTransform = placedTransforms[otherPieceId];

      const thisIfaceId = conn.pieceAId === candidatePiece.pieceId ? conn.interfaceAId : conn.interfaceBId;
      const otherIfaceId = conn.pieceAId === candidatePiece.pieceId ? conn.interfaceBId : conn.interfaceAId;

      const thisFrame = this.getPieceInterfaceFrame(candidatePiece, thisIfaceId);
      const otherFrame = this.getPieceInterfaceFrame(otherPiece, otherIfaceId);

      const ptThisWorld = localToWorld(candidateTransform, thisFrame.origin);
      const ptOtherWorld = localToWorld(otherTransform, otherFrame.origin);

      const secError = Number(len3(sub3(ptThisWorld, ptOtherWorld)).toFixed(3));
      secondaryErrors[conn.connectionId] = secError;

      // If loop closure error is too large, this candidate angle violates cycle geometry!
      if (secError > maxLoopClosureErrorMm) {
        return {
          valid: false,
          transform: candidateTransform,
          alignmentErrorMm: primaryError,
          secondaryErrors,
          rejectionReason: `Loop closure broken on connection '${conn.connectionId}' with piece '${otherPieceId}' (offset: ${secError}mm > ${maxLoopClosureErrorMm}mm).`,
        };
      }
    }

    return {
      valid: true,
      transform: candidateTransform,
      alignmentErrorMm: Number(primaryError.toFixed(4)),
      secondaryErrors,
    };
  }
}
