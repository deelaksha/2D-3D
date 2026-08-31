# Piece Geometry vs. Assembly Transform Specification (Phase 10)

This document specifies the fundamental architectural distinction between **Piece Geometry** and **Assembly Transform** in the Parametric 2D-to-3D Puzzle System.

---

## 1. Architectural Distinction

| Concept | **Piece Geometry** (Intrinsic Template) | **Assembly Transform** (Extrinsic Instance Pose) |
|---|---|---|
| **Scope** | Intrinsic piece template model (`ParametricPiece2D` / `SolidRepresentation3D`). | Extrinsic 3D spatial placement within an `AssemblyConfiguration`. |
| **Coordinate Space** | Strictly **LOCAL coordinate space** (\(x, y\) in 2D local plane, \(z \in [-T/2, +T/2]\)). | **WORLD 3D coordinate space** (\(\vec{r}_{\text{world}}, Q_{\text{world}}\)). |
| **Joining Angles** | **NONE**. No customer joining angles or assembly rotations exist here. | **Arbitrary 3D joining angles** (\(\theta \in [0^\circ, 360^\circ]\)). |
| **Mutability** | Mutated only when piece parameters (`width`, `height`, `thickness`, `tab_width`) change. | Mutated dynamically during 3D drag-and-drop, kinematic solving, or snapping. |
| **Reusability** | A single piece geometry template can be instantiated multiple times in an assembly. | Unique per instantiated piece instance. |

---

## 2. 2D-to-3D Solid Extrusion Layer (`convert2DTo3DSolid`)

The conversion layer accepts validated 2D piece geometry, stock material thickness \(T\), and material density, and generates a 3D solid mesh buffer (`SolidMeshBuffer3D`).

### Local Extrusion Bounds Guarantee
- Front face: \(z = +T/2\)
- Back face: \(z = -T/2\)
- Local bounding box z-range: \([-\text{thickness}/2, +\text{thickness}/2]\)

---

## 3. Physical Mass & Volume Calculations

- **Physical Volume (\(\text{mm}^3\))**:
  \[
  \text{Volume} = \text{usableArea2D} \times \text{thickness}
  \]
- **Surface Area (\(\text{mm}^2\))**:
  \[
  \text{SurfaceArea} = 2 \times \text{usableArea2D} + \text{perimeter} \times \text{thickness}
  \]
- **Mass (Grams)**:
  \[
  \text{Mass} = \text{Volume} \times \left(\text{density} \times 0.001\right)
  \]

---

## 4. Solid Validation Engine (`validate3DSolidRepresentation`)

Validates generated 3D solid representations:
1. **Valid Closed Profile**: Verifies 2D boundary and hole contours are closed loops.
2. **Valid Extrusion Bounds**: Verifies \(z_{\min} = -T/2\) and \(z_{\max} = +T/2\).
3. **Non-Zero Thickness**: Rejects stock thickness \(T \le 0\).
4. **Valid Solid**: Verifies positive volume (\(V > 0\)), non-empty face indices, and non-NaN vertex coordinates.
