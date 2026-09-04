/**
 * Stratified Dataset Sampler (Phase 64).
 *
 * Implements balanced, multi-dimensional stratified sampling across:
 *   1. piece count
 *   2. connection type
 *   3. difficulty
 *   4. geometry complexity
 *   5. assembly angle
 *   6. material
 *   7. failure type
 */
import type {
  CompositeDatasetExample,
  GeometryComplexityTier,
  StratifiedSamplingConfig,
} from "./types";

export class DatasetSampler {
  /**
   * Performs stratified sampling across one or multiple dimensions.
   */
  static sampleStratified(
    candidates: CompositeDatasetExample[],
    targetCount: number,
    config: StratifiedSamplingConfig = {}
  ): CompositeDatasetExample[] {
    if (candidates.length <= targetCount) {
      return [...candidates];
    }

    // 1. Filter by specific targets if configured
    let filtered = candidates.filter((c) => {
      const dim = c.samplingDimensions;

      if (config.targetPieceCounts && config.targetPieceCounts.length > 0) {
        if (!config.targetPieceCounts.includes(dim.pieceCount)) return false;
      }
      if (config.targetConnectionTypes && config.targetConnectionTypes.length > 0) {
        if (!config.targetConnectionTypes.includes(dim.connectionType)) return false;
      }
      if (config.targetDifficulties && config.targetDifficulties.length > 0) {
        if (!config.targetDifficulties.includes(dim.difficulty)) return false;
      }
      if (config.targetGeometryComplexities && config.targetGeometryComplexities.length > 0) {
        if (!config.targetGeometryComplexities.includes(dim.geometryComplexity)) return false;
      }
      if (config.targetAssemblyAngles && config.targetAssemblyAngles.length > 0) {
        if (!config.targetAssemblyAngles.includes(dim.assemblyAngle)) return false;
      }
      if (config.targetMaterials && config.targetMaterials.length > 0) {
        if (!config.targetMaterials.includes(dim.material)) return false;
      }
      if (config.targetFailureTypes && config.targetFailureTypes.length > 0) {
        if (!config.targetFailureTypes.includes(dim.failureType)) return false;
      }

      return true;
    });

    // Fallback to candidates if filter was overly restrictive
    if (filtered.length < targetCount) {
      filtered = candidates;
    }

    // 2. Primary stratification key selection
    // Bucket by composite stratum key: difficulty + pieceCount + connectionType
    const buckets = new Map<string, CompositeDatasetExample[]>();

    for (const item of filtered) {
      const key = `${item.samplingDimensions.difficulty}_${item.samplingDimensions.pieceCount}_${item.samplingDimensions.connectionType}`;
      const bucket = buckets.get(key) || [];
      bucket.push(item);
      buckets.set(key, bucket);
    }

    // 3. Balanced Round-Robin Sampling across buckets
    const selected: CompositeDatasetExample[] = [];
    const bucketList = Array.from(buckets.values());
    let pointer = 0;

    while (selected.length < targetCount) {
      let addedInRound = false;

      for (let i = 0; i < bucketList.length; i++) {
        const bucket = bucketList[i];
        if (bucket.length > 0) {
          selected.push(bucket.shift()!);
          addedInRound = true;
          if (selected.length === targetCount) break;
        }
      }

      if (!addedInRound) break; // All buckets exhausted
    }

    return selected;
  }

  /**
   * Partitions candidates into stratified sub-groups by a single dimension.
   */
  static groupDimension<K extends keyof CompositeDatasetExample["samplingDimensions"]>(
    examples: CompositeDatasetExample[],
    dimension: K
  ): Map<CompositeDatasetExample["samplingDimensions"][K], CompositeDatasetExample[]> {
    const groups = new Map<CompositeDatasetExample["samplingDimensions"][K], CompositeDatasetExample[]>();
    for (const ex of examples) {
      const val = ex.samplingDimensions[dimension];
      const grp = groups.get(val) || [];
      grp.push(ex);
      groups.set(val, grp);
    }
    return groups;
  }
}
