# Specification: Raw Geometry vs. Parametric Representation

This document specifies the conceptual distinction between **Raw 2D Geometry** and **Parametric Representation** in the Parametric 2D-to-3D Cardboard Puzzle Platform.

---

## 1. Conceptual Distinction

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          RAW GEOMETRY vs. PARAMETRIC REPRESENTATION                     │
└────────────────────────────────────────────────────────────────────────────────────────┘

  RAW GEOMETRY (Point Arrays / Explicit Polyline Paths)
  ──────────────────────────────────────────────────────
  - Discrete coordinate arrays: [{x:0, y:0}, {x:30, y:0}, {x:30, y:-10}, {x:50, y:-10}, ...]
  - Purpose: Exact rendering, CAM laser cutting, SVG/DXF exports.
  - Limitation: Static coordinate values cannot easily be re-constrained, scaled, or edited dynamically.

                                      │
                                      │ FeatureExtractor (Analytical Fitting)
                                      ▼

  PARAMETRIC REPRESENTATION (High-Level Semantic Parameters)
  ──────────────────────────────────────────────────────────
  - Named parameter definitions:
    • tab_width = 20.0mm   (unit: mm, confidence: 0.95, method: analytical_fitting)
    • tab_depth = 3.0mm    (unit: mm, confidence: 0.95, method: analytical_fitting)
    • tab_position = 40.0mm (unit: mm, confidence: 0.95, method: analytical_fitting)
    • tab_radius = 1.5mm   (unit: mm, confidence: 0.85, method: analytical_fitting)
  - Purpose: Dynamic parametric resizing, mechanical constraint solving, AI model reasoning, optimization.
```

---

## 2. Parameter Provenance Schema (`ParametricFeature`)

Every parameter extracted by `FeatureExtractor` records complete provenance:

```typescript
export interface ParametricFeature {
  id: string;
  name: string;                    // e.g. "tab_width", "slot_depth", "width", "height", "thickness"
  value: number;                   // Analytical value (e.g. 20.0)
  unit: "mm" | "deg" | "ratio";    // Unit of measurement
  sourceGeometry: string;         // Source primitive or interface port ID
  confidence: number;             // Confidence score (0.0 to 1.0)
  extractionMethod:               // Extraction algorithm used
    | "analytical_fitting"
    | "contour_bounding_box"
    | "hole_circle_fit"
    | "dimension_annotation"
    | "raw_geometry_fallback";
  minValue?: number;              // Parametric range min bound
  maxValue?: number;              // Parametric range max bound
  category: "footprint" | "tab" | "slot" | "notch" | "hole" | "custom";
}
```

---

## 3. Strict Non-Forced Fitting Rule (Raw Geometry Fallback)

> [!IMPORTANT]
> **NO FORCED TEMPLATE FITTING**:
> Parameters are extracted **only** when geometry can be analytically and reliably fitted (e.g. standard rectangular tabs, slots, circular holes, bounding footprints).
> If a boundary feature is custom, irregular, or complex:
> 1. The engine **does not force arbitrary parameters** to fit a predefined template.
> 2. It preserves the exact original vector boundary in `preservedRawGeometries`.
> 3. It logs a diagnostic event (`RAW_GEOMETRY_PRESERVED`) to ensure zero geometric distortion.

---

## 4. Programmatic API Usage

To extract parametric features for a segmented 2D piece:

```typescript
import { FeatureExtractor, InterfaceDetector2D, PieceSegmenter } from "@/core/puzzle/ingestion";

// 1. Detect interfaces for piece
const ifaceResult = InterfaceDetector2D.detectForPiece(segPiece);

// 2. Extract parametric features
const featureResult = FeatureExtractor.extractFeatures(segPiece, ifaceResult.interfaces);

console.log(`Extracted ${featureResult.parameters.length} parameter(s) and preserved ${featureResult.preservedRawGeometries.length} raw geometry element(s).`);
for (const p of featureResult.parameters) {
  console.log(`- ${p.name}: ${p.value}${p.unit} (confidence: ${p.confidence.toFixed(2)}, method: ${p.extractionMethod})`);
}
```
