# Automatic Connector Placement Engine (Phase 84)

## 1. Architectural Overview & Context

The **Automatic Connector Placement Engine** automatically calculates optimized physical positions for connectors along compatible piece interfaces.

### 1.1 Core Objectives
- Prevent structural failure caused by placing connectors too close to piece corners or thin geometry.
- Avoid cutout collisions and slot intersections on adjacent edges of the same piece.
- Balance holding force across the interface based on edge length and design difficulty.
- Support single, multiple, and asymmetric connector placements.
- Provide a detailed placement report with quality scores, manufacturability metrics, and explicit rejection logs.
- Strictly deterministic (no machine learning).

---

## 2. Physics & Geometric Factors Considered

```
                                  Shared Interface Edge [S, E]
 ┌───────────────┬───────────────────────────────────────────────────────────────┬───────────────┐
 │ Corner Margin │                     Allowable Span                            │ Corner Margin │
 │ m_corner >=   │   t_min                                                 t_max │ m_corner >=   │
 │ max(5mm, 1.5T)│   ├─────────────────[ Connector Location ]────────────────┤   │ max(5mm, 1.5T)│
 └───────────────┴───────────────────────────────────────────────────────────────┴───────────────┘
  Vertex S                                                                        Vertex E
```

### 2.1 Corner Proximity
Connectors placed too close to a piece corner leave thin wedges of material that easily fracture during cutting, sanding, or assembly.
$$m_{\text{corner}} = \max(5.0 \text{ mm}, 1.5 \times T_{\text{stock}})$$
No connector feature is allowed within $[0, m_{\text{corner}}]$ or $[L - m_{\text{corner}}, L]$ along any edge.

### 2.2 Minimum Feature Size & Thin Wall Prevention
- A minimum bridge width ($w_{\text{minBridge}} \ge 4.0$ mm) is strictly enforced between any internal slot cutout and adjacent edges.
- If two internal slots from perpendicular or adjacent edges converge within $w_{\text{minBridge}}$, the collision is flagged and rejected.

### 2.3 Structural Balance & Moment Distribution
- Centered placements achieve an optimal balance score ($1.0$).
- For long edges, multiple connectors are evenly distributed across the allowable span with minimum inter-connector gaps ($g \ge 8.0$ mm).

### 2.4 Asymmetric Placement (Anti-Inversion)
- To prevent 180° rotation assembly errors in symmetric-looking pieces, the engine supports asymmetric placement (e.g. $t_1 = 0.28, t_2 = 0.74$ or off-center $t = 0.42$).

---

## 3. Placement Modes

| Mode | Trigger Conditions | Parametric Offsets ($t$) | Structural Purpose |
|---|---|---|---|
| **`single`** | Default / Short edge ($L < 75$ mm) | $t = 0.50$ | Balanced centered holding force |
| **`multiple` (2)** | Long edge ($L \ge 75$ mm) | $t = [0.32, 0.68]$ | Prevents rotational rocking on wide pieces |
| **`multiple` (3)** | Extra-long edge ($L \ge 120$ mm, expert) | $t = [0.25, 0.50, 0.75]$ | High structural rigidity on large panels |
| **`asymmetric`** | Forced asymmetric / Hard mode ($L \ge 60$ mm) | $t = [0.28, 0.74]$ | Enforces 1-way keyed assembly |

---

## 4. Placement Report & Quality Metrics

Every execution produces a comprehensive `PlacementReport`:
- **`structuralBalanceScore`** (0.0 to 1.0): Evaluates symmetry and moment arm distribution.
- **`manufacturabilityScore`** (0.0 to 1.0): Measures margin ratios and minimum feature clearances.
- **`assemblyAccessibilityScore`** (0.0 to 1.0): Evaluates unobstructed insertion clearance.
- **`overallQualityScore`**: Weighted combination ($0.4 \times \text{Balance} + 0.4 \times \text{Mfg} + 0.2 \times \text{Access}$).
- **`rejections`**: Explicit list of rejected locations with defect codes (`REJECTED_EDGE_TOO_SHORT`, `REJECTED_CORNER_TOO_CLOSE`, `REJECTED_SLOT_INTERSECTION`).

---

## 5. Usage Example

```typescript
import { ConnectorPlacementEngine } from "@/core/puzzle/connectorplacement";

const result = ConnectorPlacementEngine.optimizePlacements({
  pieces: [pieceA, pieceB],
  edges: [
    {
      id: "shared_edge_1",
      pieceAId: "piece_A",
      pieceBId: "piece_B",
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      lengthMm: 100.0,
      normal: { x: 0, y: 1 },
      tangent: { x: 1, y: 0 },
      preferredPlacementMode: "auto",
    },
  ],
  materialConstraints: {
    stockThicknessMm: 3.0,
    minCornerMarginMm: 5.0,
    minBridgeWidthMm: 4.0,
  },
  difficulty: "medium",
});

if (result.success) {
  console.log(`Placed ${result.allPlacedConnectors.length} connectors.`);
  console.log("Quality Score:", result.report.qualityMetrics.overallQualityScore);
  console.log("Connectors:", result.allPlacedConnectors);
}
```
