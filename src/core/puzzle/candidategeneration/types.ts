/**
 * Multi-Candidate AI Design Generation Types (Phase 74).
 *
 * Supports generating N candidate puzzle designs for a single requirement,
 * evaluating 7 physical/engineering metrics per candidate, strict invariant ranking
 * (valid candidates ALWAYS rank above invalid candidates), and ensemble diversity measurement.
 */

import type { ID } from "@/core/model/types";
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { AIValidationPasses } from "../designgeneration/types";
import type { DifficultyFeatures } from "../difficulty/types";
import type { RetrievedDesign } from "../retrievalsystem/types";

/**
 * Request payload for multi-candidate design generation.
 */
export interface CandidateGenerationRequest {
  /** 1. Natural language design requirement or customer prompt */
  prompt: string;

  /** 2. Number of candidates to generate (N >= 1, configurable, default: 3) */
  candidateCount?: number;

  /** 3. Optional base64 reference image */
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

  /** 6. Optional evaluation weights for composite score ranking (sum to 1.0) */
  evaluationWeights?: {
    difficultyWeight?: number;
    materialUtilizationWeight?: number;
    connectionQualityWeight?: number;
    assemblyQualityWeight?: number;
    designSimilarityWeight?: number;
    manufacturabilityWeight?: number;
  };
}

/**
 * Detailed breakdown of the 7 required evaluation metrics for each candidate.
 */
export interface CandidateEvaluationMetrics {
  /** 1. Deterministic Validation Status */
  validity: {
    isValid: boolean;
    passes: AIValidationPasses;
    errors: string[];
    warnings: string[];
    gatePassCount: number;
    gatePassRatio: number; // [0.0, 1.0]
  };

  /** 2. Difficulty Assessment (Phase 69 alignment) */
  difficulty: {
    score: number; // [0.0, 100.0]
    level: "easy" | "medium" | "hard" | "expert";
    featureBreakdown: Partial<DifficultyFeatures>;
  };

  /** 3. Material Utilization */
  materialUtilization: {
    score: number; // [0.0, 100.0]
    sheetPackingDensityPct: number; // e.g. 45.2%
    totalPieceAreaMm2: number;
    stockSheetAreaMm2: number;
  };

  /** 4. Connection Quality */
  connectionQuality: {
    score: number; // [0.0, 100.0]
    clearanceMm: number;
    jointType: string;
    fitRating: "OPTIMAL" | "ACCEPTABLE" | "TIGHT" | "LOOSE" | "INVALID";
  };

  /** 5. Assembly Quality */
  assemblyQuality: {
    score: number; // [0.0, 100.0]
    feasibilityPassed: boolean;
    assemblySequenceSteps: number;
    stabilityRating: "HIGH" | "MODERATE" | "LOW";
  };

  /** 6. Design Similarity to User Requirement / References */
  designSimilarity: {
    score: number; // [0.0, 100.0]
    requirementAlignmentScore: number;
    matchingFeatures: string[];
    deviations: string[];
  };

  /** 7. Manufacturability */
  manufacturability: {
    score: number; // [0.0, 100.0]
    laserKerfSafe: boolean;
    minBridgeWidthMm: number;
    stockThicknessMm: number;
    cutSuitabilityRating: "EXCELLENT" | "GOOD" | "MARGINAL" | "DEFECTIVE";
  };

  /** Composite weighted quality score across all 6 quality domains [0.0, 100.0] */
  compositeScore: number;
}

/**
 * A single generated design candidate with specification, geometry, metrics, and rank.
 */
export interface DesignCandidate {
  /** Unique candidate identifier */
  candidateId: string;

  /** 0-indexed candidate index in the generation batch */
  candidateIndex: number;

  /** Design generation strategy used for this candidate */
  strategy: string;

  /** Structured parametric design specification */
  specification: ParametricDesignSpecification;

  /** Compiled canonical puzzle (defined if candidate passed compilation) */
  canonicalPuzzle?: CanonicalPuzzle;

  /** Detailed 7-metric evaluation breakdown */
  metrics: CandidateEvaluationMetrics;

  /** 1-indexed overall rank (1 = best) */
  rank: number;

  /** Whether the candidate is physically and mathematically viable (validity.isValid === true) */
  isViable: boolean;
}

/**
 * Pairwise dissimilarity comparison between two candidates.
 */
export interface PairwiseCandidateDistance {
  candidateAId: string;
  candidateBId: string;
  distance: number; // [0.0, 1.0] where 0.0 = identical, 1.0 = completely distinct
  differences: string[];
}

/**
 * Comprehensive diversity report for the generated ensemble.
 */
export interface EnsembleDiversityReport {
  /** Overall ensemble diversity score [0.0, 1.0] (average pairwise distance) */
  ensembleDiversityScore: number;

  /** Individual pairwise distance matrix */
  pairwiseDistances: PairwiseCandidateDistance[];

  /** Minimum distance observed between any two candidates */
  minPairwiseDistance: number;

  /** Maximum distance observed between any two candidates */
  maxPairwiseDistance: number;

  /** Average distance across all unique candidate pairs */
  averagePairwiseDistance: number;

  /** Whether the ensemble has sufficient diversity (no duplicate designs) */
  isSufficientlyDiverse: boolean;

  /** Identifies any pair of identical or near-identical candidates */
  duplicatePairsDetected: Array<[string, string]>;
}

/**
 * Complete result of the Multi-Candidate AI Generation workflow.
 */
export interface MultiCandidateGenerationResult {
  /** Unique run identifier */
  runId: string;

  /** Natural language design prompt */
  prompt: string;

  /** Number of candidates requested */
  candidateCountRequested: number;

  /** Number of candidates actually generated */
  candidateCountGenerated: number;

  /** Number of candidates that passed all 5 deterministic validation gates */
  validCandidateCount: number;

  /** Number of candidates that failed one or more validation gates */
  invalidCandidateCount: number;

  /**
   * Ranked array of all generated candidates.
   * STRICT INVARIANT: Valid candidates ALWAYS rank above invalid candidates!
   */
  candidates: DesignCandidate[];

  /** Top-ranked candidate (highest scoring valid candidate, or undefined if all invalid) */
  topCandidate?: DesignCandidate;

  /** Ensemble diversity measurement and duplication report */
  diversityReport: EnsembleDiversityReport;

  /** Criteria used for sorting and ranking */
  rankingCriteria: string[];

  /** Processing duration in milliseconds */
  processingDurationMs: number;
}
