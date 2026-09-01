# Supported 2D Geometry Extraction Specification

This document specifies the supported 2D geometric primitives, topology reconstruction rules, dimension extraction patterns, and geometric validation checks implemented in the **Real 2D Geometry Extraction Layer**.

---

## 1. Architectural Mandate & Non-ML Invariant

> [!IMPORTANT]
> **DETERMINISTIC EXTRACTION ONLY (NO ML / LLM GUESSWORK)**:
> All geometric primitives, boundaries, holes, dimensions, and labels are extracted using exact analytical geometry algorithms.
> If a vector element fails geometric validation or cannot be resolved, the engine **does not guess missing geometry**. Instead, it emits an explicit diagnostic item in `ImportDiagnostics` with exact error coordinates and element IDs.

---

## 2. Supported Exact Geometric Primitives

| Primitive Kind | Interfaces / Struct | Properties & Analytical Representation |
| :--- | :--- | :--- |
| **Line** | `ExactLinePrimitive` | `start: Vec2`, `end: Vec2`, `length: number` (straight 2D segment) |
| **Arc** | `ExactArcPrimitive` | `center: Vec2`, `radius: number`, `startAngleRad: number`, `endAngleRad: number`, `counterClockwise: boolean` |
| **Circle** | `ExactCirclePrimitive` | `center: Vec2`, `radius: number` (360° closed circular path) |
| **Spline / Bezier** | `ExactSplinePrimitive` | `controlPoints: Vec2[]`, `degree: number`, `knots?: number[]` (Cubic/Quadratic Bezier & B-Spline) |
| **Outer Boundary** | `BoundaryLoop` | `isOuter: true`, `edgeSegments: EdgeSegment[]` (Contiguous closed outer loop) |
| **Holes** | `BoundaryLoop` | `isOuter: false`, `edgeSegments: EdgeSegment[]` (Internal cutout boundary loops) |
| **Dimensions** | `ExtractedDimension` | `type: "linear" \| "radial" \| "diameter"`, `valueMm: number`, `text: string` |
| **Labels** | `ExtractedLabel` | `text: string`, `position: Vec2`, `layerName?: string` |

---

## 3. Geometric Validation Rules (`GeometryValidator`)

| Validation Check | Code | Trigger Condition & Diagnostics | Severity |
| :--- | :--- | :--- | :--- |
| **Self-Intersections** | `GEOM_SELF_INTERSECTION` | Non-adjacent boundary edge segments cross or overlap in 2D space. | **Error** |
| **Open Boundaries** | `GEOM_OPEN_BOUNDARY_GAP` | Endpoints of outer boundary polyline fail to close ($\text{gap} > 0.001\text{mm}$). | **Error** |
| **Zero-Length Edges**| `GEOM_ZERO_LENGTH_EDGE` | Line segment length is degenerate ($\text{length} < 10^{-4}\text{mm}$). | **Error** |
| **Invalid Curves** | `GEOM_INVALID_CURVE_RADIUS` | Arc or circle has negative, zero, or `NaN` radius. | **Error** |
| **Duplicate Edges** | `GEOM_DUPLICATE_EDGE` | Two edge segments share identical start and end vertices. | Warning |
| **Disconnected Vertices**| `GEOM_DISCONNECTED_VERTEX` | A floating 2D vertex is connected to fewer than 2 edges. | Warning |

---

## 4. Programmatic API Usage

To extract exact 2D primitives and map into `CanonicalPiece` models:

```typescript
import { DrawingImporter, GeometryExtractor } from "@/core/puzzle/ingestion";

// 1. Import normalized vector drawing
const normalized = DrawingImporter.importDrawing({
  filename: "puzzle_piece.svg",
  content: svgTextContent,
});

// 2. Execute 2D Geometry Extractor
const result = GeometryExtractor.extract(normalized);

if (result.isValid) {
  console.log(`Extracted ${result.primitives.length} exact primitives.`);
  console.log("Canonical Pieces:", result.canonicalPieces);
} else {
  console.error("Geometric validation issues:", result.validationIssues);
}
```
