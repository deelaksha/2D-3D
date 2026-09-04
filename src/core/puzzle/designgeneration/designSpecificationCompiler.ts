/**
 * Design Specification Compiler (Phase 71).
 *
 * Deterministically compiles a structured ParametricDesignSpecification into
 * a full CanonicalPuzzle with exact 2D boundaries, interfaces, connections,
 * and 3D coordinate frames.
 */
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { CanonicalInterface, CanonicalPiece, CanonicalPuzzle } from "../canonical/types";
import { createEmptyCanonicalPuzzle } from "../canonical/defaults";
import { vec3 } from "../geometry/math3d";
import { uid } from "@/core/model/ids";

export class DesignSpecificationCompiler {
  /**
   * Deterministically compiles a ParametricDesignSpecification into a CanonicalPuzzle.
   */
  public static compile(spec: ParametricDesignSpecification): CanonicalPuzzle {
    const puzzle = createEmptyCanonicalPuzzle(`AI Design ${spec.specificationId}`);
    puzzle.metadata.description = `Compiled from specification ${spec.specificationId}`;
    puzzle.metadata.difficulty = spec.difficulty.level;

    const N = Math.max(2, spec.piece_count);
    const W = spec.overall_size.widthMm;
    const H = spec.overall_size.heightMm;
    const D = spec.overall_size.depthMm;
    const T = spec.material.stockThicknessMm;
    const jointType = spec.connection_preferences.defaultType || "tab_slot";
    const joiningAngle = spec.connection_preferences.preferredJoiningAngleDeg ?? 90.0;
    const clearance = (spec.connection_preferences as any)?.clearance ?? 0.15;

    // Piece 1: Base Plate
    const baseId = `piece_base_${uid()}`;
    const basePiece: CanonicalPiece = {
      id: baseId,
      name: "Base Plate",
      geometryRef: {
        contour: { kind: "rect", x: 0, y: 0, width: W, height: D, rotation: 0 },
      },
      dimensions: { width: W, height: D, depth: T },
      thickness: T,
      materialId: spec.material.materialId,
      interfaceIds: [],
      localFrame: {
        origin: vec3(0, 0, 0),
        tangent: vec3(1, 0, 0),
        normal: vec3(0, 1, 0),
        binormal: vec3(0, 0, 1),
      },
      manufacturingParameters: {
        kerf: 0.1,
        grainAngleDeg: 0,
      },
    };
    puzzle.pieces.push(basePiece);

    // Additional perimeter / interlocking pieces (N - 1 pieces)
    const wallPiecesCount = N - 1;
    const wallWidth = Number((W / Math.max(1, Math.ceil(wallPiecesCount / 2))).toFixed(1));
    const wallHeight = H;

    for (let i = 0; i < wallPiecesCount; i++) {
      const wallId = `piece_wall_${i + 1}_${uid()}`;
      const wallPiece: CanonicalPiece = {
        id: wallId,
        name: `Wall Section ${i + 1}`,
        geometryRef: {
          contour: { kind: "rect", x: 0, y: 0, width: wallWidth, height: wallHeight, rotation: 0 },
        },
        dimensions: { width: wallWidth, height: wallHeight, depth: T },
        thickness: T,
        materialId: spec.material.materialId,
        interfaceIds: [],
        localFrame: {
          origin: vec3(i * (wallWidth * 0.5), 0, T),
          tangent: vec3(1, 0, 0),
          normal: vec3(0, 1, 0),
          binormal: vec3(0, 0, 1),
        },
        manufacturingParameters: {
          kerf: 0.1,
          grainAngleDeg: 0,
        },
      };
      puzzle.pieces.push(wallPiece);

      // Create complementary interface pair between Base Plate and Wall Piece
      const ifBaseId = `if_base_${i + 1}_${uid()}`;
      const ifWallId = `if_wall_${i + 1}_${uid()}`;

      const ifBase: CanonicalInterface = {
        id: ifBaseId,
        owningPieceId: baseId,
        name: `Base Slot Port ${i + 1}`,
        edgeGeometry: { edgeIndex: 0, parametricStart: 0.3, parametricEnd: 0.7, length: 20.0 },
        interfaceType: jointType.includes("slot") ? "slot" : "receiver",
        profile: { profileKind: "slot", width: 20.0, depth: T, clearance: 0.15 },
        compatibility: {
          allowedTypes: [jointType.includes("slot") ? "tab" : "insert"],
          genderRole: "receiver",
          complementaryPatterns: [],
        },
        localFrame: {
          origin: vec3(20 + i * 25, 0, 0),
          tangent: vec3(1, 0, 0),
          normal: vec3(0, 1, 0),
          binormal: vec3(0, 0, 1),
        },
        tolerance: 0.15,
        allowedDOF: {
          translation: { x: false, y: false, z: false },
          rotation: { rx: false, ry: false, rz: false },
        },
      };

      const ifWall: CanonicalInterface = {
        id: ifWallId,
        owningPieceId: wallId,
        name: `Wall Tab Port ${i + 1}`,
        edgeGeometry: { edgeIndex: 2, parametricStart: 0.3, parametricEnd: 0.7, length: 20.0 },
        interfaceType: jointType.includes("slot") ? "tab" : "insert",
        profile: { profileKind: "tab", width: 20.0, depth: T, clearance: 0.15 },
        compatibility: {
          allowedTypes: [jointType.includes("slot") ? "slot" : "receiver"],
          genderRole: "insert",
          complementaryPatterns: [],
        },
        localFrame: {
          origin: vec3(20, 0, 0),
          tangent: vec3(1, 0, 0),
          normal: vec3(0, -1, 0),
          binormal: vec3(0, 0, -1),
        },
        tolerance: 0.15,
        allowedDOF: {
          translation: { x: false, y: false, z: false },
          rotation: { rx: false, ry: false, rz: false },
        },
      };

      basePiece.interfaceIds.push(ifBaseId);
      wallPiece.interfaceIds.push(ifWallId);
      puzzle.interfaces.push(ifBase, ifWall);

      // Create connection
      const connId = `conn_base_wall_${i + 1}_${uid()}`;
      puzzle.connections.push({
        id: connId,
        interfaceAId: ifBaseId,
        interfaceBId: ifWallId,
        connectionType: jointType as any,
        compatibilityRules: {
          requireMatchingProfileWidth: true,
          maxToleranceDiff: 0.2,
        },
        allowedRelativeTransform: {
          positionOffset: vec3(0, 0, 0),
          rotationQuaternion: { x: 0, y: 0, z: 0, w: 1 },
        },
        allowedAngleRange: {
          minAngleDeg: joiningAngle,
          maxAngleDeg: joiningAngle,
          targetAngleDeg: joiningAngle,
        },
        clearance,
        constraintIds: [],
      });
    }

    return puzzle;
  }
}
