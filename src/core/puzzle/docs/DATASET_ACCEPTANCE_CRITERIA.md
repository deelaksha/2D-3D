# Dataset Acceptance Criteria Specification (Step 38)

This document specifies the **Dataset Acceptance Criteria & Quality Gate** that every dataset example must pass before being included in any future machine learning training dataset.

---

## 1. Quality Gate Mandate & Non-ML Invariant

> [!IMPORTANT]
> **PRE-TRAINING DATASET ACCEPTANCE GATE**:
> - No dataset example may be used for model training or benchmark evaluation unless it receives an explicit **`PASS`** evaluation from `DatasetQualityValidator`.
> - **Zero AI Training**: This validation infrastructure operates strictly deterministically to guarantee high-fidelity data quality.

---

## 2. 14 Mandatory Quality Checks

| Check Name | Target Domain | Acceptance Criteria | Failure / Review Action |
| :--- | :--- | :--- | :--- |
| `required_fields` | Schema | ID, name, and metadata present. | `FAIL` |
| `units_consistency` | Metadata | Display unit specified in `mm`. | `REVIEW_REQUIRED` |
| `coordinate_systems` | Space | Local CAD Y-up orientation space. | `REVIEW_REQUIRED` |
| `piece_count` | Topology | At least 1 valid segmented piece. | `FAIL` |
| `geometry_validity` | Geometry | Non-zero piece dimensions ($W, H, T > 0$). | `FAIL` |
| `interface_references` | Graph | Interface owning piece IDs exist. | `FAIL` |
| `connection_consistency` | Graph | Connection port IDs exist in interface graph. | `FAIL` |
| `3d_validity` | Solid CAD | Watertight extruded 3D solid mesh. | `FAIL` |
| `assembly_validity` | Assembly | Valid 3D placements and non-interpenetration. | `FAIL` |
| `annotation_present` | Curation | Versioned human annotation present. | `REVIEW_REQUIRED` |
| `annotation_status` | Curation | Human status marked `CORRECT`. | `FAIL` if `INCORRECT`, `REVIEW_REQUIRED` if `UNCERTAIN`. |
| `contradictory_annotations` | Curation | Zero conflicting edit records. | `REVIEW_REQUIRED` |
| `duplicate_examples` | Dataset | Unique dataset item ID & hash. | `FAIL` |
| `train_test_leakage` | Dataset | Zero overlap across train/val/test splits. | `FAIL` |

---

## 3. Programmatic API Usage

```typescript
import { DatasetQualityValidator } from "@/core/puzzle/validation";

const report = DatasetQualityValidator.validateItem(canonicalPuzzle, annotation);

if (report.status === "PASS") {
  console.log(`Dataset item '${report.itemId}' APPROVED for dataset inclusion (Score: ${report.overallScore}).`);
} else if (report.status === "REVIEW_REQUIRED") {
  console.warn("Review Required:", report.reviewReasons);
} else {
  console.error("Quality Check Failed:", report.failureReasons);
}
```
