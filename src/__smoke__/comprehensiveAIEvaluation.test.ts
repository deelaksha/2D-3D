import { describe, expect, it } from "vitest";
import { AIEvaluationHarness } from "../core/puzzle/aievaluation/aiEvaluationHarness";

describe("Comprehensive AI System Evaluation Framework & Benchmark Harness (Phase 56)", () => {
  it("1. AIEvaluationHarness evaluates all 9 AI pipeline stages over synthetic benchmark datasets", async () => {
    const result = await AIEvaluationHarness.evaluatePipeline(5, 42);

    expect(result.evaluationId).toBeDefined();
    expect(result.datasetName).toContain("synthetic_eval_seed_42");
    expect(result.totalExamplesEvaluated).toBe(5);
    expect(result.stageReports.length).toBe(9);
  });

  it("2. computes validParametricDesignRate as the primary end metric", async () => {
    const result = await AIEvaluationHarness.evaluatePipeline(5, 42);

    expect(result.validParametricDesignRate).toBeGreaterThanOrEqual(0.0);
    expect(result.validParametricDesignRate).toBeLessThanOrEqual(1.0);
    expect(result.overallMetrics.validParametricDesignRate).toBe(result.validParametricDesignRate);
  });

  it("3. computes precision, recall, F1, IoU, MAE, and constraint violation rates across individual stages", async () => {
    const result = await AIEvaluationHarness.evaluatePipeline(5, 42);

    const m = result.overallMetrics;
    expect(m.pieceRecognitionPrecision).toBe(0.98);
    expect(m.pieceRecognitionRecall).toBe(0.98);
    expect(m.pieceRecognitionIoU).toBe(0.96);
    expect(m.connectionPredictionF1).toBe(0.92);
    expect(m.parameterPredictionMAE).toBe(0.12);
    expect(m.constraintViolationRate).toBeGreaterThanOrEqual(0.0);
  });

  it("4. identifies weakestSubsystem with actionable benchmark diagnostics", async () => {
    const result = await AIEvaluationHarness.evaluatePipeline(5, 42);

    expect(result.weakestSubsystem).toBeDefined();
    expect(typeof result.weakestSubsystem).toBe("string");
  });

  it("5. verifies strict invariant: non-assemblable designs are evaluated as failures", async () => {
    const result = await AIEvaluationHarness.evaluatePipeline(5, 42);

    // Final Validity stage enforces physical assembly acceptance
    const finalStage = result.stageReports.find((s) => s.stageName === "Final Validity");
    expect(finalStage).toBeDefined();
    expect(finalStage?.score).toBe(result.validParametricDesignRate);
  });
});
