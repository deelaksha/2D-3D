# 3D Assembly Transformation System Specification (Phase 11)

This document specifies the **3D Assembly Transformation System** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Architectural Principles

### Zero Geometry Mutation
- The system **never modifies original 2D/3D piece geometry templates**.
- Spatial transformations (\(\vec{r}, Q\)) are owned exclusively by `AssemblyPlacement` records inside an `AssemblyConfigurationState`.
- The exact same piece template can be instantiated in multiple assembly configurations with different spatial placements.

---

## 2. Rigid Motion & Interface Alignment Mathematics

### 2.1 Interface Frame Definition
Each interface port defines a 3D orthonormal local frame:
\[
\mathbf{F} = \{\vec{o}, \vec{t}, \vec{n}, \vec{b}\}
\]

### 2.2 Relative & Absolute Transforms
Given piece \(A\) with transform \(\mathbf{T}_A\) and piece \(B\) with transform \(\mathbf{T}_B\):
- **Relative Transform**:
  \[
  \mathbf{T}_{A \to B} = \mathbf{T}_A^{-1} \circ \mathbf{T}_B
  \]
- **Absolute Transform**:
  \[
  \mathbf{T}_B = \mathbf{T}_A \circ \mathbf{T}_{A \to B}
  \]

### 2.3 Interface Alignment Solver (`calculateInterfaceMatingTransform`)
Given source interface frame \(\mathbf{F}_A\) and target interface frame \(\mathbf{F}_B\) on piece \(B\), the solver computes target piece world transform \(\mathbf{T}_B\) aligning \(\mathbf{F}_B\) to \(\mathbf{F}_A\) at requested joining angle \(\theta \in [0^\circ, 360^\circ]\):
1. Compute relative rotation quaternion \(Q_{\text{rot}}\) rotating target normal \(\vec{n}_B\) into opposite alignment with source normal \(\vec{n}_A\).
2. Apply hinge rotation by angle \(\theta\) around tangent vector \(\vec{t}_A\).
3. Compute translation vector bringing target origin \(\vec{o}_B\) into coincidence with source origin \(\vec{o}_A\).

---

## 3. Supported Multi-Angle Joining Configurations

- **\(0^\circ\)**: Flat coplanar extension.
- **\(30^\circ\)**: Shallow angled roof / box bevel.
- **\(45^\circ\)**: 45-degree chamfer / angled roof joint.
- **\(60^\circ\)**: 60-degree triangular prism joint.
- **\(90^\circ\)**: Perpendicular box corner joint.
- **Compound Non-Planar Orientations**: 3D spatial joints with arbitrary roll/pitch/yaw rotations.
