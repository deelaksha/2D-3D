# Small Pilot Dataset Specification (Step 39)

This document specifies the **Small Pilot Dataset Infrastructure** for curating a representative sample of parametric cardboard puzzle examples.

---

## 1. Architectural Mandate & Non-ML Invariant

> [!IMPORTANT]
> **REPRESENTATIVE SAMPLE CURATION (ZERO AI/ML TRAINING)**:
> - **No Full Dataset Ingestion**: Processes a small, manually selected representative pilot sample containing different design situations (simple pieces, complex pieces, different connection types, non-planar 3D joining angles, valid & invalid examples).
> - **Zero AI/ML**: Prepares curated data schema without training any machine learning model.

---

## 2. 11-Step Curation Pipeline

Each pilot item is processed through the 11-step curation pipeline:

```
  [1] IMPORT           ──────> Raw file loader & format detector
  [2] NORMALIZE        ──────> mm unit scaling & Y-up CAD orientation
  [3] EXTRACT GEOMETRY ──────> Primitives, outer loops, holes, validation
  [4] SEGMENT PIECES   ──────> Piece candidate boundaries & IDs
  [5] DETECT INTERFACES ─────> Tabs, slots, notches, frames, profiles
  [6] INFER CONNECTIONS ─────> Interface A ↔ Interface B port pairing
  [7] EXTRACT PARAMETERS ────> tab_width, slot_depth, footprint parameters
  [8] CANONICAL IR     ──────> Authoritative CanonicalPuzzle graph
  [9] RECONSTRUCT 3D   ──────> Extruded 3D solids & assembly placements
  [10] VALIDATE        ──────> 14-point dataset quality check (PASS/FAIL/REVIEW)
  [11] MANUAL REVIEW   ──────> Human reviewer status marking & versioned edit audit log
```

---

## 3. Pilot Summary Metrics

At the end of processing, `PilotDatasetManager` outputs a summary report tracking:
- `totalExamples`
- `successfulImports`
- `failedImports`
- `ambiguousCases`
- `validationFailures`
- `manualCorrections`

---

## 4. Programmatic API Usage

```typescript
import { PilotDatasetManager } from "@/core/puzzle/dataset";

const manager = new PilotDatasetManager();

// Process representative pilot sample item
manager.processSampleItem({
  id: "pilot_box_1",
  name: "Simple Box",
  category: "simple_box",
  payload: { filename: "box.svg", content: svgString },
});

// Generate summary report
const summary = manager.generateSummaryReport();
console.log(`Pilot Dataset: ${summary.successfulImports}/${summary.totalExamples} successful, ${summary.manualCorrections} manual edit(s).`);
```
