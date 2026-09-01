# Connection Prediction Architecture Specification (Phase 46)

This document specifies the **Connection Prediction Subsystem & Evaluation Engine** for predicting physical compatibility, joint types, allowed rotation angles, rotation axes, and translation constraints between interface pairs $(\text{Interface A} \leftrightarrow \text{Interface B})$.

---

## 1. Architectural Mandate & Assembly Transform Invariant

> [!IMPORTANT]
> **NO CUSTOMER ASSEMBLY TRANSFORM HALLUCINATION**:
> - **Joint Compatibility & Degrees of Freedom Only**: The connection prediction model outputs joint physical compatibility (`compatible: boolean`), joint type, allowed joining angle ranges ($\theta \in [0^\circ, 180^\circ]$), rotation axes, and translation constraints.
> - **Zero Assembly World Orientation Hallucination**: The model does **NOT** assign final customer 3D world assembly orientations. Final geometric positioning remains 100% the responsibility of the deterministic `AssemblyTransformationSystem`.
> - **Replaceable Model Interface**: Defines `ConnectionPredictionModel` interface allowing seamless swapping between the deterministic rule engine (`DeterministicRuleBasedConnectionModel`) and Graph Neural Network ML models (`MockGNNConnectionPredictionModel`).

---

## 2. Connection Prediction Schema (`ConnectionPrediction`)

```typescript
export interface ConnectionPrediction {
  predictionId: string;
  sourcePieceId: string;
  sourceInterfaceId: string;
  targetPieceId: string;
  targetInterfaceId: string;
  compatible: boolean;
  connectionType: "tab_slot" | "finger_joint" | "interlock" | "flat_contact" | "none";
  confidenceScore: number; // 0.0 to 1.0
  possibleRelativeOrientation: { rxDeg: number; ryDeg: number; rzDeg: number };
  allowedAngleRange: { minAngleDeg: number; maxAngleDeg: number; targetAngleDeg: number };
  rotationAxis: { x: number; y: number; z: number };
  translationConstraints: { freeX: boolean; freeY: boolean; freeZ: boolean };
  source: "rule_based_engine" | "gnn_ml_model" | "manual_review";
  canonicalConnection?: CanonicalConnection;
}
```

---

## 3. Evaluation Metrics (`ConnectionEvaluator`)

Evaluates model predictions against ground truth canonical connections across 5 metrics:

$$\text{Precision} = \frac{\text{TP}}{\text{TP} + \text{FP}}$$

$$\text{Recall} = \frac{\text{TP}}{\text{TP} + \text{FN}}$$

$$\text{F1-Score} = 2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$

$$\text{False Positive Rate (FPR)} = \frac{\text{FP}}{\text{FP} + \text{TN}}$$

$$\text{False Negative Rate (FNR)} = \frac{\text{FN}}{\text{FN} + \text{TP}}$$

---

## 4. Programmatic API Usage

```typescript
import { DeterministicRuleBasedConnectionModel, ConnectionEvaluator } from "@/core/puzzle/connectionprediction";

// 1. Predict connections using baseline rule model
const model = new DeterministicRuleBasedConnectionModel();
const result = await model.predictConnections(pieces, interfaces);

// 2. Evaluate against ground truth canonical connections
const report = ConnectionEvaluator.evaluate(result, groundTruthConnections);

console.log(`Precision: ${(report.precision * 100).toFixed(1)}%, Recall: ${(report.recall * 100).toFixed(1)}%`);
console.log(`F1-Score: ${(report.f1Score * 100).toFixed(1)}%, FPR: ${(report.falsePositiveRate * 100).toFixed(1)}%, FNR: ${(report.falseNegativeRate * 100).toFixed(1)}%`);
```
