/**
 * Complete AI + Optimization Loop Types (Phase 75).
 *
 * Encapsulates the complete end-to-end pipeline:
 *  Requirement -> AI planning -> Candidate generation -> Deterministic geometry ->
 *  Validation -> AI critique -> Repair -> Optimization -> Candidate ranking ->
 *  Best valid design.
 */

import type { ID } from "@/core/model/types";
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { DesignCandidate } from "../candidategeneration/types";
import type { RetrievedDesign } from "../retrievalsystem/types";

/**
 * Pipeline stage names in the master AI + Optimization loop.
 */
export type OptimizationLoopStage =
  | "REQUIREMENT_PARSING"
  | "AI_PLANNING"
  | "CANDIDATE_GENERATION"
  | "GEOMETRY_COMPILATION"
  | "DETERMINISTIC_VALIDATION"
  | "AI_CRITIQUE"
  | "REPAIR_STAGE"
  | "PARAMETRIC_OPTIMIZATION"
  | "RE_EVALUATION"
  | "CANDIDATE_RANKING"
  | "BEST_DESIGN_SELECTION";

/**
 * User request payload for the master optimization loop.
 */
export interface OptimizationLoopRequest {
  /** 1. Natural language design requirement or customer prompt */
  prompt: string;

  /** 2. Number of candidates to generate in the ensemble (N >= 1, default: 3) */
  candidateCount?: number;

  /** 3. Optional base64 reference drawing or sketch */
  referenceImageBase64?: string;

  /** 4. Optional retrieved reference designs */
  retrievedDesigns?: RetrievedDesign[];

  /** 5. Optional user target preferences */
  userPreferences?: {
    targetPieceCount?: number;
    targetDimensions?: {
      widthMm?: number;
      heightMm?: number;
      depthMm?: number;
    };
    preferredMaterialId?: ID;
    defaultJoiningAngleDeg?: number;
    preferredJointType?: string;
    targetDifficulty?: "easy" | "medium" | "hard" | "expert";
    layers?: number;
  };

  /** 6. Loop configuration flags and budgets */
  config?: {
    maxRepairIterationsPerCandidate?: number;
    enableParametricOptimization?: boolean;
    targetQualityScore?: number;
  };
}

/**
 * Record of a single parameter modification applied during repair or optimization.
 */
export interface ParameterModificationRecord {
  /** The parametric variable modified (e.g. 'clearance', 'stock_dimension', 'aspect_ratio') */
  variable: string;

  /** Value prior to modification */
  previousValue: any;

  /** Value after modification */
  newValue: any;

  /** Numeric or categorical difference */
  delta?: number | string;

  /** Pipeline stage in which modification was applied */
  stage: "REPAIR" | "OPTIMIZATION";

  /** Engineering rationale for the change */
  rationale: string;

  /** Timestamp in milliseconds */
  timestamp: number;
}

/**
 * Execution telemetry for each pipeline stage.
 */
export interface OptimizationStageLog {
  stage: OptimizationLoopStage;
  timestamp: number;
  durationMs: number;
  summary: string;
  details?: Record<string, any>;
}

/**
 * Per-candidate lifecycle history tracked across the master loop.
 */
export interface CandidateTraceLog {
  candidateId: string;
  strategy: string;
  initialSpec: ParametricDesignSpecification;
  repairedSpec?: ParametricDesignSpecification;
  optimizedSpec?: ParametricDesignSpecification;
  modifications: ParameterModificationRecord[];
  initialScore: number;
  postRepairScore?: number;
  finalScore: number;
  scoreImprovement: number;
  isValid: boolean;
}

/**
 * Comprehensive trace tracking every candidate, stage, and parameter modification.
 */
export interface OptimizationTrace {
  traceId: string;
  requirementPrompt: string;
  stages: OptimizationStageLog[];
  candidateTraces: CandidateTraceLog[];
  totalModificationsApplied: number;
  totalDurationMs: number;
}

/**
 * The selected best valid design output.
 */
export interface BestDesign {
  candidateId: string;
  rank: number;
  strategy: string;
  specification: ParametricDesignSpecification;
  canonicalPuzzle: CanonicalPuzzle;
  isViable: boolean;
}

/**
 * Granular score breakdown for the best valid design across all 7 metrics and soft objectives.
 */
export interface ScoreBreakdown {
  compositeScore: number; // [0.0, 100.0]
  validityPassRatio: number; // [0.0, 1.0] (1.0 = all 5 gates passed)
  difficultyScore: number; // [0.0, 100.0]
  materialUtilizationScore: number; // [0.0, 100.0]
  connectionQualityScore: number; // [0.0, 100.0]
  assemblyQualityScore: number; // [0.0, 100.0]
  designSimilarityScore: number; // [0.0, 100.0]
  manufacturabilityScore: number; // [0.0, 100.0]
  softObjectiveOptimizations: {
    sheetPackingDensityPct: number; // e.g. 48.5%
    clearanceCenteringMm: number; // e.g. 0.15mm
    aspectRatioBalance: number; // e.g. 1.50
  };
}

/**
 * Unified result of the complete AI + Optimization loop.
 */
export interface OptimizationLoopResult {
  runId: string;
  prompt: string;
  bestDesign?: BestDesign;
  scoreBreakdown?: ScoreBreakdown;
  reasonForSelection: string;
  trace: OptimizationTrace;
  allRankedCandidates: DesignCandidate[];
  summary: string;
}
