/**
 * Smoke & Integration Tests for Phase 77:
 * AI Puzzle-Design System Benchmark Subsystem
 */

import { describe, it, expect } from "vitest";
import {
  SystemBenchmarkRunner,
  BENCHMARK_TEST_SUITE,
  type BenchmarkTestCase,
  type ComparativeBenchmarkReport,
} from "../core/puzzle/systembenchmark";

describe("Phase 77: AI Puzzle-Design System Benchmark Subsystem", () => {
  // Use a targeted subset of test cases for fast, deterministic smoke test execution
  const smokeSubset: BenchmarkTestCase[] = [
    BENCHMARK_TEST_SUITE[0], // Standard desk organizer
    BENCHMARK_TEST_SUITE[1], // Minimalist phone stand
    BENCHMARK_TEST_SUITE[3], // Tight-tolerance challenge (stress test)
  ];

  describe("1. Benchmark Test Suite Integrity", () => {
    it("provides a standardized 8-case suite covering standard, stress, and multi-angle scenarios", () => {
      expect(BENCHMARK_TEST_SUITE.length).toBe(8);

      for (const tc of BENCHMARK_TEST_SUITE) {
        expect(tc.id).toBeDefined();
        expect(tc.name).toBeDefined();
        expect(tc.prompt.length).toBeGreaterThan(15);
        expect(tc.category).toBeDefined();
        expect(tc.tags.length).toBeGreaterThan(0);
        expect(tc.userPreferences?.targetPieceCount).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe("2. System Benchmark Execution across Configurations", () => {
    it("runs deterministic baseline and captures primary metrics without artificial optimization", async () => {
      const baselineReport = await SystemBenchmarkRunner.runSystemBenchmark(
        "DETERMINISTIC_BASELINE",
        smokeSubset
      );

      expect(baselineReport.systemConfig).toBe("DETERMINISTIC_BASELINE");
      expect(baselineReport.testCaseCount).toBe(3);

      const m = baselineReport.metrics;
      // Primary Metrics
      expect(m.validDesignRate).toBeGreaterThanOrEqual(0.0);
      expect(m.validDesignRate).toBeLessThanOrEqual(1.0);
      expect(m.physicallyAssemblableRate).toBeGreaterThanOrEqual(0.0);
      expect(m.repairSuccessRate).toBe(0.0); // Baseline has no repair loop

      // Secondary metrics & latency
      expect(m.averageLatencyMs).toBeGreaterThanOrEqual(0);
      expect(m.averageParameterErrorPct).toBeGreaterThan(0);

      // All 12 domain scores populated
      expect(Object.keys(m.domainScores).length).toBe(12);
      expect(m.domainScores.requirementParsing).toBeGreaterThan(0);
      expect(m.domainScores.manufacturability).toBeGreaterThan(0);
    });

    it("runs AI-assisted configuration with multi-candidate diversity", async () => {
      const aiReport = await SystemBenchmarkRunner.runSystemBenchmark(
        "AI_ASSISTED",
        smokeSubset
      );

      expect(aiReport.systemConfig).toBe("AI_ASSISTED");
      const m = aiReport.metrics;

      expect(m.validDesignRate).toBeGreaterThanOrEqual(0.66);
      expect(m.domainScores.candidateDiversity).toBeGreaterThan(0);
      expect(m.totalCandidatesEvaluated).toBe(9); // 3 candidates x 3 test cases
    });

    it("runs AI + Optimization loop achieving top validity, assembly rate, and repair success", async () => {
      const optReport = await SystemBenchmarkRunner.runSystemBenchmark(
        "AI_OPTIMIZATION",
        smokeSubset
      );

      expect(optReport.systemConfig).toBe("AI_OPTIMIZATION");
      const m = optReport.metrics;

      // Primary metrics
      expect(m.validDesignRate).toBe(1.0); // 100% valid designs
      expect(m.physicallyAssemblableRate).toBe(1.0); // 100% physically assemblable
      expect(m.repairSuccessRate).toBeGreaterThan(0.0); // Closed-loop repair active

      // Superior benchmark score
      expect(m.overallBenchmarkScore).toBeGreaterThan(80.0);
      expect(m.domainScores.repairSuccess).toBeGreaterThan(80.0);
      expect(m.domainScores.parametricCorrectness).toBeGreaterThan(90.0);
    });
  });

  describe("3. Tri-System Comparative Benchmark & Progression", () => {
    it("executes complete comparative benchmark, verifies architectural progression, and generates reproducible reports", async () => {
      const compReport: ComparativeBenchmarkReport =
        await SystemBenchmarkRunner.runComparativeBenchmark(smokeSubset);

      expect(compReport.reportId).toBeDefined();
      expect(compReport.testSuiteSize).toBe(3);

      const summary = compReport.comparativeSummary;
      const baseScore = summary.overallScoreComparison.DETERMINISTIC_BASELINE;
      const aiScore = summary.overallScoreComparison.AI_ASSISTED;
      const optScore = summary.overallScoreComparison.AI_OPTIMIZATION;

      // Progression Invariant: AI + Optimization >= AI-Assisted >= Deterministic Baseline
      expect(optScore).toBeGreaterThan(aiScore);
      expect(aiScore).toBeGreaterThan(baseScore);

      // Primary Metrics Comparison
      expect(summary.validDesignRateComparison.AI_OPTIMIZATION).toBeGreaterThanOrEqual(
        summary.validDesignRateComparison.DETERMINISTIC_BASELINE
      );
      expect(summary.repairSuccessRateComparison.AI_OPTIMIZATION).toBeGreaterThan(
        summary.repairSuccessRateComparison.DETERMINISTIC_BASELINE
      );

      // Reproducible Markdown Report Generation
      expect(compReport.markdownReport).toContain("AI Puzzle-Design System Benchmark Report");
      expect(compReport.markdownReport).toContain("Executive Summary: Primary Metrics");
      expect(compReport.markdownReport).toContain("The 12 Benchmark Domains Breakdown");
      expect(compReport.markdownReport).toContain("VALID DESIGN RATE");
      expect(compReport.markdownReport).toContain("PHYSICALLY ASSEMBLABLE RATE");
      expect(compReport.markdownReport).toContain("REPAIR SUCCESS RATE");
    });
  });
});
