/**
 * ML Training Infrastructure & Pipeline Components (Phase 57).
 * Executes complete training pipeline: dataset -> loader -> preprocessing -> mock model -> evaluation -> checkpoint.
 */
import type { CheckpointMetadata, DatasetSplits, EvaluationConfig, TrainingConfig } from "./types";
import type { SyntheticGeneratedExample, SyntheticGenerationConfig } from "../generator/types";
import { SyntheticPuzzleGenerator } from "../generator/syntheticGenerator";

export class DatasetValidator {
  /**
   * Validates dataset schema and verifies zero train/validation/test data leakage.
   */
  static validateSplits(splits: DatasetSplits): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const trainIds = new Set(splits.train.examples.map((e) => e.canonicalPuzzle.metadata.id));
    const valIds = new Set(splits.validation.examples.map((e) => e.canonicalPuzzle.metadata.id));
    const testIds = new Set(splits.test.examples.map((e) => e.canonicalPuzzle.metadata.id));

    // Check train vs validation leakage
    trainIds.forEach((id) => {
      if (valIds.has(id)) {
        errors.push(`DATA LEAKAGE DETECTED: Sample ${id} exists in both train and validation splits.`);
      }
      if (testIds.has(id)) {
        errors.push(`DATA LEAKAGE DETECTED: Sample ${id} exists in both train and test splits.`);
      }
    });

    // Check validation vs test leakage
    valIds.forEach((id) => {
      if (testIds.has(id)) {
        errors.push(`DATA LEAKAGE DETECTED: Sample ${id} exists in both validation and test splits.`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export class DatasetLoader {
  /**
   * Loads dataset and performs reproducible 70/15/15 train/val/test splitting with seed control.
   */
  static loadDatasetSplits(
    exampleCount: number = 20,
    seed: number = 42
  ): DatasetSplits {
    const examples: SyntheticGeneratedExample[] = [];
    for (let i = 0; i < exampleCount; i++) {
      const cfg: SyntheticGenerationConfig = {
        seed: seed + i,
        pieceCountRange: [3, 5],
        thicknessMmRange: [3.0, 3.0],
        dimensionMmRange: [60, 100],
        tabWidthMmRange: [15, 20],
        slotWidthMmRange: [15, 20],
        clearanceMmRange: [0.1, 0.2],
        connectionTypes: ["tab_slot"],
        joiningAnglesDeg: [90],
        symmetryMode: "none",
        layers: 1,
        targetValidity: i % 5 === 4 ? "invalid" : "valid",
      };
      const ex = SyntheticPuzzleGenerator.generateExample(cfg);
      examples.push(ex);
    }

    const trainCount = Math.floor(exampleCount * 0.7);
    const valCount = Math.floor(exampleCount * 0.15);

    const trainExamples = examples.slice(0, trainCount);
    const valExamples = examples.slice(trainCount, trainCount + valCount);
    const testExamples = examples.slice(trainCount + valCount);

    const splits: DatasetSplits = {
      train: { examples: trainExamples, splitName: "train" },
      validation: { examples: valExamples, splitName: "validation" },
      test: { examples: testExamples, splitName: "test" },
      randomSeed: seed,
      datasetVersion: "1.0.0-synthetic",
      schemaVersion: "v2.0",
    };

    const vRes = DatasetValidator.validateSplits(splits);
    if (!vRes.isValid) {
      throw new Error(`Dataset split validation failed: ${vRes.errors.join(" | ")}`);
    }

    return splits;
  }
}

export class FeatureEncoder {
  static encodeFeatures(example: SyntheticGeneratedExample): number[] {
    const features: number[] = new Array(128).fill(0.0);
    features[0] = example.canonicalPuzzle.pieces.length / 20.0;
    features[1] = example.canonicalPuzzle.connections.length / 30.0;
    return features;
  }
}

export class LabelEncoder {
  static encodeLabels(example: SyntheticGeneratedExample): number[] {
    return [example.validationResult.status === "PASS" ? 1.0 : 0.0];
  }
}

export class CheckpointManager {
  private checkpoints: CheckpointMetadata[] = [];

  async saveCheckpoint(
    step: number,
    epoch: number,
    trainingLoss: number,
    validationLoss: number,
    metricScore: number,
    config: TrainingConfig
  ): Promise<CheckpointMetadata> {
    const checkpointId = `ckpt_step_${step}_epoch_${epoch}`;
    const ckpt: CheckpointMetadata = {
      checkpointId,
      step,
      epoch,
      trainingLoss,
      validationLoss,
      metricScore,
      savedIso: new Date().toISOString(),
      filePath: `./checkpoints/${checkpointId}.json`,
      config,
    };
    this.checkpoints.push(ckpt);
    return ckpt;
  }

  getLatestCheckpoint(): CheckpointMetadata | undefined {
    return this.checkpoints[this.checkpoints.length - 1];
  }
}

export interface ModelTrainer {
  trainPipeline(config: TrainingConfig, evalConfig: EvaluationConfig): Promise<CheckpointMetadata>;
}

export class MockModelTrainer implements ModelTrainer {
  async trainPipeline(config: TrainingConfig, evalConfig: EvaluationConfig): Promise<CheckpointMetadata> {
    // 1. Load dataset with reproducible splits
    const splits = DatasetLoader.loadDatasetSplits(20, config.randomSeed);

    // 2. Preprocess & Encode features/labels
    splits.train.examples.forEach((ex) => {
      FeatureEncoder.encodeFeatures(ex);
      LabelEncoder.encodeLabels(ex);
    });

    // 3. Simulate training epochs with decreasing loss
    let trainLoss = 0.45;
    let valLoss = 0.48;
    const checkpointManager = new CheckpointManager();

    let lastCkpt: CheckpointMetadata | undefined;

    for (let epoch = 1; epoch <= config.epochs; epoch++) {
      trainLoss *= 0.85;
      valLoss *= 0.88;
      const step = epoch * 10;
      lastCkpt = await checkpointManager.saveCheckpoint(step, epoch, trainLoss, valLoss, 1.0 - valLoss, config);
    }

    return lastCkpt!;
  }
}
