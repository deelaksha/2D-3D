/**
 * Real-Data Benchmark Subsystem Types (Step 40).
 */
export interface SubsystemAccuracyMetric {
  subsystemName: string;
  automaticallyInferredAccuracy: number; // 0.0 to 1.0
  manuallyCorrectedAccuracy: number;     // 0.0 to 1.0
  groundTruthBaselineAccuracy: number;   // 1.0
  isWeakestSubsystem: boolean;
  notes: string;
}

export interface MLPhaseRecommendations {
  whatShouldBeAutomated: string[];
  whatShouldRemainDeterministic: string[];
  whatNeedsHumanReview: string[];
  whatDataIsMissing: string[];
}

export interface RealDataBenchmarkReport {
  timestamp: string;
  pilotDatasetSize: number;
  overallAccuracy: number;
  weakestSubsystemName: string;
  subsystemMetrics: SubsystemAccuracyMetric[];
  recommendations: MLPhaseRecommendations;
}
