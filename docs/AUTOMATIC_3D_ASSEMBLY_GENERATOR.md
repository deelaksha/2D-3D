# Automatic 3D Assembly Generator (Phase 87)

## 1. Architectural Overview & Context

The **Automatic 3D Assembly Generator** automatically assembles independently defined 3D pieces into complete, non-coplanar 3D assemblies based on topological connection graphs and connector mating definitions.

```
Inputs: 3D Pieces + Connection Graph + Connector Definitions + Desired Assembly Configuration
                                      ↓
Step 1: Select Root Piece (Deterministic centrality, degree & area heuristic)
                                      ↓
Step 2: Place Root Piece (Fixed origin at world space {0, 0, 0})
                                      ↓
Step 3: Select Connected Pieces (BFS / Frontier queue over connection graph)
                                      ↓
Step 4: Align Connection Interfaces (Lookup source & target local coordinate frames)
                                      ↓
Step 5 & 6: Apply Relative Transforms & Joining Angles (30°, 45°, 60°, 90°, etc.)
                                      ↓
Step 7: Continue until all pieces are placed (Iterate until 100% placed)
                                      ↓
Placement Validation (Verify alignment, finite coordinates, unit quaternions, angle constraints)
                                      ↓
Output: AssemblyConfiguration, AssemblyState, PieceTransforms, ConnectionStates
```

### 1.1 Non-Coplanar 3D Assemblies
Pieces are **never** assumed to remain coplanar. The assembly engine supports arbitrary non-coplanar orientations:
- $90^\circ$ (perpendicular walls, boxes)
- $45^\circ$ (octagonal facets, chamfered roofs)
- $60^\circ$ (triangular prisms, geodesic facets)
- $30^\circ$ (gentle ramps, complex polygonal enclosures)
- $180^\circ$ (planar panels)

### 1.2 Geometry Preservation Principle
Underlying 2D/3D piece geometry is strictly preserved and never mutated. Spatial positions and orientations are applied exclusively via rigid-body transforms (`RigidTransform3D`: translation vector, rotation unit quaternion).

---

## 2. Seven-Step Assembly Pipeline

1. **Root Piece Selection**:
   Deterministically selects the most stable base piece (evaluating graph degree, interior centrality, and planar area) or honors an explicit `rootPieceId`.
2. **Root Placement**:
   Fixes the root piece at world space origin:
   $$\vec{p} = (0, 0, 0), \quad Q = (0, 0, 0, 1), \quad \text{isFixed} = \text{true}$$
3. **Connected Piece Selection**:
   Traverses the assembly connection graph using Breadth-First Search (BFS), expanding the assembly frontier one piece at a time.
4. **Interface Alignment**:
   Identifies the shared connection between source and target pieces, extracting local coordinate frames $(\vec{t}, \vec{n}, \vec{b})$.
5. **Relative Transform & Joining Angle**:
   Resolves the target joining angle following strict priority:
   $$\text{Configuration Override} \to \text{Generation Strategy} \to \text{Connection Constraint} \to \text{Default}$$
   Aligns the target piece such that interface normals oppose and the target piece is rotated by the designated joining angle around the interface tangent axis.
6. **Continuation**:
   Repeats until 100% of pieces in the puzzle are placed in 3D world space.
7. **Placement Validation**:
   Validates every piece for finite coordinates, unit quaternion validity, and world-space interface origin alignment tolerance ($\le 0.5$ mm).

---

## 3. Return Structures

The engine produces a single `GeneratedAssembly3D` container returning:

1. **`AssemblyConfiguration`**: Formal configuration containing piece placements, assembly sequence, target angles, and strategy.
2. **`AssemblyState`**: Formal versioned immutable state holding active connections, collision states, and degrees of freedom.
3. **`PieceTransforms`**: Map of `pieceId` $\to$ `RigidTransform3D`.
4. **`ConnectionStates`**: Runtime status for each connection (`MATED`, current angle, clearance, alignment error).
5. **`Validation`**: Overall assembly validation report.

---

## 4. Usage Example

```typescript
import { Automatic2DGenerationEngine } from "@/core/puzzle/automatic2d";
import { Piece3DConversionEngine } from "@/core/puzzle/piece3d";
import { Automatic3DAssemblyGenerator } from "@/core/puzzle/assembly3d";

// 1. Generate 2D puzzle
const puzzle2D = Automatic2DGenerationEngine.generatePuzzle({
  overallSize: { widthMm: 400, heightMm: 400 },
  targetPieceCount: 16,
  partitionStyle: "rectangular",
});

// 2. Convert to exact 3D pieces
const puzzle3D = Piece3DConversionEngine.convertPuzzle(puzzle2D);

// 3. Automatically generate 3D assembly with 90° and 45° angles
const assembly3D = Automatic3DAssemblyGenerator.generateAssembly({
  pieces: puzzle3D.pieces,
  graph: puzzle2D.graph,
  connections: puzzle3D.connections,
  desiredConfiguration: {
    name: "3D Box Enclosure",
    generationStrategy: "box_enclosure",
    angleOverrides: {
      "edge_piece_A_piece_B": 45.0,
    },
  },
});

console.log("Root piece:", assembly3D.rootPieceId);
console.log("Placements:", Object.keys(assembly3D.pieceTransforms).length);
console.log("Validation status:", assembly3D.validation.isValid);
```
