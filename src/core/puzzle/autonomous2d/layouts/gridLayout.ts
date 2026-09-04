/**
 * Grid Layout Strategy for Autonomous 2D Puzzle Generation.
 *
 * Deterministically partitions a rectangular puzzle boundary into an R x C grid
 * of interlocking pieces with shared internal boundary edges.
 */

import type { Vec2 } from "@/core/model/types";
import type { BoundarySegment2D, PuzzleBoundary2D } from "../types";
import type { PartitionLayoutResult, RawPieceLayout, SharedEdge } from "./types";
import { distance2D, polygonArea, polygonPerimeter } from "../geometry2D";

export class GridLayoutGenerator {
  public static partition(
    widthMm: number,
    heightMm: number,
    targetPieceCount: number
  ): PartitionLayoutResult {
    const { rows, cols } = this.calculateGridDimensions(widthMm, heightMm, targetPieceCount);
    const pieceCount = rows * cols;

    // 1. Puzzle Boundary
    const puzzleBoundaryVertices: Vec2[] = [
      { x: 0, y: 0 },
      { x: widthMm, y: 0 },
      { x: widthMm, y: heightMm },
      { x: 0, y: heightMm },
    ];
    const puzzleBoundary: PuzzleBoundary2D = {
      kind: "rectangle",
      widthMm,
      heightMm,
      vertices: puzzleBoundaryVertices,
      areaMm2: widthMm * heightMm,
      perimeterMm: 2 * (widthMm + heightMm),
      bounds: { minX: 0, minY: 0, maxX: widthMm, maxY: heightMm },
    };

    const cellWidth = widthMm / cols;
    const cellHeight = heightMm / rows;

    const pieces: RawPieceLayout[] = [];
    const gridPieceIds: string[][] = Array.from({ length: rows }, () => Array(cols).fill(""));

    let pieceIndex = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pieceId = `p_grid_${r}_${c}`;
        gridPieceIds[r][c] = pieceId;

        const x0 = Number((c * cellWidth).toFixed(4));
        const x1 = Number(((c + 1) * cellWidth).toFixed(4));
        const y0 = Number((r * cellHeight).toFixed(4));
        const y1 = Number(((r + 1) * cellHeight).toFixed(4));

        // Vertices in CCW order: Bottom-Left, Bottom-Right, Top-Right, Top-Left
        const vertices: Vec2[] = [
          { x: x0, y: y0 }, // v0
          { x: x1, y: y0 }, // v1
          { x: x1, y: y1 }, // v2
          { x: x0, y: y1 }, // v3
        ];

        pieces.push({
          pieceId,
          name: `Grid Piece (${r + 1},${c + 1})`,
          vertices,
          layoutMetadata: {
            layoutType: "grid",
            index: pieceIndex++,
            gridPosition: { row: r, col: c },
          },
        });
      }
    }

    // 2. Shared Internal Edges & Outer Segments
    const sharedEdges: SharedEdge[] = [];
    const outerSegments: BoundarySegment2D[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const currentPieceId = gridPieceIds[r][c];
        const x0 = Number((c * cellWidth).toFixed(4));
        const x1 = Number(((c + 1) * cellWidth).toFixed(4));
        const y0 = Number((r * cellHeight).toFixed(4));
        const y1 = Number(((r + 1) * cellHeight).toFixed(4));

        // Edge 0 (Bottom): (x0, y0) -> (x1, y0)
        if (r === 0) {
          outerSegments.push({
            id: `outer_${currentPieceId}_e0`,
            pieceId: currentPieceId,
            start: { x: x0, y: y0 },
            end: { x: x1, y: y0 },
            lengthMm: cellWidth,
            isOuter: true,
            edgeIndex: 0,
          });
        }

        // Edge 1 (Right): (x1, y0) -> (x1, y1)
        if (c < cols - 1) {
          const rightPieceId = gridPieceIds[r][c + 1];
          sharedEdges.push({
            id: `shared_${currentPieceId}_${rightPieceId}`,
            pieceAId: currentPieceId,
            pieceBId: rightPieceId,
            edgeIndexA: 1, // Edge 1 on pieceA
            edgeIndexB: 3, // Edge 3 on pieceB is Left edge: (x1, y1) -> (x1, y0)
            start: { x: x1, y: y0 },
            end: { x: x1, y: y1 },
          });
        } else {
          outerSegments.push({
            id: `outer_${currentPieceId}_e1`,
            pieceId: currentPieceId,
            start: { x: x1, y: y0 },
            end: { x: x1, y: y1 },
            lengthMm: cellHeight,
            isOuter: true,
            edgeIndex: 1,
          });
        }

        // Edge 2 (Top): (x1, y1) -> (x0, y1)
        if (r < rows - 1) {
          const topPieceId = gridPieceIds[r + 1][c];
          sharedEdges.push({
            id: `shared_${currentPieceId}_${topPieceId}`,
            pieceAId: currentPieceId,
            pieceBId: topPieceId,
            edgeIndexA: 2, // Edge 2 on pieceA
            edgeIndexB: 0, // Edge 0 on pieceB is Bottom edge: (x0, y1) -> (x1, y1)
            start: { x: x1, y: y1 },
            end: { x: x0, y: y1 },
          });
        } else {
          outerSegments.push({
            id: `outer_${currentPieceId}_e2`,
            pieceId: currentPieceId,
            start: { x: x1, y: y1 },
            end: { x: x0, y: y1 },
            lengthMm: cellWidth,
            isOuter: true,
            edgeIndex: 2,
          });
        }

        // Edge 3 (Left): (x0, y1) -> (x0, y0)
        if (c === 0) {
          outerSegments.push({
            id: `outer_${currentPieceId}_e3`,
            pieceId: currentPieceId,
            start: { x: x0, y: y1 },
            end: { x: x0, y: y0 },
            lengthMm: cellHeight,
            isOuter: true,
            edgeIndex: 3,
          });
        }
      }
    }

    return {
      puzzleBoundary,
      pieces,
      sharedEdges,
      outerSegments,
    };
  }

  /**
   * Deterministically factors targetPieceCount into rows and cols
   * prioritizing aspect ratios matching puzzle aspect ratio.
   */
  public static calculateGridDimensions(
    widthMm: number,
    heightMm: number,
    targetCount: number
  ): { rows: number; cols: number } {
    const N = Math.max(2, Math.round(targetCount));
    const targetAspect = widthMm / Math.max(1, heightMm);

    let bestR = 1;
    let bestC = N;
    let bestDiff = Infinity;

    // Find factor pairs
    for (let r = 1; r <= Math.floor(Math.sqrt(N)); r++) {
      if (N % r === 0) {
        const c = N / r;
        // Check pair (r, c) and (c, r)
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

    // If prime or unfactorable cleanly into desired aspect, use square-root approximation
    if (bestR === 1 && N >= 4) {
      const approxCols = Math.round(Math.sqrt(N * targetAspect));
      const cols = Math.max(2, Math.min(N - 1, approxCols));
      const rows = Math.max(1, Math.round(N / cols));
      if (rows * cols === N) {
        return { rows, cols };
      }
    }

    return { rows: bestR, cols: bestC };
  }
}
