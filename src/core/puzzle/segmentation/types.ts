/**
 * Piece-Segmentation Inference & Evaluation Types (Phase 44).
 */
import type { Vec2 } from "@/core/model/types";
import type { CanonicalPiece } from "../canonical/types";

export interface BoundingBox2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PieceDetection {
  detectionId: string;
  pieceId: string;
  boundaryPolygon: Vec2[];
  boundingBox: BoundingBox2D;
  confidenceScore: number; // 0.0 to 1.0
  segmentationSource: "vector_graph" | "image_ml_model" | "manual_review";
  canonicalPiece?: CanonicalPiece;
}

export interface PieceSegmentationResult {
  segmentationId: string;
  sourceDrawing: string;
  detections: PieceDetection[];
  detectedPieceCount: number;
  overallConfidence: number;
  processingDurationMs: number;
}

export interface PieceSegmentationEvaluationReport {
  precision: number;          // TP / (TP + FP)
  recall: number;             // TP / (TP + FN)
  iou: number;                // Intersection over Union
  pieceCountAccuracy: number; // 1.0 - (|gtCount - predCount| / max(1, gtCount))
  tpCount: number;
  fpCount: number;
  fnCount: number;
}
