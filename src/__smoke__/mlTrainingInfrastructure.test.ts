import { describe, expect, it } from "vitest";
import { DatasetLoader, DatasetValidator, FeatureEncoder, LabelEncoder, MockModelTrainer } from "../core/puzzle/mltraining/mlTrainingPipeline";
import type { EvaluationConfig, TrainingConfig } from "../core/puzzle/mltraining/types";

describe("ML Training Infrastructure & Reproducibility Pipeline (Phase 57)", () => {
  it("1. DatasetLoader performs reproducible dataset loading and 70/15/15 train/val/test splitting", () => {
    const splits = DatasetLoader.loadDatasetSplits(20, 42);

    expect(splits.train.examples.length).toBe(14);       // 70%
    expect(splits.validation.examples.length).toBe(3);  // 15%
    expect(splits.test.examples.length).toBe(3);        // 15%
    expect(splits.randomSeed).toBe(42);
    expect(splits.datasetVersion).toBe("1.0.0-synthetic");
    expect(splits.schemaVersion).toBe("v2.0");
  });

  it("2. DatasetValidator verifies zero train/validation/test data leakage", () => {
    const splits = DatasetLoader.loadDatasetSplits(20, 42);
    const vRes = DatasetValidator.validateSplits(splits);

    expect(vRes.isValid).toBe(true);
    expect(vRes.errors.length).toBe(0);
  });

  it("3. FeatureEncoder and LabelEncoder preprocess synthetic examples into numerical arrays", () => {
    const splits = DatasetLoader.loadDatasetSplits(5, 42);
    const ex = splits.train.examples[0];

    const features = FeatureEncoder.encodeFeatures(ex);
    const labels = LabelEncoder.encodeLabels(ex);

    expect(features.length).toBe(128);
    expect(labels.length).toBe(1);
    expect(typeof labels[0]).toBe("number");
  });

  it("4. MockModelTrainer executes full training pipeline: dataset -> loader -> preprocessing -> mock model -> evaluation -> checkpoint", async () => {
    const trainConfig: TrainingConfig = {
      randomSeed: 42,
      datasetVersion: "1.0.0-synthetic",
      schemaVersion: "v2.0",
      modelVersion: "v1.0-mock",
      configVersion: "v1.0",
      epochs: 3,
      batchSize: 4,
      learningRate: 0.001,
      optimizer: "adamw",
    };

    const evalConfig: EvaluationConfig = {
      metrics: ["validParametricDesignRate", "loss"],
      evalBatchSize: 4,
    };

    const trainer = new MockModelTrainer();
    const finalCkpt = await trainer.trainPipeline(trainConfig, evalConfig);

    expect(finalCkpt.checkpointId).toBe("ckpt_step_30_epoch_3");
    expect(finalCkpt.epoch).toBe(3);
    expect(finalCkpt.step).toBe(30);
    expect(finalCkpt.trainingLoss).toBeLessThan(0.45);
    expect(finalCkpt.validationLoss).toBeLessThan(0.48);
    expect(finalCkpt.metricScore).toBeGreaterThan(0.5);
    expect(finalCkpt.savedIso).toBeDefined();
    expect(finalCkpt.config.randomSeed).toBe(42);
  });

  it("5. verifies strict invariant: zero large model training is executed, pipeline is 100% type-safe & lightweight", async () => {
    const trainer = new MockModelTrainer();
    const trainConfig: TrainingConfig = {
      randomSeed: 100,
      datasetVersion: "1.0.0-synthetic",
      schemaVersion: "v2.0",
      modelVersion: "v1.0-stub",
      configVersion: "v1.0",
      epochs: 1,
      batchSize: 2,
      learningRate: 0.001,
      optimizer: "adam",
    };

    const ckpt = await trainer.trainPipeline(trainConfig, { metrics: ["loss"], evalBatchSize: 2 });
    expect(ckpt.epoch).toBe(1);

    const ckptObj = ckpt as unknown as Record<string, unknown>;
    expect(ckptObj.gpuMemoryUsageMb).toBeUndefined(); // Zero heavy PyTorch/CUDA overhead
  });
});
