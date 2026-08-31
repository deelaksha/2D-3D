/**
 * Pure Deterministic 2D Geometry Generator.
 *
 * Produces exact 2D outer boundary loop geometry for straight edges, tabs, slots,
 * notches, curves, arcs, and custom profiles from parameter inputs.
 */
import type { Vec2 } from "@/core/model/types";
import type { BoundaryLoop, EdgeSegment, Vertex2D } from "../parametric/types";
import type { PipelineInput } from "./types";
import { uid } from "@/core/model/ids";

export function generateExact2DGeometry(input: PipelineInput): {
  boundary: BoundaryLoop;
  vertices: Record<string, Vertex2D>;
  sampledOutline: Vec2[];
  hash: string;
} {
  const { width: W, height: H } = input.pieceParameters || { width: 100, height: 100, thickness: 2.0 };
  const vertices: Record<string, Vertex2D> = {};
  let vCount = 0;

  function addVertex(x: number, y: number): string {
    const id = `v_pipe_${++vCount}`;
    vertices[id] = { id, x, y };
    return id;
  }

  const segments: EdgeSegment[] = [];

  // Corner vertices (Bottom-Left, Bottom-Right, Top-Right, Top-Left)
  const v_bl = addVertex(0, H);
  const v_br = addVertex(W, H);
  const v_tr = addVertex(W, 0);

  // 1. Bottom edge (Edge 0: left to right)
  segments.push({
    id: "e_bottom",
    startVertexId: v_bl,
    endVertexId: v_br,
    edgeIndex: 0,
    geometry: { kind: "line" },
    name: "Bottom Edge",
  });

  // 2. Right edge (Edge 1: bottom to top)
  segments.push({
    id: "e_right",
    startVertexId: v_br,
    endVertexId: v_tr,
    edgeIndex: 1,
    geometry: { kind: "line" },
    name: "Right Edge",
  });

  // 3. Top edge (Edge 2: right to left) with feature profiles
  const topFeatures = (input.interfaceParameters || [])
    .filter((f: any) => f.edgeIndex === 2)
    .sort((a: any, b: any) => b.parametricOffset - a.parametricOffset);
  let v_last = v_tr;

  if (topFeatures.length === 0) {
    const v_tl = addVertex(0, 0);
    segments.push({
      id: "e_top_straight",
      startVertexId: v_tr,
      endVertexId: v_tl,
      edgeIndex: 2,
      geometry: { kind: "line" },
      name: "Top Straight Edge",
    });
    v_last = v_tl;
  } else {
    for (const feat of topFeatures) {
      const center = feat.parametricOffset * W;
      const fStart = Math.max(0, center - feat.width / 2);
      const fEnd = Math.min(W, center + feat.width / 2);

      const v_feat_start = addVertex(fEnd, 0);

      segments.push({
        id: `e_top_lead_${feat.id}`,
        startVertexId: v_last,
        endVertexId: v_feat_start,
        edgeIndex: 2,
        geometry: { kind: "line" },
      });

      if (feat.featureKind === "tab") {
        const v_t_tr = addVertex(fEnd, -feat.depth);
        const v_t_tl = addVertex(fStart, -feat.depth);
        const v_feat_end = addVertex(fStart, 0);

        segments.push({
          id: `e_tab_r_${feat.id}`,
          startVertexId: v_feat_start,
          endVertexId: v_t_tr,
          edgeIndex: 2,
          geometry: { kind: "line" },
        });
        segments.push({
          id: `e_tab_top_${feat.id}`,
          startVertexId: v_t_tr,
          endVertexId: v_t_tl,
          edgeIndex: 2,
          geometry: { kind: "line" },
        });
        segments.push({
          id: `e_tab_l_${feat.id}`,
          startVertexId: v_t_tl,
          endVertexId: v_feat_end,
          edgeIndex: 2,
          geometry: { kind: "line" },
        });
        v_last = v_feat_end;
      } else if (feat.featureKind === "slot") {
        const v_s_br = addVertex(fEnd, feat.depth);
        const v_s_bl = addVertex(fStart, feat.depth);
        const v_feat_end = addVertex(fStart, 0);

        segments.push({
          id: `e_slot_r_${feat.id}`,
          startVertexId: v_feat_start,
          endVertexId: v_s_br,
          edgeIndex: 2,
          geometry: { kind: "line" },
        });
        segments.push({
          id: `e_slot_bottom_${feat.id}`,
          startVertexId: v_s_br,
          endVertexId: v_s_bl,
          edgeIndex: 2,
          geometry: { kind: "line" },
        });
        segments.push({
          id: `e_slot_l_${feat.id}`,
          startVertexId: v_s_bl,
          endVertexId: v_feat_end,
          edgeIndex: 2,
          geometry: { kind: "line" },
        });
        v_last = v_feat_end;
      } else if (feat.featureKind === "arc") {
        const v_feat_end = addVertex(fStart, 0);
        segments.push({
          id: `e_arc_${feat.id}`,
          startVertexId: v_feat_start,
          endVertexId: v_feat_end,
          edgeIndex: 2,
          geometry: {
            kind: "arc",
            center: { x: center, y: 0 },
            radius: feat.radius ?? feat.width / 2,
            startAngleRad: 0,
            endAngleRad: Math.PI,
          },
        });
        v_last = v_feat_end;
      } else {
        const v_feat_end = addVertex(fStart, 0);
        segments.push({
          id: `e_feat_${feat.id}`,
          startVertexId: v_feat_start,
          endVertexId: v_feat_end,
          edgeIndex: 2,
          geometry: { kind: "line" },
        });
        v_last = v_feat_end;
      }
    }

    const v_tl = addVertex(0, 0);
    segments.push({
      id: "e_top_trail",
      startVertexId: v_last,
      endVertexId: v_tl,
      edgeIndex: 2,
      geometry: { kind: "line" },
    });
    v_last = v_tl;
  }

  // 4. Left edge (Edge 3: top to bottom)
  segments.push({
    id: "e_left",
    startVertexId: v_last,
    endVertexId: v_bl,
    edgeIndex: 3,
    geometry: { kind: "line" },
    name: "Left Edge",
  });

  const boundary: BoundaryLoop = {
    id: "boundary_pipeline",
    isOuter: true,
    edgeSegments: segments,
  };

  // Sample discrete polyline outline
  const sampledOutline: Vec2[] = [];
  for (const seg of boundary.edgeSegments) {
    const v = vertices[seg.startVertexId];
    if (v) sampledOutline.push({ x: v.x, y: v.y });
  }

  // Compute deterministic hash signature of output geometry
  const hash = sampledOutline.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join("|");

  return {
    boundary,
    vertices,
    sampledOutline,
    hash,
  };
}
