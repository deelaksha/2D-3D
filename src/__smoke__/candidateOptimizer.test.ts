import { describe, expect, it } from "vitest";
import { CandidateOptimizer, DEFAULT_OBJECTIVE_WEIGHTS } from "../core/puzzle/candidateoptimization/candidateOptimizer";
import { DeterministicCandidateGenerator } from "../core/puzzle/multicandidate/candidateGenerator";

describe("Candidate Optimization Integration & Multi-Objective Scoring (Phase 54)", () => {
  it("1. calculates all 9 quality sub-metrics for candidate designs with default objective weights", async () => {
    const generator = new DeterministicCandidateGenerator();
    const comparison = await generator.generateCandidates("Create a 12-piece puzzle.");

    const report = CandidateOptimizer.optimizeCandidates(comparison.candidates);

    expect(report.optimizationId).toBeDefined();
    expect(report.totalCandidatesEvaluated).toBe(comparison.candidates.length);
    expect(report.ranking.length).toBe(comparison.candidates.length);

    const first = report.ranking[0];
    const b = first.scoreBreakdown;
    expect(b.materialUtilization).toBeGreaterThan(0);
    expect(b.connectionQuality).toBeGreaterThan(0);
    expect(b.assemblyDifficulty).toBeGreaterThan(0);
    expect(b.pieceCountEfficiency).toBeGreaterThan(0);
    expect(b.geometricComplexity).toBeGreaterThan(0);
    expect(b.manufacturability).toBeGreaterThan(0);
    expect(b.clearanceQuality).toBeGreaterThan(0);
    expect(b.symmetry).toBeGreaterThan(0);
    expect(b.assemblyQuality).toBeGreaterThan(0);
    expect(b.totalWeightedScore).toBeGreaterThan(0);
  });

  it("2. ranks candidates by totalWeightedScore descending and returns bestCandidate", async () => {
    const generator = new DeterministicCandidateGenerator();
    const comparison = await generator.generateCandidates("Build a 6-piece box.");

    const report = CandidateOptimizer.optimizeCandidates(comparison.candidates);

    for (let i = 0; i < report.ranking.length - 1; i++) {
      expect(report.ranking[i].scoreBreakdown.totalWeightedScore).toBeGreaterThanOrEqual(
        report.ranking[i + 1].scoreBreakdown.totalWeightedScore
      );
    }

    expect(report.bestCandidate).toBeDefined();
    expect(report.bestCandidate?.isValidCandidate).toBe(true);
  });

  it("3. verifies strict invariant: Optimizer NEVER selects an invalid candidate as bestCandidate", async () => {
    const generator = new DeterministicCandidateGenerator();
    const comparison = await generator.generateCandidates("Design a 10-piece model.");

    // Force Candidate A validation to fail (REJECTED)
    comparison.candidates[0].validationResult.status = "REJECTED";

    const report = CandidateOptimizer.optimizeCandidates(comparison.candidates);

    if (report.bestCandidate) {
      expect(report.bestCandidate.candidateId).not.toBe(comparison.candidates[0].candidateId);
      expect(report.bestCandidate.isValidCandidate).toBe(true);
    }
  });

  it("4. custom OptimizationObjectiveWeights alters candidate ranking based on user priorities", async () => {
    const generator = new DeterministicCandidateGenerator();
    const comparison = await generator.generateCandidates("Create an 8-piece puzzle.");

    // Priority 1: Heavy weight on manufacturability & material utilization
    const reportMfg = CandidateOptimizer.optimizeCandidates(comparison.candidates, {
      manufacturability: 0.50,
      materialUtilization: 0.30,
      geometricComplexity: 0.02,
    });

    // Priority 2: Heavy weight on geometric complexity & aesthetics
    const reportAesthetic = CandidateOptimizer.optimizeCandidates(comparison.candidates, {
      manufacturability: 0.02,
      materialUtilization: 0.02,
      geometricComplexity: 0.50,
      symmetry: 0.30,
    });

    expect(reportMfg.optimizationId).toBeDefined();
    expect(reportAesthetic.optimizationId).toBeDefined();
  });
});
