# Autonomous 2D Puzzle-Generation Subsystem

## 1. Architectural Overview & Context

The **Autonomous 2D Puzzle-Generation Subsystem** serves as the geometric partitioning and topological synthesis engine for the **Advanced Autonomous Generation Phase**.

### 1.1 Master Target Workflow
```
USER REQUIREMENT
    ↓
DESIGN SPECIFICATION
    ↓
AUTOMATIC PIECE GENERATION  <── [AUTONOMOUS 2D SUBSYSTEM IMPLEMENTED HERE]
    ↓
AUTOMATIC CONNECTOR GENERATION  <── [AUTONOMOUS 2D SUBSYSTEM IMPLEMENTED HERE]
    ↓
2D VALIDATION  <── [AUTONOMOUS 2D SUBSYSTEM IMPLEMENTED HERE]
    ↓
3D CONVERSION (Deferred to subsequent phase)
    ↓
AUTOMATIC ASSEMBLY (Deferred to subsequent phase)
    ↓
3D VALIDATION (Deferred to subsequent phase)
    ↓
INTERACTIVE 3D PREVIEW (Deferred to subsequent phase)
```

### 1.2 Core Architectural Principles
1. **Zero Hallucinated Geometry**: The AI layer defines high-level constraints via `ParametricDesignSpecification`. The geometry engine remains the sole mathematical authority for physical coordinates, vertex lists, and boundary polygons.
2. **Zero Disconnected Pieces**: Pieces are never generated independently in isolation. Every piece is partitioned from a unified boundary and belongs to the overall connected assembly topology.
3. **Deterministic Repeatability**: Given the same specification and random seed, the subsystem produces bit-for-bit identical vertex coordinates, boundary loops, interface ports, and connection candidates.
4. **Multi-Layout Flexibility**: Supports regular Cartesian grids, radial sectors, custom irregular polygons, and organic sinusoidal jigsaw contours.
5. **Strict 2D Validation with Structured Diagnostics**: Rejects invalid specifications and malformed topologies with structured error codes, failing pipeline stages, and actionable remediation steps.

---

## 2. Domain Data Structures

### 2.1 Subsystem Outputs
The generator returns a complete `GeneratedPuzzle2D` instance containing:
- `GeneratedPuzzle2D`: Top-level puzzle metadata, outer boundary, dimensions, and arrays of pieces, interfaces, and connection candidates.
- `GeneratedPiece[]`: Array of generated pieces with closed boundary polygons, outer perimeter segments, internal mating segments, dimensions, thickness, and material references.
- `GeneratedInterface[]`: Array of connection ports with local position, outward normal ($\vec{n}$), tangent ($\vec{t}$), role (`insert` vs `receiver`), pattern, and tolerances.
- `GeneratedConnectionCandidate[]`: Candidate connections linking complementary interfaces across adjacent pieces with kinematic mating geometry and clearances.

```typescript
export interface GeneratedPuzzle2D {
  puzzleId: string;
  specificationId: string;
  layoutType: PuzzleLayoutType;
  boundary: PuzzleBoundary2D;
  pieceCount: number;
  pieces: GeneratedPiece[];
  interfaces: GeneratedInterface[];
  connectionCandidates: GeneratedConnectionCandidate[];
  outerBoundarySegments: BoundarySegment2D[];
  internalInterfaceCount: number;
  dimensions: {
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
  };
  metadata: {
    difficulty: string;
    materialId: string;
    generatedAt: string;
    deterministicSeed: number;
    generatorVersion: string;
  };
}
```

---

## 3. Supported Layout Partition Strategies

```
             ┌──────────────────────────────────────────────┐
             │       Autonomous2DPuzzleGenerator             │
             └──────────────────────┬───────────────────────┘
                                    │
       ┌────────────────┬───────────┴────────────┬────────────────┐
       ▼                ▼                        ▼                ▼
  [Grid Layout]   [Radial Layout]     [Custom Polygonal]    [Organic Layout]
  (Cartesian RxC) (Angular Sectors)   (Slanted Bisection)   (Jigsaw Curves)
```

### 3.1 Grid Layout (`grid`)
- Partitions a rectangular boundary of dimensions $W \times H$ into $R$ rows and $C$ columns ($R \times C = N$).
- Factors $N$ deterministically to balance the aspect ratio against $W / H$.
- Internal vertical boundaries: shared between $(r, c)$ and $(r, c+1)$.
- Internal horizontal boundaries: shared between $(r, c)$ and $(r+1, c)$.
- Outer boundary segments: edges along $r=0$, $r=R-1$, $c=0$, $c=C-1$.

### 3.2 Radial Layout (`radial`)
- Partitions a circular boundary of radius $R = \min(W, H) / 2$ centered at $(W/2, H/2)$ into $N$ equal angular sectors.
- Each wedge has two radial shared edges meeting at the center:
  - $\theta_i = i \cdot \frac{2\pi}{N}$
  - $\theta_{i+1} = (i+1) \cdot \frac{2\pi}{N}$
- Each sector connects to its clockwise and counter-clockwise neighbors, forming a single closed topological ring.
- The curved circular arc on the perimeter is registered as the piece's outer boundary.

### 3.3 Custom Polygonal Layout (`custom_polygonal`)
- Partitions the puzzle into $N$ irregular polygons using recursive space bisection.
- Finds the largest remaining convex cell and slices it with a deterministic cutting line $(P, \vec{n})$.
- Adds a deterministic pseudo-random slant ($\pm 15^\circ$) to produce irregular polygonal geometries (trapezoids, pentagons, irregular quadrilaterals).
- The cutting segment between intersection points becomes the exact shared internal edge between the two child pieces.

