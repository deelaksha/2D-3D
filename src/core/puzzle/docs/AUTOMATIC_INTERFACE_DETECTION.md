# Automatic 2D Geometry Interface Detection Specification

This document specifies the **Automatic 2D Geometry Interface Detection Subsystem** for identifying mechanical connection ports (tabs, slots, notches, finger interlocks, mating profiles, special connection edges, and flat contact edges) directly from 2D boundary polyline geometry and hole loops.

---

## 1. Architectural Mandate & Invariants

> [!IMPORTANT]
> **NO DIRECTIONAL ASSUMPTIONS OR 3D ANGLE DETERMINATION**:
> - Interfaces are identified purely from 2D geometry (protrusions, recessions, notches, hole loops, and edge profiles).
> - **NOT Directional**: Interfaces are **NOT** designated as "top", "bottom", "left", or "right".
> - **NO 3D Assembly Angle**: The final 3D mating assembly angle is **not** determined at this stage.
> - **Uncertainty Flagging**: If a feature cannot be confidently classified ($\text{confidence} < 0.6$), the engine marks `uncertain: true` and logs an explicit `diagnosticReason` rather than inventing an interface.

---

## 2. Detected Interface Feature Kinds

| Feature Kind | Gender Role | Canonical Interface Type | Description & Geometry Metrics |
| :--- | :--- | :--- | :--- |
| **Tab** | `insert` | `"tab"` | Male rectangular protrusion along outer boundary ($w \in [5, 50]\text{mm}, d \approx T$). |
| **Slot** | `receiver` | `"slot"` | Female cutout recession along edge or interior hole loop ($w \in [5, 50]\text{mm}, d \approx T$). |
| **Notch** | `receiver` | `"miter"` | Corner V-notch or edge notch cutout. |
| **Interlock** | `neutral` | `"finger"` | Repeated finger-joint interlock teeth. |
| **Mating Profile** | `custom` | `"custom"` | Curved or matching contour edge profile. |
| **Special Edge** | `custom` | `"custom"` | Custom slot, peg, or hinge knuckle interface. |
| **Flat Contact** | `neutral` | `"butt"` | Straight edge segment ($L \ge 15\text{mm}$) for planar contact mating. |

---

## 3. Data Model Structure (`Detected2DInterface`)

```typescript
export interface Detected2DInterface {
  id: string;
  owningPieceId: string;
  name: string;
  featureKind: DetectedFeatureKind;
  canonicalType: CanonicalInterfaceType;
  local2DFrame: {
    origin: Vec2;   // Feature center point (mm)
    normal: Vec2;   // Unit normal vector pointing outward
    tangent: Vec2;  // Unit tangent vector along edge
  };
  edgeGeometry: {
    edgeIndex: number;
    parametricStart: number;
    parametricEnd: number;
    length: number;
  };
  profile: {
    kind: string;
    width: number;    // Feature width (mm)
    depth: number;    // Feature depth (mm)
    height: number;   // Stock material thickness (mm)
    clearance: number;// Mating clearance offset (mm)
  };
  genderRole: InterfaceGenderRole;
  toleranceMm: number;
  clearanceMm: number;
  confidence: number; // 0.0 to 1.0
  uncertain: boolean; // true if confidence < 0.6
  diagnosticReason?: string;
}
```

---

## 4. Programmatic API Usage

To detect interfaces for a 2D piece:

```typescript
import { DrawingImporter, InterfaceDetector2D, PieceSegmenter } from "@/core/puzzle/ingestion";

// 1. Import drawing and segment pieces
const normalized = DrawingImporter.importDrawing({
  filename: "tab_piece.svg",
  content: svgTextContent,
});
const segPiece = normalized.segmentedPieces[0];

// 2. Execute 2D Interface Detector
const result = InterfaceDetector2D.detectForPiece(segPiece);

console.log(`Detected ${result.interfaces.length} interface(s) (${result.uncertainCount} uncertain).`);
for (const iface of result.interfaces) {
  console.log(`- Interface ID: ${iface.id}, Kind: ${iface.featureKind}, Confidence: ${iface.confidence.toFixed(2)}`);
}
```
