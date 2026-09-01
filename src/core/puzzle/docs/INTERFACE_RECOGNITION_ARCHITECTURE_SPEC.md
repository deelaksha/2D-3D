# Interface Recognition Architecture Specification (Phase 45)

This document specifies the **Interface Recognition Architecture & Ground-Truth Evaluation Subsystem** for recognizing connection interfaces (tabs, slots, notches, interlocks, mating profiles, flat contacts, custom edge ports) from 2D CAD piece geometry or image inputs.

---

## 1. Architectural Mandate & Canonical Model Mapping

> [!IMPORTANT]
> **CANONICAL MODEL MAPPING & NO DIRECT 3D GEOMETRY**:
> - **Canonical Interface Model Mapping**: Every recognized interface candidate prediction maps directly to the authoritative `CanonicalInterface` model.
> - **Zero Direct 3D Geometry Generation**: Machine learning outputs emit structured interface candidate predictions (`InterfacePrediction`); **no direct 3D geometry or extruded mesh vertices are created from ML outputs**.
> - **Local 2D Frame Alignment**: Every interface candidate specifies a local coordinate frame (`origin`, `xAxis`, `yAxis`) and parametric profile dimensions (`widthMm`, `depthMm`, `positionMm`).

---

## 2. Candidate Interface Kinds & Prediction Schema

The system recognizes 7 candidate interface kinds:
1. `tab` (Male insertion port)
2. `slot` (Female receiving port)
3. `notch` (Corner relief notch)
4. `interlock` (Bi-directional interlocking joint)
5. `mating_profile` (Curved / mitered edge profile)
6. `flat_contact` (Neutral contact edge)
7. `custom` (Non-standard user port)

```typescript
export interface InterfacePrediction {
  predictionId: string;
  pieceId: string;
  kind: InterfaceCandidateKind;
  boundaryPoints: Vec2[];
  localFrame: LocalCoordinateFrame2D;
  parameters: InterfaceProfileParameters;
  confidenceScore: number; // 0.0 to 1.0
  source: "analytical_geometry" | "vision_ml_model" | "manual_review";
  canonicalInterface?: CanonicalInterface;
}
```

---

## 3. Evaluation Metrics (`InterfaceRecognitionEvaluator`)

Evaluates model predictions against ground truth using 4 metrics:

$$\text{Precision} = \frac{\text{TP}}{\text{TP} + \text{FP}}$$

$$\text{Recall} = \frac{\text{TP}}{\text{TP} + \text{FN}}$$

$$\text{F1-Score} = 2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$$

$$\text{Type Classification Accuracy} = \frac{\text{Correctly Classified Interface Kinds}}{\text{TP}}$$

---

## 4. Programmatic API Usage

```typescript
import { DeterministicGeometryInterfaceModel, InterfaceRecognitionEvaluator } from "@/core/puzzle/interfacerecognition";

// 1. Recognize interfaces using deterministic baseline model
const model = new DeterministicGeometryInterfaceModel();
const result = await model.recognizeInterfaces(canonicalPiece);

// 2. Evaluate against ground truth canonical interfaces
const report = InterfaceRecognitionEvaluator.evaluate(result, groundTruthInterfaces);

console.log(`F1-Score: ${(report.f1Score * 100).toFixed(1)}%, Type Accuracy: ${(report.typeAccuracy * 100).toFixed(1)}%`);
```
