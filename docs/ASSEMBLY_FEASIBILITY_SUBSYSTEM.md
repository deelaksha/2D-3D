# Assembly-Feasibility Validation Subsystem (Phase 68)

## 1. Overview & Architecture

The **Assembly-Feasibility Validation Subsystem** evaluates whether a user can physically assemble a 3D puzzle into an intended final configuration without impossible physical penetration or geometric blocking.

The system operates **strictly deterministically** (no machine learning / AI heuristics) to guarantee mathematical repeatability, safety, and transparency.

```
       AssemblyFeasibilityQuery
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ Stage 1: Final Configuration Validity                  │
│   • Pairwise static AABB intersection & penetration    │
│   • Detection: INVALID_FINAL_CONFIGURATION             │
└─────────────────────────┬──────────────────────────────┘
                          │ (Pass)
                          ▼
┌────────────────────────────────────────────────────────┐
│ Stage 2: Topological Assembly Sequence Ordering        │
│   • Directed connection graph resolution               │
│   • Or custom prescribed order (base -> parts)         │
└─────────────────────────┬──────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│ Stage 3: Sequential Trajectory & Collision Sweeper     │
│   For each incoming piece i:                           │
│     1. Kinematic verification:                         │
│        • Approach vector vs receiver normal            │
│          -> IMPOSSIBLE_INSERTION_DIRECTION             │
│        • Angle limits & rotational bounds              │
│          -> IMPOSSIBLE_ROTATION                        │
│        • Interface accessibility & clearance           │
│          -> BLOCKED_CONNECTION                         │
│     2. Trajectory Waypoint Generation:                 │
│        • Linear standoff interpolation (t: 0.0 -> 1.0) │
│     3. Continuous Collision Sweep:                     │
│        • AABB test against pieces {0, ..., i-1}        │
│        • In-transit clash -> COLLISION_DURING_MOVEMENT │
│        • Obstacle clash   -> INTERFERENCE_FROM_...     │
└─────────────────────────┬──────────────────────────────┘
                          │
                          ▼
             AssemblyFeasibilityResult
             • isFeasible (boolean)
             • status: FEASIBLE | INFEASIBLE | PARTIALLY_FEASIBLE
             • failureReasons: AssemblyFailureReason[]
             • assemblyPath: AssemblyPath
```

---

## 2. Failure Reason Taxonomies

The subsystem classifies assembly failures into six distinct, mutually exclusive failure reason codes:

| Code | Trigger Condition | Diagnostic Payload |
|---|---|---|
| `COLLISION_DURING_MOVEMENT` | An incoming piece collides with already-assembled subassembly geometry during trajectory motion. | `pieceId`, `conflictingPieceId`, `stepIndex`, waypoint location `collisionPoint` |
| `IMPOSSIBLE_INSERTION_DIRECTION` | Connection insertion vector points away from or is geometrically opposed to the receiving interface normal ($\mathbf{d}_{\text{ins}} \cdot \mathbf{n}_{\text{recv}} > 0.5$). | `pieceId`, `connectionId`, `stepIndex` |
| `BLOCKED_CONNECTION` | The insertion vector is physically obstructed, or a required mating interface is blocked by prior pieces before connection occurs. | `pieceId`, `connectionId`, `conflictingPieceId` |
| `IMPOSSIBLE_ROTATION` | The required joining angle or rotational degree of freedom exceeds allowed connection limits or violates angular clearances. | `pieceId`, `connectionId`, `stepIndex` |
| `INTERFERENCE_FROM_ASSEMBLED_PIECES` | Pieces assembled earlier in the sequence physically intrude into the bounding corridor or assembly clearance envelope of the incoming piece. | `pieceId`, `conflictingPieceId`, `stepIndex` |
| `INVALID_FINAL_CONFIGURATION` | Static target configuration has two or more pieces penetrating each other beyond clearance tolerance ($\Delta V > \text{tol}^3$). | `pieceId`, `conflictingPieceId`, overlap volume in $\text{mm}^3$ |

---

## 3. Core Data Structures

