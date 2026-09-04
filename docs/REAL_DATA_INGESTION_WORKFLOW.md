# Production-Quality Real-Data Ingestion Pipeline Specification (Phase 61)

## 1. Objective & Architectural Scope

Phase 61 safely introduces **real-world puzzle and construction kit design files** into the ML data pipeline without starting premature large-scale training or modifying the deterministic geometry engine.

The pipeline ingests diverse CAD, vector, mesh, raster, and structured project files, strictly verifies their physical validity through three sequential validation gates, records comprehensive provenance, creates immutable raw-data references, and assigns a three-tier quality status (`PASS`, `FAIL`, `REVIEW_REQUIRED`).

---

## 2. Complete 10-Stage Pipeline Architecture

```
RAW SOURCE
    ↓
FILE VALIDATION
    ↓
IMPORT
    ↓
NORMALIZATION
    ↓
CANONICAL IR
    ↓
GEOMETRY VALIDATION
    ↓
CONNECTION VALIDATION
    ↓
ASSEMBLY VALIDATION
    ↓
DATASET EXAMPLE
    ↓
QUALITY STATUS
```

### Stage Details

| Stage | Name | Description | Output |
| :--- | :--- | :--- | :--- |
| **1** | **RAW SOURCE** | Ingests the raw source file payload in read-only mode. Never modifies or overwrites the original input file. | `RawFilePayload` |
| **2** | **FILE VALIDATION** | Verifies file existence, size, magic byte headers, and format integrity across all 8 formats. Computes deterministic SHA-256 hash. | `FileValidationResult`, `RawDataReference` |
| **3** | **IMPORT** | Dispatches to specialized importers (`DrawingImporter`, `GeometryImporter`, `CADImporter`, `PuzzleImporter`) based on verified type. | Parsed geometry structures |
| **4** | **NORMALIZATION** | Standardizes coordinate systems (Y-up, origin centering) and converts dimension units to millimetres (`mm`). | `NormalizedRepresentation` |
| **5** | **CANONICAL IR** | Constructs or validates the standard `CanonicalPuzzle` intermediate representation with pieces, interfaces, and connections. | `CanonicalPuzzle` |
| **6** | **GEOMETRY VALIDATION** | Validates 2D planar boundary loops, vertex counts (≥ 3), non-zero surface area, thickness (> 0.1 mm), and 3D bounds. | `GeometryValidationDetail` |
| **7** | **CONNECTION VALIDATION** | Validates interface port pairings, gender role complementarity (`insert` ↔ `receiver`), profile width/depth tolerances, and joining angles. | `ConnectionValidationDetail` |
| **8** | **ASSEMBLY VALIDATION** | Checks assembly graph connectivity (detecting orphaned pieces), transform consistency, and assembly sequence solvability. | `AssemblyValidationDetail` |
| **9** | **DATASET EXAMPLE** | Constructs a standard `CompleteDatasetItem` / `RealDatasetExample` conforming to ML dataset schemas and embedding full provenance. | `RealDatasetExample` |
| **10** | **QUALITY STATUS** | Evaluates all validation reports to assign one of three quality tiers: `PASS`, `FAIL`, or `REVIEW_REQUIRED`. | `IngestionQualityStatus` |

---

## 3. Supported Input Formats

The ingestion pipeline provides robust support and integrity validation for all 8 project formats:

| Format | Kind | Importer Handler | Validation Criteria |
| :--- | :--- | :--- | :--- |
| **PNG** | Raster Drawing | `DrawingImporter` | Magic bytes `89 50 4E 47`; flags unscaled raster images for review |
| **JPG** | Raster Photo | `DrawingImporter` | SOI marker `FF D8 FF`; flags unscaled raster photos for review |
| **SVG** | 2D Vector | `GeometryImporter` | `<svg` root tag, closed paths, dimension units |
| **DXF** | 2D CAD Polyline | `GeometryImporter` | AutoCAD `SECTION`, `ENTITIES`, and `EOF` structure |
| **STEP** | 3D CAD B-Rep | `CADImporter` | `ISO-10303-21` and `HEADER;` standard tokens |
| **STL** | 3D Solid Mesh | `CADImporter` | ASCII `solid` declaration or binary header (≥ 84 bytes) |
| **OBJ** | 3D Polygon Mesh | `CADImporter` | Wavefront vertex (`v `) and face (`f `) definitions |
| **JSON** | Project / Canonical | `PuzzleImporter` | Valid JSON syntax; auto-differentiates WoodKit Project vs Canonical IR |

