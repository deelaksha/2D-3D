/**
 * Deterministic Difficulty Model (Phase 69)
 *
 * Implements the DifficultyModel interface using mathematical scaling functions,
 * sublinear cognitive-load curves, and weighted multi-domain aggregations.
 * Preserves granular feature telemetry for explainability and downstream ML training.
 */

import {
  DifficultyComponentScores,
  DifficultyEvaluationContext,
  DifficultyFeatures,
  DifficultyModel,
  DifficultyRating,
  DifficultyScore,
  FeatureContribution,
} from "./types";
import { DifficultyFeatureExtractor } from "./featureExtractor";

export interface DeterministicDifficultyModelConfig {
  weights?: Partial<Record<keyof DifficultyFeatures, number>>;
  thresholds?: {
    easyMax: number;
    mediumMax: number;
    hardMax: number;
  };
}

/**
 * Standard audited baseline weights summing to 1.00 across 4 domains.
 */
export const DEFAULT_DIFFICULTY_FEATURE_WEIGHTS: Record<keyof DifficultyFeatures, number> = {
  // Structural Complexity (0.25)
  pieceCount: 0.12,
  connectionDensity: 0.06,
  assemblySequenceLength: 0.07,

  // Combinatorial Search Complexity (0.30)
  possibleConfigurationsCount: 0.08,
  ambiguity: 0.10,
  deadEndPathsCount: 0.12,

  // Geometric & Kinematic Complexity (0.35)
  interlockingComplexity: 0.12,
  motionPlanningDifficulty: 0.10,
  constrainedInterfacesCount: 0.08,
  validAnglesCount: 0.05,

  // Symmetry Factor (0.10)
  symmetryOrder: 0.10,
};

export class DeterministicDifficultyModel implements DifficultyModel {
  public readonly id = "deterministic_difficulty_v1";
  public readonly version = "1.0.0";

  private weights: Record<keyof DifficultyFeatures, number>;
  private thresholds: { easyMax: number; mediumMax: number; hardMax: number };

  constructor(config?: DeterministicDifficultyModelConfig) {
    this.weights = { ...DEFAULT_DIFFICULTY_FEATURE_WEIGHTS, ...(config?.weights || {}) };
    this.thresholds = {
      easyMax: config?.thresholds?.easyMax ?? 25.0,
      mediumMax: config?.thresholds?.mediumMax ?? 55.0,
      hardMax: config?.thresholds?.hardMax ?? 80.0,
    };
  }

  /**
   * Extracts raw features from the puzzle evaluation context.
   */
  public computeFeatures(context: DifficultyEvaluationContext): DifficultyFeatures {
    return DifficultyFeatureExtractor.extractFeatures(context);
  }

