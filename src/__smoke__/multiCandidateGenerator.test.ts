import { describe, expect, it } from "vitest";
import { CandidateScorer, DeterministicCandidateGenerator } from "../core/puzzle/multicandidate/candidateGenerator";

describe("Multi-Candidate Design Generation System (Phase 53)", () => {
  it("1. DeterministicCandidateGenerator generates 5 distinct candidate specifications for a single requirement", async () => {
    const generator = new DeterministicCandidateGenerator();
    const comparison = await generator.generateCandidates("Create a difficult 20-piece puzzle.");

    expect(comparison.comparisonId).toBeDefined();
    expect(comparison.candidates.length).toBe(5);

    const ids = comparison.candidates.map((c) => c.candidateId);
    expect(ids).toContain("cand_A");
    expect(ids).toContain("cand_B");
    expect(ids).toContain("cand_C");
    expect(ids).toContain("cand_D");
    expect(ids).toContain("cand_E");
  });

  it("2. verifies each candidate is independently validated and scored across sub-metrics", async () => {
    const generator = new DeterministicCandidateGenerator();
    const comparison = await generator.generateCandidates("Build a 10-piece box.");

    comparison.candidates.forEach((cand) => {
      // Independent Validation Result
      expect(cand.validationResult).toBeDefined();
      expect(cand.validationResult.gateId).toBeDefined();

      // Independent Score Sub-metrics
      expect(cand.score.overallScore).toBeGreaterThanOrEqual(0.0);
      expect(cand.score.overallScore).toBeLessThanOrEqual(1.0);
      expect(cand.score.manufacturabilityScore).toBeGreaterThanOrEqual(0.0);
      expect(cand.score.assemblyFeasibilityScore).toBeGreaterThanOrEqual(0.0);
      expect(cand.score.aestheticComplexityScore).toBeGreaterThanOrEqual(0.0);
      expect(cand.score.constraintSatisfactionScore).toBeGreaterThanOrEqual(0.0);
    });
  });

  it("3. ranks candidates by overall score descending and provides a top recommendation", async () => {
    const generator = new DeterministicCandidateGenerator();
    const comparison = await generator.generateCandidates("Design a 15-piece interlocking model.");

    // Sorted descending by score
    for (let i = 0; i < comparison.candidates.length - 1; i++) {
      expect(comparison.candidates[i].score.overallScore).toBeGreaterThanOrEqual(
        comparison.candidates[i + 1].score.overallScore
      );
    }

    expect(comparison.recommendedCandidate).toBeDefined();
    expect(comparison.rankingReason).toContain("overall score");
  });

  it("4. verifies all generated candidates respect hard constraints (positive dimensions & valid thickness)", async () => {
    const generator = new DeterministicCandidateGenerator();
    const comparison = await generator.generateCandidates("Create a 6-piece puzzle.");

    comparison.candidates.forEach((cand) => {
      const spec = cand.specification;
      expect(spec.materialParameters.thicknessMm).toBeGreaterThanOrEqual(0.5);
      expect(spec.designParameters.outerBoundary.widthMm).toBeGreaterThan(0);
      expect(spec.designParameters.outerBoundary.heightMm).toBeGreaterThan(0);
      expect(spec.designParameters.pieceCount).toBeGreaterThan(0);
    });
  });
});
