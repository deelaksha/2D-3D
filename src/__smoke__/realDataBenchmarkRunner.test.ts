import { describe, expect, it } from "vitest";
import { RealDataBenchmarkRunner } from "../core/puzzle/benchmark/realDataBenchmarkRunner";
import type { PilotDatasetSummaryReport } from "../core/puzzle/dataset/types";

describe("Real-Data Benchmark Subsystem (Step 40)", () => {
  const mockSummaryReport: PilotDatasetSummaryReport = {
    timestamp: new Date().toISOString(),
    totalExamples: 5,
    successfulImports: 5,
    failedImports: 0,
    ambiguousCases: 1,
    validationFailures: 0,
    manualCorrections: 2,
    items: [],
  };

  it("1. measures accuracy across 7 pipeline subsystems separating inferred, corrected, and ground truth", () => {
    const report = RealDataBenchmarkRunner.runBenchmark(mockSummaryReport);

    expect(report.subsystemMetrics.length).toBe(7);
    for (const m of report.subsystemMetrics) {
      expect(m.automaticallyInferredAccuracy).toBeGreaterThan(0);
      expect(m.manuallyCorrectedAccuracy).toBeGreaterThan(m.automaticallyInferredAccuracy);
      expect(m.groundTruthBaselineAccuracy).toBe(1.0);
    }
  });

  it("2. identifies Connection Inference as the weakest subsystem", () => {
    const report = RealDataBenchmarkRunner.runBenchmark(mockSummaryReport);

    expect(report.weakestSubsystemName).toBe("Connection Inference");
    const weakest = report.subsystemMetrics.find((m) => m.isWeakestSubsystem);
    expect(weakest).toBeDefined();
    expect(weakest!.subsystemName).toBe("Connection Inference");
  });

  it("3. documents recommendations for the next ML phase across 4 categories", () => {
    const report = RealDataBenchmarkRunner.runBenchmark(mockSummaryReport);

    expect(report.recommendations.whatShouldBeAutomated.length).toBeGreaterThan(0);
    expect(report.recommendations.whatShouldRemainDeterministic.length).toBeGreaterThan(0);
    expect(report.recommendations.whatNeedsHumanReview.length).toBeGreaterThan(0);
    expect(report.recommendations.whatDataIsMissing.length).toBeGreaterThan(0);
  });
});
