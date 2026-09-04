/**
 * Smoke & Integration Tests for Phase 74:
 * Multi-Candidate AI Design Generation Subsystem
 */

import { describe, it, expect } from "vitest";
import {
  MultiCandidateGenerator,
  CandidateMetricsEvaluator,
  CandidateRanker,
  EnsembleDiversityEngine,
  type CandidateGenerationRequest,
  type DesignCandidate,
} from "../core/puzzle/candidategeneration";
import type { ParametricDesignSpecification } from "../core/puzzle/ailayer/types";

describe("Phase 74: Multi-Candidate AI Design Generation Subsystem", () => {
  const baseRequest: CandidateGenerationRequest = {
    prompt: "Design a medium interlocking 3D cardboard desk organizer with interlocking tabs",
    candidateCount: 4,
    userPreferences: {
      targetPieceCount: 4,
      targetDimensions: { widthMm: 180, heightMm: 120, depthMm: 80 },
      preferredMaterialId: "cardboard-corrugated-2mm",
      defaultJoiningAngleDeg: 90.0,
      preferredJointType: "tab_slot",
      targetDifficulty: "medium",
    },
  };

  describe("1. Configurable Candidate Count N", () => {
    it("generates exactly N candidates for configurable values of N (1, 3, 5)", async () => {
      // Test N = 1
      const res1 = await MultiCandidateGenerator.generateCandidates({
        ...baseRequest,
        candidateCount: 1,
      });
      expect(res1.candidateCountRequested).toBe(1);
      expect(res1.candidateCountGenerated).toBe(1);
      expect(res1.candidates.length).toBe(1);

      // Test N = 3
      const res3 = await MultiCandidateGenerator.generateCandidates({
        ...baseRequest,
        candidateCount: 3,
      });
      expect(res3.candidateCountRequested).toBe(3);
      expect(res3.candidateCountGenerated).toBe(3);
      expect(res3.candidates.length).toBe(3);

      // Test N = 5
      const res5 = await MultiCandidateGenerator.generateCandidates({
        ...baseRequest,
        candidateCount: 5,
      });
      expect(res5.candidateCountRequested).toBe(5);
      expect(res5.candidateCountGenerated).toBe(5);
      expect(res5.candidates.length).toBe(5);
    });
  });

  describe("2. Independent Deterministic Validation & Compilation", () => {
    it("compiles and executes 5-gate validation independently for each candidate", async () => {
      const result = await MultiCandidateGenerator.generateCandidates(baseRequest);

      expect(result.candidates.length).toBe(4);
      for (const candidate of result.candidates) {
        expect(candidate.candidateId).toBeDefined();
        expect(candidate.specification).toBeDefined();
        expect(candidate.strategy).toBeDefined();

        // 5-Gate validation breakdown
        const validity = candidate.metrics.validity;
        expect(validity.passes).toHaveProperty("schemaValidation");
        expect(validity.passes).toHaveProperty("hardConstraintValidation");
        expect(validity.passes).toHaveProperty("geometryValidation");
        expect(validity.passes).toHaveProperty("connectionValidation");
        expect(validity.passes).toHaveProperty("validation3D");

        expect(validity.gatePassCount).toBeGreaterThanOrEqual(1);
        expect(validity.gatePassRatio).toBeGreaterThan(0.0);

        if (validity.isValid) {
          expect(candidate.canonicalPuzzle).toBeDefined();
          expect(candidate.isViable).toBe(true);
        }
      }
    });
  });

  describe("3. Comprehensive 7-Metric Evaluation", () => {
    it("accurately computes all 7 required metrics for every candidate", async () => {
      const result = await MultiCandidateGenerator.generateCandidates(baseRequest);

      for (const c of result.candidates) {
        const m = c.metrics;

        // 1. Validity
        expect(typeof m.validity.isValid).toBe("boolean");
        expect(typeof m.validity.gatePassRatio).toBe("number");

        // 2. Difficulty
        expect(m.difficulty.score).toBeGreaterThanOrEqual(0);
        expect(m.difficulty.score).toBeLessThanOrEqual(100);
        expect(["easy", "medium", "hard", "expert"]).toContain(m.difficulty.level);

        // 3. Material Utilization
        expect(m.materialUtilization.score).toBeGreaterThan(0);
        expect(m.materialUtilization.sheetPackingDensityPct).toBeGreaterThan(0);
        expect(m.materialUtilization.totalPieceAreaMm2).toBeGreaterThan(0);
        expect(m.materialUtilization.stockSheetAreaMm2).toBeGreaterThan(0);

        // 4. Connection Quality
        expect(m.connectionQuality.score).toBeGreaterThanOrEqual(0);
        expect(m.connectionQuality.clearanceMm).toBeGreaterThan(0);
        expect(m.connectionQuality.jointType).toBeDefined();
        expect(["OPTIMAL", "ACCEPTABLE", "TIGHT", "LOOSE", "INVALID"]).toContain(
          m.connectionQuality.fitRating
        );

        // 5. Assembly Quality
        expect(m.assemblyQuality.score).toBeGreaterThanOrEqual(0);
        expect(typeof m.assemblyQuality.feasibilityPassed).toBe("boolean");
        expect(["HIGH", "MODERATE", "LOW"]).toContain(m.assemblyQuality.stabilityRating);

        // 6. Design Similarity
        expect(m.designSimilarity.score).toBeGreaterThan(0);
        expect(m.designSimilarity.matchingFeatures.length).toBeGreaterThan(0);

        // 7. Manufacturability
        expect(m.manufacturability.score).toBeGreaterThan(0);
        expect(m.manufacturability.stockThicknessMm).toBe(2.0);
        expect(["EXCELLENT", "GOOD", "MARGINAL", "DEFECTIVE"]).toContain(
          m.manufacturability.cutSuitabilityRating
        );

        // Composite Quality Score
        expect(m.compositeScore).toBeGreaterThan(0);
        expect(m.compositeScore).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("4. Strict Ranking Invariant: Valid ALWAYS Beats Invalid", () => {
    it("never ranks an invalid candidate above a valid candidate, even if invalid has high raw scores", () => {
      // Mock a valid candidate
      const validCandidate: DesignCandidate = {
        candidateId: "cand_valid_1",
        candidateIndex: 0,
        strategy: "Balanced Baseline",
        specification: {} as any,
        rank: 0,
        isViable: true,
        metrics: {
          validity: {
            isValid: true,
            passes: {
              schemaValidation: true,
              hardConstraintValidation: true,
              geometryValidation: true,
              connectionValidation: true,
              validation3D: true,
              overallPassed: true,
            },
            errors: [],
            warnings: [],
            gatePassCount: 5,
            gatePassRatio: 1.0,
          },
          difficulty: { score: 65, level: "medium", featureBreakdown: {} },
          materialUtilization: { score: 75, sheetPackingDensityPct: 45, totalPieceAreaMm2: 1000, stockSheetAreaMm2: 2500 },
          connectionQuality: { score: 85, clearanceMm: 0.15, jointType: "tab_slot", fitRating: "OPTIMAL" },
          assemblyQuality: { score: 85, feasibilityPassed: true, assemblySequenceSteps: 3, stabilityRating: "HIGH" },
          designSimilarity: { score: 80, requirementAlignmentScore: 80, matchingFeatures: [], deviations: [] },
          manufacturability: { score: 90, laserKerfSafe: true, minBridgeWidthMm: 4, stockThicknessMm: 2, cutSuitabilityRating: "EXCELLENT" },
          compositeScore: 78.5,
        },
      };

      // Mock an invalid candidate with high raw difficulty/similarity but failing physical validation
      const invalidCandidateHighRawScore: DesignCandidate = {
        candidateId: "cand_invalid_high_raw",
        candidateIndex: 1,
        strategy: "Hyper-Complex Extreme",
        specification: {} as any,
        rank: 0,
        isViable: false,
        metrics: {
          validity: {
            isValid: false,
            passes: {
              schemaValidation: true,
              hardConstraintValidation: true,
              geometryValidation: false, // Fails 2D geometry
              connectionValidation: true,
              validation3D: false,
              overallPassed: false,
            },
            errors: ["Invalid overlapping polygons"],
            warnings: [],
            gatePassCount: 3,
            gatePassRatio: 0.6,
          },
          difficulty: { score: 98, level: "expert", featureBreakdown: {} },
          materialUtilization: { score: 95, sheetPackingDensityPct: 85, totalPieceAreaMm2: 2000, stockSheetAreaMm2: 2300 },
          connectionQuality: { score: 90, clearanceMm: 0.15, jointType: "tab_slot", fitRating: "OPTIMAL" },
          assemblyQuality: { score: 10, feasibilityPassed: false, assemblySequenceSteps: 0, stabilityRating: "LOW" },
          designSimilarity: { score: 95, requirementAlignmentScore: 95, matchingFeatures: [], deviations: [] },
          manufacturability: { score: 90, laserKerfSafe: true, minBridgeWidthMm: 4, stockThicknessMm: 2, cutSuitabilityRating: "EXCELLENT" },
          compositeScore: 92.0, // High raw composite, but physically invalid!
        },
      };

      const anotherValidCandidate: DesignCandidate = {
        ...validCandidate,
        candidateId: "cand_valid_2",
        metrics: {
          ...validCandidate.metrics,
          compositeScore: 82.0,
        },
      };

      const { rankedCandidates, topCandidate } = CandidateRanker.rankCandidates([
        invalidCandidateHighRawScore,
        validCandidate,
        anotherValidCandidate,
      ]);

      expect(rankedCandidates.length).toBe(3);

      // Rank 1 must be valid
      expect(rankedCandidates[0].metrics.validity.isValid).toBe(true);
      expect(rankedCandidates[0].rank).toBe(1);

      // Rank 2 must be valid
      expect(rankedCandidates[1].metrics.validity.isValid).toBe(true);
      expect(rankedCandidates[1].rank).toBe(2);

      // Rank 3 must be the invalid candidate
      expect(rankedCandidates[2].metrics.validity.isValid).toBe(false);
      expect(rankedCandidates[2].candidateId).toBe("cand_invalid_high_raw");
      expect(rankedCandidates[2].rank).toBe(3);

      // Top candidate is the highest-scoring valid candidate
      expect(topCandidate).toBeDefined();
      expect(topCandidate?.candidateId).toBe("cand_valid_2");

      const invalidRanked = rankedCandidates.find((c) => !c.metrics.validity.isValid)!;
      expect(invalidRanked.rank).toBe(3);

      // Verify mathematical invariant: for all valid v and invalid inv, v.rank < inv.rank
      for (const cand of rankedCandidates) {
        if (cand.metrics.validity.isValid) {
          expect(cand.rank).toBeLessThan(invalidRanked.rank);
        }
      }
    });
  });

  describe("5. Ensemble Diversity Measurement", () => {
    it("computes pairwise diversity distances and reports ensemble diversity", async () => {
      const result = await MultiCandidateGenerator.generateCandidates({
        ...baseRequest,
        candidateCount: 4,
      });

      const diversity = result.diversityReport;
      expect(diversity.ensembleDiversityScore).toBeGreaterThan(0.0);
      expect(diversity.pairwiseDistances.length).toBe(6); // 4 choose 2 = 6 pairs
      expect(diversity.isSufficientlyDiverse).toBe(true);
      expect(diversity.duplicatePairsDetected.length).toBe(0);

      for (const pair of diversity.pairwiseDistances) {
        expect(pair.distance).toBeGreaterThanOrEqual(0.0);
        expect(pair.distance).toBeLessThanOrEqual(1.0);
        expect(pair.differences.length).toBeGreaterThan(0);
      }
    });

    it("detects identical duplicate candidates and flags non-diverse ensemble", () => {
      const identicalSpec: ParametricDesignSpecification = {
        specificationId: "spec_dup_1",
        overall_size: { widthMm: 180, heightMm: 120, depthMm: 80 },
        piece_count: 4,
        layers: 1,
        material: { stockThicknessMm: 2.0, stockWidthMm: 300, stockHeightMm: 300, materialId: "mat_1" },
        connection_preferences: { defaultType: "tab_slot", preferredJoiningAngleDeg: 90.0, genderStyle: "complementary" } as any,
        difficulty: { level: "medium", maxUniquePieces: 4 },
        symmetry: { isSymmetrical: false, symmetryAxis: "y" },
        constraints: [],
      };

      const candA: DesignCandidate = {
        candidateId: "cand_dup_A",
        candidateIndex: 0,
        strategy: "Clone 1",
        specification: identicalSpec,
        rank: 1,
        isViable: true,
        metrics: {} as any,
      };

      const candB: DesignCandidate = {
        candidateId: "cand_dup_B",
        candidateIndex: 1,
        strategy: "Clone 2",
        specification: identicalSpec,
        rank: 2,
        isViable: true,
        metrics: {} as any,
      };

      const pairDist = EnsembleDiversityEngine.computePairwiseDistance(candA, candB);
      expect(pairDist.distance).toBe(0.0);
      expect(pairDist.differences).toContain("Identical parametric specifications");

      const report = EnsembleDiversityEngine.measureEnsembleDiversity([candA, candB]);
      expect(report.ensembleDiversityScore).toBe(0.0);
      expect(report.isSufficientlyDiverse).toBe(false);
      expect(report.duplicatePairsDetected.length).toBe(1);
      expect(report.duplicatePairsDetected[0]).toEqual(["cand_dup_A", "cand_dup_B"]);
    });
  });

  describe("6. MultiCandidateGenerationResult Structure", () => {
    it("returns complete result summary and telemetry", async () => {
      const result = await MultiCandidateGenerator.generateCandidates(baseRequest);

      expect(result.runId).toBeDefined();
      expect(result.prompt).toBe(baseRequest.prompt);
      expect(result.candidateCountRequested).toBe(4);
      expect(result.candidateCountGenerated).toBe(4);
      expect(result.validCandidateCount + result.invalidCandidateCount).toBe(4);
      expect(result.rankingCriteria.length).toBeGreaterThan(0);
      expect(result.processingDurationMs).toBeGreaterThanOrEqual(0);

      // Top candidate is defined and is rank 1
      if (result.validCandidateCount > 0) {
        expect(result.topCandidate).toBeDefined();
        expect(result.topCandidate?.rank).toBe(1);
        expect(result.topCandidate?.metrics.validity.isValid).toBe(true);
      }
    });
  });
});
