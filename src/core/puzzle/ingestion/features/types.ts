/**
 * Parametric Feature Extraction Types.
 */
import type { FeatureDiagnostics } from "./diagnostics";

export type ExtractionMethod =
  | "analytical_fitting"
  | "contour_bounding_box"
  | "hole_circle_fit"
  | "dimension_annotation"
  | "raw_geometry_fallback";

export type FeatureCategory = "footprint" | "tab" | "slot" | "notch" | "hole" | "custom";

export interface ParametricFeature {
  id: string;
  name: string;
  value: number;
  unit: "mm" | "deg" | "ratio";
  sourceGeometry: string;
  confidence: number;
  extractionMethod: ExtractionMethod;
  minValue?: number;
  maxValue?: number;
  category: FeatureCategory;
}

export interface FeatureExtractionResult {
  success: boolean;
  pieceId: string;
  parameters: ParametricFeature[];
  preservedRawGeometries: string[];
  diagnostics: FeatureDiagnostics;
  durationMs: number;
}
