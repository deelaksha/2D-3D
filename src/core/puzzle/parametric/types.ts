/**
 * 2D Parametric Piece Domain Models.
 *
 * Explicitly separates:
 * 1. Topology (Vertices, Boundary loops, Edge segments, Holes)
 * 2. Geometry (Exact primitive curves: Lines, Arcs, Bezier curves)
 * 3. Parameters (Named parameters e.g. tab_width, tab_depth, tab_radius, edge_position)
 */
import type { ID, Vec2 } from "@/core/model/types";

/* ------------------------------------------------------------------ */
/* 1. Topology                                                         */
/* ------------------------------------------------------------------ */

export interface Vertex2D {
  id: ID;
  x: number;
  y: number;
}

export type SegmentPrimitiveKind = "line" | "arc" | "bezier";

export interface LineSegmentGeometry {
  kind: "line";
}

export interface ArcSegmentGeometry {
  kind: "arc";
  center: Vec2;
  radius: number;
  startAngleRad: number;
  endAngleRad: number;
  counterClockwise?: boolean;
}

export interface BezierSegmentGeometry {
  kind: "bezier";
  /** Cubic or quadratic Bezier control points in local 2D space. */
  controlPoints: Vec2[];
}

export type SegmentGeometry =
  | LineSegmentGeometry
  | ArcSegmentGeometry
  | BezierSegmentGeometry;

export interface EdgeSegment {
  id: ID;
  startVertexId: ID;
  endVertexId: ID;
  edgeIndex: number;
  geometry: SegmentGeometry;
  name?: string;
}

export interface BoundaryLoop {
  id: ID;
  isOuter: boolean;
  edgeSegments: EdgeSegment[];
}

export interface PieceTopology {
  vertices: Record<ID, Vertex2D>;
  outerBoundary: BoundaryLoop;
  holes: BoundaryLoop[];
}

/* ------------------------------------------------------------------ */
/* 2. Parameters                                                       */
/* ------------------------------------------------------------------ */

export interface ParametricDefinition {
  id: ID;
  name: string;
  value: number;
  defaultValue: number;
  expression?: string;
  minValue?: number;
  maxValue?: number;
  description?: string;
}

/* ------------------------------------------------------------------ */
/* 3. Manufacturing & Local 2D Frame                                  */
/* ------------------------------------------------------------------ */

export interface ParametricLocalFrame2D {
  origin: Vec2;
  xAxis: Vec2;
  yAxis: Vec2;
}

export interface ManufacturingTolerances {
  kerf: number;
  cutterRadius: number;
  slotClearance: number;
}

/* ------------------------------------------------------------------ */
/* Top-Level 2D Parametric Piece                                      */
/* ------------------------------------------------------------------ */

export interface ParametricPiece2D {
  id: ID;
  name: string;
  width: number;
  height: number;
  thickness: number;
  materialId: ID;
  localFrame: ParametricLocalFrame2D;
  manufacturing: ManufacturingTolerances;
  /** Named parameters driving dynamic geometry generation. */
  parameters: Record<string, ParametricDefinition>;
  /** Exact topological & geometric representation. */
  topology: PieceTopology;
  /** Sampled discrete polyline loops (mm) for rendering & extrusions. */
  sampledOutlines: Vec2[][];
}
