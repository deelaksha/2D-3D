# Complete Automatic Assembly Solver (Phase 89)

## 1. Overview & Objectives

The **Complete Automatic Assembly Solver** solves the 3D puzzle assembly problem by taking:
1. Complete converted 3D puzzle (`ConvertedPuzzle3D` with independent pieces in local frames)
2. Connection graph / retained connections
3. Valid angle candidates (from Phase 88 `ValidAngleCandidates`)

It automatically searches the combinatoric space of piece placement sequences and 3D joining angles to find at least one valid, collision-free, fully-assembled 3D configuration.

### Core Principles
- **Binary Outcome Guarantee**: The solver returns either `SuccessfulAssembly` (if and only if 100% of pieces are assembled) or `AssemblyFailureReport`. Partially assembled results are never returned as success.
- **Backtracking Search**: Explores branches, detects downstream collisions or geometric lockouts, backtracks gracefully, and tests alternative valid branches.
- **Multi-Angle Support**: Seamlessly accommodates planar (180°), orthogonal (90°), and arbitrary spatial angles (30°, 45°, 60°, 120°, 135°).
- **Configurable Limits**: Prevents unbounded combinatorial explosion using `maxBacktracks`, `maxStatesExplored`, and `timeoutMs`.
- **Purely Deterministic**: No neural nets, probabilistic approximations, or random searches.

---

## 2. Solver Architecture & Pipeline

```
ConvertedPuzzle3D + Connection Graph + ValidAngleCandidates
                           │
                           ▼
              ┌───────────────────────────┐
              │ 1. Select Assembly Root   │
              │ (Degree + Area Heuristic) │
              └────────────┬──────────────┘
                           │ Place Root at (0, 0, 0)
                           ▼
          ┌───────────────►┌───────────────────────────┐
          │                │ 2. Pick Frontier Piece    │
          │                │ (MRV / Max Placed Degree) │
          │                └─────────────┬─────────────┘
          │                              │
          │                              ▼
          │                ┌───────────────────────────┐
          │                │ 3. Evaluate Candidate     │
          │                │    Angle & Transform      │
          │                └─────────────┬─────────────┘
          │                              │
          │                              ▼
          │                ┌───────────────────────────┐
          │                │ 4. 3D Collision Detection │
          │                │    & Loop-Closure Check   │
          │                └─────────────┬─────────────┘
          │                              │
          │                 PASS ┌───────┴───────┐ COLLISION / INVALID
          │                      ▼               ▼
          │             Commit Placement    Record Diagnostic
          │                      │               │
          │                      ▼               ▼
          │             Recurse: All Done?   Try Next Angle
          │               YES ┌────┴────┐ NO     │
          │                   ▼         ▼        ▼
          │             Success      Continue Backtrack (Undo Placement)
          │                                      │
          └──────────────────────────────────────┘
```

---

## 3. Key Components

### 3.1 `AssemblyCollisionDetector`
- **Broad-Phase**: Computes world-space 3D Axis-Aligned Bounding Boxes (AABB) for the candidate piece and all placed subassembly geometry.
- **Narrow-Phase**: Evaluates interpenetrations exceeding `collisionToleranceMm` (default 0.1 mm).
- **Contact Discrimination**: Distinguishes intentional contact along mating interface boundaries from illegal body-on-body penetrations.

### 3.2 `TransformEvaluator`
- Uses `alignInterfaces` to compute exact rigid-body transforms for candidate pieces.
- Verifies finite coordinates and normalized quaternions.
- **Loop Closure Constraint Solving**: If a candidate piece shares connections with more than one already-placed piece (e.g. cycles in a closed box or faceted frame), computes the secondary interface offset. Rejects angles that break loop closure ($> 2.0\text{ mm}$).

### 3.3 `BacktrackingAssemblySolver`
- Executes recursive depth-first search guided by Minimum Remaining Values (MRV).
- Frontier pieces with the most placed neighbors and fewest valid angles are evaluated first.
- Candidate angles are tested starting with the recommended nominal angle (`preferred_first`).
- Records detailed diagnostics on failed branches.

---

## 4. Primary Contracts

```typescript
export interface SuccessfulAssembly {
  success: true;
  puzzleId: string;
  rootPieceId: string;
  assemblyConfiguration: Automatic3DAssemblyConfiguration;
  assemblyState: AssemblyState;
  pieceTransforms: PieceTransforms;
  connectionStates: ConnectionStates;
  placementOrder: string[];
  appliedAngles: Record<string, number>;
  placements: AssemblyPlacement[];
  metrics: SolverMetrics;
}

export interface AssemblyFailureReport {
  success: false;
  puzzleId?: string;
  failureReason: string;
  unplacedPieceIds: string[];
  partiallyPlacedPieceIds: string[];
  diagnostics: SolverStepDiagnostic[];
  metrics: SolverMetrics;
}

export type AssemblySolverResult = SuccessfulAssembly | AssemblyFailureReport;
```

---

## 5. Usage Example

```typescript
import {
  Automatic2DGenerationEngine,
  Piece3DConversionEngine,
  evaluatePuzzleJoiningAngles,
  solveAutomaticAssembly,
} from "@/core/puzzle";

// 1. Generate 2D puzzle & convert to 3D pieces
const puzzle2D = Automatic2DGenerationEngine.generatePuzzle(spec);
const puzzle3D = Piece3DConversionEngine.convertPuzzle(puzzle2D);

// 2. Generate valid candidate angles per connection (Phase 88)
const angleResult = evaluatePuzzleJoiningAngles(puzzle3D, { angleStepDeg: 15 });

// 3. Solve complete 3D assembly (Phase 89)
const result = solveAutomaticAssembly({
  puzzle: puzzle3D,
  validAngleCandidates: angleResult.connectionAngles,
  options: {
    maxBacktracks: 500,
    maxStatesExplored: 2000,
    timeoutMs: 5000,
    collisionToleranceMm: 0.1,
  },
});

if (result.success) {
  console.log("Assembly succeeded! Root:", result.rootPieceId);
  console.log("Placement sequence:", result.placementOrder);
  console.log("Transforms:", result.pieceTransforms);
} else {
  console.error("Assembly failed:", result.failureReason);
  console.error("Unplaced pieces:", result.unplacedPieceIds);
}
```
