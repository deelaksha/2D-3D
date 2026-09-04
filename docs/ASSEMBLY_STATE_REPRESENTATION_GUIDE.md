# Formal 3D Assembly State Representation & Transition Guide (Phase 66)

## 1. Overview & Architecture

The **3D Assembly State System** provides a formal, immutable, versioned representation of the puzzle throughout its construction lifecycle. Every state captures pieces, 3D transforms, active/inactive connections, physical contact patches, kinematic degrees of freedom, assembly sequences, collision states, and clearance tolerances.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          IMMUTABLE STATE PIPELINE                           │
│                                                                             │
│     AssemblyState A (Initial State: unplaced pieces, inactive conns)        │
│                           │                                                 │
│                           ▼  insertPiece(pieceId, transform)                │
│     AssemblyState B (Placed base piece, recalculated DOFs, sequence step 1) │
│                           │                                                 │
│                           ▼  rotatePiece(pieceId, axis, angleDeg)           │
│     AssemblyState C (Oriented piece, updated collision envelope)            │
│                           │                                                 │
│                           ▼  activateConnection(connectionId)               │
│     AssemblyState D (Generated contact patches, constrained DOFs, locked)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Entities

### 2.1 `AssemblyState`
Complete, immutable snapshot of the puzzle at step $k$:
- `stateId`: Unique UUID.
- `version`: Monotonically increasing version number ($1, 2, 3 \dots$).
- `pieces`: Array of `AssemblyPieceState` with placed flags and dimensions.
- `pieceTransforms`: Map of `pieceId -> RigidTransform3D` in 3D world space.
- `activeConnections`: List of mated, engaged `Advanced3DConnection` instances.
- `inactiveConnections`: List of unmated, potential connections.
- `contactStates`: List of active contact patches with separation/penetration distances.
- `assemblySequence`: Step-by-step history of executed assembly operations.
- `degreesOfFreedom`: Kinematic translation/rotation DOFs remaining per piece.
- `constraints`: Status of spatial and geometric constraints.
- `collisionState`: `hasCollision`, colliding pairs, and minimum clearance distance.
- `clearanceState`: Nominal vs actual clearances and tolerance check.
- `isLocked`: True when all placed pieces are fully constrained ($0 \text{ DOF}$).

### 2.2 `AssemblyTransition`
An explicit, auditable operation transforming `State_k` into `State_{k+1}`:
- Types: `"INSERT_PIECE"`, `"ROTATE_PIECE"`, `"TRANSLATE_PIECE"`, `"ACTIVATE_CONNECTION"`, `"DEACTIVATE_CONNECTION"`.
- Parameters: `pieceId`, `initialTransform`, `rotationAxis`, `rotationAngleDeg`, `translationVector`, `connectionId`.
- Success status, diagnostics, and timestamp.

### 2.3 `AssemblySnapshot`
Deep-frozen representation paired with a cryptographic SHA-256 checksum:
$$\text{Checksum} = \text{SHA256}(\text{State JSON digest})$$
Guarantees tamper-evident reproducibility and version tracking.

### 2.4 `AssemblyHistory`
Complete state machine supporting:
- Linear execution and step logging.
- `undo()`: Step backwards along the state timeline.
- `redo()`: Step forwards into future states.
- Snapshot cataloging and step-index lookups.

---

## 3. Kinematic Degree-of-Freedom (DOF) Analysis

The `DofCalculator` evaluates the active connection topology:
1. **Base Piece (Anchor)**: Assigned $0 \text{ DOF}$ (anchored in world frame).
2. **Unplaced Pieces**: $3 \text{ translation} + 3 \text{ rotation}$ unconstrained DOFs.
3. **Connected Pieces**:
   - `FIXED` joint: Fully constrained ($0 \text{ DOF}$).
   - `HINGE` joint: $0 \text{ translation}$, $1 \text{ rotation}$ around hinge axis.
   - `SLIDING` joint: $1 \text{ translation}$ along slide axis, $0 \text{ rotation}$.
   - Multi-joint connections: Intersecting constraints reduce DOFs to 0 (rigid lock).

---

## 4. Programmatic Usage Example

```typescript
import {
  AssemblyHistory,
  AssemblyStateEngine,
  type AssemblyPieceState
} from "@/core/puzzle/assemblystate";
import { ConnectionModelFactory } from "@/core/puzzle/connection";
import { vec3 } from "@/core/puzzle/geometry/math3d";

// 1. Initialize History with pieces and connections
const pieces: AssemblyPieceState[] = [
  { pieceId: "p1", name: "Base", dimensions: { width: 100, height: 80, thickness: 3 }, interfaceIds: ["if1"], isPlaced: false },
  { pieceId: "p2", name: "Wall", dimensions: { width: 80, height: 60, thickness: 3 }, interfaceIds: ["if2"], isPlaced: false },
];

const connection = ConnectionModelFactory.createFixedConnection({
  interfaceAId: "if1",
  interfaceBId: "if2",
  pieceAId: "p1",
  pieceBId: "p2",
  frameA: frameA,
  frameB: frameB,
});

const history = AssemblyHistory.fromPieces(pieces, [connection]);

// 2. State A -> Insert p1 -> State B
history.insertPiece("p1");

// 3. State B -> Insert p2 -> State C
history.insertPiece("p2");

// 4. State C -> Rotate p2 by 90° -> State D
history.rotatePiece("p2", vec3(0, 1, 0), 90.0);

// 5. State D -> Activate connection -> State E
history.activateConnection(connection.id);

console.log("Assembly is locked:", history.currentState.isLocked); // true
console.log("Snapshots count:", history.snapshots.length);

// 6. Undo / Redo
const previousState = history.undo();
const restoredState = history.redo();
```
