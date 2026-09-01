/**
 * Piece Segmentation Evaluation Engine (Phase 44).
 * Evaluates predicted piece detections against ground-truth canonical pieces.
 */
import type { BoundingBox2D, PieceDetection, PieceSegmentationEvaluationReport, PieceSegmentationResult } from "./types";
import type { CanonicalPiece } from "../canonical/types";

export class PieceSegmentationEvaluator {
  /**
   * Evaluates segmentation prediction against ground truth.
   */
  static evaluate(
    prediction: PieceSegmentationResult,
    groundTruthPieces: CanonicalPiece[]
  ): PieceSegmentationEvaluationReport {
    const gtCount = groundTruthPieces.length;
    const predDetections = prediction.detections;

    let tp = 0;
    let fp = 0;
    let totalIoU = 0;
    const matchedGt = new Set<string>();

    predDetections.forEach((det) => {
      // Find ground truth piece with matching ID or bounding box overlap
      const gtMatch = groundTruthPieces.find((gt) => gt.id === det.pieceId);
      if (gtMatch && !matchedGt.has(gtMatch.id)) {
        tp++;
        matchedGt.add(gtMatch.id);

        const gtBbox: BoundingBox2D = {
          x: 0,
          y: 0,
          width: gtMatch.dimensions.width,
          height: gtMatch.dimensions.height,
        };
        totalIoU += this.computeIoU(det.boundingBox, gtBbox);
      } else {
        fp++;
      }
    });

    const fn = Math.max(0, gtCount - tp);

    const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1.0;
    const meanIoU = tp > 0 ? totalIoU / tp : (predDetections.length === 0 && gtCount === 0 ? 1.0 : 0.0);

    const countDiff = Math.abs(gtCount - prediction.detectedPieceCount);
    const pieceCountAccuracy = Math.max(0, 1.0 - countDiff / Math.max(1, gtCount));

    return {
      precision,
      recall,
      iou: meanIoU,
      pieceCountAccuracy,
      tpCount: tp,
      fpCount: fp,
      fnCount: fn,
    };
  }

  /**
   * Computes Intersection over Union (IoU) between two 2D bounding boxes.
   */
  static computeIoU(b1: BoundingBox2D, b2: BoundingBox2D): number {
    const xOverlap = Math.max(0, Math.min(b1.x + b1.width, b2.x + b2.width) - Math.max(b1.x, b2.x));
    const yOverlap = Math.max(0, Math.min(b1.y + b1.height, b2.y + b2.height) - Math.max(b1.y, b2.y));
    const intersectionArea = xOverlap * yOverlap;

    const area1 = b1.width * b1.height;
    const area2 = b2.width * b2.height;
    const unionArea = area1 + area2 - intersectionArea;

    return unionArea > 0 ? intersectionArea / unionArea : 0.0;
  }
}
