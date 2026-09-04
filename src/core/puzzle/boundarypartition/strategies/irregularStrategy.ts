/**
 * Irregular Boundary Partitioning Strategy (Phase 82).
 *
 * Deterministically partitions an arbitrary 2D boundary into asymmetric,
 * irregular pieces with configurable complexity, jitter, and minimum feature size enforcement.
 */

import type { Vec2 } from "@/core/model/types";
import type { PartitionParameters } from "../types";
import {
  cleanPolygonVertices,
  clipPolygonByLine,
  computeBounds,
  findShortestEdgeLength,
  polygonArea,
  polygonCentroid,
} from "../polygonMath";

interface RawPiece {
  id: string;
  vertices: Vec2[];
  neighbors: Map<string, { start: Vec2; end: Vec2 }>;
}

class DeterministicRNG {
  private state: number;
  constructor(seed: number) {
    this.state = (seed >>> 0) || 42;
  }
  nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export class IrregularStrategy {
  public static partition(
    boundaryVertices: Vec2[],
    targetCount: number,
    params?: PartitionParameters
  ): RawPiece[] {
    const N = Math.max(2, Math.round(targetCount));
    const seed = params?.seed ?? 101;
    const rng = new DeterministicRNG(seed);

    // Complexity mapping
    let complexityFactor = 0.5;
    if (typeof params?.complexity === "number") {
      complexityFactor = Math.max(0, Math.min(1, params.complexity));
    } else if (params?.complexity === "low") complexityFactor = 0.2;
    else if (params?.complexity === "high") complexityFactor = 0.8;

    const jitter = params?.jitter ?? (0.2 + complexityFactor * 0.4);
    const minFeatureSizeMm = params?.minFeatureSizeMm ?? 5.0;

    let pieces: RawPiece[] = [
      {
        id: "p_irreg_0",
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

      // Base orientation along longer dimension
      const baseAngle = w >= h ? Math.PI / 2 : 0; // line perpendicular to longer dimension
      const slantAngle = (rng.nextFloat() - 0.5) * (Math.PI / 3) * jitter;
      const finalAngle = baseAngle + slantAngle;

      const normal: Vec2 = {
        x: Math.cos(finalAngle),
        y: Math.sin(finalAngle),
      };

      // Slight centroid offset
      const offsetDist = (rng.nextFloat() - 0.5) * Math.min(w, h) * 0.2 * jitter;
      const pointOnLine: Vec2 = {
        x: centroid.x + normal.x * offsetDist,
        y: centroid.y + normal.y * offsetDist,
      };

      let split = clipPolygonByLine(candidate.vertices, pointOnLine, normal);

      // Verify minimum feature size and area on split children
      if (
        !split ||
        split.polyA.length < 3 ||
        split.polyB.length < 3 ||
        polygonArea(split.polyA) < minFeatureSizeMm * minFeatureSizeMm ||
        polygonArea(split.polyB) < minFeatureSizeMm * minFeatureSizeMm
      ) {
        // Fallback: un-slanted axis split directly through centroid
        const axisNormal: Vec2 = w >= h ? { x: 1, y: 0 } : { x: 0, y: 1 };
        split = clipPolygonByLine(candidate.vertices, centroid, axisNormal);
        if (!split || split.polyA.length < 3 || split.polyB.length < 3) {
          break; // Cannot safely split further
        }
      }

      const idA = candidate.id;
      const idB = `p_irreg_${nextId++}`;

      const pieceA: RawPiece = { id: idA, vertices: split.polyA, neighbors: new Map(candidate.neighbors) };
      const pieceB: RawPiece = { id: idB, vertices: split.polyB, neighbors: new Map() };

      pieceA.neighbors.set(idB, { start: split.cutStart, end: split.cutEnd });
      pieceB.neighbors.set(idA, { start: split.cutEnd, end: split.cutStart });

      pieces.splice(maxAreaIdx, 1, pieceA, pieceB);
    }

    return pieces;
  }
}
