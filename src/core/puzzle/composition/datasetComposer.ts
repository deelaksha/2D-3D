/**
 * Hybrid Dataset Composition Master Orchestrator (Phase 64).
 *
 * Combines Real and Synthetic puzzle data pools in strictly controlled ratios,
 * enforces bounded dataset sizes, prevents synthetic data from being mistaken for
 * ground truth, and constructs balanced evaluation splits.
 */
import type { RealDatasetExample } from "../realdata/types";
import type { SyntheticGeneratedExample } from "../generator/types";
import type {
  CompositeDatasetExample,
  CompositeDatasetSplits,
  CompositionRatioConfig,
  DatasetDistributionStats,
  EvaluationSetPolicy,
  StratifiedSamplingConfig,
} from "./types";
import { DataOriginAdapter } from "./adapters";
import { DatasetSampler } from "./datasetSampler";

export class DatasetComposer {
  /**
   * Composes a hybrid Real + Synthetic dataset release.
   */
  static composeDataset(
    datasetId: string,
    datasetVersion: string,
    realPool: (RealDatasetExample | CompositeDatasetExample)[],
    syntheticPool: (SyntheticGeneratedExample | CompositeDatasetExample)[],
    ratioConfig: CompositionRatioConfig,
    samplingConfig: StratifiedSamplingConfig = {},
    evalPolicy: EvaluationSetPolicy = { policy: "mixed", testSplitRatio: 0.15, valSplitRatio: 0.15 }
  ): CompositeDatasetSplits {
    const totalTarget = Math.max(2, ratioConfig.targetTotalCount);

    // 1. Normalize and adapt candidate pools
    const adaptedReal: CompositeDatasetExample[] = realPool.map((item) =>
      "origin" in item && item.origin === "REAL"
        ? (item as CompositeDatasetExample)
        : DataOriginAdapter.fromRealExample(item as RealDatasetExample)
    );

    const adaptedSynthetic: CompositeDatasetExample[] = syntheticPool.map((item) =>
      "origin" in item && item.origin === "SYNTHETIC"
        ? (item as CompositeDatasetExample)
        : DataOriginAdapter.fromSyntheticExample(item as SyntheticGeneratedExample, "unassigned", datasetVersion)
    );

    // 2. Compute target counts based on ratio
    const normalizedSum = ratioConfig.realRatio + ratioConfig.syntheticRatio || 1.0;
    const realNormRatio = ratioConfig.realRatio / normalizedSum;
    const synthNormRatio = ratioConfig.syntheticRatio / normalizedSum;

    const targetReal = Math.round(totalTarget * realNormRatio);
    const targetSynthetic = totalTarget - targetReal;

    // 3. Stratified sampling from each pool
    const sampledReal = DatasetSampler.sampleStratified(adaptedReal, targetReal, samplingConfig);
    const sampledSynthetic = DatasetSampler.sampleStratified(adaptedSynthetic, targetSynthetic, samplingConfig);

    // Strict ratio check if requested
    if (ratioConfig.strictRatioEnforcement) {
      if (sampledReal.length < targetReal || sampledSynthetic.length < targetSynthetic) {
        throw new Error(
          `RATIO_ENFORCEMENT_FAILED: Cannot fulfill ${ratioConfig.realRatio * 100}% real / ${ratioConfig.syntheticRatio * 100}% synthetic with available candidates (needed: ${targetReal} real, ${targetSynthetic} synth; found: ${sampledReal.length} real, ${sampledSynthetic.length} synth).`
        );
      }
    }

    // 4. Construct Splits (Train / Validation / Test)
    const testRatio = evalPolicy.testSplitRatio ?? 0.15;
    const valRatio = evalPolicy.valSplitRatio ?? 0.15;

    const train: CompositeDatasetExample[] = [];
    const validation: CompositeDatasetExample[] = [];
    const test: CompositeDatasetExample[] = [];

    if (evalPolicy.policy === "pure_real") {
      // PURE REAL EVALUATION: Test set is exclusively Real Ground Truth
      const testRealTarget = Math.max(1, Math.round(sampledReal.length * 0.4));
      const testReal = sampledReal.splice(0, testRealTarget);
      for (const ex of testReal) {
        ex.split = "test";
        test.push(ex);
      }

      // Remaining real and synthetic split between train and validation
      const allRemaining = [...sampledReal, ...sampledSynthetic];
      const valCount = Math.max(1, Math.round(allRemaining.length * valRatio));

      const valItems = allRemaining.splice(0, valCount);
      for (const ex of valItems) {
        ex.split = "validation";
        validation.push(ex);
      }

      for (const ex of allRemaining) {
        ex.split = "train";
        train.push(ex);
      }
    } else {
      // MIXED / BALANCED EVALUATION: Split real and synthetic evenly across splits
      this.distributeToSplits(sampledReal, train, validation, test, testRatio, valRatio);
      this.distributeToSplits(sampledSynthetic, train, validation, test, testRatio, valRatio);
    }

    // 5. Compute Distribution Statistics
    const allExamples = [...train, ...validation, ...test];
    const distributionStats = this.computeDistributionStats(allExamples);

    return {
      datasetId,
      datasetVersion,
      train,
      validation,
      test,
      distributionStats,
    };
  }

