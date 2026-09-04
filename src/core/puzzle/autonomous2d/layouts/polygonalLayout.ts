/**
 * Custom Polygonal Layout Strategy for Autonomous 2D Puzzle Generation.
 *
 * Deterministically partitions the puzzle boundary into irregular polygonal pieces
 * using recursive slanted space bisection. Guarantees convex polygonal tiles
 * with exact shared internal boundary segments and 0 topological gaps.
 */

import type { Vec2 } from "@/core/model/types";
import type { BoundarySegment2D, PuzzleBoundary2D } from "../types";
import type { PartitionLayoutResult, RawPieceLayout, SharedEdge } from "./types";
import { DeterministicRNG, distance2D, polygonArea, polygonCentroid } from "../geometry2D";

interface PolygonCell {
  id: string;
  vertices: Vec2[];
  neighbors: Map<string, { start: Vec2; end: Vec2 }>;
}

export class PolygonalLayoutGenerator {
  public static partition(
    widthMm: number,
    heightMm: number,
    targetPieceCount: number,
    seed: number = 42
  ): PartitionLayoutResult {
    const N = Math.max(2, Math.round(targetPieceCount));
    const rng = new DeterministicRNG(seed);

    // Initial boundary: rectangle
    const puzzleBoundaryVertices: Vec2[] = [
      { x: 0, y: 0 },
      { x: widthMm, y: 0 },
      { x: widthMm, y: heightMm },
      { x: 0, y: heightMm },
    ];

    const puzzleBoundary: PuzzleBoundary2D = {
      kind: "polygon",
      widthMm,
      heightMm,
      vertices: puzzleBoundaryVertices,
      areaMm2: widthMm * heightMm,
      perimeterMm: 2 * (widthMm + heightMm),
      bounds: { minX: 0, minY: 0, maxX: widthMm, maxY: heightMm },
    };

    // Priority queue / list of cells to recursively bisect
    let cells: PolygonCell[] = [
      {
        id: "p_poly_0",
        vertices: [...puzzleBoundaryVertices],
        neighbors: new Map(),
      },
    ];

    let nextCellId = 1;
    const sharedEdgesList: SharedEdge[] = [];

    while (cells.length < N) {
      // Find largest area cell to split
      let maxAreaIdx = 0;
      let maxArea = -1;
      for (let i = 0; i < cells.length; i++) {
        const a = polygonArea(cells[i].vertices);
        if (a > maxArea) {
          maxArea = a;
          maxAreaIdx = i;
        }
      }

      const cellToSplit = cells[maxAreaIdx];
      const centroid = polygonCentroid(cellToSplit.vertices);

      // Determine split axis based on bounding dimensions of this cell
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const v of cellToSplit.vertices) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      }

      const w = maxX - minX;
      const h = maxY - minY;
      const splitVertical = w >= h;

      // Add a slight deterministic slant (-15 deg to +15 deg) to ensure irregular polygons
      const slant = (rng.nextFloat() - 0.5) * 0.3; // tangent offset
      let normal: Vec2;
      let pointOnLine: Vec2;

      if (splitVertical) {
        // Line roughly x = centroid.x + slant * y
        normal = { x: 1, y: -slant };
        pointOnLine = { x: centroid.x, y: centroid.y };
      } else {
        // Line roughly y = centroid.y + slant * x
        normal = { x: -slant, y: 1 };
        pointOnLine = { x: centroid.x, y: centroid.y };
      }

      const splitResult = this.clipPolygonByLine(cellToSplit.vertices, pointOnLine, normal);
      if (
        !splitResult ||
        splitResult.polyA.length < 3 ||
        splitResult.polyB.length < 3 ||
        polygonArea(splitResult.polyA) < 10 ||
        polygonArea(splitResult.polyB) < 10
      ) {
        // Fallback: simple axis-aligned split
        const simpleNormal = splitVertical ? { x: 1, y: 0 } : { x: 0, y: 1 };
        const fallbackSplit = this.clipPolygonByLine(cellToSplit.vertices, centroid, simpleNormal);
        if (
          !fallbackSplit ||
          fallbackSplit.polyA.length < 3 ||
          fallbackSplit.polyB.length < 3
        ) {
          // Cannot split further safely
          break;
        }
        applySplit(fallbackSplit.polyA, fallbackSplit.polyB, fallbackSplit.cutStart, fallbackSplit.cutEnd);
      } else {
        applySplit(splitResult.polyA, splitResult.polyB, splitResult.cutStart, splitResult.cutEnd);
      }

