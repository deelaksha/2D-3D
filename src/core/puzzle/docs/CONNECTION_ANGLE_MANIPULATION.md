# Connection Angle Inspection & Live Manipulation (Phase 95)

## 1. Overview

Phase 95 extends the 3D puzzle preview system into an interactive engineering tool that enables users to inspect and dynamically manipulate connection joining angles in real time. 

### Core Requirements
1. **Inspection on Selection**: Selecting any connection displays:
   - Unique connection ID
   - Connected pieces (`pieceA` $\leftrightarrow$ `pieceB`)
   - Connector type (e.g., `slot_tab`, `finger_joint`, `cross_lap`)
   - Current joining angle
   - Allowed angle range and candidate angles
2. **Angle Manipulation**:
   - Supports preset angles: **0°, 30°, 45°, 60°, 90°, 180°**, as well as arbitrary continuous angle inputs permitted by the joint.
   - For every angle change:
     1. Calculate new relative transform using kinematic alignment
     2. Propagate delta transforms $\Delta T = T_{\text{child, new}} \circ T_{\text{child, old}}^{-1}$ to all downstream pieces in the sub-assembly tree
     3. Run collision and clearance validation
     4. Run connector mating and insertion validation
     5. Update 3D viewport immediately with color-coded feedback
3. **Robust Rejection & Diagnostics**:
   - Invalid angles are **never silently accepted**.
   - If an angle results in collision or invalid alignment, the visual state is updated (`COLLISION`, `INVALID_CONNECTION`, `WARNING`), affected pieces are highlighted, and precise diagnostic failure messages are shown.
4. **Strict CAD Immutability**:
   - Piece geometry profiles, meshes, and local coordinate frames are **strictly immutable**.
   - Only `AssemblyConfiguration` (applied angles) and piece world transforms (`RigidTransform3D`) are modified.

---

## 2. Architecture & Pipeline

```
User selects Connection in 3D Preview / Drawer
                      ↓
           inspectConnection(connectionId)
   [Piece IDs, Connector Type, Current Angle, Range]
                      ↓
User moves Slider / clicks Preset (0°, 30°, 45°, 60°, 90°, 180°)
                      ↓
           adjustAngle(request)
                      ↓
            KinematicTreeSolver
    1. Identify Root vs Child piece
    2. Recalculate Child Transform: alignInterfaces(childInterface, parentInterface, newAngle)
    3. Compute Delta: ΔT = T_child_new ∘ (T_child_old)⁻¹
    4. Propagate ΔT to all Subtree Descendants
                      ↓
       AssemblyValidationPass (Phase 90)
    1. Connector Geometry & Interface Alignment
    2. Clearance Verification
    3. Collision Detection (AABB / Convex / Mesh)
    4. Assembly Graph Reachability
                      ↓
           AngleAdjustmentResult
    - isValid (boolean)
    - visualState: VALID | COLLISION | INVALID_CONNECTION | WARNING
    - diagnosticMessage (detailed explanation if invalid)
    - appliedTransforms (Map<pieceId, RigidTransform3D>)
                      ↓
3D Viewer updates piece scene meshes, highlights errors, displays diagnostic banner
```

---

## 3. Kinematic Tree Solver & Delta Propagation

When an angle between piece $A$ and piece $B$ is adjusted, one piece is the parent (closer to the assembly root) and the other is the child:
1. **Parent/Child Determination**:
   - A breadth-first search (BFS) from the assembly root identifies topological depths in the connection graph. The shallower piece is designated as parent; the deeper piece as child.
2. **Child Pose Recalculation**:
   - The child's new absolute transform is calculated using `alignInterfaces(childInterface, parentInterface, newAngleDeg, parentTransform)`.
3. **Subtree Delta Propagation**:
   - Moving the child piece must not break downstream mating relationships.
   - The kinematic delta transform is computed as:
     $$\Delta T = T_{\text{child, new}} \times (T_{\text{child, old}})^{-1}$$
   - For every descendant piece $D$ in the subtree rooted at child:
     $$T_{D, \text{new}} = \Delta T \times T_{D, \text{old}}$$
   - This ensures rigid-body fidelity for all attached sub-assemblies.

---

## 4. Live Validation & Diagnostic Reporting

Every angle adjustment executes the Phase 90 `validateConnectorAndAssembly` pipeline:
- **Collision Detection**: Identifies whether rotating the sub-assembly causes overlapping solids or illegal penetrations.
- **Clearance & Angle Checks**: Validates connector-specific angular bounds.
- **Diagnostic Feedback**:
  - If valid: `"Angle applied successfully. Assembly valid with no collisions."`
  - If collision: `"Collision detected between piece_A and piece_B: bounding boxes/faces overlap by X mm."`
  - If invalid connection: `"Mandatory connection C01 violated: joint angle exceeds physical clearance."`

---

## 5. UI Integration in 3D Preview

The `Puzzle3DPreview` component exposes:
- **Connection Angle Inspector Card**:
  - Displays connection ID, piece pair, connector type, and permitted range.
  - Interactive slider for fine-grained continuous angle adjustment.
  - Quick-preset buttons for 0°, 30°, 45°, 60°, 90°, 180°.
  - Live feedback banner with visual badges:
    - 🟢 `VALID`
    - 🔴 `COLLISION`
    - 🟣 `INVALID_CONNECTION`
    - 🟠 `WARNING`
  - Close button to deselect connection.