### `AssemblyFeasibilityQuery`
```typescript
interface AssemblyFeasibilityQuery {
  pieces: FeasibilityPieceGeometry[];
  targetConfiguration: Record<string, RigidTransform3D>;
  connections: AdvancedConnectionModel[];
  prescribedOrder?: string[];
  options?: {
    standoffDistanceMm?: number; // Distance along insertion vector to start approach (default: 50.0mm)
    trajectorySteps?: number;    // Number of interpolated discrete sweep steps (default: 20)
    toleranceMm?: number;        // Clearance tolerance (default: 0.1mm)
  };
}
```

### `AssemblyFeasibilityResult`
```typescript
interface AssemblyFeasibilityResult {
  isFeasible: boolean;
  status: "FEASIBLE" | "INFEASIBLE" | "PARTIALLY_FEASIBLE";
  failureReasons: AssemblyFailureReason[];
  assemblyPath?: AssemblyPath;
  diagnostics: string[];
}
```

### `AssemblyPath` and `AssemblyPathStep`
```typescript
interface AssemblyPathStep {
  pieceId: string;
  stepIndex: number;
  startTransform: RigidTransform3D;
  targetTransform: RigidTransform3D;
  waypoints: RigidTransform3D[];
  insertionDirection: Vec3;
  durationEstimateSec: number;
  activeConnectionIds: string[];
}

interface AssemblyPath {
  steps: AssemblyPathStep[];
  totalSteps: number;
  isExecutable: boolean;
}
```

---

## 4. Documented Limitations of the Baseline Motion Planner

As a deterministic baseline designed for high throughput, predictable execution, and safety verification, the Phase 68 planner implements specific assumptions. Developers and downstream optimization systems must note the following limitations:

1. **Linear Insertion Trajectories (Single-Axis Linear Paths)**:
   - *Limitation*: The baseline interpolates waypoints linearly along the connection's `insertionDirection` from `standoffDistanceMm` to target transform.
   - *Implication*: Complex puzzle mechanisms requiring multi-stage curved or multi-axis "twist-and-lock" insertions (e.g., L-shaped bayonet slides or helical screw threads) will register as infeasible under the baseline linear sweep unless decomposed into discrete sub-steps.
2. **Axis-Aligned Bounding Box (AABB) Collision Envelopes**:
   - *Limitation*: Collision detection between moving pieces and the stationary subassembly uses world-transformed bounding boxes with clearance volume tolerance thresholds.
   - *Implication*: For highly concave pieces (e.g., hollow ring or C-bracket) where an incoming piece moves through an interior cavity without touching the walls, AABB checks will treat the bounding box as solid. Downstream phases will incorporate convex hull decomposition or mesh-level GJK/EPA.
3. **Rigid Body Dynamics (No Elasticity or Deflection)**:
   - *Limitation*: Pieces are treated as perfectly rigid bodies with zero compliance.
   - *Implication*: Snap-fit joints (`SNAP`) that physically require temporary cantilever deflection to slip over retention tabs cannot simulate deflection in this baseline, requiring tolerance allowances or pre-clearance definitions.
4. **Single-Piece Sequential Assembly Order**:
   - *Limitation*: Pieces are evaluated one piece at a time moving into a rigid stationary subassembly.
   - *Implication*: Simultaneous co-insertion (e.g., closing a 4-bar kinematic loop or interlocking three pieces concurrently) is not evaluated in single-piece sequential mode.
5. **Discrete Time Stepping (Tunneling Risk at Low Step Counts)**:
   - *Limitation*: Trajectory sweeps evaluate discrete waypoints (default 20 steps).
   - *Implication*: Extremely thin features (e.g., 0.2mm sheet metal tabs) moving at large step increments could theoretically pass through a narrow barrier if `trajectorySteps` is set too low. Increasing `trajectorySteps` mitigates this.

---

## 5. Verification & Testing

The feasibility validation subsystem is covered by automated smoke and regression tests in `src/__smoke__/assemblyFeasibilitySubsystemPhase68.test.ts`, testing:
1. Feasible 2-piece and 3-piece sequential insertions with valid trajectories.
2. Static overlap detection triggering `INVALID_FINAL_CONFIGURATION`.
3. Normal-opposed vectors triggering `IMPOSSIBLE_INSERTION_DIRECTION`.
4. Angular range violations triggering `IMPOSSIBLE_ROTATION`.
5. Waypoint obstacle collision triggering `INTERFERENCE_FROM_ASSEMBLED_PIECES` and `COLLISION_DURING_MOVEMENT`.
6. Full assembly path generation with multi-step waypoints and duration estimates.
