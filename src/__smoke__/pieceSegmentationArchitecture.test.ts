import { describe, expect, it } from "vitest";
import { DeterministicVectorSegmentationModel, ManualCorrectionSegmentationAdapter, MockVisionMLSegmentationModel } from "../core/puzzle/segmentation/pieceSegmentationModel";
import { PieceSegmentationEvaluator } from "../core/puzzle/segmentation/pieceSegmentationEvaluator";
import type { Extracted2DGeometryResult } from "../core/puzzle/ingestion/geometry/types";
import { createCanonicalPiece } from "../core/puzzle/canonical/defaults";
import type { VersionedPuzzleAnnotation } from "../core/puzzle/annotation/types";

describe("Piece Segmentation Architecture & Evaluator (Phase 44)", () => {
  const piece1 = createCanonicalPiece("Piece 1", { width: 100, height: 50, depth: 3.0 }, 3.0);
  piece1.id = "p_1";

  const piece2 = createCanonicalPiece("Piece 2", { width: 100, height: 50, depth: 3.0 }, 3.0);
  piece2.id = "p_2";

  const mockGeomResult: Extracted2DGeometryResult = {
    sourceFilename: "test_drawing.svg",
    primitives: [],
    topologies: [],
    dimensions: [],
    labels: [],
    canonicalPieces: [piece1, piece2],
    validationIssues: [],
    isValid: true,
  };

  it("1. DeterministicVectorSegmentationModel extracts piece detections from vector geometry", async () => {
    const model = new DeterministicVectorSegmentationModel();
    const result = await model.segmentPieces(mockGeomResult);

    expect(result.detectedPieceCount).toBe(2);
    expect(result.detections[0].pieceId).toBe("p_1");
    expect(result.detections[0].confidenceScore).toBe(0.98);
    expect(result.detections[0].segmentationSource).toBe("vector_graph");
  });

  it("2. MockVisionMLSegmentationModel predicts image-based detections with confidence scores", async () => {
    const model = new MockVisionMLSegmentationModel();
    const result = await model.segmentPieces(mockGeomResult);

    expect(result.detectedPieceCount).toBe(2);
    expect(result.detections[0].confidenceScore).toBe(0.89);
    expect(result.detections[0].segmentationSource).toBe("image_ml_model");
  });

  it("3. ManualCorrectionSegmentationAdapter overrides raw detections using human review annotations", async () => {
    const model = new MockVisionMLSegmentationModel();
    const rawResult = await model.segmentPieces(mockGeomResult);

    const annotation: VersionedPuzzleAnnotation = {
      annotationId: "ann_1",
      puzzleId: "test_drawing.svg",
      version: 1,
      reviewerId: "reviewer_1",
      createdIso: new Date().toISOString(),
      lastModifiedIso: new Date().toISOString(),
      status: "CORRECT",
      edits: [
        {
          editId: "edit_1",
          timestamp: new Date().toISOString(),
          reviewerId: "reviewer_1",
          target: "piece_id",
          targetId: "p_1",
          oldValue: null,
          newValue: "p_1_corrected",
        },
      ],
    };

    const corrected = ManualCorrectionSegmentationAdapter.applyManualCorrections(rawResult, annotation);

    expect(corrected.detections[0].confidenceScore).toBe(1.0);
    expect(corrected.detections[0].segmentationSource).toBe("manual_review");
  });

  it("4. PieceSegmentationEvaluator evaluates precision, recall, IoU, and piece-count accuracy", async () => {
    const model = new DeterministicVectorSegmentationModel();
    const result = await model.segmentPieces(mockGeomResult);

    const gtPieces = [piece1, piece2];

    const evalReport = PieceSegmentationEvaluator.evaluate(result, gtPieces);

    expect(evalReport.precision).toBe(1.0);
    expect(evalReport.recall).toBe(1.0);
    expect(evalReport.pieceCountAccuracy).toBe(1.0);
    expect(evalReport.tpCount).toBe(2);
    expect(evalReport.fpCount).toBe(0);
    expect(evalReport.fnCount).toBe(0);
  });
});
