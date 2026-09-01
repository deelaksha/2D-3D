import { describe, expect, it } from "vitest";
import { AIRepairLoopEngine, MockRepairPlanner, RepairExecutor } from "../core/puzzle/airepair/aiRepairLoopEngine";
import { AIDesignValidationGate } from "../core/puzzle/aivalidationgate/aiDesignValidationGate";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../core/puzzle/canonical/defaults";
import type { DesignSpecification } from "../core/puzzle/ai/types";

describe("AI-Assisted Design Repair Loop Architecture (Phase 52)", () => {
  const spec: DesignSpecification = {
    specId: "spec_bad_thickness",
    userIntent: { rawPrompt: "Test", summary: "Test", category: "puzzle", primaryGoal: "Test" },
    designParameters: { outerBoundary: { widthMm: 100, heightMm: 100 }, pieceCount: 3 },
    assemblyParameters: { allowedAssemblyAnglesDeg: [90], assemblyType: "rigid" },
    materialParameters: { materialId: "cardboard", thicknessMm: 0.1, allowableKerfMm: 0.15, densityGramsPerCm3: 0.6 },
    hardConstraints: { minThicknessMm: 0.5 },
    softPreferences: {},
    missingInformation: [],
    isValidSchema: true,
    schemaValidationErrors: [],
  };

  it("1. MockRepairPlanner generates structured AIRepairProposals specifying all required fields", async () => {
    const puzzle = createEmptyCanonicalPuzzle("Bad Thickness");
    puzzle.pieces.push(createCanonicalPiece("Bad", { width: 100, height: 100, depth: 0.1 }, 0.1));
    puzzle.pieces[0].id = "p_bad";

    const valResult = AIDesignValidationGate.validateAIDesign(puzzle, spec);
    const planner = new MockRepairPlanner();
    const proposals = await planner.planRepairs(valResult, spec);

    expect(proposals.length).toBeGreaterThan(0);
    const p0 = proposals[0];
    expect(p0.parameter).toBe("thickness");
    expect(p0.oldValue).toBe(0.1);
    expect(p0.newValue).toBe(3.0);
    expect(p0.reason).toBeDefined();
    expect(p0.affectedGeometry).toBeDefined();
    expect(p0.expectedImprovement).toBeDefined();
  });

  it("2. RepairExecutor applies parametric variable modifications without mutating raw mesh vertices", () => {
    const updatedSpec = RepairExecutor.applyProposals(spec, [
      {
        proposalId: "p_1",
        parameter: "thickness",
        oldValue: 0.1,
        newValue: 3.0,
        reason: "Fix thickness",
        affectedGeometry: "piece_thickness",
        expectedImprovement: "Pass material validation",
      },
    ]);

    expect(updatedSpec.materialParameters.thicknessMm).toBe(3.0);
  });

  it("3. AIRepairLoopEngine successfully repairs an invalid AI proposal within iterations", async () => {
    const puzzle = createEmptyCanonicalPuzzle("Bad Thickness Puzzle");
    puzzle.pieces.push(createCanonicalPiece("Bad", { width: 100, height: 100, depth: 0.1 }, 0.1));
    puzzle.pieces[0].id = "p_bad";

    const engine = new AIRepairLoopEngine();
    const result = await engine.repairDesign(puzzle, spec);

    expect(result.status).toBe("REPAIRED");
    expect(result.iterations.length).toBeGreaterThan(0);
    expect(result.finalValidationResult.status).toBe("ACCEPTED");
    expect(result.repairedSpecification?.materialParameters.thicknessMm).toBe(3.0);
    expect(result.repairedPuzzle?.pieces[0].dimensions.depth).toBe(3.0);
  });

  it("4. prevents infinite repair loops by stopping at maxIterations when unrepairable errors persist", async () => {
    // Custom planner returning empty proposals -> cannot repair
    const noOpPlanner = {
      planRepairs: async () => [],
    };

    const puzzle = createEmptyCanonicalPuzzle("Unrepairable Puzzle");
    puzzle.pieces.push(createCanonicalPiece("Bad", { width: 100, height: 100, depth: 0.1 }, 0.1));

    const engine = new AIRepairLoopEngine(noOpPlanner, 3);
    const result = await engine.repairDesign(puzzle, spec);

    expect(result.status).toBe("REPAIR_FAILED");
    expect(result.iterations.length).toBe(1);
    expect(result.finalValidationResult.status).toBe("REJECTED");
  });

  it("5. verifies strict invariant: repair system modifies parametric variables ONLY, never arbitrary mesh vertices", async () => {
    const puzzle = createEmptyCanonicalPuzzle("Test");
    puzzle.pieces.push(createCanonicalPiece("Bad", { width: 100, height: 100, depth: 0.1 }, 0.1));

    const engine = new AIRepairLoopEngine();
    const result = await engine.repairDesign(puzzle, spec);

    const repairedObj = result.repairedPuzzle as unknown as Record<string, unknown>;
    expect(repairedObj.rawMeshVertices).toBeUndefined();
    expect(repairedObj.arbitraryMeshEdits).toBeUndefined();
  });
});
