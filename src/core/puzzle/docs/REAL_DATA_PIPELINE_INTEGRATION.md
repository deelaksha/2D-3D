# Real-Data Ingestion Pipeline Integration Specification

This document specifies the integrated **Real-Data Ingestion Pipeline** for converting real-world 2D vector drawings (SVG, DXF, OBJ, STEP, JSON) into standard `CanonicalPuzzle` IR graphs.

---

## 1. Architectural Mandate & Non-ML Invariant

> [!IMPORTANT]
> **DETERMINISTIC END-TO-END INGESTION (ZERO AI/ML TRAINING)**:
> - The entire 8-stage pipeline operates 100% deterministically using analytical geometry fitting, topological graph algorithms, and explicit feature decision rules.
> - **Full Provenance Tracing**: Every extracted piece, interface, connection candidate, and parameter maintains explicit traceability (`sourceFilename`, `sourceGeometry`, `extractionMethod`, `pipelineTrace`) back to the original input file.

---

## 2. Integrated 8-Stage Ingestion Pipeline

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATED REAL-DATA INGESTION PIPELINE                         │
└────────────────────────────────────────────────────────────────────────────────────────┘

  [1] INGEST ────────────> FileTypeDetector / RealFileLoader
                             • Reads raw string / buffer payload.
                             • Identifies file type (SVG, DXF, OBJ, STEP, JSON).

  [2] NORMALIZE ─────────> DrawingNormalizer
                             • Converts raw units (inches, px) to standard mm.
                             • Inverts SVG screen Y-down space into CAD Y-up space.

  [3] EXTRACT GEOMETRY ──> GeometryExtractor & GeometryValidator
                             • Extracts exact primitives (lines, arcs, circles, splines).
                             • Reconstructs outer boundaries and internal hole cutouts.
                             • Validates zero-length edges, open loops, and self-intersections.

  [4] SEGMENT PIECES ────> PieceSegmenter
                             • Segments multi-piece layout sheets into individual 2D piece bounds.
                             • Generates candidates and detects touching/nested ambiguity flags.

  [5] DETECT INTERFACES ─> InterfaceDetector2D & ConfidenceEngine
                             • Detects tabs, slots, notches, finger interlocks, and flat contact edges.
                             • Constructs local 2D coordinate frames and profiles.
                             • Flags uncertain features (confidence < 0.6).

  [6] INFER CONNECTIONS ─> ConnectionInferencer2D
                             • Pairs Interface A ↔ Interface B ports across distinct pieces.
                             • Evaluates gender complementarity, profile tolerances, and joining angles.

  [7] EXTRACT PARAMETERS ─> FeatureExtractor
                             • Fits reusable parameters (tab_width, slot_depth, width, height, T).
                             • Preserves raw geometry for unrecognized custom elements.

  [8] CANONICAL IR MAPPING > RealDataIngestionPipeline
                             • Constructs authoritative CanonicalPuzzle IR graph with full trace logs.
```

---

## 3. Structural Output Payload (`RealPipelineResult`)

The output of `RealDataIngestionPipeline.processDrawing()` contains all 9 required domain objects:

```typescript
export interface RealPipelineResult {
  success: boolean;
  puzzle: CanonicalPuzzle;                  // [1] Canonical Puzzle Metadata & Graph
  material: {                              // [2] Stock Material Specification
    materialId: string;
    thicknessMm: number;
  };
  pieces: CanonicalPiece[];                // [3] Canonical Piece Array
  geometry: Extracted2DGeometryResult;     // [4] Exact Geometry & Primitives
  interfaces: Detected2DInterface[];       // [5] Detected Interface Ports
  connections: ConnectionCandidate[];       // [6] Inferred Candidate Connections
  parameters: ParametricFeature[];          // [7] Extracted Parametric Features
  constraints: OrientationConstraint[];    // [8] Kinematic Orientation Constraints
  diagnostics: PipelineTraceDiagnostics;   // [9] Step-by-Step Provenance Trace Log
  totalDurationMs: number;
}
```

---

## 4. Programmatic API Usage

To process a real drawing end-to-end:

```typescript
import { RealDataIngestionPipeline } from "@/core/puzzle/ingestion";

// 1. Read input vector drawing
const payload = {
  filename: "cardboard_furniture.svg",
  content: svgFileContent,
};

// 2. Execute 8-stage pipeline
const result = RealDataIngestionPipeline.processDrawing(payload);

if (result.success) {
  console.log(`Pipeline completed in ${result.totalDurationMs}ms`);
  console.log(`Ingested ${result.pieces.length} piece(s) and ${result.connections.length} connection(s).`);
  console.log("Canonical Puzzle IR:", result.puzzle);
} else {
  console.error("Pipeline failed:", result.diagnostics.getErrors());
}
```
