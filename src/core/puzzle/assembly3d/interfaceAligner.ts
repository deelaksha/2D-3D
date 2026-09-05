/**
 * 3D Interface Aligner & Spatial Mating Solver (Phase 87 - Steps 4, 5 & 6).
 *
 * Mathematically aligns complementary interface ports at arbitrary 3D angles
 * (30°, 45°, 60°, 90°, etc.) applying rigid-body transforms strictly without
 * altering underlying piece geometry.
 */

import type { ID, Vec3 } from "@/core/model/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import { alignInterfaces, composeTransforms, inverseTransform, localToWorld } from "../framesystem/transformEngine";
import type { GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import type { DesiredAssemblyConfiguration } from "./types";
import type { CanonicalInterface } from "../canonical/types";

export interface MatingAlignmentResult {
  targetWorldTransform: RigidTransform3D;
  relativeTransform: RigidTransform3D;
  appliedJoiningAngleDeg: number;
  alignmentErrorMm: number;
}

export class InterfaceAligner {
  /**
   * Computes the exact 3D world pose of a target piece to mate with an already placed source piece.
   */
  public static alignTargetPiece(
    sourcePiece: GeneratedPiece3D,
    sourceWorldTransform: RigidTransform3D,
    targetPiece: GeneratedPiece3D,
    connection: RetainedConnection3D,
    desiredConfig?: DesiredAssemblyConfiguration
  ): MatingAlignmentResult {
    // 1. Find interfaces for this connection
    const isSourcePieceA = connection.pieceAId === sourcePiece.pieceId;
    const sourceInterfaceId = isSourcePieceA ? connection.interfaceAId : connection.interfaceBId;
    const targetInterfaceId = isSourcePieceA ? connection.interfaceBId : connection.interfaceAId;

    const sourceIface = sourcePiece.interfaces.find((i) => i.id === sourceInterfaceId);
    const targetIface = targetPiece.interfaces.find((i) => i.id === targetInterfaceId);

    if (!sourceIface || !targetIface) {
      throw new Error(
        `Failed to find interface ports for connection '${connection.connectionId}' ` +
          `between '${sourcePiece.pieceId}' and '${targetPiece.pieceId}'.`
      );
    }

    // 2. Resolve joining angle according to precedence:
    // Configuration override -> Connection parameters/constraints -> Generation strategy -> Default
    const joiningAngleDeg = this.resolveJoiningAngle(
      connection,
      sourcePiece.pieceId,
      targetPiece.pieceId,
      desiredConfig
    );

    // 3. Align interfaces using exact orthonormal frame math
    const targetWorldTransform = alignInterfaces(
      sourceIface.localFrame,
      sourceWorldTransform,
      targetIface.localFrame,
      joiningAngleDeg
    );

    // 4. Compute relative transform: T_rel = T_source^-1 * T_target
    const invSource = inverseTransform(sourceWorldTransform);
    const relativeTransform = composeTransforms(invSource, targetWorldTransform);

    // 5. Measure world-space alignment accuracy between interface origins
    const sourceWorldOrigin = localToWorld(sourceWorldTransform, sourceIface.localFrame.origin);
    const targetWorldOrigin = localToWorld(targetWorldTransform, targetIface.localFrame.origin);

    const alignmentErrorMm = Math.hypot(
      sourceWorldOrigin.x - targetWorldOrigin.x,
      sourceWorldOrigin.y - targetWorldOrigin.y,
      sourceWorldOrigin.z - targetWorldOrigin.z
    );

    return {
      targetWorldTransform,
      relativeTransform,
      appliedJoiningAngleDeg: joiningAngleDeg,
      alignmentErrorMm: Number(alignmentErrorMm.toFixed(4)),
    };
  }

  /**
   * Resolves the target joining angle following strict priority rules.
   */
  public static resolveJoiningAngle(
    connection: RetainedConnection3D,
    pieceAId: ID,
    pieceBId: ID,
    desiredConfig?: DesiredAssemblyConfiguration
  ): number {
    // Priority 1: Explicit angle override by connection ID
    if (desiredConfig?.angleOverrides) {
      if (desiredConfig.angleOverrides[connection.connectionId] !== undefined) {
        return desiredConfig.angleOverrides[connection.connectionId];
      }

      // Explicit angle override by piece pair key
      const pairKey1 = `${pieceAId}_${pieceBId}`;
      const pairKey2 = `${pieceBId}_${pieceAId}`;
      if (desiredConfig.angleOverrides[pairKey1] !== undefined) {
        return desiredConfig.angleOverrides[pairKey1];
      }
      if (desiredConfig.angleOverrides[pairKey2] !== undefined) {
        return desiredConfig.angleOverrides[pairKey2];
      }
    }

    // Priority 2: Generation strategy rules
    if (desiredConfig?.generationStrategy) {
      switch (desiredConfig.generationStrategy) {
        case "box_enclosure":
          return 90.0;
        case "prism":
          return 60.0;
        case "angled_facet":
          return 45.0;
        case "planar":
          return 180.0;
      }
    }

    // Priority 3: Connection constraint / connector parameters
    if (connection.parameters?.joiningAngleDeg !== undefined) {
      return connection.parameters.joiningAngleDeg;
    }
    if (connection.allowedAngleDeg !== undefined) {
      return connection.allowedAngleDeg;
    }

    // Priority 4: Desired configuration default angle
    if (desiredConfig?.defaultJoiningAngleDeg !== undefined) {
      return desiredConfig.defaultJoiningAngleDeg;
    }

    // Default: 180° for planar, 90° for notches
    return connection.connectorType === "notch" ? 90.0 : 180.0;
  }
}
