/**
 * Master Hybrid AI Architecture & Feature Flags Types (Phase 59).
 */
import type { CanonicalPuzzle } from "../canonical/types";
import type { DesignSpecification } from "../ai/types";
import type { AIDesignValidationResult } from "../aivalidationgate/types";
import type { OptimizedCandidateResult } from "../candidateoptimization/types";

export interface HybridPipelineFeatureFlags {
  enableMLConnectionClassifier: boolean;     // Dynamic feature flag for ML connection model
  enableAIRepairLoop: boolean;                // Dynamic feature flag for closed-loop repair
  enableMultiCandidateGeneration: boolean;    // Dynamic feature flag for candidate generation
  confidenceThreshold: number;                // e.g. 0.80 for routing low confidence to fallback
}

export interface HybridPipelineInput {
  rawPrompt: string;
  drawingSvg?: string;
  featureFlags?: Partial<HybridPipelineFeatureFlags>;
  seed?: number;
}

export type ExecutionMode = "ML" | "DETERMINISTIC_FALLBACK" | "HUMAN_REVIEW";

export interface HybridPipelineExecutionStage {
  stageName: string;
  executionMode: ExecutionMode;
  confidenceScore: number;
  passed: boolean;
  notes?: string;
}

export interface HybridPipelineResult {
  pipelineId: string;
  finalPuzzle?: CanonicalPuzzle;
  finalSpecification?: DesignSpecification;
  validationResult: AIDesignValidationResult;
  rankedCandidates: OptimizedCandidateResult[];
  stageExecutions: HybridPipelineExecutionStage[];
  usedMLClassifier: boolean;
  usedDeterministicFallback: boolean;
  status: "SUCCESS" | "REJECTED" | "REQUIRES_HUMAN_REVIEW";
  processingDurationMs: number;
}

export interface HybridComparisonReport {
  comparisonId: string;
  mlEnabledResult: HybridPipelineResult;
  mlDisabledResult: HybridPipelineResult;
  speedupMultiplier: number;
  accuracyDelta: number;
  fallbackCount: number;
}
