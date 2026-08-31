# 2D Parametric Piece Representation Specification (Phase 3)

This document specifies the **2D Parametric Piece Representation** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Architectural Principles

The 2D parametric representation models cardboard puzzle components using exact mathematical geometry and parameters rather than raster images or pre-baked meshes.

### Strict Separation of Concerns
1. **Topology**: Vertices (`Vertex2D`), boundary loops (`BoundaryLoop`: outer boundary vs inner hole loops), edge segment connectivity.
2. **Geometry**: Exact curve primitives (`LineSegmentGeometry`, `ArcSegmentGeometry`, `BezierSegmentGeometry`), hole shapes, and discrete polyline sampling.
3. **Parameters**: Named parameters (`tab_width`, `tab_depth`, `tab_radius`, `edge_position`, `width`, `height`), parameter formulas, and bounds.

---

## 2. Data Structure Hierarchy (`ParametricPiece2D`)

```
ParametricPiece2D
 ├── id: string
 ├── name: string
 ├── width: number
 ├── height: number
 ├── thickness: number (material stock thickness in mm)
 ├── materialId: string
 ├── localFrame: ParametricLocalFrame3D ({ origin, xAxis, yAxis })
 ├── manufacturing: ManufacturingTolerances ({ kerf, cutterRadius, slotClearance })
 ├── parameters: Record<string, ParametricDefinition>
 ├── topology: PieceTopology
 │    ├── vertices: Record<string, Vertex2D>
 │    ├── outerBoundary: BoundaryLoop
 │    └── holes: BoundaryLoop[]
 └── sampledOutlines: Vec2[][] (cached sampled polylines)
```

---

## 3. Exact Geometric Segment Primitives (`SegmentGeometry`)

- **LineSegment**: Straight line segment connecting `startVertexId` and `endVertexId`.
- **ArcSegment**: Circular arc defined by `{ center, radius, startAngleRad, endAngleRad, counterClockwise }`.
- **BezierSegment**: Cubic/quadratic Bezier curve defined by control points `{ controlPoints: Vec2[] }`.

---

## 4. Parameter Evaluation & Dynamic Geometry Regeneration

Piece geometry is **dynamically regeneratable** from its parameters.

When parameters such as:
- `tab_width`
- `tab_depth`
- `tab_radius`
- `edge_position`

are modified, the regeneration engine (`regenerateParametricPieceGeometry`) re-evaluates parameter values and expressions, updates outer boundary topology, recalculates vertex coordinates, regenerates tab/slot curve geometries, and updates discrete polyline outlines.

---

## 5. Validation & Serialization

- **Validation (`validateParametricPiece2D`)**: Checks topological closedness, valid vertex ID references, positive physical dimensions (`width > 0`, `height > 0`, `thickness > 0`), and parameter min/max bounds.
- **Serialization (`serializeParametricPiece2D` / `deserializeParametricPiece2D`)**: Supports lossless JSON serialization and deserialization with automatic parameter re-evaluation.
