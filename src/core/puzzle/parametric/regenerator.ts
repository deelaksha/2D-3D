/**
 * Geometry & Topology Regeneration Engine for 2D Parametric Pieces.
 *
 * CRITICAL REQUIREMENT:
 * A piece must be regeneratable from its parameters.
 * Changing parameters such as `tab_width`, `tab_depth`, `tab_radius`, `edge_position`
 * automatically regenerates the corresponding 2D topology and geometry.
 */
import type { Vec2 } from "@/core/model/types";
import type {
  BoundaryLoop,
  EdgeSegment,
  ParametricPiece2D,
  PieceTopology,
  Vertex2D,
} from "./types";
import { evaluateParameterStore } from "./evaluator";
import { uid } from "@/core/model/ids";
import { rotate } from "@/core/geometry/vec";

export function createDefaultParametricPiece2D(
  width = 100,
  height = 100,
  thickness = 2.0,
): ParametricPiece2D {
  const piece: ParametricPiece2D = {
    id: uid("param_p_"),
    name: "Parametric Cardboard Piece",
    width,
    height,
    thickness,
    materialId: "cardboard-2mm",
    localFrame: {
      origin: { x: 0, y: 0 },
      xAxis: { x: 1, y: 0 },
      yAxis: { x: 0, y: 1 },
    },
    manufacturing: {
      kerf: 0.1,
      cutterRadius: 1.0,
      slotClearance: 0.15,
    },
    parameters: {
      width: { id: "p_w", name: "width", value: width, defaultValue: width, minValue: 10 },
      height: { id: "p_h", name: "height", value: height, defaultValue: height, minValue: 10 },
      tab_width: { id: "p_tw", name: "tab_width", value: 20, defaultValue: 20, minValue: 2 },
      tab_depth: { id: "p_td", name: "tab_depth", value: 5, defaultValue: 5, minValue: 0 },
      tab_radius: { id: "p_tr", name: "tab_radius", value: 1.5, defaultValue: 1.5, minValue: 0 },
      edge_position: { id: "p_ep", name: "edge_position", value: width / 2, defaultValue: width / 2 },
      hole_radius: { id: "p_hr", name: "hole_radius", value: 4, defaultValue: 4, minValue: 0 },
    },
    topology: {
      vertices: {},
      outerBoundary: { id: "outer", isOuter: true, edgeSegments: [] },
      holes: [],
    },
    sampledOutlines: [],
  };

  return regenerateParametricPieceGeometry(piece);
}

