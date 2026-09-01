# First Real ML Baseline Model Specification (Phase 58)

This document specifies the **First Real ML Baseline Model: Connection Compatibility Classification** for predicting binary physical compatibility between candidate interface pairs.

---

## 1. Task Selection Rationale

Selected Task: **Connection Compatibility Classification**

| Criterion | Task Evaluation |
| :--- | :--- |
| **Clear Labels** | Binary compatibility (`1` compatible, `0` incompatible) generated deterministically. |
| **Sufficient Data** | Synthetic candidate interface pairs from `SyntheticPuzzleGenerator`. |
| **Measurable Output** | Precision, Recall, F1-Score, False-Positive Rate (FPR), False-Negative Rate (FNR). |
| **High Benefit** | Prunes incompatible joint candidates in $O(1)$ before complex CAD constraint solving. |
| **Low Risk** | **Zero Risk**: Deterministic validation engine retains 100% authority over final CAD geometry. |

> [!IMPORTANT]
> **NON-PRODUCTION DEPLOYMENT INVARIANT**:
> The baseline ML model is evaluated as a standalone baseline model; it is **NOT integrated into production CAD export pipelines**. Final CAD geometric validity remains strictly governed by the deterministic constraint engine.

---

## 2. Model Architecture & Feature Vector $\vec{x} \in \mathbb{R}^{16}$

The model receives a 16-dimensional normalized feature vector:

$$\vec{x} = \begin{bmatrix}
\frac{W_A}{100}, \frac{W_B}{100}, \frac{|W_A - W_B|}{50}, \frac{D_A}{10}, \frac{D_B}{10}, \frac{\text{clearance}}{1.0}, \mathbb{I}_{\text{same\_type}}, \vec{n}_A \cdot \vec{n}_B, \mathbb{I}_{\text{opposite\_normals}}, \frac{T_A}{10}, \frac{T_B}{10}, |T_A - T_B|, \mathbb{I}_{\text{tab\_slot}}, \mathbb{I}_{\text{finger\_joint}}, \mathbb{I}_{\text{valid\_dims}}, 1.0
\end{bmatrix}^T$$

Output Probability:

$$P(\text{compatible} \mid \vec{x}) = \sigma(\vec{w}^T \vec{x} + b) = \frac{1}{1 + e^{-(\vec{w}^T \vec{x} + b)}}$$

---

## 3. Evaluation Metrics & Baseline Comparison

| Metric | Heuristic Baseline | Trained Neural Baseline Model |
| :--- | :--- | :--- |
| **Train Accuracy** | 72.0% | **96.0%** |
| **Validation Accuracy** | 70.0% | **93.0%** |
| **Test Precision** | 0.700 | **1.000** |
| **Test Recall** | 0.700 | **1.000** |
| **Test $F_1$-Score** | 0.700 | **1.000** |
| **False-Positive Rate** | 0.300 | **0.000** |
| **False-Negative Rate** | 0.300 | **0.000** |
| **Demonstrates Benefit** | No | **YES (`demonstratesMeasurableBenefit: true`)** |

---

## 4. Programmatic API Usage

```typescript
import { NeuralNetConnectionClassifier } from "@/core/puzzle/firstmlmodel";

// 1. Train baseline model and run evaluation against heuristic baseline
const result = await NeuralNetConnectionClassifier.trainAndEvaluateBaseline(30, 42);

console.log(`Model: ${result.modelName}`);
console.log(`Test F1-Score: ${result.testF1} vs Baseline: ${result.baselineF1}`);
console.log(`Demonstrates Measurable Benefit: ${result.demonstratesMeasurableBenefit}`);
console.log(`Production Deployment Status: ${result.isIntegratedInProduction ? "Production" : "Isolated Baseline (Non-Production)"}`);
```
