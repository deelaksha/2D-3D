/**
 * High-Level Autonomous Puzzle Generator API Smoke Tests (Phase 92).
 *
 * Validates:
 *  1. End-to-end single API call: generatePuzzle(requirement).
 *  2. 16-piece requirement from prompt:
 *     "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
 *  3. Verifies complete 15-stage pipeline execution:
 *     1. requirement parsing
 *     2. design specification
 *     3. 2D boundary generation
 *     4. piece partitioning
 *     5. connection graph generation
 *     6. connector generation
 *     7. connector placement
 *     8. 2D validation
 *     9. 3D piece generation
 *     10. angle generation
 *     11. 3D assembly
 *     12. collision validation
 *     13. assembly feasibility
 *     14. repair if necessary
 *     15. final validation
 *  4. Verifies all 9 returned fields in PuzzleGenerationResult:
 *     - designSpecification
 *     - pieces2D
 *     - connectors
 *     - connectionGraph
 *     - pieces3D
 *     - assembly
 *     - validationReport
 *     - repairHistory
 *     - generationStatistics
 *  5. Structured object input format.
 *  6. Planar vs non-planar connection configurations.
 *  7. Complete timing breakdown in generationStatistics.
 */

import { describe, expect, it } from "vitest";
import {
  generatePuzzle,
  HighLevelPuzzleGenerator,
  parseRequirement,
  type PuzzleGenerationResult,
} from "../core/puzzle/highlevelapi";

