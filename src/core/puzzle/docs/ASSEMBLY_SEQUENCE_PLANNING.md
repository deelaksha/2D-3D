# Assembly-Sequence Planning Subsystem Specification (Phase 14)

This document specifies the **Assembly-Sequence Planning Subsystem** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Architectural Mandate

### Graph Connectivity \(\neq\) Physical Assemblability
- A topologically connected assembly graph \(G = (V, E)\) does **NOT** guarantee that a puzzle can be physically assembled.
- Insertion vector trajectories (\(\vec{v}_{\text{insert}}\)) can encounter 3D bounding volume collisions with already-assembled subassembly pieces, or neighboring geometry can physically trap an incoming piece.

---

## 2. Explicit Assembly Sequence Representation

Assembly sequences are represented step-by-step with explicit subassembly state labels:

```json
{
  "sequenceId": "seq_001",
  "isPhysicallyAssemblable": true,
  "totalSteps": 3,
  "steps": [
    {
      "stepNumber": 1,
      "addedPieceId": "P01",
      "activeConnectionIds": [],
      "subAssemblyPieces": ["P01"],
      "subAssemblyStateLabel": "P01",
      "stepDescription": "Step 1: Place base piece 'P01'."
    },
    {
      "stepNumber": 2,
      "addedPieceId": "P02",
      "activeConnectionIds": ["conn_1"],
      "subAssemblyPieces": ["P01", "P02"],
      "subAssemblyStateLabel": "P01 + P02",
      "joiningAngleDeg": 90.0,
      "stepDescription": "Step 2: Attach 'P02' to subassembly [P01 + P02] via connections [conn_1]."
    },
    {
      "stepNumber": 3,
      "addedPieceId": "P03",
      "activeConnectionIds": ["conn_2"],
      "subAssemblyPieces": ["P01", "P02", "P03"],
      "subAssemblyStateLabel": "P01 + P02 + P03",
      "joiningAngleDeg": 90.0,
      "stepDescription": "Step 3: Attach 'P03' to subassembly [P01 + P02 + P03] via connections [conn_2]."
    }
  ]
}
```

---

## 3. Baseline Solver Pipeline & Verification Steps

For each candidate piece assembly order \(P_1, P_2, \dots, P_N\):
1. **Base Placement**: Place base piece \(P_1\). Subassembly \(S_1 = \{P_1\}\).
2. **Step \(k\) Insertion & Physical Verification**:
   - Check connection constraint (active connection edge exists to \(S_{k-1}\)).
   - Check joining angle range constraint.
   - Run 3D geometric spatial validation (`validate3DAssemblyGeometry`) on subassembly \(S_{k-1} \cup \{P_k\}\).
   - If unexpected 3D collisions or interface misalignments occur, reject sequence and return structured invalidation reasons.

---

## 4. Current Limitations & Extensibility

- **Baseline Trajectory**: Employs straight-line linear 3D insertion trajectory vectors.
- **Future AI / Motion Planning Interface**: The `AssemblySequenceSolver` interface is designed to support future non-linear 3D motion planning algorithms (e.g. RRT*, PRM, or AI-guided trajectory solvers) without breaking existing data structures.
