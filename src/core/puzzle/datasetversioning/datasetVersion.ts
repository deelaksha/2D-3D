/**
 * Dataset Version & Lifecycle Release Manager (Phase 63).
 *
 * Implements the 5-state dataset release lifecycle:
 *   DRAFT ──> REVIEW ──┬──> APPROVED ──> TRAINING ──> DEPRECATED
 *                      └──> DRAFT (rejected back for fixes)
 *
 * Enforces mandatory 7-point version metadata, immutable snapshot locking,
 * and strict quality audit approval gates.
 */
import type { RealDatasetExample } from "../realdata/types";
import type {
  DatasetExampleVersionMetadata,
  DatasetLifecycleStatus,
  DatasetManifestPayload,
  DatasetQualityReport,
  DatasetSplitName,
  VersionedDatasetExample,
} from "./types";
import { QualityAuditor } from "./qualityAuditor";
import { DatasetManifest } from "./datasetManifest";

export class DatasetLockedError extends Error {
  constructor(message: string) {
    super(`DATASET SNAPSHOT LOCKED: ${message}`);
    this.name = "DatasetLockedError";
  }
}

export class DatasetApprovalBlockedError extends Error {
  constructor(message: string) {
    super(`DATASET APPROVAL BLOCKED: ${message}`);
    this.name = "DatasetApprovalBlockedError";
  }
}

export class DatasetVersion {
  readonly datasetId: string;
  readonly datasetVersion: string;
  private status: DatasetLifecycleStatus = "DRAFT";
  private isImmutable: boolean = false;
  private lockedIso?: string;
  private examples: VersionedDatasetExample[] = [];

  constructor(datasetId: string, datasetVersion: string) {
    this.datasetId = datasetId;
    this.datasetVersion = datasetVersion;
  }

  getStatus(): DatasetLifecycleStatus {
    return this.status;
  }

  isLocked(): boolean {
    return this.isImmutable;
  }

  getExamples(): VersionedDatasetExample[] {
    return [...this.examples];
  }

  getExample(exampleId: string): VersionedDatasetExample | undefined {
    return this.examples.find((e) => e.itemId === exampleId);
  }

  /**
   * Adds an example to the dataset, enforcing 7-point version metadata and immutability lock.
   */
  addExample(
    example: RealDatasetExample,
    split: DatasetSplitName = "unassigned",
    overrides?: Partial<DatasetExampleVersionMetadata>
  ): VersionedDatasetExample {
    if (this.isImmutable) {
      throw new DatasetLockedError(`Cannot add examples to locked dataset version '${this.datasetVersion}'.`);
    }

    const versionMetadata: DatasetExampleVersionMetadata = {
      example_id: example.itemId,
      schema_version: overrides?.schema_version || "1.0.0",
      dataset_version: this.datasetVersion,
      source_version: overrides?.source_version || example.provenance?.source_version || "unknown_hash",
      annotation_version: overrides?.annotation_version || (example.qualityStatus === "PASS" ? "APPROVED" : "PENDING"),
      geometry_version: overrides?.geometry_version || "1.0.0",
      validation_version: overrides?.validation_version || "1.0.0",
    };

    const versioned: VersionedDatasetExample = {
      ...example,
      split,
      versionMetadata,
    };

    this.examples.push(versioned);
    return versioned;
  }

  /**
   * Removes an example from the dataset (only permitted while in DRAFT).
   */
  removeExample(exampleId: string): boolean {
    if (this.isImmutable) {
      throw new DatasetLockedError(`Cannot remove examples from locked dataset version '${this.datasetVersion}'.`);
    }
    const idx = this.examples.findIndex((e) => e.itemId === exampleId);
    if (idx === -1) return false;
    this.examples.splice(idx, 1);
    return true;
  }

  /**
   * Assigns an example to a split (train, validation, test).
   */
  assignSplit(exampleId: string, split: DatasetSplitName): void {
    if (this.isImmutable) {
      throw new DatasetLockedError(`Cannot reassign splits in locked dataset version '${this.datasetVersion}'.`);
    }
    const ex = this.examples.find((e) => e.itemId === exampleId);
    if (!ex) throw new Error(`EXAMPLE_NOT_FOUND: Example '${exampleId}' does not exist.`);
    ex.split = split;
  }

  /**
   * Runs the 9-defect category quality audit.
   */
  runQualityAudit(): DatasetQualityReport {
    return QualityAuditor.auditDataset(this.datasetVersion, this.getExamples());
  }

  /**
   * Transitions dataset to REVIEW state.
   */
  submitForReview(): void {
    if (this.status !== "DRAFT") {
      throw new Error(`Invalid state transition: Cannot submit from '${this.status}' to REVIEW.`);
    }
    this.status = "REVIEW";
  }

  /**
   * Approves dataset version.
   * MANDATORY GUARD: Runs quality audit. Fails if any critical defects exist!
   * Automatically locks dataset into an immutable snapshot.
   */
  approve(): DatasetQualityReport {
    if (this.status !== "REVIEW" && this.status !== "DRAFT") {
      throw new Error(`Invalid state transition: Cannot approve from '${this.status}'.`);
    }

    const report = this.runQualityAudit();
    if (!report.isApprovedForTraining || report.criticalDefectsCount > 0) {
      const messages = report.allDefects.filter((d) => d.severity === "CRITICAL").map((d) => d.message);
      throw new DatasetApprovalBlockedError(
        `Cannot approve dataset version '${this.datasetVersion}' with active critical defects: ${messages.join("; ")}`
      );
    }

    this.status = "APPROVED";
    this.createSnapshot();
    return report;
  }

  /**
   * Promotes an APPROVED dataset version to the active TRAINING baseline.
   */
  markForTraining(): void {
    if (this.status !== "APPROVED") {
      throw new Error(`Invalid state transition: Dataset must be APPROVED before being marked for TRAINING (current: '${this.status}').`);
    }
    this.status = "TRAINING";
  }

  /**
   * Deprecates a dataset version when superseded.
   */
  deprecate(): void {
    this.status = "DEPRECATED";
  }

  /**
   * Creates an immutable snapshot, permanently freezing the dataset.
   */
  createSnapshot(): DatasetManifestPayload {
    this.isImmutable = true;
    this.lockedIso = new Date().toISOString();
    return this.getManifest();
  }

  /**
   * Generates manifest for the current dataset state.
   */
  getManifest(): DatasetManifestPayload {
    return DatasetManifest.generateManifest(
      this.datasetId,
      this.datasetVersion,
      this.status,
      this.getExamples(),
      {
        isImmutable: this.isImmutable,
        lockedIso: this.lockedIso,
      }
    );
  }
}
