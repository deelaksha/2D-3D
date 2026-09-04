# Dataset Versioning & Quality Management Guide (Phase 63)

## 1. Executive Summary & Purpose

Phase 63 introduces the **Dataset Versioning & Quality-Management Subsystem** for the parametric 2D-to-3D puzzle ML pipeline.

Before any dataset examples are used to train machine learning models, they must be organized into strictly tracked releases, audited for defects, and sealed into **cryptographically verifiable, immutable snapshots**. This guarantees reproducibility, zero data leakage, auditability, and protection against corrupted training data.

---

## 2. Mandatory 7-Point Example Version Metadata

Every single example included in a dataset release must carry explicit 7-point version metadata:

```typescript
export interface DatasetExampleVersionMetadata {
  example_id: string;          // Unique dataset example identifier (e.g. "ex_cardboard_01")
  schema_version: string;      // Structural schema version (e.g. "1.0.0")
  dataset_version: string;     // Dataset release version (e.g. "v1.2.0")
  source_version: string;      // SHA-256 hash of original raw source file
  annotation_version: string;  // Human annotation certification status (e.g. "APPROVED")
  geometry_version: string;    // Version of deterministic geometry engine (e.g. "1.0.0")
  validation_version: string;  // Version of validation engine suite (e.g. "1.0.0")
}
```

---

## 3. The 5 Dataset Release Lifecycle States

```
DRAFT ──> REVIEW ──┬──> APPROVED ──> TRAINING ──> DEPRECATED
                   └──> DRAFT (rejected back for corrections)
```

| State | Scope & Constraints | Mutation Permitted? | ML Training Eligibility |
| :--- | :--- | :--- | :--- |
| **`DRAFT`** | Active compilation; examples being added, removed, or split. | **Yes** | Not eligible. |
| **`REVIEW`** | Locked for quality audit and human inspection. | **No** | Not eligible. |
| **`APPROVED`** | Passed all 9 quality audit checks with 0 critical defects. Automatically sealed into an **immutable snapshot**. | **No (Locked)** | Ready for training baseline. |
| **`TRAINING`** | Active production training baseline consumed by ML training pipelines. | **No (Locked)** | **Active Training Baseline**. |
| **`DEPRECATED`** | Superseded by newer dataset release; retained for historical reproducibility. | **No (Locked)** | Historical reference only. |

---

## 4. Immutable Dataset Snapshots & Manifests

When a dataset transitions to `APPROVED`, or when explicitly calling `dataset.createSnapshot()`:
1. **Mutation Lock**: The dataset is locked (`isImmutable = true`). Any subsequent `addExample()`, `removeExample()`, or `assignSplit()` throws `DatasetLockedError`.
2. **Item Checksums**: Computes individual SHA-256 checksums over each example's pieces, interfaces, connections, and assembly.
3. **Root Snapshot Hash**: Computes a deterministic root Merkle hash across all sorted item checksums:
   $$\text{RootHash} = \text{SHA256}(\text{Item}_1 \parallel \text{Item}_2 \parallel \dots \parallel \text{Item}_N)$$
4. **Dataset Manifest**: Serialized into a portable `DatasetManifestPayload` cataloging item entries, checksums, split allocations, and metadata.

---

## 5. The 9 Quality Defect Categories

The `QualityAuditor` rigorously scans the dataset collection and flags issues across 9 distinct categories:

| Category | Description | Severity |
| :--- | :--- | :--- |
| **1. `duplicate_examples`** | Multiple examples sharing identical raw content hashes or identical geometry signatures. | **CRITICAL** |
| **2. `conflicting_annotations`** | Identical raw geometry labeled with conflicting difficulty levels or differing connection interfaces. | **CRITICAL** |
| **3. `missing_fields`** | Examples missing required fields or any of the mandatory 7 version metadata fields. | **CRITICAL** |
| **4. `invalid_geometry`** | Pieces with fewer than 3 boundary vertices, zero or negative surface area, or invalid thickness. | **CRITICAL** |
| **5. `invalid_connections`** | Dangling interface references, gender role conflicts (`insert` coupled with `insert`), or impossible angles ($|\theta| > 360^\circ$). | **CRITICAL** |
| **6. `invalid_assemblies`** | Multi-piece puzzles with disconnected assembly graphs or assembly sequences referencing non-existent pieces. | **WARNING** |
| **7. `missing_ground_truth`** | Multi-piece puzzles lacking 3D ground truth placements or explicit assembly sequences. | **CRITICAL** |
| **8. `data_leakage`** | The exact same example (by ID or raw source hash) appearing in both `train` and `validation` or `test` splits. | **CRITICAL** |
| **9. `near_duplicate_train_test`** | Examples in `train` split sharing near-identical (≥ 98%) geometric/topological profiles with examples in `validation` or `test` splits. | **CRITICAL** |

> [!IMPORTANT]
> **Strict Approval Gate**:
> Transitioning to `APPROVED` or `TRAINING` strictly throws `DatasetApprovalBlockedError` if the quality audit detects **any** CRITICAL defects.

---

## 6. Deep Version Diffing (`DatasetDiffEngine`)

Compare any two dataset releases or snapshots:
- **Added Examples**: Examples present in target but not base.
- **Removed Examples**: Examples present in base but dropped in target.
- **Modified Examples**: Details whether geometry, parameters, interfaces, connections, assembly, or split assignments changed.
- **Status Delta**: Transition between lifecycle statuses.

---

## 7. Example Operational Workflow

```typescript
import { DatasetVersion, DatasetDiffEngine } from "@/core/puzzle/datasetversioning";

// 1. Create new draft dataset release
const datasetV1 = new DatasetVersion("woodkit_furniture", "v1.0.0");

// 2. Add examples with split assignments
datasetV1.addExample(example1, "train");
datasetV1.addExample(example2, "validation");
datasetV1.addExample(example3, "test");

// 3. Submit for review
datasetV1.submitForReview();

// 4. Run quality audit & approve
// (Throws DatasetApprovalBlockedError if critical defects exist)
const report = datasetV1.approve();
console.log("Quality Score:", report.overallScore);
console.log("Root Snapshot Hash:", datasetV1.getManifest().rootSnapshotHash);

// 5. Mark for active training baseline
datasetV1.markForTraining();

// 6. Compare with a subsequent release
const diff = DatasetDiffEngine.computeDiff(
  "v1.0.0",
  "v2.0.0",
  datasetV1.getExamples(),
  datasetV2.getExamples()
);
console.log("Added examples in v2:", diff.addedExamples);
```
