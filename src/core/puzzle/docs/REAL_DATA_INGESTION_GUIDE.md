# Real-Data Ingestion & Normalization Framework Specification

This document specifies the **Real-Data Ingestion & Normalization Framework** for the Parametric 2D-to-3D Cardboard Puzzle Platform.

---

## 1. Architectural Mandate & Objectives

> [!IMPORTANT]
> **NO ML MODEL TRAINING / LLM FINE-TUNING IN THIS PHASE**:
> This framework establishes the production ingestion infrastructure that converts real-world 2D vector drawings, raster graphics, 3D CAD meshes, and structured JSON project files into standard `CanonicalPuzzle` IR graphs **without invoking unvalidated machine learning or AI models**.

### Core Invariant
All parsers and importers pass through a unified intermediate data format (`NormalizedRepresentation`) before mapping into the standard `CanonicalPuzzle` IR. **No importer creates its own separate domain model.**

---

## 2. Ingestion Pipeline Architecture

```
                               ┌────────────────────────────────┐
                               │           INPUT FILE           │
                               │  (Buffer / String / Stream)    │
                               └───────────────┬────────────────┘
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │       FileTypeDetector         │
                               │ (Extension + Magic Byte Check) │
                               └───────────────┬────────────────┘
                                               │
               ┌───────────────────────┬───────┴───────────────┬───────────────────────┐
               ▼                       ▼                       ▼                       ▼
    ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
    │  DrawingImporter   │   │  GeometryImporter  │   │    CADImporter     │   │   PuzzleImporter   │
    │   (PNG, JPG, SVG)  │   │     (DXF, SVG)     │   │  (STEP, STL, OBJ)  │   │  (JSON, Project)   │
    └──────────┬─────────┘   └─────────┬──────────┘   └─────────┬──────────┘   └──────────┬─────────┘
               │                       │                       │                       │
               └───────────────────────┼───────────────────────┴───────────────────────┘
                                       │
                                       ▼
                       ┌────────────────────────────────┐
                       │    NormalizedRepresentation    │
                       │ (Scale mm, Origin, Contours)   │
                       └───────────────┬────────────────┘
                                       │
                                       ▼
                       ┌────────────────────────────────┐
                       │      Canonical Puzzle IR       │
                       │       (CanonicalPuzzle)        │
                       └───────────────┬────────────────┘
                                       │
                                       ▼
                       ┌────────────────────────────────┐
                       │          ImportResult          │
                       │ (CanonicalPuzzle + Diagnostics)│
                       └────────────────────────────────┘
```

---

## 3. Importer & Format Matrix

| Format Category | Supported Extensions | Responsible Importer | Ingestion & Conversion Logic |
| :--- | :--- | :--- | :--- |
| **Raster Drawings** | `.png`, `.jpg`, `.jpeg` | `DrawingImporter` | Extracts image bounds, defaults scale to 1px = 1mm with `RASTER_SCALE_UNASSIGNED` diagnostic warning. |
| **Vector Drawings** | `.svg` | `DrawingImporter` / `GeometryImporter` | Parses SVG `<path>` and `<rect>` elements, converts Y-down screen coordinates to Y-up CAD space. |
| **2D Vector CAD** | `.dxf` | `GeometryImporter` | Parses `LWPOLYLINE`, `LINE`, and `ARC` entities, closes gaps within 0.5mm tolerance. |
| **3D CAD Meshes** | `.step`, `.stp`, `.stl`, `.obj` | `CADImporter` | Extracts 3D vertex/face bounding boxes, projects 2D footprint, and infers material thickness. |
| **Structured JSON** | `.json` | `PuzzleImporter` | Parses native `CanonicalPuzzle` JSON, WoodKit `Project` JSON, and generic JSON manifests. |

---

## 4. Error Handling, Units & Coordinate Conversions

### Diagnostic Codes (`ImportDiagnostics`)
- `UNSUPPORTED_FORMAT`: Input file extension or magic bytes are unsupported.
- `CORRUPTED_FILE` / `JSON_PARSE_ERROR`: Input payload contains malformed syntax.
- `RASTER_SCALE_UNASSIGNED`: Raster image lacks physical DPI resolution (defaulted to 1px = 1mm).
- `UNIT_SCALE_APPLIED`: Input units (inches, cm, px) scaled to standard millimeters (`scaleToMmFactor`).
- `GAPS_REPAIRED`: Open polyline endpoints automatically joined within tolerance gap.
- `DEFAULT_THICKNESS`: Missing material thickness assigned default 3.0mm cardboard value.

---

## 5. How to Import Real Puzzles in Production

To import a real puzzle file programmatically:

```typescript
import { UnifiedIngestionPipeline } from "@/core/puzzle/ingestion";

// 1. Read real file content
const filePayload = {
  filename: "cardboard_house_design.dxf",
  content: dxfFileTextContent,
};

// 2. Execute normalized ingestion pipeline
const result = UnifiedIngestionPipeline.importFile(filePayload);

if (result.success) {
  console.log(`Successfully ingested '${result.sourceFilename}' in ${result.durationMs}ms`);
  console.log("Canonical Puzzle IR:", result.puzzle);
} else {
  console.error("Ingestion failed:", result.diagnostics.getErrors());
}
```
