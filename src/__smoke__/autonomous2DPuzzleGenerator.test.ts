/**
 * Autonomous 2D Puzzle Generator Engine Smoke Tests.
 *
 * Tests:
 *  1. 4 Pieces Generation (2x2 Grid)
 *  2. 9 Pieces Generation (3x3 Grid)
 *  3. 16 Pieces Generation (4x4 Grid)
 *  4. Irregular Piece Layouts:
 *      a) Radial Layout (Angular Sectors)
 *      b) Custom Polygonal Layout (Irregular Slanted Bisection)
 *      c) Organic Layout (Smooth Interlocking Jigsaw Waves)
 *  5. Deterministic Repeatability across identical runs
 *  6. Structured Diagnostics on invalid specifications
 *  7. Canonical Puzzle Conversion downstream bridge
 */

import { describe, expect, it } from "vitest";
import { Autonomous2DPuzzleGenerator } from "../core/puzzle/autonomous2d/autonomous2DPuzzleGenerator";
import type { ParametricDesignSpecification } from "../core/puzzle/ailayer/types";
import { Autonomous2DValidator } from "../core/puzzle/autonomous2d/validator2D";

function createValidSpecification(pieceCount: number = 4): ParametricDesignSpecification {
  return {
    specificationId: `spec_test_${pieceCount}_pcs`,
    overall_size: {
      widthMm: 200,
      heightMm: 200,
      depthMm: 50,
    },
    piece_count: pieceCount,
    layers: 1,
    material: {
      stockThicknessMm: 3.0,
      stockWidthMm: 600,
      stockHeightMm: 400,
      materialId: "mat_cardboard_heavy",
    },
    connection_preferences: {
      defaultType: "tab_slot",
      preferredJoiningAngleDeg: 180,
      genderStyle: "balanced",
    },
    difficulty: {
      level: "medium",
      maxUniquePieces: pieceCount,
    },
    symmetry: {
      isSymmetrical: true,
      symmetryAxis: "x",
    },
    constraints: [],
  };
}