  private static distributeToSplits(
    items: CompositeDatasetExample[],
    train: CompositeDatasetExample[],
    val: CompositeDatasetExample[],
    test: CompositeDatasetExample[],
    testRatio: number,
    valRatio: number
  ): void {
    const testCount = Math.max(items.length >= 4 ? 1 : 0, Math.round(items.length * testRatio));
    const valCount = Math.max(items.length >= 4 ? 1 : 0, Math.round(items.length * valRatio));

    const testSlice = items.splice(0, testCount);
    for (const ex of testSlice) {
      ex.split = "test";
      test.push(ex);
    }

    const valSlice = items.splice(0, valCount);
    for (const ex of valSlice) {
      ex.split = "validation";
      val.push(ex);
    }

    for (const ex of items) {
      ex.split = "train";
      train.push(ex);
    }
  }

  private static computeDistributionStats(examples: CompositeDatasetExample[]): DatasetDistributionStats {
    const total = examples.length;
    let realCount = 0;
    let syntheticCount = 0;
    let groundTruthCount = 0;

    const byPieceCount: Record<number, number> = {};
    const byConnectionType: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};
    const byGeometryComplexity: Record<string, number> = {};
    const byAssemblyAngle: Record<number, number> = {};
    const byMaterial: Record<string, number> = {};
    const byFailureType: Record<string, number> = {};

    for (const ex of examples) {
      if (ex.origin === "REAL") realCount++;
      if (ex.origin === "SYNTHETIC") syntheticCount++;
      if (ex.isGroundTruth) groundTruthCount++;

      const dim = ex.samplingDimensions;

      byPieceCount[dim.pieceCount] = (byPieceCount[dim.pieceCount] || 0) + 1;
      byConnectionType[dim.connectionType] = (byConnectionType[dim.connectionType] || 0) + 1;
      byDifficulty[dim.difficulty] = (byDifficulty[dim.difficulty] || 0) + 1;
      byGeometryComplexity[dim.geometryComplexity] = (byGeometryComplexity[dim.geometryComplexity] || 0) + 1;
      byAssemblyAngle[dim.assemblyAngle] = (byAssemblyAngle[dim.assemblyAngle] || 0) + 1;
      byMaterial[dim.material] = (byMaterial[dim.material] || 0) + 1;
      byFailureType[dim.failureType] = (byFailureType[dim.failureType] || 0) + 1;
    }

    return {
      totalExamples: total,
      realCount,
      syntheticCount,
      actualRealRatio: total > 0 ? Number((realCount / total).toFixed(2)) : 0,
      actualSyntheticRatio: total > 0 ? Number((syntheticCount / total).toFixed(2)) : 0,
      groundTruthCount,
      byPieceCount,
      byConnectionType,
      byDifficulty,
      byGeometryComplexity,
      byAssemblyAngle,
      byMaterial,
      byFailureType,
    };
  }
}
