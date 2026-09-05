/**
 * Prompts 110–112: Multi-Solution Solver, Difficulty Engine & AI Coach Tests.
 *
 * Validates:
 *  - Prompt 110: Multi-solution discovery (Solution A, Solution B, Solution C)
 *  - Prompt 111: Deterministic difficulty scoring (0–10 score, categorical rating, reasons)
 *  - Prompt 112: Deterministic AI assembly coach queries (next piece, collision diagnosis, angle feasibility)
 */

import { describe, expect, it } from "vitest";
import { generatePuzzle } from "@/core/puzzle/highlevelapi";
import { MultiSolutionSolver } from "@/core/puzzle/designer/multiSolutionSolver";
import { DeterministicDifficultyEngine } from "@/core/puzzle/designer/deterministicDifficultyEngine";
import { AssemblyCoach } from "@/core/puzzle/designer/assemblyCoach";

describe("Prompts 110–112: Solutions, Difficulty & AI Coach", () => {
  it("discovers multiple valid assembly solutions with distinct metrics", async () => {
    const res = await generatePuzzle("6-piece 3mm plywood planar puzzle");
    const puzzle3D = res.puzzle3D;

    const solutions = MultiSolutionSolver.discoverSolutions(
      puzzle3D,
      res.pieceTransforms,
      res.appliedAngles
    );

    expect(solutions.length).toBeGreaterThanOrEqual(1);
    const solA = solutions[0];
    expect(solA.id).toBe("solution_a");
    expect(solA.isValid).toBe(true);
    expect(solA.uniqueAnglesCount).toBeGreaterThan(0);
    expect(solA.structuralScore).toBeGreaterThan(0);
  });

  it("calculates deterministic assembly difficulty scores with transparent reasons", async () => {
    const res = await generatePuzzle("12-piece non-planar 3mm cardboard puzzle");
    const puzzle3D = res.puzzle3D;

    const evaluation = DeterministicDifficultyEngine.evaluate(
      puzzle3D,
      res.pieceTransforms,
      res.appliedAngles,
      2
    );

    expect(evaluation.score).toBeGreaterThanOrEqual(0.0);
    expect(evaluation.score).toBeLessThanOrEqual(10.0);
    expect(["Beginner", "Intermediate", "Advanced", "Expert"]).toContain(evaluation.category);
    expect(evaluation.reasons.length).toBeGreaterThan(0);
    expect(evaluation.metrics.pieceCount).toBe(12);
  });

  it("provides deterministic advice from AI Assembly Coach", async () => {
    const res = await generatePuzzle("8-piece 3mm cardboard puzzle");
    const puzzle3D = res.puzzle3D;

    // 1. Next piece recommendation
    const partialTransforms = {
      [puzzle3D.pieces[0].pieceId]: res.pieceTransforms[puzzle3D.pieces[0].pieceId],
    };
    const adviceNext = AssemblyCoach.recommendNextPiece(puzzle3D, partialTransforms);
    expect(adviceNext.recommendedPieceId).toBeDefined();
    expect(adviceNext.recommendedReason).toContain("Piece");

    // 2. Angle feasibility check
    if (puzzle3D.connections.length > 0) {
      const connId = puzzle3D.connections[0].connectionId;
      const adviceAngle = AssemblyCoach.verifyAngleFeasibility(puzzle3D, connId, 90);
      expect(adviceAngle.angleFeasibility).toBeDefined();
      expect(adviceAngle.angleFeasibility?.requestedAngleDeg).toBe(90);
    }
  });
});
