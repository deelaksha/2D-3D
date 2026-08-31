# Dataset-Generation Framework Specification (Phase 18)

This document specifies the **Dataset-Generation Framework** for the Parametric 2D-to-3D Cardboard Puzzle System.

---

## 1. Executive Summary & Constraints

> [!IMPORTANT]
> **NO REAL DATASET PROCESSING & NO MODEL TRAINING**:
> This framework defines `DatasetExporter` and `DatasetImporter` interfaces, schema versioning enforcement (`1.0.0`), and an extensible multi-format adapter architecture. No real project dataset is converted or trained in this phase.

---

## 2. Exporter & Importer Interfaces

### `DatasetExporter` (`PuzzleDatasetExporter`)
- Converts active canonical models, 3D placement transforms, solids, connection graphs, and 5-domain validation reports into standard `CompleteDatasetItem` JSON records.

### `DatasetImporter` (`PuzzleDatasetImporter`)
- Reads raw `CompleteDatasetItem` JSON records, validates schema versioning (`1.0.0`) and design vs assembly parameter rules, and reconstructs active `CanonicalPuzzle` models, 3D placement transforms, and assembly graphs without data loss.

---

## 3. Pluggable Multi-Format Adapter Architecture (`FormatAdapterRegistry`)

External CAD and graphics file formats convert to and from the authoritative canonical internal model via pluggable `FormatAdapter` handlers:

- **`PNG`**: 2D drawing / sketch raster image parsing.
- **`SVG`**: 2D vector path & contour geometry conversion.
- **`DXF`**: 2D CAD polyline & arc layer conversion.
- **`STEP`**: 3D solid STEP B-Rep boundary representation.
- **`STL`**: 3D triangulated surface mesh export/import.
- **`JSON`**: Canonical JSON serialization.

### Crucial Architectural Principle
Adding support for a new file format (e.g. STEP or DXF) requires registering a new `FormatAdapter` in `FormatAdapterRegistry`. **It NEVER alters, mutates, or breaks the authoritative canonical internal representation**.