describe("Phase 92: High-Level Autonomous Puzzle Generator API", () => {
  describe("End-to-End Required Prompt", () => {
    it("generates a valid 16-piece 3D assembly from 'Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections.'", async () => {
      const prompt = "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections.";

      const result: PuzzleGenerationResult = await generatePuzzle(prompt);

      // 1. Return structure validation
      expect(result).toBeDefined();
      expect(result.designSpecification).toBeDefined();
      expect(result.pieces2D).toBeDefined();
      expect(result.connectors).toBeDefined();
      expect(result.connectionGraph).toBeDefined();
      expect(result.pieces3D).toBeDefined();
      expect(result.assembly).toBeDefined();
      expect(result.validationReport).toBeDefined();
      expect(result.repairHistory).toBeDefined();
      expect(result.generationStatistics).toBeDefined();

      // 2. Piece count & Material verification
      expect(result.pieces2D.length).toBe(16);
      expect(result.pieces3D.length).toBe(16);
      expect(result.designSpecification.targetPieceCount).toBe(16);
      expect(result.designSpecification.material.id.toLowerCase()).toContain("cardboard");
      expect(result.designSpecification.material.stockThicknessMm).toBe(3);

      // 3. 2D Pieces verification
      for (const p2d of result.pieces2D) {
        expect(p2d.id).toBeDefined();
        expect(p2d.exactBoundary.length).toBeGreaterThanOrEqual(3);
        expect(p2d.thickness).toBe(3);
        expect(p2d.material.stockThicknessMm).toBe(3);
      }

      // 4. Connectors & Connection Graph verification
      expect(result.connectors.length).toBeGreaterThan(0);
      expect(result.connectionGraph.getAllConnectionEdges().length).toBe(result.connectors.length);
      expect(result.connectionGraph.getAllPieceNodes().length).toBe(16);

      // 5. 3D Pieces verification
      for (const p3d of result.pieces3D) {
        expect(p3d.pieceId).toBeDefined();
        expect(p3d.thickness).toBe(3);
        expect(p3d.localCoordinateFrame).toBeDefined();
        expect(p3d.solid.localMesh.positions.length).toBeGreaterThan(0);
        expect(p3d.solid.localMesh.indices.length).toBeGreaterThan(0);
      }

      // 6. Assembly verification
      expect(result.assembly.success).toBe(true);
      expect(Object.keys(result.assembly.pieceTransforms).length).toBe(16);

      // Non-planar verification: check that transforms or applied angles have non-coplanar rotations
      const appliedAngles = Object.values(result.assembly.appliedAngles);
      expect(appliedAngles.length).toBeGreaterThan(0);
      const hasNonZeroAngle = appliedAngles.some((ang) => Math.abs(ang) > 0.001);
      expect(hasNonZeroAngle).toBe(true);

      // 7. Validation report verification
      expect(result.validationReport.isValid).toBe(true);
      expect(result.validationReport.failureCount).toBe(0);
      expect(Object.keys(result.validationReport.pieceDetails).length).toBe(16);
      expect(result.validationReport.totalPieces).toBe(16);

      // 8. Repair history audit
      expect(result.repairHistory).toBeDefined();
      expect(typeof result.repairHistory.totalAttempts).toBe("number");

      // 9. Generation statistics verification
      const stats = result.generationStatistics;
      expect(stats.pieceCount).toBe(16);
      expect(stats.connectionCount).toBe(result.connectors.length);
      expect(stats.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.requirementParsing).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.designSpecification).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.boundaryGeneration).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.piecePartitioning).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.connectionGraphGeneration).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.connectorGeneration).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.connectorPlacement).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.validation2D).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.piece3DGeneration).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.angleGeneration).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.assembly3D).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.collisionValidation).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.assemblyFeasibility).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.repair).toBeGreaterThanOrEqual(0);
      expect(stats.stageDurationsMs.finalValidation).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Requirement Parser", () => {
    it("parses natural language strings into structured requirements", () => {
      const parsed = parseRequirement(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );

      expect(parsed.pieceCount).toBe(16);
      expect(parsed.material).toBe("cardboard");
      expect(parsed.thickness).toBe(3);
      expect(parsed.nonPlanar).toBe(true);
      expect(parsed.boundaryShape).toBe("rectangle");
      expect(parsed.gridDimensions).toEqual({ rows: 4, cols: 4 });
    });

    it("handles varied phrasing and materials", () => {
      const parsed1 = parseRequirement("Create a 4 piece wooden puzzle 5mm thick");
      expect(parsed1.pieceCount).toBe(4);
      expect(parsed1.material).toBe("wood");
      expect(parsed1.thickness).toBe(5);
      expect(parsed1.nonPlanar).toBe(false);

      const parsed2 = parseRequirement("9-piece acrylic 2.5 mm 3D interlocking joints");
      expect(parsed2.pieceCount).toBe(9);
      expect(parsed2.material).toBe("acrylic");
      expect(parsed2.thickness).toBe(2.5);
      expect(parsed2.nonPlanar).toBe(true);
    });
  });

  describe("Structured Object Input", () => {
    it("accepts structured PuzzleRequirementInput directly", async () => {
      const generator = new HighLevelPuzzleGenerator();

      const result = await generator.generatePuzzle({
        pieceCount: 4,
        material: "plywood",
        thickness: 3.5,
        nonPlanar: false,
        boundaryShape: "rectangle",
        overallSize: { width: 100, height: 100 },
      });

      expect(result.pieces3D.length).toBe(4);
      expect(result.designSpecification.material.id).toBe("plywood");
      expect(result.designSpecification.material.stockThicknessMm).toBe(3.5);
      expect(result.assembly.success).toBe(true);
      expect(result.validationReport.isValid).toBe(true);
    });
  });

  describe("Zero Manual Construction Guarantee", () => {
    it("caller provides only requirement string and receives fully assembled and validated 3D puzzle", async () => {
      const result = await generatePuzzle("4-piece 3mm plywood planar puzzle");

      expect(Object.keys(result.assembly.pieceTransforms).length).toBe(4);
      expect(result.validationReport.isValid).toBe(true);
      expect(result.validationReport.assemblyLevelValidation.allPiecesIncluded).toBe(true);
      expect(result.validationReport.assemblyLevelValidation.noDisconnectedPieces).toBe(true);
    });
  });
});
