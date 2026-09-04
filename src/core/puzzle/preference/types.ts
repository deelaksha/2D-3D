/**
 * Preference Learning Infrastructure Types (Phase 76).
 *
 * Captures structured human and customer feedback across 6 dimensions:
 *  - Overall preference
 *  - Difficulty preference
 *  - Visual preference
 *  - Connection preference
 *  - Assembly preference
 *  - Manufacturing preference
 *
 * CRITICAL ARCHITECTURAL INVARIANT:
 *  - Preference data must remain strictly isolated from deterministic geometry ground truth.
 *  - Subjective human ratings must never overwrite or contaminate objective CAD geometry,
 *    assembly state invariants, or deterministic validation passes.
 */

import type { ID } from "@/core/model/types";

/**
 * The 6 formal preference evaluation dimensions.
 */
export type PreferenceDimension =
  | "overall"
  | "difficulty"
  | "visual"
  | "connection"
  | "assembly"
  | "manufacturing";

/**
 * Structured breakdown for each of the 6 feedback dimensions.
 */
export interface DimensionFeedback {
  /** Rating on a 1.0 to 5.0 scale (or normalized [0.0, 1.0]) */
  rating: number;

  /** Diagnostic tags describing the feedback */
  tags?: string[];

  /** Reviewer explanation or qualitative notes */
  notes?: string;

  /** Domain-specific qualitative perception */
  specificPerception?: Record<string, any>;
}

/**
 * Granular structured feedback across all 6 required dimensions.
 */
export interface StructuredFeedback {
  /** 1. Overall Preference */
  overall: DimensionFeedback;

  /** 2. Difficulty Preference (e.g. perceivedDifficulty: 'too_easy' | 'just_right' | 'too_hard') */
  difficulty: DimensionFeedback & {
    perceivedDifficulty?: "too_easy" | "just_right" | "too_hard";
    preferredTier?: "easy" | "medium" | "hard" | "expert";
  };

  /** 3. Visual / Aesthetic Preference (e.g. proportions, balance, symmetry appreciation) */
  visual: DimensionFeedback & {
    aestheticBalanceRating?: number; // 1-5
    symmetryAppreciation?: boolean;
  };

  /** 4. Connection Preference (e.g. joint tight/loose perception, tab geometry) */
  connection: DimensionFeedback & {
    fitPerception?: "too_tight" | "ideal" | "too_loose";
    preferredJointType?: string;
  };

  /** 5. Assembly Preference (e.g. sequence intuitiveness, ergonomic grip feel) */
  assembly: DimensionFeedback & {
    sequenceIntuitiveness?: number; // 1-5
    ergonomicRating?: number;       // 1-5
  };

  /** 6. Manufacturing Preference (e.g. cardboard grain, sheet waste acceptability) */
  manufacturing: DimensionFeedback & {
    materialQualityRating?: number;    // 1-5
    wasteAcceptabilityRating?: number; // 1-5
  };
}

/**
 * Contextual metadata about the review environment and reviewer.
 */
export interface ReviewContext {
  /** Unique reviewer identifier (anonymized customer ID or annotator ID) */
  reviewerId: string;

  /** Role of the reviewer */
  reviewerRole: "customer" | "engineer" | "assembler" | "evaluator" | "tester";

  /** Evaluation environment / substrate used during review */
  reviewEnvironment: "physical_assembled_prototype" | "3d_interactive_preview" | "cad_drawings" | "photo_mockup";

  /** Optional hardware or display platform */
  deviceOrChannel?: string;

  /** Optional evaluation session ID */
  sessionId?: string;
}

/**
 * Optional comparison metadata for pairwise ranking (Design A vs Design B).
 */
export interface PairwiseComparisonTarget {
  /** Identifier of the competitor design */
  targetDesignId: string;

  /** Version of the competitor design */
  targetDesignVersion: number | string;

  /** Which design the user preferred: 'this' | 'target' | 'tie' */
  preferredDesign: "this" | "target" | "tie";

  /** Margin of victory (1 = slight preference, 3 = strong preference) */
  winMargin?: number;
}

