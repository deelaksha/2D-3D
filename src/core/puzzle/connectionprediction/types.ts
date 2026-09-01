/**
 * Connection Prediction Inference & Evaluation Types (Phase 46).
 */
import type { Vec3 } from "@/core/model/types";
import type { CanonicalConnection } from "../canonical/types";

export type ConnectionPredictionType =
  | "tab_slot"
  | "finger_joint"
  | "interlock"
  | "flat_contact"
  | "none";

export interface RelativeOrientation3D {
  rxDeg: number;
  ryDeg: number;
  rzDeg: number;
}

export interface AllowedAngleRangeSpec {
  minAngleDeg: number;
  maxAngleDeg: number;
  targetAngleDeg: number;
}

export interface TranslationConstraintsSpec {
  freeX: boolean;
  freeY: boolean;
  freeZ: boolean;
}

export interface ConnectionPrediction {
  predictionId: string;
  sourcePieceId: string;
  sourceInterfaceId: string;
  targetPieceId: string;
  targetInterfaceId: string;
  compatible: boolean;
  connectionType: ConnectionPredictionType;
  confidenceScore: number; // 0.0 to 1.0
  possibleRelativeOrientation: RelativeOrientation3D;
  allowedAngleRange: AllowedAngleRangeSpec;
  rotationAxis: Vec3;
  translationConstraints: TranslationConstraintsSpec;
  source: "rule_based_engine" | "gnn_ml_model" | "manual_review";
  canonicalConnection?: CanonicalConnection;
}

export interface ConnectionPredictionResult {
  resultId: string;
  predictions: ConnectionPrediction[];
  overallConfidence: number;
  processingDurationMs: number;
}

export interface ConnectionEvaluationReport {
  precision: number;          // TP / (TP + FP)
  recall: number;             // TP / (TP + FN)
  f1Score: number;            // 2 * (P * R) / (P + R)
  falsePositiveRate: number;  // FP / (FP + TN)
  falseNegativeRate: number;  // FN / (FN + TP)
  tpCount: number;
  fpCount: number;
  tnCount: number;
  fnCount: number;
}
