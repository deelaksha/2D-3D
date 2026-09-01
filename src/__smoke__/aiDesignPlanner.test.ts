import { describe, expect, it } from "vitest";
import { convertPlanToSpecification, MockDesignPlanner } from "../core/puzzle/designplanner/designPlanner";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../core/puzzle/canonical/defaults";
import type { RetrievedDesign } from "../core/puzzle/retrievalsystem/types";

describe("AI Design Planner Subsystem (Phase 49)", () => {
  it("1. MockDesignPlanner parses user requirement and outputs structured DesignPlan", async () => {
    const planner = new MockDesignPlanner();
    const plan = await planner.createDesignPlan({
      userRequirement: "Build a 10-piece cardboard desktop chair using 3 mm cardboard.",
    });

    expect(plan.planId).toBeDefined();
    expect(plan.intent.targetCategory).toBe("furniture");
    expect(plan.pieceStrategy.targetPieceCount).toBe(10);
    expect(plan.materialStrategy.thicknessMm).toBe(3.0);
  });

  it("2. incorporates reference retrieved examples without directly copying geometry", async () => {
    const refPuz = createEmptyCanonicalPuzzle("Ref 5-Piece Stand");
    for (let i = 0; i < 5; i++) {
      refPuz.pieces.push(createCanonicalPiece(`Ref ${i}`, { width: 100, height: 100, depth: 3.0 }, 3.0));
    }

    const refExample: RetrievedDesign = {
      designId: "ref_5pc",
      canonicalPuzzle: refPuz,
      similarity: { overallScore: 0.95, topologyScore: 0.95, dimensionScore: 0.95, connectionTypeScore: 0.95 },
      embedding: { vectorId: "v_1", dimensions: 128, values: [] },
      isReferenceOnly: true,
    };

    const planner = new MockDesignPlanner();
    const plan = await planner.createDesignPlan({
      userRequirement: "Build a desktop stand.",
      retrievedExamples: [refExample],
    });

    expect(plan.pieceStrategy.targetPieceCount).toBe(5);
  });

  it("3. verifies DesignPlan contains all 6 required strategy sections", async () => {
    const planner = new MockDesignPlanner();
    const plan = await planner.createDesignPlan({
      userRequirement: "Create a 4-piece box.",
    });

    expect(plan.intent).toBeDefined();
    expect(plan.pieceStrategy).toBeDefined();
    expect(plan.connectionStrategy).toBeDefined();
    expect(plan.materialStrategy).toBeDefined();
    expect(plan.assemblyStrategy).toBeDefined();
    expect(plan.constraintStrategy).toBeDefined();
  });

  it("4. converts DesignPlan into canonical DesignSpecification using convertPlanToSpecification", async () => {
    const planner = new MockDesignPlanner();
    const plan = await planner.createDesignPlan({
      userRequirement: "Create a 6-piece puzzle in 3mm cardboard.",
    });

    const spec = convertPlanToSpecification(plan);

    expect(spec.specId).toBe(`spec_from_${plan.planId}`);
    expect(spec.designParameters.pieceCount).toBe(6);
    expect(spec.materialParameters.thicknessMm).toBe(3.0);
    expect(spec.isValidSchema).toBe(true);
  });

  it("5. verifies strict invariant: No STL/STEP or direct mesh geometry is produced by the planner", async () => {
    const planner = new MockDesignPlanner();
    const plan = await planner.createDesignPlan({
      userRequirement: "Create a 3-piece box.",
    });

    const specObj = plan as unknown as Record<string, unknown>;
    expect(specObj.meshVertices).toBeUndefined();
    expect(specObj.stlBuffer).toBeUndefined();
    expect(specObj.stepFile).toBeUndefined();
  });
});
