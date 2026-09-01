/**
 * Real-File Ingestion and Normalization Types.
 */
import type { Vec2, Vec3 } from "@/core/model/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { ImportDiagnostics } from "./diagnostics";

export type DetectedFileType =
  | "dxf"
  | "svg"
  | "step"
  | "stl"
  | "obj"
  | "png"
  | "jpg"
  | "json"
  | "project_json"
  | "canonical_json"
  | "unknown";

export interface RawFilePayload {
  filename: string;
  format?: string;
  content: string | Uint8Array;
  metadata?: Record<string, unknown>;
}

export interface RawVectorPath {
  id: string;
  points: Vec2[];
  closed: boolean;
  layerName?: string;
  color?: string;
  strokeWidth?: number;
}

export interface IngestedDrawing {
  sourceFilename: string;
  detectedFormat: DetectedFileType;
  units: "mm" | "cm" | "inch" | "px";
  scaleToMmFactor: number;
  paths: RawVectorPath[];
  rawBoundingBox: { min: Vec2; max: Vec2 };
}

export interface NormalizedDrawing {
  sourceFilename: string;
  units: "mm";
  paths: RawVectorPath[];
  bounds: { min: Vec2; max: Vec2; width: number; height: number };
  simplifiedPathCount: number;
}

export interface ExtractedContour2D {
  id: string;
  outerLoop: Vec2[];
  holes: Vec2[][];
  area: number;
  perimeter: number;
  bounds: { min: Vec2; max: Vec2; width: number; height: number };
}

export interface SegmentedPiece2D {
  pieceId: string;
  pieceName: string;
  contour: ExtractedContour2D;
  localOrigin: Vec2;
  localOuterLoop: Vec2[];
  localHoles: Vec2[][];
  materialThicknessMm: number;
}

export interface NormalizedRepresentation {
  sourceFilename: string;
  detectedFileType: DetectedFileType;
  units: "mm";
  scaleToMmFactor: number;
  yAxisOrientation: "y_up" | "y_down";
  contours: ExtractedContour2D[];
  segmentedPieces: SegmentedPiece2D[];
  meshVertices3D?: Vec3[];
  meshFaces3D?: number[][];
  estimatedMaterialThicknessMm: number;
  metadata?: Record<string, unknown>;
}

export interface ImportResult {
  success: boolean;
  sourceFilename: string;
  detectedFileType: DetectedFileType;
  puzzle?: CanonicalPuzzle;
  normalized?: NormalizedRepresentation;
  diagnostics: ImportDiagnostics;
  durationMs: number;
}
