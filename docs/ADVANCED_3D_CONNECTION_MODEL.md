# Advanced 3D Connection Model & Kinematics (Phase 65)

## 1. Overview & Architecture

The **Advanced 3D Connection Model** provides a mathematically rigorous, assembly-configuration-independent representation of spatial interface-to-interface relationships. It models complex multi-behavior kinematics without assuming horizontal/vertical planes or planar surfaces.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ADVANCED 3D CONNECTION MODEL                          │
│                                                                             │
│  Interface A Frame (Fa)                  Interface B Frame (Fb)             │
│  • Origin: o_a                           • Origin: o_b                      │
│  • Tangent: t_a                          • Tangent: t_b                     │
│  • Normal:  n_a                          • Normal:  n_b                     │
│  • Binormal: b_a = t_a x n_a             • Binormal: b_b = t_b x n_b        │
│                                                                             │
│               Relative Rigid Transformation: T_{A -> B}                     │
│               • Rotation: R(theta_joining, phi_roll)                        │
│               • Translation: t(o_a, o_b, clearance * n_b)                   │
│                                                                             │
│  Kinematic Behaviors:                                                       │
│  • FIXED      ──► 0 DOF (Locked translation & rotation)                     │
│  • HINGE      ──► 1 Rotational DOF around hinge axis [theta_min, theta_max] │
│  • SLIDING    ──► 1 Translational DOF along slide vector                    │
│  • ROTATIONAL ──► Multi-axis spherical or swivel rotation                   │
│  • INTERLOCK  ──► Multi-stage keyed trajectory                              │
│  • SNAP       ──► Cantilever deflection & irreversible detent lock          │
│  • CUSTOM     ──► Configurable user kinematics                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Mathematical Specifications

### 2.1 Coordinate Frame Orthonormality
Each interface frame $F = (\mathbf{o}, \mathbf{t}, \mathbf{n}, \mathbf{b})$ must strictly satisfy:
1. **Unit Length**: $||\mathbf{t}|| = 1$, $||\mathbf{n}|| = 1$, $||\mathbf{b}|| = 1 \pm 10^{-4}$.
2. **Mutual Orthogonality**: $\mathbf{t} \cdot \mathbf{n} = 0$, $\mathbf{t} \cdot \mathbf{b} = 0$, $\mathbf{n} \cdot \mathbf{b} = 0 \pm 10^{-4}$.
3. **Right-Handed Orientation**: $\mathbf{t} \times \mathbf{n} = \mathbf{b}$.

### 2.2 Relative Transformation Computation
The relative transformation $T_{A \to B} = (R, \mathbf{p})$ mapping local coordinates of Interface A into local coordinates of Interface B is computed deterministically:
$$q_{\text{oppose}} = \text{Quat}(\mathbf{b}_A, \pi)$$
$$q_{\text{joining}} = \text{Quat}(\mathbf{t}_A, \theta)$$
$$q_{\text{roll}} = \text{Quat}(\mathbf{n}_A, \phi)$$
$$R = q_{\text{joining}} \cdot (q_{\text{roll}} \cdot q_{\text{oppose}})$$
$$\mathbf{p} = \mathbf{o}_B + c \cdot \mathbf{n}_B - R(\mathbf{o}_A)$$
where $c$ is the nominal clearance distance.

### 2.3 Non-Planar & Arbitrary Spatial Configurations
The engine makes **zero assumptions of planarity**:
- Supports compound spatial rotations with non-zero roll, pitch, and yaw.
- Handles tilted, oblique normal vectors.
- Validated across discrete angles ($0^\circ$, $30^\circ$, $45^\circ$, $60^\circ$, $90^\circ$) and arbitrary 3D continuous orientations.

---

## 3. Connection Behaviors & Degrees of Freedom (DOF)

| Behavior | Translational DOF | Rotational DOF | Motion Limits & Invariants |
|---|---|---|---|
| **`FIXED`** | 0 | 0 | Rigid locking upon seating. |
| **`HINGE`** | 0 | 1 | Revolute rotation around hinge axis $\mathbf{a}_{\text{hinge}} \in [\theta_{\text{min}}, \theta_{\text{max}}]$. |
| **`SLIDING`** | 1 | 0 | Prismatic translation along slide vector $\mathbf{v}_{\text{slide}}$. |
| **`ROTATIONAL`** | 0 | 2 or 3 | Multi-axis spherical rotation (ball-and-socket / gimbal). |
| **`INTERLOCK`** | 0 | 0 | Keyed insertion followed by orthogonal slide into locking detent. |
| **`SNAP`** | 0 | 0 | Elastic cantilever deflection during insertion, irreversible retention. |
| **`CUSTOM`** | $0 \dots 3$ | $0 \dots 3$ | User-defined parametric kinematic constraints. |

---

## 4. Contact Regions & Clearances

Each connection defines one or more `ContactRegion3D` patches representing physical mating surfaces:
- `surfaceNormal`: Normalized surface normal vector $\mathbf{n}_{\text{contact}}$.
- `contactAreaMm2`: Effective contact surface area ($A > 0$).
- `contactType`: `"face_to_face" | "edge_to_face" | "tab_shoulder" | "detent_bearing" | "miter_face"`.
- `bounds`: Local min/max spatial extents.

---

## 5. Assembly Independence

The connection model is **pairwise and intrinsic**:
- Defines relative constraints purely between Interface A and Interface B.
- Independent of puzzle world placement coordinates, global origins, and full assembly sequence trees.
- Relative transforms remain invariant regardless of how pieces are placed in the global world frame.

---

## 6. Programmatic Usage Example

```typescript
import {
  ConnectionModelFactory,
  ConnectionMathValidator,
  ConnectionKinematicsEngine
} from "@/core/puzzle/connection";

// 1. Create a 45° miter hinge connection
const hingeConn = ConnectionModelFactory.createHingeConnection({
  interfaceAId: "if_roof_left",
  interfaceBId: "if_roof_right",
  frameA: frameA,
  frameB: frameB,
  joiningAngleDeg: 45.0,
  minAngleDeg: 30.0,
  maxAngleDeg: 60.0,
  clearance: 0.15,
  tolerance: 0.05,
});

// 2. Mathematically validate frames and kinematics
const report = ConnectionMathValidator.validateConnection(hingeConn);
if (!report.isValid) {
  console.error("Connection invalid:", report.errors);
}

// 3. Articulate the hinge at 55°
const articulatedTransform = ConnectionKinematicsEngine.computeArticulatedHingeTransform(
  hingeConn,
  55.0
);
```
