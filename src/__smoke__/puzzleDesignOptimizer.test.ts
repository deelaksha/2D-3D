import { describe, expect, it } from "vitest";
import {
  createEmptyCanonicalPuzzle,
  DeterministicGridOptimizer,
  evaluateDesignScore,
  Objective,
} from "@/core/puzzle";

describe("Phase 21: Puzzle Design Optimization Subsystem", () => {
  const optimizer = new DeterministicGridOptimizer();

  const mockObjectives: Objective[] = [
    { objectiveId: "o1", kind: "material_utilization", weight: 0.4, direction: "maximize" },
    { objectiveId: "o2", kind: "connection_quality", weight: 0.3, direction: "maximize" },
    { objectiveId: "o3", kind: "piece_count", weight: 0.3, targetValue: 20, direction: "target" },
  ];

  it("evaluates multi-objective fitness scores for feasible candidate designs", () => {
    const puzzle = createEmptyCanonicalPuzzle("Feasible_Puzzle");
    puzzle.pieces.push({
      id: "p1",
      name: "Piece 1",
      geometryRef: { contour: { kind: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0 } },
      dimensions: { width: 100, height: 100, depth: 2 },
      thickness: 2.0,
      materialId: "cardboard-2mm",
      interfaceIds: [],
      localFrame: { origin: { x: 0, y: 0, z: 0 }, tangent: { x: 1, y: 0, z: 0 }, normal: { x: 0, y: -1, z: 0 }, binormal: { x: 0, y: 0, z: -1 } },
      manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
    });

    const score = evaluateDesignScore({ candidateId: "c1", puzzle, parameters: {}, isFeasible: true }, mockObjectives);

    expect(score.isFeasible).toBe(true);
    expect(score.totalScore).toBeGreaterThan(0.0);
    expect(score.objectiveScores.material_utilization).toBeDefined();
    expect(score.objectiveScores.connection_quality).toBeDefined();
    expect(score.objectiveScores.piece_count).toBeDefined();
  });

  it("immediately rejects candidates violating HARD constraints (isFeasible = false)", () => {
    const defectivePuzzle = createEmptyCanonicalPuzzle("Defective_Puzzle");

    // Add oversized piece violating manufacturing sheet width bounds (700mm > 580mm usable)
    defectivePuzzle.pieces.push({
      id: "p_over",
      name: "Oversized Piece",
      geometryRef: { contour: { kind: "rect", x: 0, y: 0, width: 700, height: 100, rotation: 0 } },
      dimensions: { width: 700, height: 100, depth: 2 },
      thickness: 2.0,
      materialId: "cardboard-2mm",
      interfaceIds: [],
      localFrame: { origin: { x: 0, y: 0, z: 0 }, tangent: { x: 1, y: 0, z: 0 }, normal: { x: 0, y: -1, z: 0 }, binormal: { x: 0, y: 0, z: -1 } },
      manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
    });

    const score = evaluateDesignScore({ candidateId: "c2", puzzle: defectivePuzzle, parameters: {}, isFeasible: true }, mockObjectives);

    expect(score.isFeasible).toBe(false);
    expect(score.totalScore).toBe(0.0);
    expect(score.hardConstraintViolations.length).toBeGreaterThan(0);
  });

  it("optimizes over parameter search spaces using DeterministicGridOptimizer", async () => {
    const puzzle = createEmptyCanonicalPuzzle("Optimization_Test");
    puzzle.pieces.push({
      id: "p1",
      name: "Piece 1",
      geometryRef: { contour: { kind: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0 } },
      dimensions: { width: 100, height: 100, depth: 2 },
      thickness: 2.0,
      materialId: "cardboard-2mm",
      interfaceIds: [],
      localFrame: { origin: { x: 0, y: 0, z: 0 }, tangent: { x: 1, y: 0, z: 0 }, normal: { x: 0, y: -1, z: 0 }, binormal: { x: 0, y: 0, z: -1 } },
      manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
    });

    const searchSpace = [
      {
        parameterName: "piece_width",
        targetEntityId: "p1",
        values: [80, 100, 120],
      },
    ];

    const result = await optimizer.optimize(puzzle, mockObjectives, [], searchSpace);

    expect(result.success).toBe(true);
    expect(result.bestDesign).toBeDefined();
    expect(result.evaluatedCandidatesCount).toBe(3);
    expect(result.feasibleCandidatesCount).toBe(3);
    expect(result.bestDesign?.isFeasible).toBe(true);
  });
});
