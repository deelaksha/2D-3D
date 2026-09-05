/**
 * Assembly-Level Validator (Phase 90 - Pass 2).
 *
 * Evaluates the complete assembly against the 8 required global criteria:
 *  1. all pieces included
 *  2. no unintended collisions
 *  3. no disconnected pieces
 *  4. all mandatory connections satisfied
 *  5. valid transforms
 *  6. valid material dimensions
 *  7. valid thickness
 *  8. valid geometry
 *
 * Produces granular failure items identifying exact piece, interface, connection,
 * position, angle, and failure reason.
 */

import { AssemblyCollisionDetector } from "../assemblysolver/assemblyCollisionDetector";
import type { RigidTransform3D } from "../framesystem/types";
import { vec3 } from "../geometry/math3d";
import type { ConvertedPuzzle3D, GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import type {
  AssemblyValidationOptions,
  ConnectionValidationDetail,
  PieceValidationDetail,
  ValidationFailureItem,
} from "./types";

export class AssemblyLevelValidator {
  /**
   * Evaluates the entire assembly for global spatial, topological, and physical validity.
   */
  public static validateAssembly(
    puzzle: ConvertedPuzzle3D,
    pieceTransforms: Record<string, RigidTransform3D>,
    connectionDetails: Record<string, ConnectionValidationDetail>,
    appliedAngles: Record<string, number>,
    options: AssemblyValidationOptions = {}
  ): {
    allPiecesIncluded: boolean;
    noUnintendedCollisions: boolean;
    noDisconnectedPieces: boolean;
    allMandatoryConnectionsSatisfied: boolean;
    validTransforms: boolean;
    validMaterialDimensions: boolean;
    validThickness: boolean;
    validGeometry: boolean;
    pieceDetails: Record<string, PieceValidationDetail>;
    failures: ValidationFailureItem[];
  } {
    const failures: ValidationFailureItem[] = [];
    const pieceDetails: Record<string, PieceValidationDetail> = {};

    const pieces = puzzle.pieces ?? [];
    const connections = puzzle.connections ?? [];
    const collisionToleranceMm = options.collisionToleranceMm ?? 0.1;
    const stockThicknessMm = puzzle.specification?.material?.stockThicknessMm;

    // ─────────────────────────────────────────────────────────────
    // 1. All Pieces Included & Piece Details Check
    // ─────────────────────────────────────────────────────────────
    let allPiecesIncluded = true;
    let validTransforms = true;
    let validMaterialDimensions = true;
    let validThickness = true;
    let validGeometry = true;

    const placedPiecesMap = new Map<string, GeneratedPiece3D>();

    for (const piece of pieces) {
      const transform = pieceTransforms[piece.pieceId];
      const issues: string[] = [];

      // Piece inclusion check
      if (!transform) {
        allPiecesIncluded = false;
        const msg = `Piece '${piece.pieceId}' is omitted from assembly placements.`;
        issues.push(msg);
        failures.push({
          pieceId: piece.pieceId,
          failureReason: msg,
          severity: "error",
          category: "missing_piece",
        });

        pieceDetails[piece.pieceId] = {
          pieceId: piece.pieceId,
          isValid: false,
          hasValidTransform: false,
          position: vec3(0, 0, 0),
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          materialDimensionsValid: false,
          thicknessValid: false,
          thicknessMm: piece.thickness ?? 0,
          geometryValid: false,
          closedProfile: false,
          areaMm2: 0,
          issues,
        };
        continue;
      }

      placedPiecesMap.set(piece.pieceId, piece);

      // ─────────────────────────────────────────────────────────────
      // 5. Valid Transforms Check (per piece)
      // ─────────────────────────────────────────────────────────────
      let transformOk = true;
      const pos = transform.position;
      const rot = transform.rotation;

      const hasFinitePos =
        Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z);
      const hasFiniteRot =
        Number.isFinite(rot.x) && Number.isFinite(rot.y) && Number.isFinite(rot.z) && Number.isFinite(rot.w);

      if (!hasFinitePos || !hasFiniteRot) {
        transformOk = false;
        validTransforms = false;
        const msg = `Piece '${piece.pieceId}' has non-finite coordinates or rotation.`;
        issues.push(msg);
        failures.push({
          pieceId: piece.pieceId,
          position: pos,
          failureReason: msg,
          severity: "error",
          category: "transform",
        });
      } else {
        const qNorm = Math.hypot(rot.x, rot.y, rot.z, rot.w);
        if (Math.abs(qNorm - 1.0) > 1e-3) {
          transformOk = false;
          validTransforms = false;
          const msg = `Piece '${piece.pieceId}' rotation quaternion norm is non-unit (${qNorm.toFixed(4)} != 1.0).`;
          issues.push(msg);
          failures.push({
            pieceId: piece.pieceId,
            position: pos,
            failureReason: msg,
            severity: "error",
            category: "transform",
          });
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 6. Valid Material Dimensions Check
      // ─────────────────────────────────────────────────────────────
      let matDimOk = true;
      const bounds = piece.profile?.localBounds;
      if (!bounds) {
        matDimOk = false;
        validMaterialDimensions = false;
        const msg = `Piece '${piece.pieceId}' lacks profile bounding dimensions.`;
        issues.push(msg);
        failures.push({
          pieceId: piece.pieceId,
          position: pos,
          failureReason: msg,
          severity: "error",
          category: "material",
        });
      } else {
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
          matDimOk = false;
          validMaterialDimensions = false;
          const msg = `Piece '${piece.pieceId}' has invalid dimensions (${width}mm x ${height}mm).`;
          issues.push(msg);
          failures.push({
            pieceId: piece.pieceId,
            position: pos,
            failureReason: msg,
            severity: "error",
            category: "material",
          });
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 7. Valid Thickness Check
      // ─────────────────────────────────────────────────────────────
      let thickOk = true;
      const thickness = piece.thickness;
      if (thickness <= 0 || !Number.isFinite(thickness)) {
        thickOk = false;
        validThickness = false;
        const msg = `Piece '${piece.pieceId}' has non-positive thickness (${thickness}mm).`;
        issues.push(msg);
        failures.push({
          pieceId: piece.pieceId,
          position: pos,
          failureReason: msg,
          severity: "error",
          category: "thickness",
        });
      } else if (stockThicknessMm !== undefined && Math.abs(thickness - stockThicknessMm) > 0.05) {
        thickOk = false;
        validThickness = false;
        const msg = `Piece '${piece.pieceId}' thickness (${thickness}mm) deviates from stock specification (${stockThicknessMm}mm).`;
        issues.push(msg);
        failures.push({
          pieceId: piece.pieceId,
          position: pos,
          failureReason: msg,
          severity: "error",
          category: "thickness",
        });
      }

      // ─────────────────────────────────────────────────────────────
      // 8. Valid Geometry Check
      // ─────────────────────────────────────────────────────────────
      let geomOk = true;
      const closed = piece.profile?.isClosed ?? false;
      const area = piece.profile?.areaMm2 ?? 0;
      if (!closed) {
        geomOk = false;
        validGeometry = false;
        const msg = `Piece '${piece.pieceId}' profile boundary is open or unclosed.`;
        issues.push(msg);
        failures.push({
          pieceId: piece.pieceId,
          position: pos,
          failureReason: msg,
          severity: "error",
          category: "geometry",
        });
      }
      if (area <= 0 || !Number.isFinite(area)) {
        geomOk = false;
        validGeometry = false;
        const msg = `Piece '${piece.pieceId}' profile area is non-positive (${area}mm²).`;
        issues.push(msg);
        failures.push({
          pieceId: piece.pieceId,
          position: pos,
          failureReason: msg,
          severity: "error",
          category: "geometry",
        });
      }

      const isPieceValid = transformOk && matDimOk && thickOk && geomOk;

      pieceDetails[piece.pieceId] = {
        pieceId: piece.pieceId,
        isValid: isPieceValid,
        hasValidTransform: transformOk,
        position: pos,
        rotation: rot,
        materialDimensionsValid: matDimOk,
        thicknessValid: thickOk,
        thicknessMm: thickness,
        geometryValid: geomOk,
        closedProfile: closed,
        areaMm2: area,
        issues,
      };
    }

    // ─────────────────────────────────────────────────────────────
    // 2. No Unintended Collisions Check
    // ─────────────────────────────────────────────────────────────
    let noUnintendedCollisions = true;

    // Build direct neighbor adjacency set
    const neighborMap = new Map<string, Set<string>>();
    for (const p of pieces) {
      neighborMap.set(p.pieceId, new Set<string>());
    }
    for (const conn of connections) {
      neighborMap.get(conn.pieceAId)?.add(conn.pieceBId);
      neighborMap.get(conn.pieceBId)?.add(conn.pieceAId);
    }

    // Check pairwise collisions across all placed pieces
    const placedList = Array.from(placedPiecesMap.entries());
    for (let i = 0; i < placedList.length; i++) {
      const [idA, pieceA] = placedList[i];
      const transformA = pieceTransforms[idA];
      if (!transformA) continue;

      const directNeighbors = neighborMap.get(idA) ?? new Set<string>();

      // Check pieceA against all other placed pieces
      const otherPieces = new Map<string, GeneratedPiece3D>();
      const otherTransforms: Record<string, RigidTransform3D> = {};

      for (let j = i + 1; j < placedList.length; j++) {
        const [idB, pieceB] = placedList[j];
        const transformB = pieceTransforms[idB];
        if (transformB) {
          otherPieces.set(idB, pieceB);
          otherTransforms[idB] = transformB;
        }
      }

      if (otherPieces.size > 0) {
        const collisionResult = AssemblyCollisionDetector.checkCollisionWithSubassembly(
          pieceA,
          transformA,
          otherPieces,
          otherTransforms,
          directNeighbors,
          collisionToleranceMm
        );

        if (collisionResult.hasCollision) {
          noUnintendedCollisions = false;
          const msg =
            collisionResult.message ??
            `Spatial collision detected between piece '${idA}' and '${collisionResult.conflictingPieceId}'.`;
          failures.push({
            pieceId: idA,
            position: transformA.position,
            failureReason: msg,
            severity: "error",
            category: "collision",
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. No Disconnected Pieces Check (Connected Components)
    // ─────────────────────────────────────────────────────────────
    let noDisconnectedPieces = true;

    if (placedPiecesMap.size > 1) {
      // Build adjacency graph from valid mated connections
      const matedAdjacency = new Map<string, Set<string>>();
      for (const id of placedPiecesMap.keys()) {
        matedAdjacency.set(id, new Set<string>());
      }

      for (const conn of connections) {
        const detail = connectionDetails[conn.connectionId];
        if (detail?.isValid && detail.finalConnectionState === "MATED") {
          matedAdjacency.get(conn.pieceAId)?.add(conn.pieceBId);
          matedAdjacency.get(conn.pieceBId)?.add(conn.pieceAId);
        }
      }

      // BFS traversal starting from first placed piece
      const startNode = placedList[0][0];
      const visited = new Set<string>([startNode]);
      const queue: string[] = [startNode];

      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const nbr of matedAdjacency.get(curr) ?? []) {
          if (!visited.has(nbr) && placedPiecesMap.has(nbr)) {
            visited.add(nbr);
            queue.push(nbr);
          }
        }
      }

      // If any placed piece is unvisited, the assembly is disconnected
      for (const [id] of placedPiecesMap.entries()) {
        if (!visited.has(id)) {
          noDisconnectedPieces = false;
          const msg = `Piece '${id}' is disconnected from the main assembly component (topological fragment).`;
          failures.push({
            pieceId: id,
            position: pieceTransforms[id]?.position,
            failureReason: msg,
            severity: "error",
            category: "connectivity",
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. All Mandatory Connections Satisfied
    // ─────────────────────────────────────────────────────────────
    let allMandatoryConnectionsSatisfied = true;
    const mandatoryIds = options.mandatoryConnectionIds ?? connections.map((c) => c.connectionId);

    for (const mId of mandatoryIds) {
      const detail = connectionDetails[mId];
      if (!detail || !detail.isValid || detail.finalConnectionState !== "MATED") {
        allMandatoryConnectionsSatisfied = false;
        const angle = appliedAngles[mId];
        const msg = `Mandatory connection '${mId}' is not satisfied (status: ${detail?.finalConnectionState ?? "MISSING"}).`;
        failures.push({
          connectionId: mId,
          pieceId: detail?.pieceAId,
          interfaceId: detail?.interfaceAId,
          angleDeg: angle,
          failureReason: msg,
          severity: "error",
          category: "mandatory_connection",
        });
      }
    }

    return {
      allPiecesIncluded,
      noUnintendedCollisions,
      noDisconnectedPieces,
      allMandatoryConnectionsSatisfied,
      validTransforms,
      validMaterialDimensions,
      validThickness,
      validGeometry,
      pieceDetails,
      failures,
    };
  }
}
