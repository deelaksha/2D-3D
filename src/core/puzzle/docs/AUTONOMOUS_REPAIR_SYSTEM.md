# Autonomous Generator to Repair System (Phase 91)

## Overview

The **Autonomous Repair Engine** connects the automatic 2D/3D puzzle generator and 3D assembly solver to the deterministic parametric repair system.

It implements a complete closed-loop repair controller:

```
Generate
   ↓
Validate
   ↓
Find failure
   ↓
Identify responsible parameter
   ↓
Modify parameter
   ↓
Regenerate affected geometry (Local-first)
   ↓
Reassemble
   ↓
Validate again
```

---

## Key Principles & Architectural Guarantees

### 1. Local Repair Precedence
When a single connector (e.g. `C07`) fails:
- The system **does not regenerate the entire puzzle**.
- It modifies `C07`'s parametric variables (e.g., slot width, tab width, clearance, joining angle).
- It regenerates only the affected interfaces and 3D solid profiles for piece A and piece B.
- All other $N-2$ pieces remain completely untouched.
- Reassembles the affected region and revalidates.

### 2. Controlled Global Fallback
Only when local repair fails after configurable retries (or when addressing whole-puzzle topological defects such as missing pieces or global disconnection) does the system fall back to global regeneration.

### 3. Infinite Loop & Cycle Prevention
A deterministic state hash is computed from the puzzle's connection parameters, piece thickness, and applied joining angles at each iteration. If any state repeats, the engine halts immediately with `status = "cycle_detected"`, preventing infinite oscillations.

### 4. Strict Parametric Only (No Raw Mesh Editing)
Arbitrary 3D vertices and meshes are NEVER manipulated directly. All geometric repairs update parametric values, re-evaluating contours and solid extrusions deterministically.

---

## Reporting & Output

Every repair session produces a `FinalRepairStatus` containing:
- **`status`**: `"repaired" | "unrepaired" | "max_retries_exceeded" | "cycle_detected" | "failed"`.
- **`repairedPuzzle`**: Updated `ConvertedPuzzle3D`.
- **`pieceTransforms`**: Validated 3D world placement transforms.
- **`validationReport`**: Phase 90 `AssemblyValidationReport`.
- **`history`**: Complete `RepairHistory` documenting every attempt, scope (`"local"` vs `"global"`), modified parameters, and duration.
