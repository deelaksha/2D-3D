/**
 * Smoke & Integration Tests for Phase 75:
 * Complete AI + Optimization Loop Subsystem
 */

import { describe, it, expect } from "vitest";
import {
  AIOptimizationLoop,
  ParametricSoftOptimizer,
  type OptimizationLoopRequest,
} from "../core/puzzle/aioptimizationloop";
import type { ParametricDesignSpecification } from "../core/puzzle/ailayer/types";

describe("Phase 75: Complete AI + Optimization Loop Subsystem", () => {
  const baseRequest: OptimizationLoopRequest = {
    prompt: "Design a 4-piece interlocking cardboard desk storage puzzle with sturdy tab-slot joints",
    candidateCount: 3,
    userPreferences: {
      targetPieceCount: 4,
      targetDimensions: { widthMm: 180, heightMm: 120, depthMm: 80 },
      preferredMaterialId: "cardboard-corrugated-2mm",
      defaultJoiningAngleDeg: 90.0,
      preferredJointType: "tab_slot",
      targetDifficulty: "medium",
    },
    config: {
      enableParametricOptimization: true,
      maxRepairIterationsPerCandidate: 2,
    },
  };

  describe("1. Complete 10-Stage Pipeline Execution", () => {
    it("runs the full AI + optimization loop through all 10 stages and selects the best valid design", async () => {
      const result = await AIOptimizationLoop.runOptimizationLoop(baseRequest);

      expect(result.runId).toBeDefined();
      expect(result.prompt).toBe(baseRequest.prompt);
      expect(result.bestDesign).toBeDefined();
      expect(result.bestDesign?.rank).toBe(1);
      expect(result.bestDesign?.isViable).toBe(true);
      expect(result.bestDesign?.canonicalPuzzle).toBeDefined();

      // Check all 10 pipeline stages in the trace
      const stageNames = result.trace.stages.map((s) => s.stage);
      expect(stageNames).toContain("REQUIREMENT_PARSING");
      expect(stageNames).toContain("AI_PLANNING");
      expect(stageNames).toContain("CANDIDATE_GENERATION");
      expect(stageNames).toContain("GEOMETRY_COMPILATION");
      expect(stageNames).toContain("DETERMINISTIC_VALIDATION");
      expect(stageNames).toContain("AI_CRITIQUE");
      expect(stageNames).toContain("REPAIR_STAGE");
      expect(stageNames).toContain("PARAMETRIC_OPTIMIZATION");
      expect(stageNames).toContain("RE_EVALUATION");
      expect(stageNames).toContain("CANDIDATE_RANKING");
      expect(stageNames).toContain("BEST_DESIGN_SELECTION");

      expect(result.trace.totalDurationMs).toBeGreaterThan(0);
      expect(result.summary).toContain("Selected");
    });
  });

  describe("2. Parametric Variables Only (No Raw Mesh Mutation)", () => {
    it("strictly modifies only approved parametric variables and never raw mesh geometry", async () => {
      const result = await AIOptimizationLoop.runOptimizationLoop(baseRequest);

      const approvedParametricVars = [
        "stock_width",
        "stock_height",
        "clearance",
        "bounding_width",
        "tab_width",
        "slot_width",
      ];

      for (const candTrace of result.trace.candidateTraces) {
        for (const mod of candTrace.modifications) {
          expect(approvedParametricVars).toContain(mod.variable);
          expect(mod.rationale).toBeDefined();
          expect(["REPAIR", "OPTIMIZATION"]).toContain(mod.stage);
        }
      }
    });

    it("optimizes soft objectives directly on parametric variables", () => {
      const initialSpec: ParametricDesignSpecification = {
        specificationId: "spec_test_opt_1",
        overall_size: { widthMm: 180, heightMm: 120, depthMm: 80 },
        piece_count: 4,
        layers: 1,
        material: {
          stockThicknessMm: 2.0,
          stockWidthMm: 800, // Excessively large sheet (low packing density)
          stockHeightMm: 800,
          materialId: "cardboard-corrugated-2mm",
        },
        connection_preferences: {
          defaultType: "tab_slot",
          preferredJoiningAngleDeg: 90.0,
          genderStyle: "complementary",
          clearance: 0.11, // Suboptimal clearance (< 0.15mm)
        } as any,
        difficulty: { level: "medium", maxUniquePieces: 4 },
        symmetry: { isSymmetrical: false, symmetryAxis: "y" },
        constraints: [],
      };

      const { optimizedSpec, modifications } =
        ParametricSoftOptimizer.optimizeSoftObjectives(initialSpec);

      // Stock sheet downsized
      expect(optimizedSpec.material.stockWidthMm).toBeLessThan(800);
      expect(optimizedSpec.material.stockHeightMm).toBeLessThan(800);

      // Clearance centered toward 0.15mm
      expect((optimizedSpec.connection_preferences as any).clearance).toBe(0.15);

      // Modifications tracked
      expect(modifications.length).toBeGreaterThanOrEqual(2);
      const modVars = modifications.map((m) => m.variable);
      expect(modVars).toContain("stock_width");
      expect(modVars).toContain("stock_height");
      expect(modVars).toContain("clearance");
    });
  });

  describe("3. Hard Constraints Are Non-Negotiable", () => {
    it("preserves hard constraints and never reduces stock size below physical containment bounds", () => {
      const compactSpec: ParametricDesignSpecification = {
        specificationId: "spec_test_hard_1",
        overall_size: { widthMm: 200, heightMm: 150, depthMm: 100 },
        piece_count: 4,
        layers: 1,
        material: {
          stockThicknessMm: 2.0,
          stockWidthMm: 250, // Already tight stock sheet (width 200 * 1.25 = 250)
          stockHeightMm: 190, // Already tight stock sheet (height 150 * 1.25 = 188)
          materialId: "cardboard-corrugated-2mm",
        },
        connection_preferences: {
          defaultType: "tab_slot",
          preferredJoiningAngleDeg: 90.0,
          genderStyle: "complementary",
          clearance: 0.15, // Already optimal
        } as any,
        difficulty: { level: "medium", maxUniquePieces: 4 },
        symmetry: { isSymmetrical: false, symmetryAxis: "y" },
        constraints: [],
      };

      const { optimizedSpec } = ParametricSoftOptimizer.optimizeSoftObjectives(compactSpec);

      // Hard constraint: stock sheet must never shrink below piece bounding size
      expect(optimizedSpec.material.stockWidthMm).toBeGreaterThanOrEqual(
        compactSpec.overall_size.widthMm
      );
      expect(optimizedSpec.material.stockHeightMm).toBeGreaterThanOrEqual(
        compactSpec.overall_size.heightMm
      );
    });
  });

  describe("4. Granular ScoreBreakdown and ReasonForSelection", () => {
    it("returns comprehensive ScoreBreakdown and multi-factor ReasonForSelection", async () => {
      const result = await AIOptimizationLoop.runOptimizationLoop(baseRequest);

      const sb = result.scoreBreakdown;
      expect(sb).toBeDefined();
      expect(sb?.compositeScore).toBeGreaterThan(0);
      expect(sb?.validityPassRatio).toBe(1.0); // Best valid design passed all 5 gates
      expect(sb?.difficultyScore).toBeGreaterThan(0);
      expect(sb?.materialUtilizationScore).toBeGreaterThan(0);
      expect(sb?.connectionQualityScore).toBeGreaterThan(0);
      expect(sb?.assemblyQualityScore).toBeGreaterThan(0);
      expect(sb?.designSimilarityScore).toBeGreaterThan(0);
      expect(sb?.manufacturabilityScore).toBeGreaterThan(0);

      // Soft objective metrics
      expect(sb?.softObjectiveOptimizations.sheetPackingDensityPct).toBeGreaterThan(0);
      expect(sb?.softObjectiveOptimizations.clearanceCenteringMm).toBe(0.15);
      expect(sb?.softObjectiveOptimizations.aspectRatioBalance).toBeGreaterThan(0);

      // Reason for Selection
      expect(result.reasonForSelection).toContain("Best Valid Design");
      expect(result.reasonForSelection).toContain("Validity Invariant");
      expect(result.reasonForSelection).toContain("Top Composite Score");
      expect(result.reasonForSelection).toContain("Material Efficiency");
      expect(result.reasonForSelection).toContain("Joint Quality");
    });
  });

  describe("5. Invariant Ranking Maintained Across Ensemble", () => {
    it("ensures allRankedCandidates preserves the valid-over-invalid priority invariant", async () => {
      const result = await AIOptimizationLoop.runOptimizationLoop({
        ...baseRequest,
        candidateCount: 4,
      });

      expect(result.allRankedCandidates.length).toBe(4);

      let seenInvalid = false;
      for (const cand of result.allRankedCandidates) {
        if (!cand.metrics.validity.isValid) {
          seenInvalid = true;
        } else if (seenInvalid) {
          // A valid candidate should NEVER appear after an invalid candidate!
          expect(cand.metrics.validity.isValid).toBe(false);
        }
      }
    });
  });
});