describe("Autonomous 2D Puzzle Generator Subsystem", () => {
  it("generates a valid 4-piece puzzle with exact boundaries and connections (4 pieces)", () => {
    const spec = createValidSpecification(4);
    const result = Autonomous2DPuzzleGenerator.generate(spec, { layoutType: "grid" });

    expect(result.success).toBe(true);
    expect(result.puzzle).toBeDefined();

    const puzzle = result.puzzle!;
    expect(puzzle.pieceCount).toBe(4);
    expect(puzzle.pieces.length).toBe(4);
    expect(puzzle.layoutType).toBe("grid");

    // Check 2x2 grid has 4 internal shared edges, thus 8 interfaces (4 pairs)
    expect(puzzle.interfaces.length).toBe(8);
    expect(puzzle.connectionCandidates.length).toBe(4);

    // Each piece must have closed boundary and positive area
    for (const piece of puzzle.pieces) {
      expect(piece.boundary.vertices.length).toBe(4);
      expect(piece.boundary.areaMm2).toBeCloseTo(10000, 0); // 100x100 mm = 10,000 mm^2
      expect(piece.interfaces.length).toBe(2); // In a 2x2 grid, every corner piece connects to 2 neighbors
      expect(piece.outerBoundary.length).toBe(2); // 2 exterior edges
      expect(piece.thicknessMm).toBe(3.0);
    }

    // 2D Validation check
    const val = Autonomous2DValidator.validate(puzzle);
    expect(val.isValid).toBe(true);
    expect(val.errors.length).toBe(0);
    expect(val.checks.topologyConnected).toBe(true);
    expect(val.checks.noOrphanPieces).toBe(true);
  });

  it("generates a valid 9-piece puzzle with full topological connectivity (9 pieces)", () => {
    const spec = createValidSpecification(9);
    const result = Autonomous2DPuzzleGenerator.generate(spec, { layoutType: "grid" });

    expect(result.success).toBe(true);
    expect(result.puzzle).toBeDefined();

    const puzzle = result.puzzle!;
    expect(puzzle.pieceCount).toBe(9);
    expect(puzzle.pieces.length).toBe(9);

    // In a 3x3 grid: 3*2 = 6 horizontal and 3*2 = 6 vertical internal edges = 12 edges = 24 interfaces
    expect(puzzle.connectionCandidates.length).toBe(12);
    expect(puzzle.interfaces.length).toBe(24);

    // Center piece (row 1, col 1) should connect to 4 neighbors
    const centerPiece = puzzle.pieces.find(
      (p) => p.layoutMetadata.gridPosition?.row === 1 && p.layoutMetadata.gridPosition?.col === 1
    );
    expect(centerPiece).toBeDefined();
    expect(centerPiece!.interfaces.length).toBe(4);
    expect(centerPiece!.outerBoundary.length).toBe(0);

    // Corner pieces should connect to 2 neighbors and have 2 outer edges
    const cornerPieces = puzzle.pieces.filter((p) => p.outerBoundary.length === 2);
    expect(cornerPieces.length).toBe(4);

    // Edge pieces should connect to 3 neighbors and have 1 outer edge
    const edgePieces = puzzle.pieces.filter((p) => p.outerBoundary.length === 1);
    expect(edgePieces.length).toBe(4);

    const val = Autonomous2DValidator.validate(puzzle);
    expect(val.isValid).toBe(true);
  });

  it("generates a valid 16-piece puzzle with exact tessellation (16 pieces)", () => {
    const spec = createValidSpecification(16);
    const result = Autonomous2DPuzzleGenerator.generate(spec, { layoutType: "grid" });

    expect(result.success).toBe(true);
    expect(result.puzzle).toBeDefined();

    const puzzle = result.puzzle!;
    expect(puzzle.pieceCount).toBe(16);
    expect(puzzle.pieces.length).toBe(16);

    // In a 4x4 grid: 4*3 + 4*3 = 24 internal edges = 48 interfaces
    expect(puzzle.connectionCandidates.length).toBe(24);
    expect(puzzle.interfaces.length).toBe(48);

    // Sum of piece areas should match puzzle boundary area
    const totalPieceArea = puzzle.pieces.reduce((sum, p) => sum + p.boundary.areaMm2, 0);
    expect(totalPieceArea).toBeCloseTo(puzzle.boundary.areaMm2, 0);

    const val = Autonomous2DValidator.validate(puzzle);
    expect(val.isValid).toBe(true);
    expect(val.checks.noSelfIntersections).toBe(true);
  });

  describe("Irregular Piece Layouts", () => {
    it("generates an irregular radial layout puzzle with circular boundary", () => {
      const spec = createValidSpecification(6);
      const result = Autonomous2DPuzzleGenerator.generate(spec, { layoutType: "radial" });

      expect(result.success).toBe(true);
      expect(result.puzzle).toBeDefined();

      const puzzle = result.puzzle!;
      expect(puzzle.layoutType).toBe("radial");
      expect(puzzle.boundary.kind).toBe("circle");
      expect(puzzle.pieces.length).toBe(6);

      // 6 radial wedges form a ring: 6 shared radial boundary rays = 6 connection candidates
      expect(puzzle.connectionCandidates.length).toBe(6);
      expect(puzzle.interfaces.length).toBe(12);

      for (const piece of puzzle.pieces) {
        expect(piece.boundary.areaMm2).toBeGreaterThan(0);
        expect(piece.interfaces.length).toBe(2); // Each sector connects to clockwise and counter-clockwise neighbors
        expect(piece.outerBoundary.length).toBe(1); // Circular arc outer segment
      }

      const val = Autonomous2DValidator.validate(puzzle);
      expect(val.isValid).toBe(true);
      expect(val.checks.topologyConnected).toBe(true);
    });

    it("generates an irregular custom polygonal layout with slanted bisection", () => {
      const spec = createValidSpecification(5);
      const result = Autonomous2DPuzzleGenerator.generate(spec, {
        layoutType: "custom_polygonal",
        seed: 12345,
      });

      expect(result.success).toBe(true);
      expect(result.puzzle).toBeDefined();

      const puzzle = result.puzzle!;
      expect(puzzle.layoutType).toBe("custom_polygonal");
      expect(puzzle.pieces.length).toBe(5);

      for (const piece of puzzle.pieces) {
        expect(piece.boundary.vertices.length).toBeGreaterThanOrEqual(3);
        expect(piece.boundary.areaMm2).toBeGreaterThan(50);
        expect(piece.interfaces.length).toBeGreaterThanOrEqual(1);
      }

      const val = Autonomous2DValidator.validate(puzzle);
      expect(val.isValid).toBe(true);
      expect(val.checks.topologyConnected).toBe(true);
      expect(val.checks.allPiecesClosedAndPositiveArea).toBe(true);
    });

    it("generates an organic puzzle with smooth interlocking curved interfaces", () => {
      const spec = createValidSpecification(4);
      const result = Autonomous2DPuzzleGenerator.generate(spec, {
        layoutType: "organic",
        seed: 999,
      });

      expect(result.success).toBe(true);
      expect(result.puzzle).toBeDefined();

      const puzzle = result.puzzle!;
      expect(puzzle.layoutType).toBe("organic");
      expect(puzzle.pieces.length).toBe(4);

      // Organic pieces have more vertices due to harmonic wave discretization
      for (const piece of puzzle.pieces) {
        expect(piece.boundary.vertices.length).toBeGreaterThan(4);
        expect(piece.boundary.areaMm2).toBeGreaterThan(0);
      }

      const val = Autonomous2DValidator.validate(puzzle);
      expect(val.isValid).toBe(true);
    });
  });

  it("is strictly deterministic (identical output given same spec & seed)", () => {
    const spec = createValidSpecification(9);
    const run1 = Autonomous2DPuzzleGenerator.generate(spec, { seed: 42, layoutType: "grid" });
    const run2 = Autonomous2DPuzzleGenerator.generate(spec, { seed: 42, layoutType: "grid" });

    expect(run1.puzzle!.pieces.length).toBe(run2.puzzle!.pieces.length);
    expect(run1.puzzle!.interfaces.length).toBe(run2.puzzle!.interfaces.length);

    for (let i = 0; i < run1.puzzle!.pieces.length; i++) {
      const p1 = run1.puzzle!.pieces[i];
      const p2 = run2.puzzle!.pieces[i];
      expect(p1.boundary.areaMm2).toBe(p2.boundary.areaMm2);
      expect(p1.boundary.centroid.x).toBeCloseTo(p2.boundary.centroid.x, 4);
      expect(p1.boundary.centroid.y).toBeCloseTo(p2.boundary.centroid.y, 4);
      expect(p1.dimensions.widthMm).toBe(p2.dimensions.widthMm);
    }
  });

  it("returns structured diagnostics when specification is invalid", () => {
    // 1. Piece count < 2
    const invalidSpec: ParametricDesignSpecification = {
      ...createValidSpecification(1),
      piece_count: 1,
    };

    const result1 = Autonomous2DPuzzleGenerator.generate(invalidSpec);
    expect(result1.success).toBe(false);
    expect(result1.puzzle).toBeUndefined();
    expect(result1.diagnostics.length).toBeGreaterThan(0);
    expect(result1.diagnostics.some((d) => d.code === "ERR_INSUFFICIENT_PIECE_COUNT")).toBe(true);
    expect(result1.diagnostics[0].remediation).toBeDefined();

    // 2. Non-positive dimensions
    const invalidDimensionsSpec: ParametricDesignSpecification = {
      ...createValidSpecification(4),
      overall_size: { widthMm: -100, heightMm: 200, depthMm: 10 },
    };

    const result2 = Autonomous2DPuzzleGenerator.generate(invalidDimensionsSpec);
    expect(result2.success).toBe(false);
    expect(result2.diagnostics.some((d) => d.code === "ERR_INVALID_SPEC_DIMENSIONS")).toBe(true);

    // 3. Exceeds material stock sheet
    const oversizeSpec: ParametricDesignSpecification = {
      ...createValidSpecification(4),
      overall_size: { widthMm: 800, heightMm: 500, depthMm: 10 },
      material: {
        stockThicknessMm: 3.0,
        stockWidthMm: 600,
        stockHeightMm: 400,
        materialId: "cardboard",
      },
    };

    const result3 = Autonomous2DPuzzleGenerator.generate(oversizeSpec);
    expect(result3.success).toBe(false);
    expect(result3.diagnostics.some((d) => d.code === "ERR_EXCEEDS_STOCK_WIDTH")).toBe(true);
  });

  it("converts GeneratedPuzzle2D to CanonicalPuzzle for downstream workflow integration", () => {
    const spec = createValidSpecification(4);
    const result = Autonomous2DPuzzleGenerator.generate(spec);
    expect(result.success).toBe(true);

    const canonical = Autonomous2DPuzzleGenerator.toCanonicalPuzzle(result.puzzle!);
    expect(canonical.metadata.id).toBe(result.puzzle!.puzzleId);
    expect(canonical.pieces.length).toBe(4);
    expect(canonical.interfaces.length).toBe(8);
    expect(canonical.connections.length).toBe(4);

    for (const piece of canonical.pieces) {
      expect(piece.thickness).toBe(3.0);
      expect(piece.interfaceIds.length).toBe(2);
      expect(piece.geometryRef?.contour).toBeDefined();
    }
  });
});
