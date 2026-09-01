/**
 * Comprehensive AI Evaluation Framework Types & Metrics (Phase 56).
 */

export interface StageEvaluationMetrics {
  requirementParsingAccuracy: number;  // 0.0 to 1.0
  pieceRecognitionPrecision: number;   // 0.0 to 1.0
  pieceRecognitionRecall: number;      // 0.0 to 1.0
  pieceRecognitionIoU: number;         // 0.0 to 1.0
  interfaceRecognitionAccuracy: number; // 0.0 to 1.0
  connectionPredictionF1: number;      // 0.0 to 1.0
  parameterPredictionMAE: number;      // Mean Absolute Error in mm
  designPlanningSuccessRate: number;   // 0.0 to 1.0
  generationSuccessRate: number;       // 0.0 to 1.0
  repairSuccessRate: number;           // 0.0 to 1.0
  manufacturabilityPassRate: number;   // 0.0 to 1.0
  constraintViolationRate: number;     // 0.0 to 1.0
  validParametricDesignRate: number;   // PRIMARY END METRIC (0.0 to 1.0)
}

export interface StageEvaluationReport {
  stageName: string;
  evaluatedCount: number;
  passedCount: number;
  failedCount: number;
  score: number;
  details: Record<string, number | string>;
}

export interface ComprehensiveAIEvaluationResult {
  evaluationId: string;
  timestampIso: string;
  datasetName: string;
  totalExamplesEvaluated: number;
  stageReports: StageEvaluationReport[];
  overallMetrics: StageEvaluationMetrics;
  validParametricDesignRate: number;  // PRIMARY END METRIC
  weakestSubsystem: string;
  processingDurationMs: number;
}
