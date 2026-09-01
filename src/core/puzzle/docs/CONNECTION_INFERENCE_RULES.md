# Connection Inference Rules Specification

This document specifies the **Connection Inference Subsystem** for inferring candidate physical connections between explicit interface ports ($\text{Interface A} \leftrightarrow \text{Interface B}$) across 2D cardboard puzzle pieces.

---

## 1. Architectural Mandate & Invariants

> [!IMPORTANT]
> **PORT-TO-PORT MATCHING & ORIENTATION NEUTRALITY**:
> - **Port-to-Port**: Connections are inferred directly between explicit interface ports ($\text{Interface A} \leftrightarrow \text{Interface B}$), never between coarse directional bounding labels like "Piece A right ↔ Piece B left".
> - **Orientation Neutral**: A connection describes topological and geometric **mating compatibility**. It does **not** hardcode a fixed 3D world pose or 3D assembly position (final 3D transforms belong to `AssemblyConfiguration`).
> - **Strict Negative Rejection**:
>   - `TAB + TAB` $\rightarrow$ Rejected (`Incompatible gender roles: insert cannot mate with insert`).
>   - `Unrelated Flat Edges` $\rightarrow$ Rejected (`Unrelated flat edges do not auto-declare connection`).

---

## 2. Inferred Connection Candidate Fields (`ConnectionCandidate`)

```typescript
export interface ConnectionCandidate {
  candidateId: string;
  interfaceAId: string;          // First interface ID
  interfaceBId: string;          // Second interface ID
  pieceAId: string;               // Owning piece A ID
  pieceBId: string;               // Owning piece B ID
  compatible: boolean;           // Overall compatibility flag
  connectionType: InferredConnectionType; // "tab_slot" | "interlock" | "edge_contact" | "hinge_like" | "custom"
  profileCompatibility: {
    widthDeltaMm: number;        // Width variance (mm)
    depthDeltaMm: number;        // Depth variance (mm)
    fitQuality: "exact" | "tight" | "loose" | "incompatible";
  };
  matingGeometry: {
    contactCenter: Vec2;         // 2D contact midpoint (mm)
    contactNormal: Vec2;         // 2D mating normal vector
  };
  requiredClearanceMm: number;   // Mechanical clearance offset (mm)
  orientationConstraint: {
    allowedRotationAxis: Vec3;   // Allowed 3D rotation axis (e.g. [0, 0, 1])
    allowedAngleRange: {
      minAngleDeg: number;       // Min allowed 3D angle (e.g. 85.0deg)
      maxAngleDeg: number;       // Max allowed 3D angle (e.g. 95.0deg)
      targetAngleDeg: number;    // Nominal 3D joining angle (e.g. 90.0deg)
    };
  };
  confidence: number;            // Confidence score (0.0 to 1.0)
  reason: string;                // Detailed explanatory text
  warnings: string[];            // Warning logs
}
```

---

## 3. Decision Matrix & Matching Rules

| Rule | Condition | Decision | Explanation / Reason |
| :--- | :--- | :--- | :--- |
| **Gender Compatibility** | `insert` + `receiver` | **Compatible** | Complementary male/female port pair. |
| **Gender Mismatch** | `insert` + `insert` | **Rejected** | `TAB` + `TAB` cannot mate without female slot receiver. |
| **Profile Fit** | $\Delta \text{width} \le 1.5\text{mm}$, $\Delta \text{depth} \le 1.0\text{mm}$ | **Compatible** | Feature dimensions fit within mechanical tolerance. |
| **Profile Mismatch** | $\Delta \text{width} > 2.0\text{mm}$ | **Rejected** | Width difference exceeds maximum allowable tolerance. |
| **Flat Edge Filtering** | `flat_contact` + `flat_contact` | **Rejected** | Unrelated flat edges without mating slots or alignment tags do not auto-connect. |

---

## 4. Programmatic API Usage

To infer connection candidates across detected interface ports:

```typescript
import { ConnectionInferencer2D } from "@/core/puzzle/ingestion";

// 1. Map interfaces by owning piece ID
const interfacesByPiece = new Map<string, Detected2DInterface[]>([
  ["piece_1", [tabInterface]],
  ["piece_2", [slotInterface]],
]);

// 2. Infer candidate connections
const result = ConnectionInferencer2D.inferConnections(interfacesByPiece);

console.log(`Inferred ${result.compatibleCount} compatible connection(s) out of ${result.candidates.length} evaluated pair(s).`);
for (const cand of result.candidates) {
  if (cand.compatible) {
    console.log(`- Connection Candidate: ${cand.candidateId} (${cand.interfaceAId} ↔ ${cand.interfaceBId}), Type: ${cand.connectionType}, Target Angle: ${cand.orientationConstraint.allowedAngleRange.targetAngleDeg}°`);
  }
}
```