/**
 * A single atomic preference example record.
 */
export interface PreferenceExample {
  /** Unique preference example identifier */
  example_id: string;

  /** Identifier of the evaluated design */
  design_id: string;

  /** Version of the evaluated design */
  design_version: number | string;

  /** Structured feedback across the 6 dimensions */
  feedback: StructuredFeedback;

  /** Overall composite rating [1.0, 5.0] */
  rating: number;

  /** Primary textual rationale provided by reviewer */
  reason: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Review context metadata */
  review_context: ReviewContext;

  /** Optional pairwise comparison target */
  comparison_target?: PairwiseComparisonTarget;

  /** Parametric feature snapshot (piece count, clearance, aspect ratio) */
  parametric_features_snapshot?: Record<string, any>;

  /**
   * STRICT ISOLATION GUARD:
   * Explicit flag guaranteeing this record does not overwrite or mutate geometric ground truth.
   */
  is_ground_truth_isolated: true;
}

/**
 * Aggregated statistics for a collection of preference examples.
 */
export interface PreferenceDatasetStatistics {
  totalExamples: number;
  uniqueDesignsCount: number;
  uniqueReviewersCount: number;
  averageOverallRating: number;
  averageDimensionRatings: {
    overall: number;
    difficulty: number;
    visual: number;
    connection: number;
    assembly: number;
    manufacturing: number;
  };
  ratingDistribution: Record<number, number>; // e.g. { 1: 0, 2: 1, 3: 5, 4: 10, 5: 8 }
  reviewEnvironmentDistribution: Record<string, number>;
  pairwiseComparisonCount: number;
}

/**
 * Query filter for searching preference examples.
 */
export interface PreferenceQueryFilter {
  designId?: string;
  designVersion?: number | string;
  minRating?: number;
  maxRating?: number;
  reviewerRole?: ReviewContext["reviewerRole"];
  reviewEnvironment?: ReviewContext["reviewEnvironment"];
  hasPairwiseComparison?: boolean;
}

/**
 * Result of a model predicting preference for a design candidate.
 */
export interface PreferencePrediction {
  predictedRating: number; // [1.0, 5.0]
  confidenceScore: number; // [0.0, 1.0]
  dimensionScores: Record<PreferenceDimension, number>;
  predictedAcceptanceLikelihood: number; // [0.0, 1.0]
  rationale: string;
}

/**
 * Result of predicting preference between two candidates (A vs B).
 */
export interface PairwisePreferencePrediction {
  preferredCandidate: "A" | "B" | "TIE";
  probAWin: number; // [0.0, 1.0]
  probBWin: number; // [0.0, 1.0]
  confidenceScore: number;
  dimensionAdvantages: Record<PreferenceDimension, "A" | "B" | "TIE">;
  reason: string;
}

/**
 * Evaluation and calibration metrics for a preference model.
 */
export interface PreferenceModelMetrics {
  meanAbsoluteError: number;
  rootMeanSquaredError: number;
  pairwiseRankingAccuracy: number; // [0.0, 1.0]
  evaluatedExamplesCount: number;
}

/**
 * Formal interface for future preference learning models (Phase 76).
 * Enables downstream neural, Bradley-Terry, or reward models to be plugged in.
 */
export interface PreferenceModel {
  /** Unique model identifier */
  readonly modelId: string;

  /** Semantic version of the model */
  readonly modelVersion: string;

  /**
   * Predicts a continuous preference score for a single candidate.
   */
  predictPreference(
    parametricFeatures: Record<string, any>,
    context?: Partial<ReviewContext>
  ): Promise<PreferencePrediction>;

  /**
   * Predicts pairwise preference probability between Candidate A and Candidate B.
   */
  predictPairwisePreference(
    featuresA: Record<string, any>,
    featuresB: Record<string, any>
  ): Promise<PairwisePreferencePrediction>;

  /**
   * Evaluates prediction calibration against a labeled PreferenceDataset.
   */
  evaluateCalibration(
    examples: PreferenceExample[]
  ): Promise<PreferenceModelMetrics>;
}
