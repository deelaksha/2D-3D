# Piece Segmentation Strategy Specification

This document specifies the **Piece Segmentation Subsystem** strategy for extracting individual puzzle/cardboard piece boundaries, assigning deterministic piece IDs, and mapping candidates into `CanonicalPiece` objects.

---

## 1. Architectural Mandate & Non-ML Invariant

> [!IMPORTANT]
> **DETERMINISTIC SEGMENTATION ONLY (NO ML / GRID ASSUMPTIONS)**:
> - The segmentation subsystem operates without machine learning.
> - **Arbitrary Layout Support**: The engine makes **no grid or alignment assumptions** (pieces may be rotated, nested, or placed arbitrarily in 2D layout space).
> - **No 3D Orientation Inference**: The 2D layout position does **not** dictate or infer 3D assembly mating orientations.
> - **Explicit Ambiguity Diagnostics**: If boundaries or labels are ambiguous, the engine emits diagnostic warnings/errors inside `SegmentationDiagnostics` rather than silently guessing.

---

## 2. Segmentation Pipeline Flow

```
Drawing -> Piece candidates -> Piece boundaries -> Piece IDs -> Canonical Piece Objects
```

### Multi-Source Detection
1. **Source 1: Explicit Piece Labels & Layers**: Matches CAD layers (`PIECE_1`, `CUT_LAYER`) or text labels positioned inside closed polygon contours.
2. **Source 2: Closed Boundaries**: Extracts top-level closed outer loops (`ExtractedContour2D`).
3. **Source 3: Nesting & Containment Hierarchy**: Computes spatial containment trees to distinguish top-level piece containers vs nested internal cutout holes vs nested sub-pieces.
4. **Source 4: Project Metadata**: Preserves existing part IDs and names when loaded from project manifests.

---

## 3. Ambiguity & Error Diagnostics (`SegmentationDiagnostics`)

| Diagnostic Code | Condition | Behavior & Log Level |
| :--- | :--- | :--- |
| `TOUCHING_PIECES` | Distinct piece boundaries share vertices in 2D layout space | **Info**: Logs shared vertex count without merging pieces. |
| `AMBIGUOUS_CONTAINMENT` | Sub-piece is positioned inside parent piece boundary loop | **Warning**: Emits spatial nesting warning for candidate resolution. |
| `CONFLICTING_PIECE_LABELS` | Multiple text labels assigned inside a single piece contour | **Warning**: Reports naming conflict for developer review. |
| `UNCLOSED_PIECE_BOUNDARY` | Polyline path has unclosed endpoint gap $> 0.5\text{mm}$ | **Error**: Rejects polyline as invalid boundary candidate. |

---

## 4. Programmatic API Usage

To segment a drawing into candidate pieces:

```typescript
import { DrawingImporter, PieceSegmenter } from "@/core/puzzle/ingestion";

// 1. Import normalized vector drawing
const normalized = DrawingImporter.importDrawing({
  filename: "puzzle_sheet.svg",
  content: svgTextContent,
});

// 2. Execute Piece Segmenter
const result = PieceSegmenter.segmentDrawing(normalized);

if (result.success) {
  console.log(`Segmented ${result.pieces.length} piece(s) in ${result.durationMs}ms`);
  for (const piece of result.pieces) {
    console.log(`Piece ID: ${piece.id}, Dimensions: ${piece.dimensions.width}x${piece.dimensions.height}mm`);
  }
} else {
  console.error("Segmentation errors:", result.diagnostics.getErrors());
}
```
