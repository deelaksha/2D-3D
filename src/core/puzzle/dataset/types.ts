/**
 * Small Pilot Dataset Subsystem Types (Step 39).
 */
import type { DatasetAcceptanceStatus } from "../validation/types";
import type { AnnotationStatus } from "../annotation/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { RealPipelineResult } from "../ingestion/pipeline/types";

export type PilotProcessingStatus = "SUCCESS" | "FAILED" | "AMBIGUOUS";

export interface PilotDatasetItemRecord {
  id: string;
  name: string;
  category: "simple_box" | "complex_furniture" | "non_planar_joint" | "invalid_drawing" | "multi_piece";
  sourceFilename: string;
  version: number;
  processingStatus: PilotProcessingStatus;
  validationStatus: DatasetAcceptanceStatus;
  annotationStatus: AnnotationStatus;
  pipelineResult?: RealPipelineResult;
  puzzle?: CanonicalPuzzle;
  manualCorrectionsCount: number;
}

export interface PilotDatasetSummaryReport {
  timestamp: string;
  totalExamples: number;
  successfulImports: number;
  failedImports: number;
  ambiguousCases: number;
  validationFailures: number;
  manualCorrections: number;
  items: PilotDatasetItemRecord[];
}
