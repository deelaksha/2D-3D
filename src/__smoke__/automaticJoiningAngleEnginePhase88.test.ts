import { describe, expect, it } from "vitest";
import {
  AutomaticJoiningAngleEngine,
  evaluateConnectionAngles,
  evaluatePuzzleJoiningAngles,
  generateCandidateAngles,
  getConnectorAngleRange,
  validateCandidateAngle,
  evaluateCandidates,
} from "../core/puzzle/anglegeneration";
import type {
  AngleGenerationRequest,
  ValidAngleCandidates,
} from "../core/puzzle/anglegeneration";
import { quatFromAxisAngle, vec3 } from "../core/puzzle/geometry/math3d";
import type { CoordinateFrame3D } from "../core/puzzle/framesystem/types";
import { Automatic2DGenerationEngine } from "../core/puzzle/automatic2d";
import { Piece3DConversionEngine } from "../core/puzzle/piece3d";

describe("Phase 88: Automatic Joining-Angle Generation System", () => {
  // Common test interface frames
  const frameA: CoordinateFrame3D = {
    origin: vec3(50, 0, 0),
    xAxis: vec3(1, 0, 0),
    yAxis: vec3(0, 1, 0),
    zAxis: vec3(0, 0, 1),
  };

  const frameB: CoordinateFrame3D = {
    origin: vec3(0, 0, 0),
    xAxis: vec3(-1, 0, 0),
    yAxis: vec3(0, 1, 0),
    zAxis: vec3(0, 0, 1),
  };

  const testPieceA = {
    pieceId: "P01",
    dimensions: { width: 50, height: 40, thickness: 3 },
    interfaceFrame: frameA,
  };

  const testPieceB = {
    pieceId: "P02",
    dimensions: { width: 50, height: 40, thickness: 3 },
    interfaceFrame: frameB,
  };

  describe("Candidate Angle Generation", () => {
    it("generates discrete candidate angles based on connector type", () => {
      // Tab-slot connector default candidate range
      const tabSlotCandidates = generateCandidateAngles("tab_slot");
      expect(tabSlotCandidates).toContain(0);
      expect(tabSlotCandidates).toContain(15);
      expect(tabSlotCandidates).toContain(30);
      expect(tabSlotCandidates).toContain(45);
      expect(tabSlotCandidates).toContain(60);
      expect(tabSlotCandidates).toContain(90);
      expect(tabSlotCandidates).toContain(180);

      // Notch connector test angles
      const notchCandidates = generateCandidateAngles("notch");
      expect(notchCandidates).toContain(90);

      // Hinge connector sampled with custom step
      const hingeCandidates = generateCandidateAngles("hinge", { angleStepDeg: 30 });
      expect(hingeCandidates).toEqual([0, 30, 60, 90, 120, 150, 180]);

      // Custom discrete candidate angles
      const customCandidates = generateCandidateAngles("tab_slot", {
        customCandidates: [0, 15, 30, 45, 60, 90],
      });
      expect(customCandidates).toEqual([0, 15, 30, 45, 60, 90]);
    });

    it("provides canonical angle ranges for connector types", () => {
      expect(getConnectorAngleRange("notch")).toEqual({ min: 90, max: 90, step: 0 });
      expect(getConnectorAngleRange("hinge")).toEqual({ min: 0, max: 180, step: 15 });
      expect(getConnectorAngleRange("rotational")).toEqual({ min: 0, max: 360, step: 15 });
    });
  });

  describe("Validation of Candidates (0°, 15°, 30°, 45°, 60°, 90°)", () => {
    it("evaluates C01 candidates and removes invalid angles with specific reasons", () => {
      const request: AngleGenerationRequest = {
        pieceA: testPieceA,
        pieceB: testPieceB,
        connection: {
          connectionId: "C01",
          connectorType: "tab_slot",
          clearanceMm: 0.15,
        },
        options: {
          customCandidates: [0, 15, 30, 45, 60, 90],
        },
      };

      const result: ValidAngleCandidates = evaluateConnectionAngles(request);

      expect(result.connectionId).toBe("C01");
      expect(result.allCandidates).toHaveLength(6);

      // 0° candidate must be rejected due to collision (direct backface fold-back overlap)
      const eval0 = result.allCandidates.find((c) => c.angleDeg === 0)!;
      expect(eval0.mathematicallyPossible).toBe(true);
      expect(eval0.geometricallyValid).toBe(false);
      expect(eval0.isValid).toBe(false);
      expect(eval0.rejectionReason).toBe("collision");

      // 15° candidate must be rejected due to impossible_insertion (trajectory interference)
      const eval15 = result.allCandidates.find((c) => c.angleDeg === 15)!;
      expect(eval15.mathematicallyPossible).toBe(true);
      expect(eval15.geometricallyValid).toBe(true);
      expect(eval15.physicallyAssemblable).toBe(false);
      expect(eval15.isValid).toBe(false);
      expect(eval15.rejectionReason).toBe("impossible_insertion");

      // 30°, 45°, 60°, 90° must be completely valid across all 3 tiers
      for (const validAngle of [30, 45, 60, 90]) {
        const evalAngle = result.allCandidates.find((c) => c.angleDeg === validAngle)!;
        expect(evalAngle.mathematicallyPossible).toBe(true);
        expect(evalAngle.geometricallyValid).toBe(true);
        expect(evalAngle.physicallyAssemblable).toBe(true);
        expect(evalAngle.isValid).toBe(true);
        expect(evalAngle.rejectionReason).toBeUndefined();
      }

      // Valid angles output
      expect(result.validAngles).toEqual([30, 45, 60, 90]);

      // Rejected angles list with reasons
      expect(result.rejectedAngles).toHaveLength(2);
      expect(result.rejectedAngles).toContainEqual({
        angleDeg: 0,
        reason: "collision",
        details: expect.stringContaining("collision"),
      });
      expect(result.rejectedAngles).toContainEqual({
        angleDeg: 15,
        reason: "impossible_insertion",
        details: expect.stringContaining("Linear insertion blocked"),
      });
    });
  });

  describe("Three-Tier Distinction", () => {
    it("explicitly distinguishes mathematically possible, geometrically valid, and physically assemblable", () => {
      const request: AngleGenerationRequest = {
        pieceA: testPieceA,
        pieceB: testPieceB,
        connection: {
          connectionId: "C_TIERS",
          connectorType: "tab_slot",
          clearanceMm: 0.15,
        },
        options: {
          customCandidates: [0, 15, 45],
        },
      };

      const result = evaluateConnectionAngles(request);

      // Tier 1: Mathematically possible includes 0, 15, 45
      expect(result.mathematicallyPossibleAngles).toContain(0);
      expect(result.mathematicallyPossibleAngles).toContain(15);
      expect(result.mathematicallyPossibleAngles).toContain(45);

      // Tier 2: Geometrically valid excludes 0° (collision)
      expect(result.geometricallyValidAngles).not.toContain(0);
      expect(result.geometricallyValidAngles).toContain(15);
      expect(result.geometricallyValidAngles).toContain(45);

      // Tier 3: Physically assemblable excludes 15° (insertion blocked)
      expect(result.physicallyAssemblableAngles).not.toContain(0);
      expect(result.physicallyAssemblableAngles).not.toContain(15);
      expect(result.physicallyAssemblableAngles).toContain(45);

      // Final valid angles: only 45°
      expect(result.validAngles).toEqual([45]);
    });
  });

  describe("Explicit Rejection Reasons", () => {
    it("rejects invalid_geometry for notch joints at non-90° angles", () => {
      const request: AngleGenerationRequest = {
        pieceA: testPieceA,
        pieceB: testPieceB,
        connection: {
          connectionId: "C_NOTCH",
          connectorType: "notch",
          clearanceMm: 0.15,
        },
        options: {
          customCandidates: [45, 60, 90],
        },
      };

      const result = evaluateConnectionAngles(request);

      const eval45 = result.allCandidates.find((c) => c.angleDeg === 45)!;
      expect(eval45.mathematicallyPossible).toBe(false);
      expect(eval45.rejectionReason).toBe("invalid_geometry");

      const eval90 = result.allCandidates.find((c) => c.angleDeg === 90)!;
      expect(eval90.isValid).toBe(true);

      expect(result.validAngles).toEqual([90]);
      expect(result.recommendedAngle).toBe(90);
    });

    it("rejects insufficient_clearance when clearance is below minimum threshold", () => {
      const request: AngleGenerationRequest = {
        pieceA: testPieceA,
        pieceB: testPieceB,
        connection: {
          connectionId: "C_CLEARANCE",
          connectorType: "tab_slot",
          clearanceMm: 0.01, // Way below default 0.05 mm
        },
        options: {
          customCandidates: [90],
          minClearanceMm: 0.05,
        },
      };

      const result = evaluateConnectionAngles(request);
      const eval90 = result.allCandidates.find((c) => c.angleDeg === 90)!;

      expect(eval90.mathematicallyPossible).toBe(true);
      expect(eval90.geometricallyValid).toBe(false);
      expect(eval90.rejectionReason).toBe("insufficient_clearance");
      expect(result.validAngles).toHaveLength(0);
    });

    it("rejects invalid_connector_alignment when interface frames do not align", () => {
      // Create mismatched frame with huge offset
      const badFrameB: CoordinateFrame3D = {
        origin: vec3(999, 999, 999),
        xAxis: vec3(0, 0, 1),
        yAxis: vec3(0, 1, 0),
        zAxis: vec3(-1, 0, 0),
      };

      const badPieceB = {
        pieceId: "P_MISALIGNED",
        dimensions: { width: 50, height: 40, thickness: 3 },
        interfaceFrame: badFrameB,
      };

      const evalResult = validateCandidateAngle(
        90,
        testPieceA,
        badPieceB,
        {
          connectionId: "C_MISALIGNED",
          connectorType: "tab_slot",
          clearanceMm: 0.15,
        }
      );

      // Mathematically possible passed, but geometric alignment failed
      expect(evalResult.mathematicallyPossible).toBe(true);
      expect(evalResult.geometricallyValid).toBe(false);
      expect(evalResult.rejectionReason).toBe("invalid_connector_alignment");
      expect(evalResult.metrics.alignmentErrorMm).toBeGreaterThan(0.5);
    });

    it("rejects collision for directly folded pieces", () => {
      const evalResult = validateCandidateAngle(
        0,
        testPieceA,
        testPieceB,
        {
          connectionId: "C_COLLISION",
          connectorType: "tab_slot",
          clearanceMm: 0.15,
        }
      );

      expect(evalResult.geometricallyValid).toBe(false);
      expect(evalResult.rejectionReason).toBe("collision");
      expect(evalResult.diagnosticMessage).toContain("collision");
    });
  });

  describe("Integration with Converted 3D Puzzle", () => {
    it("evaluates joining angles for all connections in a 2D->3D converted puzzle", () => {
      // 1. Generate 2D puzzle
      const puzzle2d = Automatic2DGenerationEngine.generatePuzzle({
        targetPieceCount: 4,
        overallSize: { widthMm: 100, heightMm: 100 },
        boundaryShape: "rectangle",
        partitionStyle: "rectangular",
        material: {
          id: "plywood",
          name: "Birch Plywood",
          stockThicknessMm: 3.0,
        },
      });

      // 2. Convert to 3D pieces
      const puzzle3d = Piece3DConversionEngine.convertPuzzle(puzzle2d);

      // 3. Evaluate joining angles across all connections
      const result = evaluatePuzzleJoiningAngles(puzzle3d, {
        angleStepDeg: 30, // Evaluate [0°, 30°, 60°, 90°, 120°, 150°, 180°]
      });

      expect(result.puzzleId).toBe(puzzle3d.puzzleId);
      expect(result.totalConnectionsEvaluated).toBe(puzzle3d.connections.length);
      expect(result.totalConnectionsEvaluated).toBeGreaterThan(0);
      expect(result.allConnectionsHaveValidAngle).toBe(true);
      expect(result.executionDurationMs).toBeGreaterThanOrEqual(0);

      // Check each connection's valid angles
      for (const conn of puzzle3d.connections) {
        const connAngles = result.connectionAngles[conn.connectionId];
        expect(connAngles).toBeDefined();
        expect(connAngles.validAngles.length).toBeGreaterThan(0);
        expect(connAngles.recommendedAngle).toBeDefined();
        expect(connAngles.allCandidates.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Deterministic Behavior (No AI)", () => {
    it("produces strictly identical results across 50 consecutive runs", () => {
      const request: AngleGenerationRequest = {
        pieceA: testPieceA,
        pieceB: testPieceB,
        connection: {
          connectionId: "C_DETERMINISTIC",
          connectorType: "tab_slot",
          clearanceMm: 0.15,
        },
        options: {
          customCandidates: [0, 15, 30, 45, 60, 90, 180],
        },
      };

      const baseline = evaluateConnectionAngles(request);

      for (let i = 0; i < 50; i++) {
        const runResult = evaluateConnectionAngles(request);
        expect(runResult.validAngles).toEqual(baseline.validAngles);
        expect(runResult.recommendedAngle).toEqual(baseline.recommendedAngle);
        expect(runResult.rejectedAngles).toEqual(baseline.rejectedAngles);
        expect(runResult.mathematicallyPossibleAngles).toEqual(baseline.mathematicallyPossibleAngles);
        expect(runResult.geometricallyValidAngles).toEqual(baseline.geometricallyValidAngles);
        expect(runResult.physicallyAssemblableAngles).toEqual(baseline.physicallyAssemblableAngles);
      }
    });
  });
});
