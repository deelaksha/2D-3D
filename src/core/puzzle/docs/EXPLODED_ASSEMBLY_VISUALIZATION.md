# Exploded Assembly Visualization (Phase 96)

## 1. Overview

Phase 96 introduces an **automated exploded assembly visualization** subsystem into the 3D puzzle engine and interactive previewer. 

The system automatically calculates exploded spatial layouts and step-by-step physical assembly sequences derived directly from the **authoritative assembly graph** while strictly preserving:
- **Piece Identity**: Every piece retains its persistent CAD piece ID, geometry, and material properties.
- **Connection Relationships**: Mating interface pairs, connector types, and clearance parameters remain authoritatively mapped.
- **Assembly Order**: Pieces are topologically sequenced (1 to $N$) starting from the assembly foundation root piece.

---

## 2. Supported Visualization Modes

The viewer supports three synchronized visualization modes:

| View Mode | Description | Explosion Factor | Piece Visibility | Indicator Features |
| :--- | :--- | :--- | :--- | :--- |
| **Normal View** | Standard fully-assembled 3D puzzle. | $0.0$ | All pieces visible at assembled positions. | Standard mating interfaces. |
| **Exploded View** | Continuous exploded displacement along branch kinematic axes. | $0.0 \dots 1.0$ (via slider) | All pieces visible, displaced outward by $\Delta \vec{P} \cdot \alpha$. | Guide lines, piece numbers, directions, interface ports. |
| **Assembly-Step View** | Discrete step-by-step physical assembly progression ($1 \dots N$). | Step-based | Pieces $1 \dots k$ visible; piece $k$ highlighted along insertion vector. | Step descriptions, active incoming joint arrows, step counter. |

---

## 3. Algorithmic Architecture: Deterministic Branch Layout Solver

```
                    Authoritative Puzzle & Assembly Graph
                                      ↓
                     BFS Assembly Graph Traversal
              (Assigns 1-indexed Assembly Steps & Branch Depths)
                                      ↓
                 Branch Displacement & Vector Evaluation
            1. Root piece remains stationary at world origin
            2. Relative direction: interface normal + centroid vector
            3. Branch accumulation: ΔP_child = ΔP_parent + (baseDistance * u_child)
                                      ↓
                            ExplodedAssemblyResult
            ├── pieces (ExplodedPieceState[])
            ├── connections (ExplodedConnectionIndicator[])
            ├── steps (AssemblyStepState[])
            └── currentPieceTransforms (Record<ID, RigidTransform3D>)
                                      ↓
                 Viewer Controller & Three.js Viewport HUD
      (Mesh displacement, guide lines, trajectory arrows, numbered badges)
```

### Determinism Guarantee
The layout calculation is 100% deterministic:
- Given the same puzzle and connection graph, running the solver multiple times yields identical 3D explosion vectors and piece positions down to floating-point precision.
- Pieces never collide or cross over preceding parent pieces in their kinematic tree branch because child offsets accumulate relative to their immediate topological parent:
  $$\vec{\Delta}_{\text{child}} = \vec{\Delta}_{\text{parent}} + D_{\text{base}} \times \vec{u}_{\text{relative}}$$

---

## 4. Visual Indicators

The system generates 3D visual indicators that can be toggled interactively:
1. **Piece Numbers (`# Numbers`)**: 3D numbered circular badges positioned above each piece centroid, indicating assembly order ($1, 2, 3 \dots N$).
2. **Connection Indicators (`Lines`)**: Dashed cyan guide lines connecting mating interface origins across exploded gaps.
3. **Assembly Directions (`Directions`)**: 3D trajectory arrows showing the direction along which pieces slide or insert into place.
4. **Joining Interfaces (`Interfaces`)**: Spherical markers and coordinate frames identifying physical connection ports.

---

## 5. Strict CAD Immutability

The exploded assembly subsystem operates strictly on **rigid-body spatial transforms** (`RigidTransform3D`) and visualization scene objects:
- `piece.solid.localMesh` vertices, indices, and normals are **never modified**.
- Authoritative CAD boundaries and 2D profiles remain untouched.
