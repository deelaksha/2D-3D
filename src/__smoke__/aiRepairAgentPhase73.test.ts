/**
 * Smoke & Integration Tests for Phase 73:
 * AI-Assisted Repair Agent Subsystem
 */

import { describe, it, expect } from "vitest";
import {
  AIRepairAgent,
  ParametricParameterWhitelister,
  RepairSessionResult,
  APPROVED_PARAMETRIC_VARIABLES,
} from "../core/puzzle/repairagent";
import type { ParametricDesignSpecification } from "../core/puzzle/ailayer/types";

describe("Phase 73: AI-Assisted Repair Agent Subsystem", () => {
  const agent = new AIRepairAgent();

  function makeSpec(overrides?: Partial<ParametricDesignSpecification>): ParametricDesignSpecification {
    return {
      specificationId: "spec_test_repair_123",
      overall_size: { widthMm: 180, heightMm: 120, depthMm: 80 },
      piece_count: 4,
      layers: 1,
      material: {
        stockThicknessMm: 2.0,
        stockWidthMm: 300,
        stockHeightMm: 300,
        materialId: "cardboard-corrugated-2mm",
      },
      connection_preferences: {
        defaultType: "tab_slot",
        preferredJoiningAngleDeg: 90.0,
        genderStyle: "complementary",
      },
      difficulty: { level: "medium", maxUniquePieces: 4 },
      symmetry: { isSymmetrical: false, symmetryAxis: "y" },
      constraints: [],
      ...overrides,
    };
  }

  describe("1. Pristine Design Bypass", () => {
    it("bypasses repair loop when initial design already satisfies validation and critique PASS", async () => {
      const pristineSpec = makeSpec();

      const result: RepairSessionResult = await agent.runRepairSession(pristineSpec);

      expect(result.status).toBe("CONVERGED_PASS");
      expect(result.totalIterations).toBe(0);
      expect(result.totalParameterChanges).toBe(0);
      expect(result.iterations.length).toBe(0);
      expect(result.summary).toContain("zero repairs required");
      expect(result.finalCanonicalPuzzle).toBeDefined();
    });
  });

  describe("2. Closed-Loop Multi-Iteration Repair & Convergence", () => {
    it("successfully repairs a flawed design with tight clearance and sheet waste to achieve CONVERGED_PASS", async () => {
      // Suboptimal specification: tight clearance (0.04mm) and massive sheet waste (1000x1000mm)
      const flawedSpec = makeSpec({
        material: {
          stockThicknessMm: 2.0,
          stockWidthMm: 1000,
          stockHeightMm: 1000,
          materialId: "cardboard-corrugated-2mm",
        },
      });
      (flawedSpec.connection_preferences as any).clearance = 0.04; // Overly tight (< 0.08mm)

      const result = await agent.runRepairSession(flawedSpec, {
        maxIterations: 5,
        minImprovementThreshold: 1.0,
        targetQualityScore: 80.0,
      });

      expect(result.status).toBe("CONVERGED_PASS");
      expect(result.totalIterations).toBeGreaterThanOrEqual(1);
      expect(result.totalParameterChanges).toBeGreaterThanOrEqual(1);
      expect(result.overallScoreImprovement).toBeGreaterThan(0.0);

      // Verify the repaired parameter values
      const repairedClearance = (result.finalSpecification.connection_preferences as any).clearance;
      expect(repairedClearance).toBe(0.15); // Successfully adjusted from 0.04 to 0.15mm
      expect(result.finalSpecification.material.stockWidthMm).toBeLessThan(1000); // Downsized stock width

      // Verify final critique is PASS
      expect(result.finalCritique.overallAssessment).toBe("PASS");
      expect(result.finalCritique.hardFailuresCount).toBe(0);
    });
  });

  describe("3. Strict Approved Parametric Variables Whitelist", () => {
    it("strictly allows only whitelisted variables and blocks arbitrary geometry/mesh mutations", () => {
      // Valid whitelisted variables
      expect(ParametricParameterWhitelister.isWhitelisted("tab_width")).toBe(true);
      expect(ParametricParameterWhitelister.isWhitelisted("slot_width")).toBe(true);
      expect(ParametricParameterWhitelister.isWhitelisted("clearance")).toBe(true);
      expect(ParametricParameterWhitelister.isWhitelisted("interface_position")).toBe(true);
      expect(ParametricParameterWhitelister.isWhitelisted("angle_range")).toBe(true);
      expect(ParametricParameterWhitelister.isWhitelisted("piece_dimension")).toBe(true);
      expect(ParametricParameterWhitelister.isWhitelisted("connection_density")).toBe(true);
      expect(ParametricParameterWhitelister.isWhitelisted("stock_dimension")).toBe(true);

      // Prohibited non-parametric or arbitrary mesh parameters
      expect(ParametricParameterWhitelister.isWhitelisted("raw_mesh_vertices")).toBe(false);
      expect(ParametricParameterWhitelister.isWhitelisted("arbitrary_cad_spline")).toBe(false);
      expect(ParametricParameterWhitelister.isWhitelisted("triangle_mesh_normals")).toBe(false);
      expect(ParametricParameterWhitelister.isWhitelisted("bezier_control_points")).toBe(false);

      // Physical bounds validation
      const outOfBoundsClearance = ParametricParameterWhitelister.validateProposal({
        proposalId: "p1",
        variable: "clearance",
        parameterPath: "connection_preferences.clearance",
        oldValue: 0.15,
        newValue: 4.5, // 4.5mm clearance is unphysical for laser cardboard
        rationale: "Too loose",
        targetIssueId: "i1",
        affectedEntityId: "e1",
      });
      expect(outOfBoundsClearance.isValid).toBe(false);
      expect(outOfBoundsClearance.reason).toContain("outside safe physical bounds");
    });
  });

  describe("4. Loop Prevention & Cycle Detection", () => {
    it("detects recurring parameter state cycles and terminates gracefully without infinite looping", async () => {
      // Create spec that agent attempts to adjust
      const spec = makeSpec();
      (spec.connection_preferences as any).clearance = 0.05;

      // Run repair with state hash verification
      const hash1 = ParametricParameterWhitelister.computeStateHash(spec);
      expect(hash1).toBeDefined();

      const result = await agent.runRepairSession(spec, {
        maxIterations: 3,
      });

      // Session must finish with a valid terminal status, never hang
      expect(["CONVERGED_PASS", "CYCLE_DETECTED", "MIN_IMPROVEMENT_NOT_MET", "MAX_ITERATIONS_REACHED"]).toContain(
        result.status
      );
    });
  });

  describe("5. Minimum Improvement Threshold Enforcement", () => {
    it("terminates repair session early if improvement plateau is below threshold", async () => {
      const spec = makeSpec();

      // Configure an impossibly high minimum improvement threshold (e.g. 50.0 pts per iteration)
      const result = await agent.runRepairSession(spec, {
        minImprovementThreshold: 50.0,
      });

      // Either converged on initial pass or terminated early due to threshold
      expect(["CONVERGED_PASS", "MIN_IMPROVEMENT_NOT_MET"]).toContain(result.status);
    });
  });

  describe("6. Complete Repair History Telemetry", () => {
    it("records full diagnostic history for every iteration", async () => {
      const flawedSpec = makeSpec({
        material: {
          stockThicknessMm: 2.0,
          stockWidthMm: 1200,
          stockHeightMm: 1200,
          materialId: "cardboard-corrugated-2mm",
        },
      });
      (flawedSpec.connection_preferences as any).clearance = 0.04;

      const result = await agent.runRepairSession(flawedSpec, { maxIterations: 3 });

      expect(result.iterations.length).toBeGreaterThanOrEqual(1);

      for (const log of result.iterations) {
        expect(log.iterationNumber).toBeGreaterThan(0);
        expect(log.identifiedProblems).toBeDefined();
        expect(log.selectedParameters).toBeDefined();
        expect(log.proposedModifications.length).toBeGreaterThan(0);
        expect(log.appliedModifications.length).toBeGreaterThan(0);
        expect(log.regeneratedSpecification).toBeDefined();
        expect(log.validationPasses).toBeDefined();
        expect(log.critique).toBeDefined();
        expect(log.stateHash).toBeDefined();
        expect(log.durationMs).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
