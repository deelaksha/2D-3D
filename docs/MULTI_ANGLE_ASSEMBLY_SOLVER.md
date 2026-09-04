# Multi-Angle 3D Assembly Solver (Phase 67)

## 1. Overview & Architecture

The **Multi-Angle 3D Assembly Solver** determines whether a desired joining angle between two puzzle pieces is geometrically, physically, and kinematically valid.

Crucially, the solver does not treat an allowed angle as a guarantee of assemblability. It enforces a strict **3-tier evaluation pipeline**:

```
                              [ Desired Angle theta ]
                                        │
                                        ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │ TIER 1: THEORETICALLY ALLOWED                                          │
    │ • Continuous ranges [theta_min, theta_max]                             │
    │ • Discrete angle sets {theta_1, theta_2, ...}                          │
    │ • Behavior DOFs (FIXED, HINGE, SLIDING, ROTATIONAL)                    │
    │ • Rotation axis constraints                                            │
    └───────────────────────────────────┬────────────────────────────────────┘
                                        │ PASS
                                        ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │ TIER 2: GEOMETRICALLY VALID (At Seated Resting Pose)                   │
    │ • Solves exact 3D world placement: T_B = T_A o T_rel(theta)            │
    │ • Evaluates 3D spatial interpenetration outside joint contact zones    │
    │ • Detects plate thickness clashes and acute fold-back collisions       │
    └───────────────────────────────────┬────────────────────────────────────┘
                                        │ PASS
                                        ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │ TIER 3: PHYSICALLY ASSEMBLABLE (Insertion Sweep Trajectory)            │
    │ • Simulates approach sweep along connection insertionDirection         │
    │ • Swept volume collision check from standoff distance to seated pose   │
    │ • Detects geometric undercuts, draft traps, and assembly jamming       │
    └───────────────────────────────────┬────────────────────────────────────┘
                                        │ PASS
                                        ▼
                             [ FULLY_VALID ANGLE ]
```

---

## 2. The 3-Tier Classification Model

| Status | Tier 1 (Theoretical) | Tier 2 (Geometric) | Tier 3 (Physical) | Explanation |
|---|:---:|:---:|:---:|---|
| **`FULLY_VALID`** | PASS | PASS | PASS | Angle is in range, seated pose is collision-free, and piece can be inserted along trajectory without jamming. |
| **`BLOCKED_ASSEMBLY_PATH`** | PASS | PASS | **FAIL** | Resting pose is geometrically valid, but the insertion trajectory is obstructed (undercut or mechanical trap). |
| **`GEOMETRIC_SELF_COLLISION`**| PASS | **FAIL** | — | Desired angle is within kinematic limits, but causes major body overlap/plate clash when seated. |
| **`THEORETICALLY_DISALLOWED`**| **FAIL**| — | — | Desired angle violates connection continuous ranges, discrete sets, or behavior rotation axis constraints. |

---

## 3. Supported Angular Formulations

### 3.1 Continuous Angle Ranges
Bounded angular intervals $[\theta_{\text{min}}, \theta_{\text{max}}]$ with angular tolerance $\epsilon$ (default $0.5^\circ$):
$$\theta \in [\theta_{\text{min}} - \epsilon, \theta_{\text{max}} + \epsilon]$$

### 3.2 Discrete Angle Sets
Explicit permitted angles (e.g. $[0^\circ, 45^\circ, 90^\circ, 135^\circ]$):
$$\exists \theta_k \in \Theta_{\text{allowed}} \quad \text{s.t.} \quad |\theta - \theta_k| \le \epsilon$$

### 3.3 Axis-Constrained Single Rotations
For revolute joints (`HINGE`), rotations must align with the connection's dedicated hinge axis:
$$|\mathbf{a}_{\text{desired}} \cdot \mathbf{a}_{\text{hinge}}| \ge 1 - \epsilon$$

### 3.4 Multi-Axis Rotations
For spherical / universal joints (`ROTATIONAL` / `CUSTOM`), rotations can occur across multiple independent axes (e.g. tangent, normal, and binormal).

---

## 4. Physical Insertion Sweep Analysis

An angle that is mathematically collision-free when seated may be **physically impossible to assemble** due to surrounding geometry blocking the insertion path.

The `InsertionSweepEvaluator` simulates the motion:
$$\mathbf{p}(s) = \mathbf{p}_{\text{seated}} - \mathbf{v}_{\text{insert}} \cdot (1 - s) \cdot d_{\text{standoff}}, \quad s \in [0, 1)$$
- Evaluates swept volume collisions at discretized trajectory steps.
- Distinguishes intentional joint contact at $s \approx 1.0$ from blocking collisions along the path $s < 1.0$.
- Checks that approach vectors oppose the interface normal ($\mathbf{v}_{\text{insert}} \cdot \mathbf{n}_A < 0.5$).

---

## 5. Programmatic Usage Example

```typescript
import {
  MultiAngleAssemblySolver,
  type SolvableAssemblyPiece,
  type DiscreteAngleSet
} from "@/core/puzzle/assembly";
import { ConnectionModelFactory } from "@/core/puzzle/connection";

// 1. Define query
const result = MultiAngleAssemblySolver.evaluateAngle({
  pieceA,
  pieceB,
  connection,
  desiredAngleDeg: 45.0,
  angleSpecification: {
    kind: "discrete_set",
    allowedAnglesDeg: [0, 45, 90, 135],
    nominalAngleDeg: 90,
  }
});

// 2. Check structured 3-tier results
if (result.overallStatus === "FULLY_VALID") {
  console.log("Angle 45° is fully valid!");
  console.log("Seated placement transform:", result.resultingPlacement);
} else {
  console.warn("Angle rejected:", result.overallStatus);
  console.warn("Diagnostics:", result.diagnostics);
}

// 3. Batch candidate angle search
const batchResults = MultiAngleAssemblySolver.findValidAngles(
  pieceA,
  pieceB,
  connection,
  [0, 30, 45, 60, 90, 120, 180]
);
```