  /**
   * Evaluates raw features into a structured, explainable DifficultyScore.
   */
  public evaluate(features: DifficultyFeatures): DifficultyScore {
    const normalizedFeatures = this.normalizeFeatures(features);
    const featureBreakdown: Record<keyof DifficultyFeatures, FeatureContribution> = {} as any;

    let totalWeightedScore = 0.0;

    for (const key of Object.keys(features) as Array<keyof DifficultyFeatures>) {
      const rawVal = features[key];
      const normVal = normalizedFeatures[key];
      const weight = this.weights[key] ?? 0.0;
      const weightedContribution = Number((normVal * weight * 100.0).toFixed(4));

      totalWeightedScore += weightedContribution;

      featureBreakdown[key] = {
        featureName: key,
        rawValue: rawVal,
        normalizedValue: normVal,
        weight,
        weightedContribution,
      };
    }

    const overallScore = Number(Math.min(100.0, Math.max(0.0, totalWeightedScore)).toFixed(2));
    const level = this.classifyLevel(overallScore);
    const componentScores = this.computeComponentScores(normalizedFeatures);

    return {
      overallScore,
      level,
      features,
      normalizedFeatures,
      componentScores,
      featureBreakdown,
      modelId: this.id,
      modelVersion: this.version,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * End-to-end convenience method: extracts features and calculates DifficultyScore.
   */
  public scorePuzzle(context: DifficultyEvaluationContext): DifficultyScore {
    const features = this.computeFeatures(context);
    return this.evaluate(features);
  }

  /**
   * Normalizes each measurable property into the bounded [0.0, 1.0] interval.
   */
  public normalizeFeatures(features: DifficultyFeatures): Record<keyof DifficultyFeatures, number> {
    return {
      // Piece Count: Sublinear logarithmic curve. N=1 -> 0.0, N=4 -> 0.33, N=8 -> 0.50, N=64 -> 1.0
      pieceCount: Number(
        Math.min(1.0, Math.max(0.0, Math.log2(Math.max(1, features.pieceCount)) / Math.log2(64))).toFixed(4)
      ),

      // Connection Density: Direct ratio [0.0, 1.0]
      connectionDensity: Number(Math.min(1.0, Math.max(0.0, features.connectionDensity)).toFixed(4)),

      // Possible Configurations: Log10 scaling. 1 -> 0.0, 10 -> 0.25, 100 -> 0.50, 10000 -> 1.0
      possibleConfigurationsCount: Number(
        Math.min(1.0, Math.max(0.0, Math.log10(Math.max(1, features.possibleConfigurationsCount)) / 4.0)).toFixed(4)
      ),

      // Ambiguity: Range [1.0, 5.0] maps to [0.0, 1.0]
      ambiguity: Number(
        Math.min(1.0, Math.max(0.0, (features.ambiguity - 1.0) / 4.0)).toFixed(4)
      ),

      // Assembly Sequence Length: 0 to 30 steps
      assemblySequenceLength: Number(
        Math.min(1.0, Math.max(0.0, features.assemblySequenceLength / 30.0)).toFixed(4)
      ),

      // Valid Angles: Log2 scaling. 1 -> 0.0, 2 -> 0.2, 4 -> 0.4, 32 -> 1.0
      validAnglesCount: Number(
        Math.min(1.0, Math.max(0.0, Math.log2(Math.max(1, features.validAnglesCount)) / 5.0)).toFixed(4)
      ),

      // Constrained Interfaces: 0 to 15 constrained interfaces
      constrainedInterfacesCount: Number(
        Math.min(1.0, Math.max(0.0, features.constrainedInterfacesCount / 15.0)).toFixed(4)
      ),

      // Symmetry Order: Log2 scaling. 1 -> 0.0, 2 -> 0.33, 4 -> 0.67, 8 -> 1.0
      symmetryOrder: Number(
        Math.min(1.0, Math.max(0.0, Math.log2(Math.max(1, features.symmetryOrder)) / 3.0)).toFixed(4)
      ),

      // Interlocking Complexity: Metric [0.0, 10.0] maps to [0.0, 1.0]
      interlockingComplexity: Number(
        Math.min(1.0, Math.max(0.0, features.interlockingComplexity / 10.0)).toFixed(4)
      ),

      // Motion Planning Difficulty: Direct ratio [0.0, 1.0]
      motionPlanningDifficulty: Number(
        Math.min(1.0, Math.max(0.0, features.motionPlanningDifficulty)).toFixed(4)
      ),

      // Dead-End Paths Count: 0 to 10 dead-ends
      deadEndPathsCount: Number(
        Math.min(1.0, Math.max(0.0, features.deadEndPathsCount / 10.0)).toFixed(4)
      ),
    };
  }

  /**
   * Aggregates normalized features into 4 high-level domain component scores ([0.0, 100.0]).
   */
  private computeComponentScores(
    norm: Record<keyof DifficultyFeatures, number>
  ): DifficultyComponentScores {
    const calcDomainScore = (keys: Array<keyof DifficultyFeatures>): number => {
      let weightSum = 0;
      let scoreSum = 0;
      for (const k of keys) {
        const w = this.weights[k] ?? 0;
        weightSum += w;
        scoreSum += norm[k] * w;
      }
      return weightSum > 0 ? Number(((scoreSum / weightSum) * 100.0).toFixed(2)) : 0.0;
    };

    return {
      structuralComplexity: calcDomainScore([
        "pieceCount",
        "connectionDensity",
        "assemblySequenceLength",
      ]),
      combinatorialSearchComplexity: calcDomainScore([
        "possibleConfigurationsCount",
        "ambiguity",
        "deadEndPathsCount",
      ]),
      geometricKinematicComplexity: calcDomainScore([
        "interlockingComplexity",
        "motionPlanningDifficulty",
        "constrainedInterfacesCount",
        "validAnglesCount",
      ]),
      symmetryFactor: calcDomainScore(["symmetryOrder"]),
    };
  }

  /**
   * Classifies numerical score into categorical difficulty ratings.
   */
  private classifyLevel(score: number): DifficultyRating {
    if (score < this.thresholds.easyMax) return "easy";
    if (score < this.thresholds.mediumMax) return "medium";
    if (score < this.thresholds.hardMax) return "hard";
    return "expert";
  }
}
