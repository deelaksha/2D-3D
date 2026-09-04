/**
 * Rectangular Boundary Partitioning Strategy (Phase 82).
 *
 * Deterministically partitions an arbitrary 2D boundary into a rectangular/grid-like
 * arrangement of pieces, clipping cells to stay strictly inside the boundary.
 */

import type { Vec2 } from "@/core/model/types";
import type { PartitionParameters } from "../types";
import {
  cleanPolygonVertices,
  clipPolygonByLine,
  computeBounds,
  polygonArea,
  polygonCentroid,
  polygonPerimeter,
} from "../polygonMath";

interface RawPiece {
  id: string;
  vertices: Vec2[];
  neighbors: Map<string, { start: Vec2; end: Vec2 }>;
}

export class RectangularStrategy {
  public static partition(
    boundaryVertices: Vec2[],
    targetCount: number,
    params?: PartitionParameters
  ): RawPiece[] {
    const N = Math.max(2, Math.round(targetCount));
    const bounds = computeBounds(boundaryVertices);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    // Calculate rows and cols matching target aspect ratio
    const targetAspect = width / Math.max(1, height);
    let bestR = 1;
    let bestC = N;
    let bestDiff = Infinity;

    for (let r = 1; r <= Math.floor(Math.sqrt(N)); r++) {
      if (N % r === 0) {
        const c = N / r;
        const diff1 = Math.abs(c / r - targetAspect);
        if (diff1 < bestDiff) {
          bestDiff = diff1;
          bestR = r;
          bestC = c;
        }
        const diff2 = Math.abs(r / c - targetAspect);
        if (diff2 < bestDiff) {
          bestDiff = diff2;
          bestR = c;
          bestC = r;
        }
      }
    }

    const rows = bestR;
    const cols = bestC;

    // We partition the boundary by successive axis-aligned cuts
    let currentPolys: RawPiece[] = [
      {
        id: "p_rect_0",
        vertices: cleanPolygonVertices(boundaryVertices),
        neighbors: new Map(),
      },
    ];

    let pieceCounter = 1;

    // 1. Make horizontal cuts (rows - 1 cuts)
    const dy = height / rows;
    for (let r = 1; r < rows; r++) {
      const cutY = bounds.minY + r * dy;
      const pointOnLine: Vec2 = { x: (bounds.minX + bounds.maxX) / 2, y: cutY };
      const normal: Vec2 = { x: 0, y: 1 }; // Cut horizontal line

      const nextPolys: RawPiece[] = [];
      for (const piece of currentPolys) {
        const split = clipPolygonByLine(piece.vertices, pointOnLine, normal);
        if (split && polygonArea(split.polyA) > 1 && polygonArea(split.polyB) > 1) {
          const idA = piece.id;
          const idB = `p_rect_${pieceCounter++}`;

          const pieceA: RawPiece = { id: idA, vertices: split.polyA, neighbors: new Map(piece.neighbors) };
          const pieceB: RawPiece = { id: idB, vertices: split.polyB, neighbors: new Map() };

          pieceA.neighbors.set(idB, { start: split.cutStart, end: split.cutEnd });
          pieceB.neighbors.set(idA, { start: split.cutEnd, end: split.cutStart });

          nextPolys.push(pieceA, pieceB);
        } else {
          nextPolys.push(piece);
        }
      }
      currentPolys = nextPolys;
    }

    // 2. Make vertical cuts (cols - 1 cuts per row band)
    const dx = width / cols;
    for (let c = 1; c < cols; c++) {
      const cutX = bounds.minX + c * dx;
      const pointOnLine: Vec2 = { x: cutX, y: (bounds.minY + bounds.maxY) / 2 };
      const normal: Vec2 = { x: 1, y: 0 }; // Cut vertical line

      const nextPolys: RawPiece[] = [];
      for (const piece of currentPolys) {
        const pBounds = computeBounds(piece.vertices);
        if (pBounds.minX < cutX && pBounds.maxX > cutX) {
          const split = clipPolygonByLine(piece.vertices, pointOnLine, normal);
          if (split && polygonArea(split.polyA) > 1 && polygonArea(split.polyB) > 1) {
            const idA = piece.id;
            const idB = `p_rect_${pieceCounter++}`;

            const pieceA: RawPiece = { id: idA, vertices: split.polyA, neighbors: new Map(piece.neighbors) };
            const pieceB: RawPiece = { id: idB, vertices: split.polyB, neighbors: new Map() };

            pieceA.neighbors.set(idB, { start: split.cutStart, end: split.cutEnd });
            pieceB.neighbors.set(idA, { start: split.cutEnd, end: split.cutStart });

            nextPolys.push(pieceA, pieceB);
            continue;
          }
        }
        nextPolys.push(piece);
      }
      currentPolys = nextPolys;
    }

    return currentPolys;
  }
}