export function regenerateParametricPieceGeometry(
  piece: ParametricPiece2D,
  parameterOverrides: Record<string, number> = {},
): ParametricPiece2D {
  // 1. Evaluate current parameter values
  const vars = evaluateParameterStore(piece.parameters, parameterOverrides);

  const w = vars.width ?? piece.width;
  const h = vars.height ?? piece.height;
  const tw = vars.tab_width ?? 20;
  const td = vars.tab_depth ?? 5;
  const tr = vars.tab_radius ?? 0;
  const ep = vars.edge_position ?? w / 2;
  const hr = vars.hole_radius ?? 0;

  const vertices: Record<string, Vertex2D> = {};
  let vIdx = 0;

  function addVertex(x: number, y: number): string {
    const id = `v_${++vIdx}`;
    vertices[id] = { id, x, y };
    return id;
  }

  // 2. Generate outer boundary vertices incorporating parametric tab/slot on top edge
  const segments: EdgeSegment[] = [];

  // Bottom edge (left to right)
  const v_bl = addVertex(0, h);
  const v_br = addVertex(w, h);

  // Right edge (bottom to top)
  const v_tr = addVertex(w, 0);

  // Top edge with parametric tab centered at edge_position (ep)
  const tabStart = Math.max(0, ep - tw / 2);
  const tabEnd = Math.min(w, ep + tw / 2);

  const v_t1 = addVertex(w, 0); // start of top edge from right
  const v_t_tab_right = addVertex(tabEnd, 0);
  const v_t_tab_top_right = addVertex(tabEnd, -td);
  const v_t_tab_top_left = addVertex(tabStart, -td);
  const v_t_tab_left = addVertex(tabStart, 0);
  const v_tl = addVertex(0, 0);

  // Build EdgeSegments for outer boundary
  segments.push({
    id: "e_bottom",
    startVertexId: v_bl,
    endVertexId: v_br,
    edgeIndex: 0,
    geometry: { kind: "line" },
    name: "Bottom Straight Edge",
  });

  segments.push({
    id: "e_right",
    startVertexId: v_br,
    endVertexId: v_tr,
    edgeIndex: 1,
    geometry: { kind: "line" },
    name: "Right Edge",
  });

  // Top edge segments (including tab geometry)
  segments.push({
    id: "e_top_right",
    startVertexId: v_tr,
    endVertexId: v_t_tab_right,
    edgeIndex: 2,
    geometry: { kind: "line" },
  });

  // Tab right riser edge
  segments.push({
    id: "e_tab_riser_right",
    startVertexId: v_t_tab_right,
    endVertexId: v_t_tab_top_right,
    edgeIndex: 2,
    geometry: tr > 0
      ? {
          kind: "arc",
          center: { x: tabEnd, y: -td / 2 },
          radius: tr,
          startAngleRad: 0,
          endAngleRad: Math.PI / 2,
        }
      : { kind: "line" },
    name: "Tab Right Riser",
  });

  // Tab top flat edge
  segments.push({
    id: "e_tab_top",
    startVertexId: v_t_tab_top_right,
    endVertexId: v_t_tab_top_left,
    edgeIndex: 2,
    geometry: { kind: "line" },
    name: "Tab Top Edge",
  });

  // Tab left riser edge
  segments.push({
    id: "e_tab_riser_left",
    startVertexId: v_t_tab_top_left,
    endVertexId: v_t_tab_left,
    edgeIndex: 2,
    geometry: { kind: "line" },
    name: "Tab Left Riser",
  });

  // Top left flat edge
  segments.push({
    id: "e_top_left",
    startVertexId: v_t_tab_left,
    endVertexId: v_tl,
    edgeIndex: 2,
    geometry: { kind: "line" },
  });

  // Left edge (top to bottom)
  segments.push({
    id: "e_left",
    startVertexId: v_tl,
    endVertexId: v_bl,
    edgeIndex: 3,
    geometry: { kind: "line" },
    name: "Left Edge",
  });

  const outerBoundary: BoundaryLoop = {
    id: "outer_loop",
    isOuter: true,
    edgeSegments: segments,
  };

  // 3. Generate inner hole loop if hole_radius > 0
  const holes: BoundaryLoop[] = [];
  if (hr > 0) {
    const hcx = w / 2;
    const hcy = h / 2;
    const v_h1 = addVertex(hcx + hr, hcy);
    const v_h2 = addVertex(hcx, hcy - hr);
    const v_h3 = addVertex(hcx - hr, hcy);
    const v_h4 = addVertex(hcx, hcy + hr);

    holes.push({
      id: "hole_center",
      isOuter: false,
      edgeSegments: [
        {
          id: "e_hole_arc",
          startVertexId: v_h1,
          endVertexId: v_h1,
          edgeIndex: 4,
          geometry: {
            kind: "arc",
            center: { x: hcx, y: hcy },
            radius: hr,
            startAngleRad: 0,
            endAngleRad: Math.PI * 2,
          },
          name: "Center Circular Hole",
        },
      ],
    });
  }

  // 4. Sample discrete polyline loops for rendering / extrusion
  const sampledOuter: Vec2[] = [];
  for (const seg of outerBoundary.edgeSegments) {
    const sv = vertices[seg.startVertexId];
    if (sv) sampledOuter.push({ x: sv.x, y: sv.y });
  }

  const sampledOutlines: Vec2[][] = [sampledOuter];
  if (holes.length > 0) {
    const holeSample: Vec2[] = [];
    const hseg = holes[0].edgeSegments[0];
    if (hseg.geometry.kind === "arc") {
      const { center, radius } = hseg.geometry;
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        holeSample.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
      }
    }
    sampledOutlines.push(holeSample);
  }

  // 5. Update parameter values in piece definition
  const updatedParameters = { ...piece.parameters };
  for (const [k, v] of Object.entries(vars)) {
    if (updatedParameters[k]) {
      updatedParameters[k] = { ...updatedParameters[k], value: v };
    }
  }

  return {
    ...piece,
    width: w,
    height: h,
    parameters: updatedParameters,
    topology: {
      vertices,
      outerBoundary,
      holes,
    },
    sampledOutlines,
  };
}
