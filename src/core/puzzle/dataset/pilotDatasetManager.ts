/**
 * Small Pilot Dataset Manager (Step 39).
 * Manages a small manually selected representative pilot sample executing the 11-step curation pipeline:
 *   [1] Import -> [2] Normalize -> [3] Extract Geometry -> [4] Segment Pieces ->
 *   [5] Detect Interfaces -> [6] Infer Connections -> [7] Extract Parameters -> [8] Canonical IR ->
 *   [9] Reconstruct 3D -> [10] Validate -> [11] Manual Review
 */
import type { PilotDatasetItemRecord, PilotDatasetSummaryReport } from "./types";
import { RealDataIngestionPipeline } from "../ingestion/pipeline/realDataIngestionPipeline";
import { DatasetQualityValidator } from "../validation/datasetQualityValidator";
import { PuzzleReviewManager } from "../annotation/reviewManager";
import type { RawFilePayload } from "../ingestion/types";

export interface FixtureSampleItem {
  id: string;
  name: string;
  category: PilotDatasetItemRecord["category"];
  payload: RawFilePayload;
}

export class PilotDatasetManager {
  private items: PilotDatasetItemRecord[] = [];
  private reviewManager = new PuzzleReviewManager();

  /**
   * Processes a representative pilot sample through the 11-step curation pipeline.
   */
  processSampleItem(sample: FixtureSampleItem): PilotDatasetItemRecord {
    // Steps 1–8: Ingestion Pipeline (Import, Normalize, Geometry, Segment, Interfaces, Connections, Parameters, Canonical IR)
    const pipelineResult = RealDataIngestionPipeline.processDrawing(sample.payload);

    let processingStatus: PilotDatasetItemRecord["processingStatus"] = "SUCCESS";
    if (!pipelineResult.success) {
      processingStatus = "FAILED";
    } else if (pipelineResult.diagnostics.hasWarnings()) {
      processingStatus = "AMBIGUOUS";
    }

    // Step 9: Reconstruct 3D (included in pipeline output)
    const puzzle = pipelineResult.puzzle;

    // Step 10: Validate Dataset Quality
    const validationReport = DatasetQualityValidator.validateItem(puzzle);

    // Step 11: Manual Review & Annotation Session
    const reviewSession = this.reviewManager.startReviewSession(puzzle, "pilot_curator");
    if (processingStatus === "SUCCESS" && validationReport.status === "PASS") {
      this.reviewManager.markStatus(puzzle.metadata.id, "CORRECT", "pilot_curator");
    }

    const record: PilotDatasetItemRecord = {
      id: sample.id,
      name: sample.name,
      category: sample.category,
      sourceFilename: sample.payload.filename,
      version: 1,
      processingStatus,
      validationStatus: validationReport.status,
      annotationStatus: reviewSession.status,
      pipelineResult,
      puzzle,
      manualCorrectionsCount: reviewSession.edits.length,
    };

    this.items.push(record);
    return record;
  }

  /**
   * Generates the summary report for the small pilot dataset.
   */
  generateSummaryReport(): PilotDatasetSummaryReport {
    const totalExamples = this.items.length;
    const successfulImports = this.items.filter((i) => i.processingStatus === "SUCCESS").length;
    const failedImports = this.items.filter((i) => i.processingStatus === "FAILED").length;
    const ambiguousCases = this.items.filter((i) => i.processingStatus === "AMBIGUOUS").length;
    const validationFailures = this.items.filter((i) => i.validationStatus === "FAIL").length;
    const manualCorrections = this.items.reduce((sum, i) => sum + i.manualCorrectionsCount, 0);

    return {
      timestamp: new Date().toISOString(),
      totalExamples,
      successfulImports,
      failedImports,
      ambiguousCases,
      validationFailures,
      manualCorrections,
      items: this.items,
    };
  }
}
