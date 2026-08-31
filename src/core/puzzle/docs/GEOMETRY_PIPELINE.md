# Parametric 2D Geometry Pipeline Specification (Phase 9)

This document specifies the **Parametric 2D Geometry Generation Pipeline** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Architectural Principles

### Deterministic Generation
- The pipeline is **100% deterministic**. Identical input parameters produce 100% identical vertex coordinates, boundary topology, and polyline sampling hashes.
- Pure mathematical geometry generation: **No AI models** or non-deterministic randomized algorithms are involved.

### Clear Separation of Parameters and Generator
- **Parameters**: Decoupled input specifications (`width`, `height`, `thickness`, edge feature lists).
- **Geometry Generator**: Pure function `runParametricGeometryPipeline(input)` generating exact 2D boundary loops.

---

## 2. Supported Parameterized Edge Profiles (`FeatureProfileKind`)

- **`straight`**: Straight baseline reference edge.
- **`tab`**: Male tab profile extruding outward from piece contour (`width`, `depth`, `radius`).
- **`slot`**: Female slot profile recessed into piece edge (`width`, `depth`).
- **`notch`**: Corner notch cutout (`width`, `depth`).
- **`curve`**: Cubic/quadratic Bezier curve profile.
- **`arc`**: Circular arc profile (`radius`, `startAngleRad`, `endAngleRad`).
- **`custom`**: Polyline / spline nodes for custom profiles (`customPoints`).

---

## 3. Geometric Validation Engine (`validateGeneratedGeometry`)

The validator checks:
1. **Closed Boundary Topology**: Ensures first start vertex matches last end vertex along the outer boundary loop.
2. **Self-Intersection Detection**: Scans boundary segment pairs for illegal self-intersections.
3. **Invalid Physical Dimensions**: Rejects non-positive width (\(W \le 0\)) or height (\(H \le 0\)).
4. **Degenerate Edge Check**: Rejects zero-length edges (\(L < 1e-4\text{mm}\)).
5. **Minimum Feature Size**: Verifies all feature dimensions satisfy `minFeatureSize`.

---

## 4. Integration with Existing Geometry Engine

Integrates with `src/core/geometry/vec.ts` and `src/core/geometry/outline.ts` for vector arithmetic, rotation, and polyline sampling.
