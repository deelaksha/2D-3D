# Automatic 2D Generation System (Phase 85)

## 1. Architectural Overview & Context

The **Automatic 2D Generation System** integrates the complete pipeline for synthesizing physically connected, manufacturable 2D puzzles from high-level design specifications.

It establishes an end-to-end, deterministic synthesis pipeline without AI hallucination, coupling mathematical boundary partitioning, topological assembly graphs, kinematic connector generation, parametric placement optimization, and exact boundary contour embedding.

```
Design Specification
        ↓
Global Boundary Generator
        ↓
Piece Partitioning (Phase 82)
        ↓
Connection Graph (Topology G = (V, E))
        ↓
Connector Generation (Phase 83)
        ↓
Connector Placement (Phase 84)
        ↓
Parametric Geometry (Exact Boundary Embedding)
        ↓
2D Validation
```

---

## 2. Pipeline Stages

### Stage 1: Design Specification
Accepts a high-level `DesignSpecification2D` defining:
- Outer dimensions ($W \times H$)
- Target piece count ($N \ge 2$, e.g. 16 pieces)
- Boundary geometry preference (`rectangle`, `circle`, `l_shaped`, `polygon`)
- Partitioning style (`rectangular`, `polygonal`, `irregular`, `organic`)
- Material and stock thickness ($T_{\text{stock}}$, kerf)
- Preferred connector type (`tab_slot`, `notch`, `interlock`, `keyed`, `hinge`, `rotational`, `custom`)
- Joining angles, clearance overrides, and difficulty settings

### Stage 2: Global Boundary Generator
Synthesizes and validates the master closed 2D polygon with guaranteed positive counter-clockwise winding, computing exact perimeter and planar area via the Shoelace formula.

### Stage 3: Piece Partitioning
Executes the Phase 82 `BoundaryPartitionEngine` to partition the boundary into $N$ piece cells with:
- Zero unintended gaps
- Zero unintended overlaps
- Exact area conservation
- Parameterized jitter, curvature, and complexity

### Stage 4: Connection Graph
Extracts canonical shared boundary edges between adjacent piece pairs, constructing a topological `PuzzleAssemblyGraph` $G = (V, E)$. Verifies single connected component reachability ($0$ isolated pieces).

### Stage 5: Connector Generation & Placement
- **Connector Placement Engine (Phase 84)**: Evaluates edge lengths, enforcing corner margins ($m_{\text{corner}} \ge \max(5\text{ mm}, 1.5 T_{\text{stock}})$) and bridge widths to position joints.
- **Automatic Connector Generation Engine (Phase 83)**: Computes complementary male/female dimensions with stock-thickness-dependent manufacturing clearances ($c \in [0.15, 0.25]\text{ mm}$), local coordinate frames, and 3D joining constraints.

### Stage 6: Parametric Geometry (Boundary Embedding)
Splices physical connector features into piece boundaries to produce `exactBoundary`:
- Male tab/bulb features protrude outward along the edge's outward normal $\vec{n}$.
- Female slot/cavity features cut inward into the piece along $-\vec{n}$ with clearance offsets.
- Computes exact piece bounding boxes, perimeter, and area.

### Stage 7: 2D Validation
Deterministically verifies boundary closure, piece dimensions, connector tolerances, complementarity ($W_{\text{slot}} \ge W_{\text{tab}}, D_{\text{slot}} \ge D_{\text{tab}}$), clearance margins, and whole-graph connectivity.

---

## 3. Data Contracts

### 3.1 Piece Model (`GeneratedPiece2D`)
Every piece provides:
- **`pieceId` / `id`**: Unique piece identifier.
- **`exactBoundary`**: Array of 2D coordinates representing the exact physical contour with embedded male tabs and female slots.
- **`dimensions`**: Width, height, thickness, area, perimeter, and bounding box.
- **`interfaces`**: Array of canonical connection interfaces.
- **`connectorParameters`**: Parameter blocks for all attached connectors.
- **`material`**: Material definition (id, name, thickness, kerf).
- **`thickness`**: Stock thickness in mm.

### 3.2 Connection Model (`GeneratedConnection2D`)
Every connection provides:
- **`connectionId` / `id`**: Unique connection identifier.
- **`pieceA`**: ID of Piece A (male / insert role).
- **`pieceB`**: ID of Piece B (female / receiver role).
- **`interfaceA`**: Canonical interface on Piece A.
- **`interfaceB`**: Canonical interface on Piece B.
- **`connectorType`**: Connector type (`tab_slot`, `notch`, `interlock`, `keyed`, `hinge`, `rotational`, `custom`).
- **`parameters`**: Sizing parameters (tab width/depth, slot width/depth).
- **`clearance`**: Manufacturing clearance in mm.
- **`allowedAngle`**: Nominal joining angle.

### 3.3 Container Object (`GeneratedPuzzle2D`)
```typescript
export interface GeneratedPuzzle2D {
  id: string;
  name: string;
  specification: DesignSpecification2D;
  globalBoundary: {
    vertices: Vec2[];
    areaMm2: number;
    perimeterMm: number;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  };
  pieces: GeneratedPiece2D[];
  connections: GeneratedConnection2D[];
  graph: PuzzleAssemblyGraph;
  validation: ValidationResult2D;
  dimensions: {
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
  };
  metadata: {
    generatedAt: string;
    executionDurationMs: number;
    generatorVersion: string;
    seed: number;
  };
}
```

---

## 4. Usage Example

```typescript
import { Automatic2DGenerationEngine } from "@/core/puzzle/automatic2d";

const puzzle = Automatic2DGenerationEngine.generatePuzzle({
  overallSize: { widthMm: 400, heightMm: 400 },
  targetPieceCount: 16,
  partitionStyle: "rectangular",
  preferredConnectorType: "tab_slot",
  material: {
    id: "mat_plywood_3mm",
    name: "Birch Plywood",
    stockThicknessMm: 3.0,
    kerfMm: 0.15,
  },
  seed: 42,
});

console.log(`Generated ${puzzle.pieces.length} pieces with ${puzzle.connections.length} connections.`);
console.log("Validation Status:", puzzle.validation.isValid);
```
