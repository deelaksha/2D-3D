/**
 * Polygonal Boundary Partitioning Strategy (Phase 82).
 *
 * Deterministically partitions an arbitrary 2D boundary into N polygonal pieces
 * using recursive balanced space bisection.
 */

import type { Vec2 } from "@/core/model/types";
import type { PartitionParameters } from "../types";
import {
  cleanPolygonVertices,
  clipPolygonByLine,
  computeBounds,
  polygonArea,
  polygonCentroid,
} from "../polygonMath";

interface RawPiece {
  id: string;
  vertices: Vec2[];
  neighbors: Map<string, { start: Vec2; end: Vec2 }>;
}

export class PolygonalStrategy {
  public static partition(
    boundaryVertices: Vec2[],
    targetCount: number,
    params?: PartitionParameters
  ): RawPiece[] {
    const N = Math.max(2, Math.round(targetCount));

    let pieces: RawPiece[] = [
      {
        id: "p_poly_0",
        vertices: cleanPolygonVertices(boundaryVertices),
        neighbors: new Map(),
      },
    ];

    let nextId = 1;

    while (pieces.length < N) {
      // Find largest piece
      let maxAreaIdx = 0;
      let maxArea = -1;
      for (let i = 0; i < pieces.length; i++) {
        const a = polygonArea(pieces[i].vertices);
        if (a > maxArea) {
          maxArea = a;
          maxAreaIdx = i;
        }
      }

      const candidate = pieces[maxAreaIdx];
      const centroid = polygonCentroid(candidate.vertices);
      const bounds = computeBounds(candidate.vertices);
      const w = bounds.maxX - bounds.minX;
      const h = bounds.maxY - bounds.minY;

      // Normal perpendicular to the longer axis
      const normal: Vec2 = w >= h ? { x: 1, y: 0 } : { x: 0, y: 1 };

      const split = clipPolygonByLine(candidate.vertices, centroid, normal);
      if (!split || split.polyA.length < 3 || split.polyB.length < 3 || polygonArea(split.polyA) < 1 || polygonArea(split.polyB) < 1) {
        // Fallback to alternate axis
        const altNormal: Vec2 = w >= h ? { x: 0, y: 1 } : { x: 1, y: 0 };
        const altSplit = clipPolygonByLine(candidate.vertices, centroid, altNormal);
        if (!altSplit || altSplit.polyA.length < 3 || altSplit.polyB.length < 3) {
          break; // Cannot split further
        }
        applySplit(altSplit.polyA, altSplit.polyB, altSplit.cutStart, altSplit.cutEnd);
      } else {
        applySplit(split.polyA, split.polyB, split.cutStart, split.cutEnd);
      }

      function applySplit(polyA: Vec2[], polyB: Vec2[], cutStart: Vec2, cutEnd: Vec2) {
        const idA = candidate.id;
        const idB = `p_poly_${nextId++}`;

        const pieceA: RawPiece = { id: idA, vertices: polyA, neighbors: new Map(candidate.neighbors) };
        const pieceB: RawPiece = { id: idB, vertices: polyB, neighbors: new Map() };

        pieceA.neighbors.set(idB, { start: cutStart, end: cutEnd });
        pieceB.neighbors.set(idA, { start: cutEnd, end: cutStart });

        pieces.splice(maxAreaIdx, 1, pieceA, pieceB);
      }
    }

    return pieces;
  }
}
