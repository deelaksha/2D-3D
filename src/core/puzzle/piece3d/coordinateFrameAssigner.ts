/**
 * Coordinate Frame Assigner (Phase 86 - Stage 4).
 *
 * Assigns canonical orthonormal local coordinate frames to each 3D piece
 * and translates interface local frames into piece-local space without
 * assigning global assembly transforms.
 */

import type { Vec3 } from "@/core/model/types";
import type { CoordinateFrame3D } from "../framesystem/types";
import type { CanonicalInterface } from "../canonical/types";
import type { GeneratedConnection2D, GeneratedPiece2D } from "../automatic2d/types";
import type { ExtrudablePieceProfile, GeneratedPiece3D } from "./types";
import type { SolidRepresentation3D } from "../solid3d/types";

export class CoordinateFrameAssigner {
  /**
   * Constructs the complete GeneratedPiece3D object with assigned local frame and retained metadata.
   */
  public static assignPiece3D(
    piece2D: GeneratedPiece2D,
    profile: ExtrudablePieceProfile,
    solid: SolidRepresentation3D,
    allConnections: GeneratedConnection2D[]
  ): GeneratedPiece3D {
    // 1. Orthonormal local coordinate frame for the piece
    // Strictly independent in local space (no final assembly position assigned)
    const localCoordinateFrame: CoordinateFrame3D = {
      origin: { x: 0, y: 0, z: 0 },
      tangent: { x: 1, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      binormal: { x: 0, y: 0, z: 1 },
    };

    // 2. Extract retained interface IDs and connector IDs
    const interfaceIds = piece2D.interfaces.map((iface) => iface.id);

    const connectorIds = allConnections
      .filter((c) => c.pieceA === piece2D.id || c.pieceB === piece2D.id)
      .map((c) => c.id);

    // 3. Transform interface local frames to piece-local coordinates
    const localInterfaces: CanonicalInterface[] = piece2D.interfaces.map((iface) => {
      const orig = iface.localFrame.origin;
      const localOrigin: Vec3 = {
        x: Number((orig.x - profile.centroid.x).toFixed(4)),
        y: Number((orig.y - profile.centroid.y).toFixed(4)),
        z: orig.z ?? 0,
      };

      return {
        ...iface,
        localFrame: {
          ...iface.localFrame,
          origin: localOrigin,
        },
      };
    });

    return {
      pieceId: piece2D.id,
      name: piece2D.name,
      interfaceIds,
      connectorIds,
      material: { ...piece2D.material },
      thickness: piece2D.thickness,
      localCoordinateFrame,
      profile,
      solid,
      interfaces: localInterfaces,
      connectorParameters: [...piece2D.connectorParameters],
      sheetCentroid: profile.centroid,
      neighborPieceIds: [...piece2D.neighborPieceIds],
      isBorderPiece: piece2D.isBorderPiece,
    };
  }
}
