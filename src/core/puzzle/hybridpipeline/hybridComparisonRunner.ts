/**
 * Hybrid Comparison & Benchmark Runner (Phase 59).
 * Compares side-by-side performance: ML Enabled vs ML Disabled.
 */
import type { HybridComparisonReport } from "./types";
import { HybridPipelineEngine } from "./hybridPipelineEngine";

export class HybridComparisonRunner {
  /**
   * Compares pipeline execution with ML Enabled vs ML Disabled for a user prompt.
   */
  static async compareModes(userPrompt: string): Promise<HybridComparisonReport> {
    const comparisonId = `comp_${Date.now()}`;

    // 1. Run ML Enabled
    const mlEnabledResult = await HybridPipelineEngine.executePipeline({
      rawPrompt: userPrompt,
      featureFlags: { enableMLConnectionClassifier: true },
    });

    // 2. Run ML Disabled
    const mlDisabledResult = await HybridPipelineEngine.executePipeline({
      rawPrompt: userPrompt,
      featureFlags: { enableMLConnectionClassifier: false },
    });

    const speedupMultiplier = mlDisabledResult.processingDurationMs > 0
      ? Number((mlDisabledResult.processingDurationMs / Math.max(1, mlEnabledResult.processingDurationMs)).toFixed(2))
      : 1.0;

    const fallbackCount = mlEnabledResult.stageExecutions.filter(
      (s) => s.executionMode === "DETERMINISTIC_FALLBACK"
    ).length;

    return {
      comparisonId,
      mlEnabledResult,
      mlDisabledResult,
      speedupMultiplier,
      accuracyDelta: 0.0,
      fallbackCount,
    };
  }
}
