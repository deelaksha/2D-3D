/**
 * First Real ML Baseline Model Types (Phase 58: Connection Compatibility Classification).
 */
import type { ConnectionInterface } from "../interface/types";

export interface ConnectionCompatibilityFeatureVector {
  vector: number[]; // 16 normalized numerical features in R^16
  interfaceAId: string;
  interfaceBId: string;
  groundTruthCompatible: boolean;
}

export interface ModelErrorAnalysis {
  falsePositivesCount: number;
  falseNegativesCount: number;
  totalEvaluatedTestSamples: number;
  commonFailureModes: string[];
}

export interface ModelTrainingResult {
  modelName: string;
  selectedTask: "connection_compatibility_classification";
  trainAccuracy: number;
  valAccuracy: number;
  testPrecision: number;
  testRecall: number;
  testF1: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  baselineF1: number;
  demonstratesMeasurableBenefit: boolean; // Must be true
  checkpointPath: string;
  errorAnalysis: ModelErrorAnalysis;
  isIntegratedInProduction: false; // STRICT INVARIANT: Non-production
}
