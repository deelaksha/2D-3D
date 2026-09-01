/**
 * Interface Recognition Inference & Evaluation Types (Phase 45).
 */
import type { Vec2 } from "@/core/model/types";
import type { CanonicalInterface } from "../canonical/types";

export type InterfaceCandidateKind =
  | "tab"
  | "slot"
  | "notch"
  | "interlock"
  | "mating_profile"
  | "flat_contact"
  | "custom";

export interface LocalCoordinateFrame2D {
  origin: Vec2;
  xAxis: Vec2;
  yAxis: Vec2;
}

export interface InterfaceProfileParameters {
  widthMm?: number;
  depthMm?: number;
  positionMm?: number;
  radiusMm?: number;
}

export interface InterfacePrediction {
  predictionId: string;
  pieceId: string;
  kind: InterfaceCandidateKind;
  boundaryPoints: Vec2[];
  localFrame: LocalCoordinateFrame2D;
  parameters: InterfaceProfileParameters;
  confidenceScore: number; // 0.0 to 1.0
  source: "analytical_geometry" | "vision_ml_model" | "manual_review";
  canonicalInterface?: CanonicalInterface;
}

export interface InterfaceRecognitionResult {
  recognitionId: string;
  pieceId: string;
  predictions: InterfacePrediction[];
  overallConfidence: number;
  processingDurationMs: number;
}

export interface InterfaceRecognitionEvaluationReport {
  precision: number;      // TP / (TP + FP)
  recall: number;         // TP / (TP + FN)
  f1Score: number;        // 2 * (P * R) / (P + R)
  typeAccuracy: number;   // Proportion of correctly classified interface kinds
  tpCount: number;
  fpCount: number;
  fnCount: number;
}
