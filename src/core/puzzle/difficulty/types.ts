/**
 * Formal Puzzle Difficulty Representation Types (Phase 69)
 *
 * Provides typed definitions for extracting, normalizing, and scoring measurable
 * puzzle difficulty properties, preserving detailed feature telemetry for future ML training.
 */

import { AdvancedConnectionModel } from "../connection/connectionModel";
import { RigidTransform3D } from "../assemblytransforms/types";
import { AssemblyPath } from "../feasibility/types";

/**
 * Standard discrete difficulty tiers.
 */
export type DifficultyRating = "easy" | "medium" | "hard" | "expert";

/**
 * 11 measurable properties characterizing puzzle difficulty.
 * Derived strictly from physical, topological, kinematic, and motion properties.
 */
export interface DifficultyFeatures {
  /** 1. Total piece count in the puzzle (N >= 1) */
  pieceCount: number;

  /** 2. Connection density: ratio of actual connections to potential pairwise connections (0.0 to 1.0) */
  connectionDensity: number;

  /** 3. Total number of valid distinct assembly configurations or combinatorial state space size */
  possibleConfigurationsCount: number;

  /** 4. Ambiguity metric: candidate matching interfaces / actual connections or indistinguishable piece count */
  ambiguity: number;

  /** 5. Total number of sequential assembly steps required to reach the completed state */
  assemblySequenceLength: number;

  /** 6. Total count of valid discrete joining angles (or discretized continuous angular freedom sectors) */
  validAnglesCount: number;

  /** 7. Number of interfaces with tight tolerances, multi-axis keying, or non-planar constraints */
  constrainedInterfacesCount: number;

  /** 8. Rotational / reflective symmetry order (higher symmetry increases orientation search ambiguity) */
  symmetryOrder: number;

  /** 9. Interlocking complexity score: metric of interlocked joints (burr, dovetail, snap) blocking translation in >= 2 axes */
  interlockingComplexity: number;

  /** 10. Motion-planning difficulty: ratio of restricted insertion vectors and clearance envelopes */
  motionPlanningDifficulty: number;

  /** 11. Count of assembly paths leading to irreversible or blocked dead-ends requiring disassembly */
  deadEndPathsCount: number;
}

/**
 * Individual feature breakdown contribution for explainability and ML feature storage.
 */
export interface FeatureContribution {
  featureName: keyof DifficultyFeatures;
  rawValue: number;
  normalizedValue: number; // Scaled [0.0, 1.0]
  weight: number;
  weightedContribution: number;
}

/**
 * High-level component score aggregations ([0.0, 100.0]).
 */
export interface DifficultyComponentScores {
  /** Structural complexity derived from piece count, connection density, and sequence length */
  structuralComplexity: number;

  /** Combinatorial search complexity from configurations, ambiguity, and dead-ends */
  combinatorialSearchComplexity: number;

  /** Geometric & kinematic complexity from constrained interfaces, valid angles, interlocks, and motion planning */
  geometricKinematicComplexity: number;

  /** Symmetry influence factor reflecting rotational orientation ambiguity */
  symmetryFactor: number;
}

/**
 * Complete, immutable difficulty scoring record.
 */
export interface DifficultyScore {
  /** Global composite difficulty score on continuous [0.0, 100.0] scale */
  overallScore: number;

  /** Discrete categorical difficulty level */
  level: DifficultyRating;

  /** Raw, unscaled measurable features */
  features: DifficultyFeatures;

  /** Normalized feature vector [0.0, 1.0] */
  normalizedFeatures: Record<keyof DifficultyFeatures, number>;

  /** 4 high-level domain component scores */
  componentScores: DifficultyComponentScores;

  /** Complete granular feature breakdown (for ML telemetry and explainable UI) */
  featureBreakdown: Record<keyof DifficultyFeatures, FeatureContribution>;

  /** Identifier of the model evaluating this score */
  modelId: string;

  /** Version string of the scoring model */
  modelVersion: string;

  /** Evaluation timestamp (ISO-8601) */
  evaluatedAt: string;
}

/**
 * Piece description for difficulty evaluation.
 */
export interface DifficultyPieceInput {
  id: string;
  name?: string;
  dimensions?: {
    width: number;
    height: number;
    thickness: number;
  };
  symmetryOrder?: number;
  material?: string;
}

/**
 * Contextual input provided to a DifficultyModel for feature extraction and scoring.
 */
export interface DifficultyEvaluationContext {
  /** All pieces participating in the puzzle */
  pieces: DifficultyPieceInput[];

  /** All active or candidate connections between pieces */
  connections: AdvancedConnectionModel[];

  /** Target 3D assembly configuration (optional) */
  targetConfiguration?: Record<string, RigidTransform3D>;

  /** Validated assembly path or feasibility result (optional) */
  assemblyPath?: AssemblyPath;

  /** Known alternative valid configurations (default: 1) */
  knownConfigurationsCount?: number;

  /** Known dead-end assembly sequence branches count (default: 0) */
  deadEndPathsCount?: number;

  /** Pre-calculated ambiguity ratio if available */
  ambiguityRatio?: number;

  /** Overall puzzle assembly rotational/reflective symmetry order (default: derived from pieces or 1) */
  assemblySymmetryOrder?: number;
}

/**
 * Formal interface for difficulty evaluation models.
 * Can be implemented by deterministic baseline models or future ML-based predictors.
 */
export interface DifficultyModel {
  readonly id: string;
  readonly version: string;

  /**
   * Extracts measurable raw DifficultyFeatures from the puzzle evaluation context.
   */
  computeFeatures(context: DifficultyEvaluationContext): DifficultyFeatures;

  /**
   * Computes a structured DifficultyScore from precomputed DifficultyFeatures.
   */
  evaluate(features: DifficultyFeatures): DifficultyScore;

  /**
   * End-to-end convenience method: extracts features and computes the DifficultyScore.
   */
  scorePuzzle(context: DifficultyEvaluationContext): DifficultyScore;
}
