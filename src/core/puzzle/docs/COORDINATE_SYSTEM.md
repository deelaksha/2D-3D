# 3D Coordinate-Frame System Specification (Phase 5)

This document specifies the **3D Coordinate-Frame & Transformation System** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Architectural Principles

### Preservation of Base Geometry
- **Piece 2D base geometry is never mutated** by 3D assembly actions or rotations.
- Assembly configurations apply 3D rigid transformations (`RigidTransform3D`) dynamically to piece instances inside `CanonicalAssemblyConfiguration.pieceTransforms`.

### 3D Coordinate Conventions
- **Right-Handed System**:
  - `+X` axis: Tangent vector along edge (Right)
  - `+Y` axis: Normal vector outward (Up/Forward)
  - `+Z` axis: Binormal vector (Out of page / Thickness)
- **Unit Quaternions**: Rotations are represented as normalized unit quaternions \(Q = [q_x, q_y, q_z, q_w]\).

---

## 2. Core Mathematical Operations

### 2.1 Rigid Point & Vector Transformations
- **Point Transformation**: \(p' = T(p) = R \cdot p + t\)
- **Vector Transformation**: \(v' = R \cdot v\)

### 2.2 Transformation Composition (\(T_{\text{composite}} = T_1 \circ T_2\))
Evaluates nested spatial transformations sequentially:
\[
T_{12}(p) = T_1(T_2(p)) = R_1 (R_2 p + t_2) + t_1 = (R_1 R_2) p + (R_1 t_2 + t_1)
\]
- Composite Rotation: \(R_{12} = R_1 \cdot R_2\)
- Composite Position: \(t_{12} = R_1 \cdot t_2 + t_1\)

### 2.3 Inverse Transformation (\(T^{-1}\))
Inverts a rigid spatial transformation such that \(T^{-1}(T(p)) = p\):
- Inverse Rotation: \(R^{-1} = R^*\) (Quaternion conjugate \([-q_x, -q_y, -q_z, q_w]\))
- Inverse Position: \(t^{-1} = -R^{-1} \cdot t\)

### 2.4 Local-to-World & World-to-Local Conversion
- `localToWorld(pieceTransform, localPoint)`: \(p_{\text{world}} = T_{\text{piece}}(p_{\text{local}})\)
- `worldToLocal(pieceTransform, worldPoint)`: \(p_{\text{local}} = T_{\text{piece}}^{-1}(p_{\text{world}})\)

### 2.5 Interface-to-Interface Mating Alignment (`alignInterfaces`)
Aligns a target interface to a source interface at an arbitrary 3D joining angle \(\theta\):
1. Compute source interface world position: \(O_{\text{world}} = T_{\text{source}}(O_{\text{source\_local}})\).
2. Calculate relative mating rotation quaternion \(Q_{\text{mating}}\) driven by joining angle \(\theta\) and roll angle.
3. Compute target piece rotation: \(Q_{\text{target}} = Q_{\text{source}} \cdot Q_{\text{mating}}\).
4. Compute target piece position: \(P_{\text{target}} = O_{\text{world}} - (Q_{\text{target}} \cdot O_{\text{target\_local}})\).
