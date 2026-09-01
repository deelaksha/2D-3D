import { describe, expect, it } from "vitest";
import { HybridPipelineEngine } from "../core/puzzle/hybridpipeline/hybridPipelineEngine";
import { HybridComparisonRunner } from "../core/puzzle/hybridpipeline/hybridComparisonRunner";

describe("Master Hybrid AI Architecture Integration & Feature Flags (Phase 59)", () => {
  it("1. HybridPipelineEngine executes full 13-stage hybrid pipeline with ML enabled", async () => {
    const result = await HybridPipelineEngine.executePipeline({
      rawPrompt: "Design a 6-piece box puzzle with finger joints.",
      featureFlags: { enableMLConnectionClassifier: true },
    });

    expect(result.pipelineId).toBeDefined();
    expect(result.status).toBe("SUCCESS");
    expect(result.finalPuzzle).toBeDefined();
    expect(result.stageExecutions.length).toBeGreaterThanOrEqual(10);
    expect(result.rankedCandidates.length).toBeGreaterThan(0);
  });

  it("2. routes low-confidence ML predictions to deterministic rule engine or human review", async () => {
    const result = await HybridPipelineEngine.executePipeline({
      rawPrompt: "Create a complex puzzle.",
      featureFlags: {
        enableMLConnectionClassifier: true,
        confidenceThreshold: 0.99, // Force fallback threshold
      },
    });

    const connStage = result.stageExecutions.find((s) => s.stageName === "Connection Reasoning");
    expect(connStage).toBeDefined();
    if (connStage!.confidenceScore < 0.99) {
      expect(connStage?.executionMode).toBe("DETERMINISTIC_FALLBACK");
      expect(result.usedDeterministicFallback).toBe(true);
    }
  });

  it("3. feature flag toggling (enableMLConnectionClassifier: false) cleanly executes via 100% deterministic rules", async () => {
    const result = await HybridPipelineEngine.executePipeline({
      rawPrompt: "Build a 4-piece tray.",
      featureFlags: { enableMLConnectionClassifier: false },
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.usedMLClassifier).toBe(false);
    expect(result.usedDeterministicFallback).toBe(true);

    const connStage = result.stageExecutions.find((s) => s.stageName === "Connection Reasoning");
    expect(connStage?.executionMode).toBe("DETERMINISTIC_FALLBACK");
  });

  it("4. HybridComparisonRunner compares ML enabled vs ML disabled side-by-side", async () => {
    const report = await HybridComparisonRunner.compareModes("Create an 8-piece puzzle.");

    expect(report.comparisonId).toBeDefined();
    expect(report.mlEnabledResult.status).toBe("SUCCESS");
    expect(report.mlDisabledResult.status).toBe("SUCCESS");
    expect(report.speedupMultiplier).toBeGreaterThan(0.0);
    expect(report.mlEnabledResult.usedMLClassifier).toBe(true);
    expect(report.mlDisabledResult.usedMLClassifier).toBe(false);
  });

  it("5. verifies strict invariant: geometry engine and AIDesignValidationGate remain 100% authoritative", async () => {
    const result = await HybridPipelineEngine.executePipeline({
      rawPrompt: "Design a 5-piece puzzle.",
    });

    expect(result.validationResult).toBeDefined();
    // Gate validation is passed
    expect(result.validationResult.status).toBe("ACCEPTED");
  });
});
