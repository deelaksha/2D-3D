# Dataset Annotation & Human Review Workflow (Step 37)

This document specifies the **Dataset Annotation & Human Review Subsystem** for reviewing automatically extracted puzzle features, marking evaluation status, and recording versioned human edits.

---

## 1. Architectural Mandate & Non-ML Invariant

> [!IMPORTANT]
> **HUMAN REVIEW & SOURCE DATA IMMUTABILITY**:
> - **Source Data Immutability**: Review edits create versioned annotations (`VersionedPuzzleAnnotation`) in `AnnotationStore` without modifying original ingested vector files.
> - **Zero ML**: Purely human-in-the-loop validation and audit trail recording.

---

## 2. Review Workflow & Statuses

Reviewers inspect automatically extracted information:
- Puzzle & metadata
- Pieces & 2D boundaries
- Interface ports (tabs, slots, notches, finger interlocks)
- Connections ($\text{Interface A} \leftrightarrow \text{Interface B}$)
- Parametric features (`tab_width`, `slot_depth`, footprint)
- 3D assembly extrusions & placements
- Validation results

Reviewers assign evaluation status:
- **`CORRECT`**: Extraction and topology are 100% verified.
- **`INCORRECT`**: Extraction failed or contains invalid geometry.
- **`UNCERTAIN`**: Ambiguous drawing or low confidence interface requiring further inspection.

Reviewers can edit:
- `piece_id`
- `interface_id`
- `connection`
- `parameter`
- `joining_angle`
- `constraint`

Every change records a `ManualEditRecord` (timestamp, reviewerId, target, oldValue, newValue, reason).

---

## 3. Programmatic API Usage

```typescript
import { PuzzleReviewManager } from "@/core/puzzle/annotation";

const manager = new PuzzleReviewManager();

// 1. Start review session
manager.startReviewSession(puzzle, "reviewer_alice");

// 2. Record manual property adjustment
manager.recordEdit(
  puzzle.metadata.id,
  "reviewer_alice",
  "parameter",
  "tab_width",
  10.0,
  10.2,
  "Kerf clearance adjustment"
);

// 3. Mark evaluation status
const finalAnnotation = manager.markStatus(puzzle.metadata.id, "CORRECT", "reviewer_alice");
console.log(`Saved version ${finalAnnotation.version} with ${finalAnnotation.edits.length} edit(s).`);
```
