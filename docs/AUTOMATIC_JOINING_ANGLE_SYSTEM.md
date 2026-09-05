# Automatic Joining-Angle Generation System (Phase 88)

## 1. Overview & Objectives

The **Automatic Joining-Angle Generation System** deterministically computes and verifies possible joining angles for each physical connection in a 3D puzzle assembly.

Instead of guessing or assuming planar (180°) or orthogonal (90°) orientations, the engine:
1. Systematically determines candidate angles from connector kinematics and connection constraints.
2. Formally evaluates each candidate through a strict **3-Tier Hierarchy**.
3. Categorizes non-viable angles into 5 explicit rejection reasons.
4. Returns a typed `ValidAngleCandidates` object per connection.
5. Operates completely deterministically without heuristics, random search, or AI.

---

## 2. Theoretical Architecture & 3-Tier Classification

```
   Candidate Generation (0°, 15°, 30°, 45°, 60°, 90°, 180°, etc.)
                              │
                              ▼
        ┌───────────────────────────────────────────┐
        │  Tier 1: Mathematically Possible          │
        │  - Connector kinematics & degree of freedom│
        │  - Angular range limits [min, max]        │
        └─────────────────────┬─────────────────────┘
                              │ PASS
                              ▼
        ┌───────────────────────────────────────────┐
        │  Tier 2: Geometrically Valid              │
        │  - Interface frame alignment precision    │
        │  - Minimum physical clearance threshold   │
        │  - Direct body-on-body collision checking │
        └─────────────────────┬─────────────────────┘
                              │ PASS
                              ▼
        ┌───────────────────────────────────────────┐
        │  Tier 3: Physically Assemblable           │
        │  - Approach trajectory & linear standoff  │
        │  - Swept-volume insertion interference    │
        └─────────────────────┬─────────────────────┘
                              │ ALL PASS
                              ▼
                     ValidAngleCandidates
```

### 2.1 Tier 1: Mathematically Possible
- Determines if the mechanical connector family mathematically supports rotation or placement at the candidate angle.
- **Rules**:
  - `notch` (half-lap joint): Rigid crossing joint, only $|angle - 90^\circ| \le 1^\circ$ is geometrically permissible. Non-90° angles violate joint kinematics (`invalid_geometry`).
  - `interlock` (dovetail): In-plane tensile locks support 180° or angled 90° configurations.
  - `tab_slot`: In-line (180°), right angle (90°), and acute or obtuse configurations down to 15°.
  - `hinge` / `rotational`: Sampled across continuous ranges ($[0^\circ, 180^\circ]$ or $[0^\circ, 360^\circ]$).
  - Explicit connection range bounds ($[\min, \max]$) are enforced.

### 2.2 Tier 2: Geometrically Valid
- Aligns Piece B's coordinate frame with Piece A's interface frame at the candidate angle using rigid-body transformations (`alignInterfaces`).
- **Validation**:
  1. **Alignment Precision**: Mating interface points must coincide within $\le 0.5\text{ mm}$ error margin; otherwise rejected as `invalid_connector_alignment`.
  2. **Clearance**: Manufacturing tolerance must meet or exceed minimum threshold ($\text{clearance} \ge 0.05\text{ mm}$); otherwise rejected as `insufficient_clearance`.
  3. **Collision / Penetration**:
     - Extreme folding angles ($0^\circ$) where adjacent piece bodies overlap or fold directly back onto each other are detected and rejected as `collision`.
     - Direct vertex-in-polyhedron penetration depths $> 0.05\text{ mm}$ trigger `collision`.

### 2.3 Tier 3: Physically Assemblable
- Evaluates the approach trajectory from a standoff distance ($20\text{ mm}$) along the insertion vector to the final seated pose.
- Detects swept volume collisions where adjacent body volume blocks sliding into place before seating. Angles causing this are rejected as `impossible_insertion`.

---

## 3. Explicit Rejection Categories

| Rejection Reason | Description | Primary Detection Trigger |
| :--- | :--- | :--- |
| `invalid_geometry` | Angle violates connector kinematic design | Notches at non-90°, angles outside kinematic limits |
| `invalid_connector_alignment` | Interface mating frames fail alignment | Mating coordinate error $> 0.5\text{ mm}$ |
| `insufficient_clearance` | Mating clearance below physical limit | Connection clearance $< \text{minClearanceMm}$ (0.05 mm) |
| `collision` | Rigid bodies overlap in final seated pose | 0° acute fold-back, body penetration depth $> 0.05\text{ mm}$ |
| `impossible_insertion` | Swept volume obstructed during approach | Body obstruction along insertion path |

---

## 4. Domain Data Structures

```typescript
export interface ValidAngleCandidates {
  connectionId: string;
  pieceAId: string;
  pieceBId: string;
  connectorType: ConnectorType;
  allCandidates: CandidateAngleEvaluation[];
  validAngles: number[];
  mathematicallyPossibleAngles: number[];
  geometricallyValidAngles: number[];
  physicallyAssemblableAngles: number[];
  rejectedAngles: RejectedAngleInfo[];
  recommendedAngle: number;
}
```

---

## 5. Usage Example

```typescript
import {
  AutomaticJoiningAngleEngine,
  evaluateConnectionAngles,
} from "@/core/puzzle";

const result = evaluateConnectionAngles({
  pieceA,
  pieceB,
  connection,
  options: {
    angleStepDeg: 15.0, // 0°, 15°, 30°, 45°, 60°, 75°, 90°, ..., 180°
    minClearanceMm: 0.05,
  },
});

console.log("Valid angles:", result.validAngles);
// e.g. [30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]
console.log("Rejected angles:", result.rejectedAngles);
// [
//   { angleDeg: 0, reason: "collision", details: "Direct body-on-body collision (0° fold back)." },
//   { angleDeg: 15, reason: "impossible_insertion", details: "Linear insertion blocked..." }
// ]
```
