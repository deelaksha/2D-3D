# AI Evaluation Framework Specification (Phase 56)

This document specifies the **Comprehensive AI System Evaluation Framework & Benchmark Harness** for evaluating the AI pipeline separately across 9 distinct stages.

---

## 1. Primary End Metric Invariant

> [!IMPORTANT]
> **PRIMARY END METRIC: VALID PARAMETRIC DESIGN RATE**:
> $$\text{ValidParametricDesignRate} = \frac{\text{Number of Physically Valid Assemblable Designs}}{\text{Total Evaluated Designs}}$$
> - **A visually impressive design that cannot physically assemble is evaluated as a failure**.
> - **9 Pipeline Stage Evaluators**: Evaluates Requirement Parsing, Piece Recognition, Interface Recognition, Connection Prediction, Parameter Prediction, Design Planning, Design Generation, Repair, and Final Validity.
> - **Synthetic Benchmark Harness**: Uses `SyntheticPuzzleGenerator` (seeded Mulberry32 PRNG) for deterministic, reproducible evaluation.
> - **Zero Model Training**: Implements the evaluation harness, stage evaluators, and benchmark reports; zero model training is performed.

---

## 2. All 9 Evaluated Pipeline Stages

| Stage # | Stage Name | Metric Computed | Evaluation Provider |
| :--- | :--- | :--- | :--- |
| **1** | **Requirement Parsing** | Accuracy (0.0 to 1.0) | `RequirementParser` |
| **2** | **Piece Recognition** | Precision, Recall, IoU (0.0 to 1.0) | `PieceSegmentationEvaluator` |
| **3** | **Interface Recognition** | Accuracy (0.0 to 1.0) | `InterfaceRecognitionEvaluator` |
| **4** | **Connection Prediction** | F1-Score (0.0 to 1.0) | `ConnectionEvaluator` |
| **5** | **Parameter Prediction** | MAE (Mean Absolute Error in mm) | `ParameterEvaluator` |
| **6** | **Design Planning** | Plan Completeness (0.0 to 1.0) | `MockDesignPlanner` |
| **7** | **Design Generation** | Candidate Generation Success Rate | `DeterministicCandidateGenerator` |
| **8** | **Repair** | Automated Repair Convergence Rate | `AIRepairLoopEngine` |
| **9** | **Final Validity** | **Valid Parametric Design Rate** | `AIDesignValidationGate` |

---

## 3. Programmatic API Usage

```typescript
import { AIEvaluationHarness } from "@/core/puzzle/aievaluation";

// 1. Run evaluation harness over 10 synthetic benchmark examples (seed = 42)
const result = await AIEvaluationHarness.evaluatePipeline(10, 42);

console.log(`Evaluation Dataset: ${result.datasetName}`);
console.log(`Valid Parametric Design Rate (PRIMARY): ${(result.validParametricDesignRate * 100).toFixed(1)}%`);
console.log(`Weakest Subsystem Identified: ${result.weakestSubsystem}`);
```
