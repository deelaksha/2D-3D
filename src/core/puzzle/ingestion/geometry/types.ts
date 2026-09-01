/**
 * Real 2D Geometry Extraction Types.
 */
import type { Vec2 } from "@/core/model/types";
import type { PieceTopology } from "../../parametric/types";
import type { CanonicalPiece } from "../../canonical/types";

export interface ExactLinePrimitive {
  kind: "line";
  id: string;
  start: Vec2;
  end: Vec2;
  length: number;
}

export interface ExactArcPrimitive {
  kind: "arc";
  id: string;
  center: Vec2;
  radius: number;
  startAngleRad: number;
  endAngleRad: number;
  counterClockwise: boolean;
}

export interface ExactCirclePrimitive {
  kind: "circle";
  id: string;
  center: Vec2;
  radius: number;
}

export interface ExactSplinePrimitive {
  kind: "spline";
  id: string;
  controlPoints: Vec2[];
  degree: number;
  knots?: number[];
}

export type ExactPrimitive =
  | ExactLinePrimitive
  | ExactArcPrimitive
  | ExactCirclePrimitive
  | ExactSplinePrimitive;

export interface ExtractedDimension {
  id: string;
  type: "linear" | "radial" | "diameter";
  valueMm: number;
  text: string;
  startPoint?: Vec2;
  endPoint?: Vec2;
}

export interface ExtractedLabel {
  id: string;
  text: string;
  position: Vec2;
  layerName?: string;
  targetElementId?: string;
}

export interface GeometricValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  elementId?: string;
  location?: Vec2;
}

export interface Extracted2DGeometryResult {
  sourceFilename: string;
  primitives: ExactPrimitive[];
  topologies: PieceTopology[];
  dimensions: ExtractedDimension[];
  labels: ExtractedLabel[];
  canonicalPieces: CanonicalPiece[];
  validationIssues: GeometricValidationIssue[];
  isValid: boolean;
}
