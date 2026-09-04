/**
 * Organic Boundary Partitioning Strategy (Phase 82).
 *
 * Partitions the puzzle boundary and modulates internal shared boundaries
 * with smooth, non-self-intersecting continuous harmonic waves while preserving
 * outer perimeter boundary containment.
 */

import type { Vec2 } from "@/core/model/types";
import type { PartitionParameters } from "../types";
import { distance, normalize } from "../polygonMath";
import { PolygonalStrategy } from "./polygonalStrategy";

interface RawPiece {
  id: string;
  vertices: Vec2[];
  neighbors: Map<string, { start: Vec2; end: Vec2 }>;
}

export class OrganicStrategy {
  public static partition(
    boundaryVertices: Vec2[],
    targetCount: number,
    params?: PartitionParameters
  ): RawPiece[] {
    // 1. Obtain base polygonal partition
    const basePieces = PolygonalStrategy.partition(boundaryVertices, targetCount, params);

    const curvature = params?.curvature ?? 4.0; // mm
    const freq = params?.waveFrequency ?? 1.0;
    const minFeature = params?.minFeatureSizeMm ?? 5.0;

    // Collect all shared internal edges
    // Key: idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`
    const sharedEdgeMap = new Map<string, { idA: string; idB: string; start: Vec2; end: Vec2; curve: Vec2[] }>();

    for (const p of basePieces) {
      for (const [neighborId, seg] of p.neighbors.entries()) {
        const edgeKey = p.id < neighborId ? `${p.id}_${neighborId}` : `${neighborId}_${p.id}`;
        if (!sharedEdgeMap.has(edgeKey)) {
          const len = distance(seg.start, seg.end);
          if (len > minFeature * 2) {
            const tangent = normalize({ x: seg.end.x - seg.start.x, y: seg.end.y - seg.start.y });
            const normal = { x: -tangent.y, y: tangent.x };
            const amp = Math.min(curvature, len * 0.12);

            const numSamples = 10;
            const curve: Vec2[] = [];
            for (let s = 0; s <= numSamples; s++) {
              const t = s / numSamples;
              const wave = Math.sin(Math.PI * t) * Math.sin(2 * Math.PI * freq * t);
              const disp = amp * wave;

              const pt: Vec2 = {
                x: Number((seg.start.x + tangent.x * len * t + normal.x * disp).toFixed(4)),
                y: Number((seg.start.y + tangent.y * len * t + normal.y * disp).toFixed(4)),
              };
              curve.push(pt);
            }
            sharedEdgeMap.set(edgeKey, { idA: p.id, idB: neighborId, start: seg.start, end: seg.end, curve });
          }
        }
      }
    }

    // 2. Modulate pieces
    const organicPieces: RawPiece[] = [];

    for (const p of basePieces) {
      const newVerts: Vec2[] = [];
      const n = p.vertices.length;

      for (let i = 0; i < n; i++) {
        const v1 = p.vertices[i];
        const v2 = p.vertices[(i + 1) % n];

        // Check if [v1, v2] matches any shared edge
        let matched = false;
        for (const [neighborId, seg] of p.neighbors.entries()) {
          const edgeKey = p.id < neighborId ? `${p.id}_${neighborId}` : `${neighborId}_${p.id}`;
          const shared = sharedEdgeMap.get(edgeKey);
          if (!shared) continue;

          // Check forward direction
          if (distance(v1, shared.start) < 0.1 && distance(v2, shared.end) < 0.1) {
            for (let k = 0; k < shared.curve.length - 1; k++) {
              newVerts.push(shared.curve[k]);
            }
            matched = true;
            break;
          }
          // Check reverse direction
          if (distance(v1, shared.end) < 0.1 && distance(v2, shared.start) < 0.1) {
            const rev = [...shared.curve].reverse();
            for (let k = 0; k < rev.length - 1; k++) {
              newVerts.push(rev[k]);
            }
            matched = true;
            break;
          }
        }

        if (!matched) {
          newVerts.push(v1);
        }
      }

      organicPieces.push({
        id: p.id,
        vertices: newVerts,
        neighbors: p.neighbors,
      });
    }

    return organicPieces;
  }
}
