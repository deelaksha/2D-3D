# ML Training Infrastructure Specification (Phase 57)

This document specifies the **ML Training Infrastructure & Pipeline Harness** for dataset loading, data validation, leakage prevention, feature encoding, model training, evaluation, and checkpoint management.

---

## 1. Architectural Mandate & Reproducibility Invariant

> [!IMPORTANT]
> **REPRODUCIBILITY & ZERO DATA LEAKAGE**:
> - **Full Version & Seed Tracking**: Every training run records `randomSeed`, `datasetVersion`, `schemaVersion`, `modelVersion`, and `configVersion`.
> - **Zero Data Leakage Invariant**: `DatasetValidator` verifies that train (70%), validation (15%), and test (15%) splits contain zero overlapping sample IDs.
> - **Pipeline Integrity**: Successfully executes `dataset -> loader -> preprocessing -> mock model -> evaluation -> checkpoint` without requiring a real large GPU model.
> - **Zero Heavy Training**: Zero large ML model training runs are initiated in this phase.

---

## 2. Training Launch Protocol for Future Production ML

When launching real model training in future phases:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION ML TRAINING LAUNCH PROTOCOL                          │
└────────────────────────────────────────────────────────────────────────────────────────┘

  1. Export Data Pipeline    • Run `SyntheticPuzzleGenerator.generateDatasetBatch()` to produce
                                10,000+ synthetic canonical puzzle examples.
                             • Export to JSONL / TFRecord format.

  2. Preprocessing & Splits  • Load dataset via `DatasetLoader.loadDatasetSplits(10000, seed=42)`.
                             • Verify zero leakage via `DatasetValidator.validateSplits()`.

  3. Model Instantiation     • Replace `MockModelTrainer` with PyTorch / JAX GNN trainer.
                             • Train Graph Neural Network (GCN/GraphSAGE) for connection prediction.

  4. Checkpointing           • Save model checkpoints with `CheckpointManager.saveCheckpoint()`.
                             • Evaluate checkpoint via `AIEvaluationHarness`.
```

---

## 3. Programmatic API Usage

```typescript
import { MockModelTrainer } from "@/core/puzzle/mltraining";

const trainer = new MockModelTrainer();
const finalCkpt = await trainer.trainPipeline(
  {
    randomSeed: 42,
    datasetVersion: "1.0.0-synthetic",
    schemaVersion: "v2.0",
    modelVersion: "v1.0-gnn",
    configVersion: "v1.0",
    epochs: 5,
    batchSize: 16,
    learningRate: 0.001,
    optimizer: "adamw",
  },
  { metrics: ["validParametricDesignRate", "loss"], evalBatchSize: 16 }
);

console.log(`Saved Checkpoint: ${finalCkpt.checkpointId} at Step ${finalCkpt.step}`);
console.log(`Final Validation Loss: ${finalCkpt.validationLoss.toFixed(4)}`);
```