---

## 4. Provenance & Immutability Model

Every ingested dataset example is anchored to the original source file with 7 immutable provenance fields:

```typescript
export interface IngestionProvenance {
  source_file: string;          // Original filename or relative path
  source_id: string;            // Deterministic stable source ID (e.g., src_dxf_a1b2c3d4e5)
  source_version: string;       // Cryptographic SHA-256 content hash
  import_timestamp: string;     // ISO 8601 UTC timestamp of ingestion
  schema_version: string;       // Schema specification version ("1.0.0")
  geometry_version: string;     // Deterministic geometry engine version ("1.0.0")
  processing_version: string;   // Pipeline processing version ("61.0.0")
  raw_ref: RawDataReference;    // Immutable reference to raw source
}
```

### Raw Data Reference (`raw_ref`)

```typescript
export interface RawDataReference {
  rawId: string;                // e.g. "raw_svg_4a7484aa"
  sourceFile: string;
  sha256: string;               // Deterministic 64-character SHA-256 hex
  sizeBytes: number;
  detectedFormat: SupportedRealDataFormat;
  createdAt: string;
  mimeType: string;
  contentSnippet?: string;
}
```

> [!IMPORTANT]
> **Source File Immutability**:
> Original source files on disk or in remote storage are **never modified, overwritten, or renamed** by the ingestion pipeline. All raw file interactions are strictly read-only.

---

## 5. Three-Tier Quality Status Gating

| Quality Status | Criteria | Action / ML Eligibility |
| :--- | :--- | :--- |
| **`PASS`** | 0 file validation errors, 0 geometry errors, 0 connection errors, 0 assembly errors, and 0 blocking ambiguities. | **Approved for ML Training**: Ingested directly into training/validation/test dataset splits. |
| **`FAIL`** | Unparseable syntax, corrupted headers, degenerate geometry (< 3 vertices, zero area), severe collisions, or unresolvable references. | **Rejected**: Excluded from dataset. Diagnostic error trace recorded for debugging. |
| **`REVIEW_REQUIRED`** | Structurally valid syntax and geometry, but has non-blocking warnings (e.g. unscaled raster image without explicit DPI, disconnected multi-piece puzzle, unconnected interface ports, non-standard joint angle). | **Held for Review**: Stored in a review queue awaiting human or AI validation before inclusion in training splits. |

---

## 6. Execution Controls & Dry-Run Mode

To prevent runaway processing or accidental dataset contamination:

1. **Controlled Ingestion (No Automatic Full Ingestion)**:
   - Batch ingestion uses `maxItems` limit guards (default: 25 items per run).
   - Datasets are processed explicitly by file list or controlled queue.

2. **Dry-Run Mode (`dryRun: true`)**:
   - Executes all 10 stages end-to-end.
   - Generates full stage traces, diagnostics, and preview dataset items.
   - **Does NOT** write to dataset directories, manifest indices, or ML splits.

---

## 7. Example Usage

```typescript
import { RealDataIngestionPipeline } from "@/core/puzzle/realdata";

// Ingest a single real design file
const result = RealDataIngestionPipeline.ingestFile({
  filename: "cabinet_joint.dxf",
  content: dxfFileContentString,
});

if (result.qualityStatus === "PASS") {
  console.log("Approved for ML training:", result.datasetExample?.itemId);
  console.log("Provenance SHA-256:", result.provenance?.source_version);
} else if (result.qualityStatus === "REVIEW_REQUIRED") {
  console.log("Requires inspection:", result.warnings);
} else {
  console.error("Ingestion failed:", result.errors);
}

// Dry-run preview
const preview = RealDataIngestionPipeline.ingestFile(
  { filename: "sketch.png", content: pngBytes },
  { dryRun: true }
);
console.log("Dry run status:", preview.qualityStatus); // "REVIEW_REQUIRED"
```
