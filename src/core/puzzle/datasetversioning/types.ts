/**
 * Dataset Versioning & Quality Management Subsystem Types (Phase 63).
 *
 * Enforces mandatory 7-point version metadata on every dataset example,
 * immutable snapshots with root cryptographic hashes, manifests,
 * comprehensive quality auditing across 9 defect categories,
 * deep version diffing, and a 5-state release lifecycle.
 */
import type { ID } from "@/core/model/types";
import type { RealDatasetExample } from "../realdata/types";

/**
 * 5 Dataset Release Lifecycle States.
 */
export type DatasetLifecycleStatus =
  | "DRAFT"
  | "REVIEW"
  | "APPROVED"
  | "TRAINING"
  | "DEPRECATED";

/**
 * Mandatory 7-Point Version Metadata required on every dataset example.
 */
export interface DatasetExampleVersionMetadata {
  example_id: string;
  schema_version: string;
  dataset_version: string;
  source_version: string;
  annotation_version: string;
  geometry_version: string;
  validation_version: string;
}

/**
 * Dataset split assignment.
 */
export type DatasetSplitName = "train" | "validation" | "test" | "unassigned";

/**
 * Fully versioned dataset example combining the base RealDatasetExample
 * with the mandatory 7-point version metadata and split allocation.
 */
export interface VersionedDatasetExample extends RealDatasetExample {
  versionMetadata: DatasetExampleVersionMetadata;
  split: DatasetSplitName;
}

/**
 * Manifest item entry for cataloging and checksum verification.
 */
export interface ManifestItemEntry {
  exampleId: string;
  sourceFile: string;
  split: DatasetSplitName;
  checksumSha256: string;
  pieceCount: number;
  interfaceCount: number;
  connectionCount: number;
  versionMetadata: DatasetExampleVersionMetadata;
}

/**
 * Serialized Dataset Manifest schema.
 */
export interface DatasetManifestPayload {
  manifestVersion: string;
  datasetId: string;
  datasetVersion: string;
  status: DatasetLifecycleStatus;
  createdIso: string;
  lockedIso?: string;
  rootSnapshotHash: string;
  isImmutable: boolean;
  totalExamples: number;
  splitsCount: {
    train: number;
    validation: number;
    test: number;
    unassigned: number;
  };
  itemEntries: ManifestItemEntry[];
  metadata?: Record<string, unknown>;
}

/**
 * The 9 Defect Categories detected by the Dataset Quality Auditor.
 */
export type QualityDefectCategory =
  | "duplicate_examples"
  | "conflicting_annotations"
  | "missing_fields"
  | "invalid_geometry"
  | "invalid_connections"
  | "invalid_assemblies"
  | "missing_ground_truth"
  | "data_leakage"
  | "near_duplicate_train_test";

export type DefectSeverity = "CRITICAL" | "WARNING" | "INFO";

/**
 * Specific defect identified during dataset quality auditing.
 */
export interface QualityDefect {
  defectId: string;
  category: QualityDefectCategory;
  severity: DefectSeverity;
  message: string;
  exampleIds: string[];
  details?: Record<string, unknown>;
}

/**
 * Comprehensive Dataset Quality Audit Report.
 */
export interface DatasetQualityReport {
  reportId: string;
  datasetVersion: string;
  generatedIso: string;
  isApprovedForTraining: boolean;
  overallScore: number;
  totalExamplesAudited: number;
  criticalDefectsCount: number;
  warningDefectsCount: number;
  categorySummaries: Record<
    QualityDefectCategory,
    {
      category: QualityDefectCategory;
      passed: boolean;
      defectCount: number;
      defects: QualityDefect[];
    }
  >;
  allDefects: QualityDefect[];
}

/**
 * Deep difference between two dataset versions or snapshots.
 */
export interface DatasetDiffReport {
  baseVersion: string;
  targetVersion: string;
  generatedIso: string;
  totalChanges: number;
  statusChange?: {
    from: DatasetLifecycleStatus;
    to: DatasetLifecycleStatus;
  };
  addedExamples: string[];
  removedExamples: string[];
  modifiedExamples: Array<{
    exampleId: string;
    changedAspects: Array<"geometry" | "interfaces" | "connections" | "parameters" | "assembly" | "split">;
    details: string[];
  }>;
  unchangedExamplesCount: number;
}
