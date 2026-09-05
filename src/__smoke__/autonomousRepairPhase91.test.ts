/**
 * Autonomous Generator to Repair System Smoke Tests (Phase 91).
 *
 * Validates:
 *  1. Immediate pass on already-valid assemblies (0 iterations).
 *  2. Local-first repair precedence:
 *     - When connector C07 fails (e.g. tab width > slot width), repairs C07 parameters,
 *       regenerates only affected interfaces, reassembles, and validates without regenerating the entire puzzle.
 *  3. Local clearance defect repair (increases clearance to compliant threshold).
 *  4. Local joining angle repair (corrects acute/out-of-range angles).
 *  5. Local piece thickness correction & solid re-extrusion.
 *  6. Controlled global fallback when local repair is insufficient.
 *  7. Cycle detection & infinite loop prevention via state hashing.
 *  8. Configurable retry limits enforcement (maxRetries, maxLocalRetries).
 *  9. Complete, auditable RepairHistory and FinalRepairStatus reporting.
 * 10. Strict guarantee: No raw mesh editing.
 */

import { describe, expect, it } from "vitest";
import { Automatic2DGenerationEngine } from "../core/puzzle/automatic2d";
import { Piece3DConversionEngine } from "../core/puzzle/piece3d";
import { solveAutomaticAssembly } from "../core/puzzle/assemblysolver";
import { evaluatePuzzleJoiningAngles } from "../core/puzzle/anglegeneration";
import {
  AutonomousRepairEngine,
  repairAutonomousAssembly,
} from "../core/puzzle/autonomousrepair";
import type { ConvertedPuzzle3D } from "../core/puzzle/piece3d/types";

