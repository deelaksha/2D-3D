/**
 * Parametric Feature Prediction Inference & Evaluation Types (Phase 47).
 */
import type { Vec2 } from "@/core/model/types";

export type ParameterPredictionName =
  | "tab_width"
  | "tab_depth"
  | "tab_position"
  | "slot_width"
  | "slot_depth"
  | "slot_position"
  | "radius"
  | "edge_offset"
  | "clearance"
  | "thickness"
  | "width"
  | "height";

export interface ObservedGeometryRegion {
  regionId: string;
  pieceId: string;
  boundaryPoints: Vec2[];
  description: string;
}

export interface ParameterPrediction {
  predictionId: string;
  pieceId: string;
  parameterName: ParameterPredictionName;
  value: number;
  unit: "mm" | "deg" | "ratio";
  confidenceScore: number; // 0.0 to 1.0
  source: "analytical_fitting" | "ml_regression_model" | "manual_review";
  observedRegion: ObservedGeometryRegion;
  isValidParam: boolean;
  validationError?: string;
}

export interface ParameterPredictionResult {
  resultId: string;
  pieceId: string;
  predictions: ParameterPrediction[];
  overallConfidence: number;
  processingDurationMs: number;
}

export interface ParameterEvaluationReport {
  meanAbsoluteError: number;   // MAE in mm
  rootMeanSquareError: number; // RMSE in mm
  withinToleranceRate: number; // Proportion within <= 0.5mm tolerance
  evaluatedCount: number;
}
