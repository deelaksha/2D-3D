/**
 * Hybrid Real + Synthetic Dataset Composition Subsystem Types (Phase 64).
 *
 * Provides data structures for mixing Real and Synthetic puzzle data in
 * mathematically controlled ratios, enforcing strict ground-truth separation,
 * tracking sample origin, stratified sampling across 7 dimensions,
 * and generating balanced evaluation splits.
 */
import type { VersionedDatasetExample } from "../datasetversioning/types";

/**
 * Origin of a dataset example.
 */
export type DataOrigin = "REAL" | "SYNTHETIC";

/**
 * Geometric complexity classification tier.
 */
export type GeometryComplexityTier = "simple" | "medium" | "complex";

/**
 * The 7 sampling and stratification dimensions.
 */
export interface SamplingDimensions {
  /** 1. Number of pieces in the puzzle (e.g. 2, 3, 4, 5+). */
  pieceCount: number;
  /** 2. Dominant interface connection type (e.g. 'tab_slot', 'finger', 'dovetail'). */
  connectionType: string;
  /** 3. Requirement target difficulty ('easy', 'medium', 'hard', 'expert'). */
  difficulty: "easy" | "medium" | "hard" | "expert";
  /** 4. Geometry complexity tier ('simple', 'medium', 'complex'). */
  geometryComplexity: GeometryComplexityTier;
  /** 5. Dominant 3D joining angle in degrees (e.g. 0, 30, 45, 60, 90). */
  assemblyAngle: number;
  /** 6. Cardboard or stock material specification ID. */
  material: string;
  /** 7. Failure classification ('none' for valid, or specific failure code). */
  failureType: string;
}

/**
 * Unified Composite Dataset Example.
 * Synthetic examples are permanently flagged with isGroundTruth = false.
 */
export interface CompositeDatasetExample extends VersionedDatasetExample {
  /** Source origin: REAL or SYNTHETIC. */
  origin: DataOrigin;
  /**
   * CRITICAL GROUND TRUTH FLAG:
   * Strictly true ONLY for verified real data.
   * Synthetic examples MUST NEVER be marked true.
   */
  isGroundTruth: boolean;
  /** Extracted 7-dimensional stratification features. */
  samplingDimensions: SamplingDimensions;
  /** Synthetic generator seed if origin is SYNTHETIC. */
  syntheticSeed?: number;
}

/**
 * Composition ratio configuration.
 */
export interface CompositionRatioConfig {
  /** Proportion of real data (0.0 to 1.0, e.g. 0.2 for 20%). */
  realRatio: number;
  /** Proportion of synthetic data (0.0 to 1.0, e.g. 0.8 for 80%). */
  syntheticRatio: number;
  /** Maximum total dataset size (keeps dataset compact and bounded). */
  targetTotalCount: number;
  /** If true, strictly rejects composition if ratio cannot be met within tolerance. */
  strictRatioEnforcement?: boolean;
}

/**
 * Stratified sampling configuration for the 7 dimensions.
 */
export interface StratifiedSamplingConfig {
  targetPieceCounts?: number[];
  targetConnectionTypes?: string[];
  targetDifficulties?: ("easy" | "medium" | "hard" | "expert")[];
  targetGeometryComplexities?: GeometryComplexityTier[];
  targetAssemblyAngles?: number[];
  targetMaterials?: string[];
  targetFailureTypes?: string[];
}

/**
 * Policy for evaluation set (test/validation split) construction.
 */
export interface EvaluationSetPolicy {
  /**
   * 'pure_real': Test split contains ONLY real ground truth examples.
   * 'mixed': Test split mirrors the training ratio.
   * 'balanced_classes': Test split equalizes across difficulty and connection types.
   */
  policy: "pure_real" | "mixed" | "balanced_classes";
  /** Fraction of examples allocated to evaluation test split (e.g. 0.15). */
  testSplitRatio?: number;
  /** Fraction of examples allocated to validation split (e.g. 0.15). */
  valSplitRatio?: number;
}

/**
 * Distribution statistics summarizing the composite dataset.
 */
export interface DatasetDistributionStats {
  totalExamples: number;
  realCount: number;
  syntheticCount: number;
  actualRealRatio: number;
  actualSyntheticRatio: number;
  groundTruthCount: number;
  byPieceCount: Record<number, number>;
  byConnectionType: Record<string, number>;
  byDifficulty: Record<string, number>;
  byGeometryComplexity: Record<string, number>;
  byAssemblyAngle: Record<number, number>;
  byMaterial: Record<string, number>;
  byFailureType: Record<string, number>;
}

/**
 * Result of dataset composition.
 */
export interface CompositeDatasetSplits {
  datasetId: string;
  datasetVersion: string;
  train: CompositeDatasetExample[];
  validation: CompositeDatasetExample[];
  test: CompositeDatasetExample[];
  distributionStats: DatasetDistributionStats;
}