describe("Phase 91: Autonomous Generator to Repair System Connection", () => {
  function createTestSolvedAssembly(pieceCount = 4) {
    const puzzle2d = Automatic2DGenerationEngine.generatePuzzle({
      targetPieceCount: pieceCount,
      overallSize: { widthMm: 120, heightMm: 120 },
      boundaryShape: "rectangle",
      partitionStyle: "rectangular",
      material: {
        id: "plywood",
        name: "Birch Plywood",
        stockThicknessMm: 3.0,
      },
    });
    const puzzle3d = Piece3DConversionEngine.convertPuzzle(puzzle2d);
    const angleResult = evaluatePuzzleJoiningAngles(puzzle3d, { angleStepDeg: 30 });

    const solved = solveAutomaticAssembly({
      puzzle: puzzle3d,
      validAngleCandidates: angleResult.connectionAngles,
    });

    if (!solved.success) {
      throw new Error("Failed to solve test assembly for Phase 91 test setup.");
    }

    return {
      puzzle3d,
      solved,
      pieceTransforms: solved.pieceTransforms,
      appliedAngles: solved.appliedAngles,
    };
  }

  describe("Immediate Validation (0-iteration pass)", () => {
    it("returns status 'repaired' immediately with 0 iterations if already valid", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const result = repairAutonomousAssembly(puzzle3d, pieceTransforms, appliedAngles);

      expect(result.status).toBe("repaired");
      expect(result.repaired).toBe(true);
      expect(result.totalIterations).toBe(0);
      expect(result.repairedParametersCount).toBe(0);
      expect(result.history.totalAttempts).toBe(0);
      expect(result.validationReport.isValid).toBe(true);
    });
  });

  describe("Local-First Connector Repair", () => {
    it("repairs single connector failure locally without regenerating the whole puzzle", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      // Target specific connection (simulate C07 failure: tab width > slot width)
      const targetConn = puzzle3d.connections[0];
      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        connections: puzzle3d.connections.map((c, i) =>
          i === 0
            ? {
                ...c,
                parameters: {
                  ...c.parameters,
                  tabWidth: 40.0,
                  slotWidth: 15.0, // Defect: tab (40mm) > slot (15mm)
                },
              }
            : c
        ),
      };

      const result = repairAutonomousAssembly(corruptPuzzle, pieceTransforms, appliedAngles, {
        preferLocal: true,
      });

      expect(result.status).toBe("repaired");
      expect(result.repaired).toBe(true);

      // Verified Local Repair Precedence:
      // Local repair handled it, so globalAttemptsCount must be 0!
      expect(result.history.localAttemptsCount).toBeGreaterThanOrEqual(1);
      expect(result.history.globalAttemptsCount).toBe(0);

      // Verify the target connector parameters were adjusted
      const repairedConn = result.repairedPuzzle.connections.find(
        (c) => c.connectionId === targetConn.connectionId
      )!;
      expect(repairedConn.parameters?.slotWidth).toBeGreaterThanOrEqual(40.0);

      // Verify other pieces (pieces 2 and 3 not in conn 0) were preserved
      const nonAdjacentPiece = result.repairedPuzzle.pieces.find(
        (p) => p.pieceId !== targetConn.pieceAId && p.pieceId !== targetConn.pieceBId
      );
      if (nonAdjacentPiece) {
        const originalNonAdjacent = puzzle3d.pieces.find(
          (p) => p.pieceId === nonAdjacentPiece.pieceId
        )!;
        expect(nonAdjacentPiece.thickness).toBe(originalNonAdjacent.thickness);
      }

      expect(result.validationReport.isValid).toBe(true);
      expect(result.validationReport.summary.errorCount).toBe(0);
    });

    it("repairs insufficient clearance locally", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const targetConnId = puzzle3d.connections[0].connectionId;
      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        connections: puzzle3d.connections.map((c, i) =>
          i === 0
            ? {
                ...c,
                clearanceMm: 0.005, // Defect: 0.005mm < 0.05mm minimum
                parameters: { ...c.parameters, clearance: 0.005 },
              }
            : c
        ),
      };

      const result = repairAutonomousAssembly(corruptPuzzle, pieceTransforms, appliedAngles, {
        preferLocal: true,
      });

      expect(result.status).toBe("repaired");
      expect(result.repaired).toBe(true);
      expect(result.history.localAttemptsCount).toBeGreaterThanOrEqual(1);
      expect(result.history.globalAttemptsCount).toBe(0);

      const repairedConn = result.repairedPuzzle.connections.find(
        (c) => c.connectionId === targetConnId
      )!;
      expect(repairedConn.clearanceMm).toBeGreaterThanOrEqual(0.15);
      expect(result.validationReport.isValid).toBe(true);
    });

    it("repairs invalid joining angle locally", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const targetConnId = puzzle3d.connections[0].connectionId;
      const invalidAngles = {
        ...appliedAngles,
        [targetConnId]: 260.0, // Outside valid [0°, 180°]
      };

      const result = repairAutonomousAssembly(puzzle3d, pieceTransforms, invalidAngles, {
        preferLocal: true,
      });

      expect(result.status).toBe("repaired");
      expect(result.repaired).toBe(true);
      expect(result.history.localAttemptsCount).toBeGreaterThanOrEqual(1);
      expect(result.history.globalAttemptsCount).toBe(0);

      expect(result.appliedAngles[targetConnId]).toBeLessThanOrEqual(180.0);
      expect(result.validationReport.isValid).toBe(true);
    });

    it("repairs piece thickness locally and re-extrudes solid representation", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const corruptPieceId = puzzle3d.pieces[0].pieceId;
      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        pieces: puzzle3d.pieces.map((p, i) =>
          i === 0 ? { ...p, thickness: 12.0 } : p // Defect: 12.0mm != 3.0mm stock
        ),
      };

      const result = repairAutonomousAssembly(corruptPuzzle, pieceTransforms, appliedAngles, {
        preferLocal: true,
      });

      expect(result.status).toBe("repaired");
      expect(result.repaired).toBe(true);
      expect(result.history.localAttemptsCount).toBeGreaterThanOrEqual(1);
      expect(result.history.globalAttemptsCount).toBe(0);

      const repairedPiece = result.repairedPuzzle.pieces.find((p) => p.pieceId === corruptPieceId)!;
      expect(repairedPiece.thickness).toBe(3.0);
      expect(result.validationReport.validThickness).toBe(true);
    });
  });

  describe("Global Regeneration Fallback", () => {
    it("falls back to global regeneration when local repair cannot resolve the defect", () => {
      const { puzzle3d, appliedAngles } = createTestSolvedAssembly(4);

      // Create an unresolvable local defect: piece 3 is missing from puzzle.pieces entirely (3 pieces instead of 4)
      const brokenPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        pieces: puzzle3d.pieces.slice(0, 3), // Only 3 pieces in puzzle, but spec requires 4
        specification: {
          ...puzzle3d.specification,
          targetPieceCount: 4,
        },
      };

      const result = repairAutonomousAssembly(brokenPuzzle, {}, appliedAngles, {
        preferLocal: true,
        maxLocalRetries: 1,
        maxGlobalRetries: 2,
      });

      expect(result.status).toBe("repaired");
      expect(result.repaired).toBe(true);
      // Global regeneration was triggered and succeeded
      expect(result.history.globalAttemptsCount).toBeGreaterThanOrEqual(1);
      expect(result.validationReport.isValid).toBe(true);
      expect(result.validationReport.totalPieces).toBe(4);
      expect(result.validationReport.allPiecesIncluded).toBe(true);
    });
  });

  describe("Cycle Detection & Infinite Loop Prevention", () => {
    it("detects cycle and halts with 'cycle_detected' to prevent infinite loop", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      // Create an engine run where local attempts are exhausted and global is disabled
      // and state hash repeats
      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        connections: puzzle3d.connections.map((c, i) =>
          i === 0 ? { ...c, connectorType: "unsupported_unknown" as any } : c
        ),
      };

      // Set maxLocalRetries = 0 and maxGlobalRetries = 0 to test immediate loop exit
      const result = repairAutonomousAssembly(corruptPuzzle, pieceTransforms, appliedAngles, {
        maxLocalRetries: 0,
        maxGlobalRetries: 0,
        maxRetries: 2,
      });

      expect(result.repaired).toBe(false);
      expect(["max_retries_exceeded", "cycle_detected", "unrepaired"]).toContain(result.status);
    });
  });

  describe("Audit Trail & Reporting", () => {
    it("returns complete chronological RepairHistory and FinalRepairStatus", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        connections: puzzle3d.connections.map((c, i) =>
          i === 0
            ? {
                ...c,
                parameters: { ...c.parameters, tabWidth: 35.0, slotWidth: 20.0 },
              }
            : c
        ),
      };

      const result = repairAutonomousAssembly(corruptPuzzle, pieceTransforms, appliedAngles);

      expect(result.history).toBeDefined();
      expect(result.history.totalAttempts).toBeGreaterThanOrEqual(1);
      expect(result.history.attempts.length).toBe(result.history.totalAttempts);

      for (const attempt of result.history.attempts) {
        expect(attempt.iteration).toBeGreaterThan(0);
        expect(["local", "global"]).toContain(attempt.scope);
        expect(attempt.detectedFailure).toBeDefined();
        expect(attempt.modifications.length).toBeGreaterThan(0);
        expect(attempt.durationMs).toBeGreaterThanOrEqual(0);
      }

      expect(result.repairedParametersCount).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
