# Parametric Feature Prediction Architecture Specification (Phase 47)

This document specifies the **Parametric Feature Prediction Subsystem & Evaluation Engine** for predicting parametric CAD dimensions (`tab_width`, `tab_depth`, `tab_position`, `slot_width`, `slot_depth`, `slot_position`, `radius`, `edge_offset`, `clearance`, `thickness`) from observed 2D geometry regions or drawing inputs.

---

## 1. Architectural Mandate & Validation Gate Invariant

> [!IMPORTANT]
> **SEPARATION OF GEOMETRY VS PARAMETERS & DETERMINISTIC VALIDATION**:
> - **Separation of Observed Geometry vs Predicted Parameters**: Every prediction pairs an explicit `ObservedGeometryRegion` (boundary points, region ID, description) with a structured `ParameterPrediction` (`parameterName`, `value`, `unit`, `confidenceScore`, `source`).
> - **Deterministic Geometry Validation Gate**: ML models are **never allowed to directly modify geometry**. All predicted parameters must pass through deterministic validation rules (`DeterministicParameterValidator`):
>   - `value > 0.0`
>   - `tab_width < piece_width`
>   - `thickness >= 0.5mm`
> - **Zero Model Training**: Implements the inference architecture, baseline provider, validation gate, and evaluation metrics engine; zero model training is performed in this phase.

---

## 2. Prediction Schema (`ParameterPrediction`)

```typescript
export interface ObservedGeometryRegion {
  regionId: string;
  pieceId: string;
  boundaryPoints: Vec2[];
  description: string;
}

export interface ParameterPrediction {
  predictionId: string;
  pieceId: string;
  parameterName: ParameterPredictionName;
  value: number;
  unit: "mm" | "deg" | "ratio";
  confidenceScore: number; // 0.0 to 1.0
  source: "analytical_fitting" | "ml_regression_model" | "manual_review";
  observedRegion: ObservedGeometryRegion;
  isValidParam: boolean;
  validationError?: string;
}
```

---

## 3. Evaluation Metrics (`ParameterEvaluator`)

Evaluates model predictions against ground truth across 3 metrics:

$$\text{Mean Absolute Error (MAE)} = \frac{1}{N} \sum_{i=1}^N |y_i - \hat{y}_i| \quad (\text{in mm})$$

$$\text{Root Mean Square Error (RMSE)} = \sqrt{\frac{1}{N} \sum_{i=1}^N (y_i - \hat{y}_i)^2} \quad (\text{in mm})$$

$$\text{Within-Tolerance Rate} = \frac{\text{Predictions with } |y_i - \hat{y}_i| \le 0.5\text{mm}}{N}$$

---

## 4. Programmatic API Usage

```typescript
import { DeterministicAnalyticalParameterModel, ParameterEvaluator } from "@/core/puzzle/parameterprediction";

// 1. Predict parameters using analytical baseline model
const model = new DeterministicAnalyticalParameterModel();
const result = await model.predictParameters(canonicalPiece);

// 2. Evaluate against ground truth parametric dimensions
const groundTruth = { tab_width: 20.0, tab_depth: 10.0, slot_width: 20.0, thickness: 3.0 };
const report = ParameterEvaluator.evaluate(result, groundTruth, 0.5);

console.log(`MAE: ${report.meanAbsoluteError.toFixed(3)}mm, RMSE: ${report.rootMeanSquareError.toFixed(3)}mm`);
console.log(`Within-Tolerance Success Rate: ${(report.withinToleranceRate * 100).toFixed(1)}%`);
```
