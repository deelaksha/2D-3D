# Automatic Puzzle-Boundary Partitioning Engine (Phase 82)

## 1. Architectural Overview

The **Automatic Puzzle-Boundary Partitioning Engine** partitions an arbitrary 2D global puzzle boundary (rectangular, circular, or irregular concave polygon) into individual 2D pieces whose mathematical union exactly covers the intended puzzle area with:
- Strictly zero unintended gaps
- Strictly zero unintended overlaps
- Guaranteed boundary containment (all vertices lie within or on the global boundary)
- Fully parametric control (complexity, minimum feature size, jitter, curvature, wave frequency)
- 100% deterministic repeatability for a given configuration/seed
- Pure geometric partitioning (no connectors generated yet, as per Phase 82 specifications)

---

## 2. Partitioning Styles

```
                               ┌──────────────────────────────────────────────┐
                               │           BoundaryPartitionEngine            │
                               └──────────────────────┬───────────────────────┘
                                                      │
         ┌─────────────────────────┬──────────────────┴────────────────┬─────────────────────────┐
         ▼                         ▼                                   ▼                         ▼
   [Rectangular]              [Polygonal]                         [Irregular]                [Organic]
   (Grid Slicing)          (Convex Bisection)                 (Jittered Slanted Cut)     (Harmonic Jigsaw Waves)
```

### 2.1 Rectangular (`rectangular`)
- Partitions the puzzle boundary along axis-aligned planes matching target aspect ratio $W / H$.
- Slices the global boundary successively into row and column bands.
- Adapts cleanly even to irregular outer boundaries via planar clipping.

### 2.2 Polygonal (`polygonal`)
- Recursive space bisection prioritizing pieces with maximum area.
- Alternates principal cutting axes through the geometric centroid.
- Generates convex polygonal pieces with balanced area distribution.

### 2.3 Irregular (`irregular`)
- Slanted, jittered space bisection controlled by parametric `complexity` and `jitter` (0.0 to 1.0).
- Rotates cutting normals by dynamic angles ($\pm 15^\circ$ to $\pm 30^\circ$) and offsets cutting lines from centroids.
- Enforces `minFeatureSizeMm` to prevent thin corner shards.

### 2.4 Organic (`organic`)
- Modulates internal cutting segments with continuous harmonic sinusoidal waves:
  $$P(t) = (1-t)S + tE + \vec{n} \cdot A \cdot \sin(\pi t) \sin(2\pi \cdot \text{freq} \cdot t)$$
- Mating edges share bit-for-bit identical inverted curve vertices.
- Outer perimeter edges remain flush to the global boundary to avoid boundary leakage.

---

## 3. Data Contracts

### 3.1 PartitionRequest
```typescript
export interface PartitionRequest {
  /** Overall global puzzle boundary (closed polygon). */
  boundary: BoundaryInput | Vec2[];
  /** Desired number of partitioned pieces (N >= 2). */
  targetPieceCount: number;
  /** Selected partitioning style (default: "polygonal"). */
  style?: "rectangular" | "polygonal" | "irregular" | "organic";
  /** Parametric geometry and complexity settings. */
  parameters?: {
    seed?: number;
    complexity?: "low" | "medium" | "high" | number;
    minFeatureSizeMm?: number;
    jitter?: number;
    curvature?: number;
    waveFrequency?: number;
  };
}
```

### 3.2 PartitionResult & Diagnostics
```typescript
export interface PartitionResult {
  success: boolean;
  pieces: PartitionedPiece[];
  boundary: {
    vertices: Vec2[];
    areaMm2: number;
    perimeterMm: number;
  };
  actualPieceCount: number;
  areaCoverageRatio: number; // sum(pieceArea) / boundaryArea (approx 1.0)
  diagnostics: PartitionDiagnostics;
  executionDurationMs: number;
}
```

---

## 4. Validation & Quality Checks

| Validation Criterion | Description | Pass Threshold |
|---|---|---|
| **Area Conservation** | Difference between sum of piece areas and boundary area | Error $< 1.0\%$ |
| **Boundary Containment** | All piece vertices remain within or on the global boundary | $0$ containment violations |
| **Piece Connectivity** | BFS traversal of the adjacency graph finds 1 connected component | $0$ isolated orphan pieces |
| **Self-Intersection** | No non-adjacent edge segment intersections in piece boundaries | $0$ self-intersections |
| **Minimum Feature Size** | Edge lengths $\ge \text{minFeatureSizeMm}$ | Warns if edge $< \text{minFeatureSizeMm}$ |

---

## 5. Usage Example

```typescript
import { BoundaryPartitionEngine } from "@/core/puzzle/boundarypartition";

// 1. Define arbitrary global boundary (e.g. L-shaped or rectangular)
const boundary = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 150 },
  { x: 150, y: 150 },
  { x: 150, y: 300 },
  { x: 0, y: 300 },
];

// 2. Request irregular partition into 6 pieces
const result = BoundaryPartitionEngine.partition({
  boundary,
  targetPieceCount: 6,
  style: "irregular",
  parameters: {
    seed: 12345,
    complexity: "medium",
    jitter: 0.35,
    minFeatureSizeMm: 8.0,
  },
});

if (result.success) {
  console.log(`Successfully partitioned into ${result.pieces.length} pieces.`);
  console.log(`Area coverage: ${(result.areaCoverageRatio * 100).toFixed(2)}%`);
} else {
  console.error("Partition failed:", result.diagnostics.issues);
}
```