### 3.4 Organic Layout (`organic`)
- Starts with partition cells and modulates internal shared boundaries with continuous harmonic sinusoidal curves (e.g. jigsaw bulb lobes):
  $$\vec{r}(t) = \vec{r}_{\text{base}}(t) + \vec{n} \cdot A \cdot \left(\sin(\pi t) + 0.25 \sin(3\pi t)\right)$$
- If an internal boundary bulges into Piece B from Piece A, Piece B receives the exact complementary inward cavity.
- Exterior perimeter edges remain straight to ensure flush outer boundaries.

---

## 4. Complementary Interface & Connector Generation

For every shared internal boundary segment between Piece A and Piece B:
1. **Midpoint & Vectors**: Computes contact center $C$, tangent vector $\vec{t}_A$, and outward normal $\vec{n}_A$.
2. **Opposing Reciprocity**: The mating interface on Piece B is assigned:
   $$\vec{n}_B = -\vec{n}_A, \quad \vec{t}_B = -\vec{t}_A$$
3. **Role Assignment**: Piece A is designated as the `insert` (male feature) and Piece B as the `receiver` (female feature).
4. **Dimension Sizing**:
   - Feature width: $W_{\text{feat}} = \text{clamp}(L_{\text{edge}} \times 0.45, 6.0, 25.0)$ mm.
   - Feature depth: $D_{\text{feat}} = \text{clamp}(T_{\text{stock}} \times 1.5, 2.5, 8.0)$ mm.
   - Feature clearance: $0.15$ mm (or user-specified override).
5. **Connection Candidate**: Emits a `GeneratedConnectionCandidate` pairing Interface A and Interface B with kinematic parameters and compatibility rating.

---

## 5. 2D Validation Suite & Structured Diagnostics

Every generated puzzle must satisfy 7 verification criteria:
1. **Boundary Integrity**: Puzzle boundary has $\ge 3$ vertices, is non-degenerate, and planar area $> 0$.
2. **Piece Count Conservation**: Actual piece count matches target count ($N \ge 2$).
3. **Piece Geometry**: Every piece boundary is a closed loop, has positive area (Shoelace formula), and has no self-intersecting non-adjacent edges.
4. **Topological Connectivity**: Breadth-First Search (BFS) over the connection graph confirms a single connected component ($0$ disconnected orphan pieces).
5. **Interface Reciprocity**: Every internal interface has a designated mating interface on the adjacent piece with opposed normals ($\vec{n}_A \cdot \vec{n}_B \le -0.7$).
6. **Perimeter Enclosure**: Outer boundary segments form an unbroken perimeter enclosure.
7. **Manufacturing Constraints**: Material thickness $> 0$ and dimensions within sheet stock limits.

### Diagnostic Codes Reference
| Code | Pipeline Stage | Description | Remediation |
|---|---|---|---|
| `ERR_INSUFFICIENT_PIECE_COUNT` | `specification_validation` | Piece count $< 2$ | Increase target piece count in specification |
| `ERR_INVALID_SPEC_DIMENSIONS` | `specification_validation` | Width or height $\le 0$ | Set positive dimensions in spec |
| `ERR_EXCEEDS_STOCK_WIDTH` | `specification_validation` | Puzzle width $>$ stock width | Reduce width or select larger sheet |
| `ERR_DISCONNECTED_TOPOLOGY` | `interface_generation` | Orphan/isolated pieces detected | Ensure shared boundaries span graph |
| `ERR_SELF_INTERSECTING_PIECE` | `piece_partitioning` | Boundary polygon self-intersects | Verify cutting lines and vertex order |
| `ERR_UNPAIRED_INTERFACE` | `interface_generation` | Missing complementary mate | Verify interface synthesizer pairing |

---

## 6. Programmatic Usage

```typescript
import { Autonomous2DPuzzleGenerator } from "@/core/puzzle/autonomous2d";
import type { ParametricDesignSpecification } from "@/core/puzzle/ailayer/types";

// 1. Prepare validated specification
const spec: ParametricDesignSpecification = {
  specificationId: "spec_autonomous_001",
  overall_size: { widthMm: 300, heightMm: 200, depthMm: 50 },
  piece_count: 9,
  layers: 1,
  material: {
    stockThicknessMm: 3.0,
    stockWidthMm: 600,
    stockHeightMm: 400,
    materialId: "cardboard_3mm",
  },
  connection_preferences: {
    defaultType: "tab_slot",
    preferredJoiningAngleDeg: 180,
    genderStyle: "balanced",
  },
  difficulty: { level: "medium", maxUniquePieces: 9 },
  symmetry: { isSymmetrical: true, symmetryAxis: "x" },
  constraints: [],
};

// 2. Generate 2D puzzle
const result = Autonomous2DPuzzleGenerator.generate(spec, {
  layoutType: "grid", // or "radial", "organic", "custom_polygonal"
  seed: 42,
});

if (result.success && result.puzzle) {
  console.log(`Generated ${result.puzzle.pieceCount} pieces!`);
  console.log(`Total interfaces: ${result.puzzle.interfaces.length}`);
  console.log(`Connection candidates: ${result.puzzle.connectionCandidates.length}`);

  // 3. Convert to CanonicalPuzzle for downstream engines
  const canonicalPuzzle = Autonomous2DPuzzleGenerator.toCanonicalPuzzle(result.puzzle);
} else {
  console.error("Generation failed:", result.diagnostics);
}
```
