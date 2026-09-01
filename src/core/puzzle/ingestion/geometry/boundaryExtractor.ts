/**
 * Boundary Extractor.
 * Reconstructs contiguous outer boundaries and inner hole loops into PieceTopology models.
 */
import type { Vec2 } from "@/core/model/types";
import type { ExactPrimitive } from "./types";
import type { BoundaryLoop, EdgeSegment, PieceTopology, Vertex2D } from "../../parametric/types";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class BoundaryExtractor {
  /**
   * Reconstructs PieceTopology from exact primitives and contours.
   */
  static extractTopology(primitives: ExactPrimitive[], outerPts: Vec2[], holeLoopsPts: Vec2[][]): PieceTopology {
    const vertices: Record<string, Vertex2D> = {};
    let vCounter = 1;

    function getOrAddVertex(p: Vec2): string {
      for (const [id, v] of Object.entries(vertices)) {
        if (Math.hypot(v.x - p.x, v.y - p.y) < 1e-4) {
          return id;
        }
      }
      const id = `v_extr_${vCounter++}`;
      vertices[id] = { id, x: p.x, y: p.y };
      return id;
    }

    // Build outer boundary edge segments
    const outerSegments: EdgeSegment[] = [];
    const n = outerPts.length;
    for (let i = 0; i < n; i++) {
      const p1 = outerPts[i];
      const p2 = outerPts[(i + 1) % n];
      const v1 = getOrAddVertex(p1);
      const v2 = getOrAddVertex(p2);

      outerSegments.push({
        id: `e_outer_${i + 1}`,
        startVertexId: v1,
        endVertexId: v2,
        edgeIndex: i,
        geometry: { kind: "line" },
        name: `Outer Segment ${i + 1}`,
      });
    }

    const outerBoundary: BoundaryLoop = {
      id: "loop_outer_1",
      isOuter: true,
      edgeSegments: outerSegments,
    };

    // Build hole loops
    const holes: BoundaryLoop[] = [];
    let holeCounter = 1;

    for (const hPts of holeLoopsPts) {
      if (hPts.length < 3) continue;
      const holeSegments: EdgeSegment[] = [];
      const hn = hPts.length;

      for (let i = 0; i < hn; i++) {
        const p1 = hPts[i];
        const p2 = hPts[(i + 1) % hn];
        const v1 = getOrAddVertex(p1);
        const v2 = getOrAddVertex(p2);

        holeSegments.push({
          id: `e_hole_${holeCounter}_${i + 1}`,
          startVertexId: v1,
          endVertexId: v2,
          edgeIndex: i,
          geometry: { kind: "line" },
        });
      }

      holes.push({
        id: `loop_hole_${holeCounter++}`,
        isOuter: false,
        edgeSegments: holeSegments,
      });
    }

    return {
      vertices,
      outerBoundary,
      holes,
    };
  }
}