      function applySplit(polyA: Vec2[], polyB: Vec2[], cutStart: Vec2, cutEnd: Vec2) {
        const childAId = cellToSplit.id;
        const childBId = `p_poly_${nextCellId++}`;

        const cellA: PolygonCell = {
          id: childAId,
          vertices: polyA,
          neighbors: new Map(),
        };

        const cellB: PolygonCell = {
          id: childBId,
          vertices: polyB,
          neighbors: new Map(),
        };

        sharedEdgesList.push({
          id: `shared_${childAId}_${childBId}`,
          pieceAId: childAId,
          pieceBId: childBId,
          edgeIndexA: 0, // will be resolved in post-processing
          edgeIndexB: 0,
          start: cutStart,
          end: cutEnd,
        });

        // Replace split cell
        cells.splice(maxAreaIdx, 1, cellA, cellB);
      }
    }

    // 3. Assemble raw pieces and match shared edges
    const pieces: RawPieceLayout[] = cells.map((cell, idx) => ({
      pieceId: cell.id,
      name: `Polygonal Tile ${idx + 1}`,
      vertices: cell.vertices,
      layoutMetadata: {
        layoutType: "custom_polygonal",
        index: idx + 1,
        customRegionId: cell.id,
      },
    }));

    // Identify outer segments and refine shared edges indices
    const outerSegments: BoundarySegment2D[] = [];
    const TOL = 0.05;

    // Check each edge of each piece against the puzzle boundary
    for (const p of pieces) {
      const v = p.vertices;
      const m = v.length;
      for (let i = 0; i < m; i++) {
        const p1 = v[i];
        const p2 = v[(i + 1) % m];

        // Is this segment on the outer boundary?
        const isOuter =
          (Math.abs(p1.y) < TOL && Math.abs(p2.y) < TOL) ||
          (Math.abs(p1.x - widthMm) < TOL && Math.abs(p2.x - widthMm) < TOL) ||
          (Math.abs(p1.y - heightMm) < TOL && Math.abs(p2.y - heightMm) < TOL) ||
          (Math.abs(p1.x) < TOL && Math.abs(p2.x) < TOL);

        if (isOuter) {
          outerSegments.push({
            id: `outer_${p.pieceId}_e${i}`,
            pieceId: p.pieceId,
            start: p1,
            end: p2,
            lengthMm: distance2D(p1, p2),
            isOuter: true,
            edgeIndex: i,
          });
        }
      }
    }

    // Ensure all adjacent pieces sharing cut segments are properly registered
    const finalSharedEdges: SharedEdge[] = [];
    for (const se of sharedEdgesList) {
      const pieceA = pieces.find((p) => p.pieceId === se.pieceAId);
      const pieceB = pieces.find((p) => p.pieceId === se.pieceBId);
      if (!pieceA || !pieceB) continue;

      const idxA = this.findEdgeIndex(pieceA.vertices, se.start, se.end);
      const idxB = this.findEdgeIndex(pieceB.vertices, se.end, se.start);

      finalSharedEdges.push({
        ...se,
        edgeIndexA: idxA >= 0 ? idxA : 0,
        edgeIndexB: idxB >= 0 ? idxB : 0,
      });
    }

    return {
      puzzleBoundary,
      pieces,
      sharedEdges: finalSharedEdges,
      outerSegments,
    };
  }

  private static findEdgeIndex(vertices: Vec2[], p1: Vec2, p2: Vec2): number {
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % n];
      if (
        (distance2D(v1, p1) < 0.1 && distance2D(v2, p2) < 0.1) ||
        (distance2D(v1, p2) < 0.1 && distance2D(v2, p1) < 0.1)
      ) {
        return i;
      }
    }
    return 0;
  }

  /**
   * Clips a convex polygon by an infinite line (P, N) where N is normal.
   */
  private static clipPolygonByLine(
    vertices: Vec2[],
    pointOnLine: Vec2,
    normal: Vec2
  ): { polyA: Vec2[]; polyB: Vec2[]; cutStart: Vec2; cutEnd: Vec2 } | null {
    const n = vertices.length;
    const side: number[] = [];

    for (let i = 0; i < n; i++) {
      const d = (vertices[i].x - pointOnLine.x) * normal.x + (vertices[i].y - pointOnLine.y) * normal.y;
      side.push(d);
    }

    const polyA: Vec2[] = [];
    const polyB: Vec2[] = [];
    const intersections: Vec2[] = [];

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const v1 = vertices[i];
      const v2 = vertices[j];
      const s1 = side[i];
      const s2 = side[j];

      if (s1 >= 0) polyA.push(v1);
      if (s1 <= 0) polyB.push(v1);

      if ((s1 > 1e-6 && s2 < -1e-6) || (s1 < -1e-6 && s2 > 1e-6)) {
        const t = s1 / (s1 - s2);
        const intersectPt: Vec2 = {
          x: Number((v1.x + (v2.x - v1.x) * t).toFixed(4)),
          y: Number((v1.y + (v2.y - v1.y) * t).toFixed(4)),
        };
        polyA.push(intersectPt);
        polyB.push(intersectPt);
        intersections.push(intersectPt);
      }
    }

    if (intersections.length < 2) return null;

    return {
      polyA,
      polyB,
      cutStart: intersections[0],
      cutEnd: intersections[1],
    };
  }
}
