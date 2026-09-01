/**
 * ML Training Infrastructure Types & Configuration (Phase 57).
 */
import type { SyntheticGeneratedExample } from "../generator/types";

export interface TrainSplit {
  examples: SyntheticGeneratedExample[];
  splitName: "train";
}

export interface ValidationSplit {
  examples: SyntheticGeneratedExample[];
  splitName: "validation";
}

export interface TestSplit {
  examples: SyntheticGeneratedExample[];
  splitName: "test";
}

export interface DatasetSplits {
  train: TrainSplit;
  validation: ValidationSplit;
  test: TestSplit;
  randomSeed: number;
  datasetVersion: string;
  schemaVersion: string;
}

export interface TrainingConfig {
  randomSeed: number;
  datasetVersion: string;
  schemaVersion: string;
  modelVersion: string;
  configVersion: string;
  epochs: number;
  batchSize: number;
  learningRate: number;
  optimizer: "adam" | "adamw" | "sgd";
}

export interface EvaluationConfig {
  metrics: string[];
  evalBatchSize: number;
}

export interface CheckpointMetadata {
  checkpointId: string;
  step: number;
  epoch: number;
  trainingLoss: number;
  validationLoss: number;
  metricScore: number;
  savedIso: string;
  filePath: string;
  config: TrainingConfig;
}
