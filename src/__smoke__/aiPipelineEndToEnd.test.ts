import { describe, expect, it } from "vitest";
import { AIPipelineEngine } from "../core/puzzle/aipipeline/aiPipelineEngine";

describe("Master AI Pipeline Integration & Rejection Diagnostics (Phase 50)", () => {
  it("1. valid AI requirement proceeds through 7-stage pipeline to produce canonical puzzle", async () => {
    const engine = new AIPipelineEngine();
    const result = await engine.executePipeline({
      userRequirement: "Create a 4-piece puzzle with 3 mm cardboard and 200 x 200 mm footprint.",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.designPlan).toBeDefined();
    expect(result.specification).toBeDefined();
    expect(result.canonicalPuzzle).toBeDefined();
    expect(result.canonicalPuzzle?.pieces.length).toBe(4);
    expect(result.rejectionDiagnostics.length).toBe(0);
    expect(result.constraintReport?.status).toBe("PASS");
  });

  it("2. rejects invalid piece count (0 pieces) with detailed rejection diagnostics for AI", async () => {
    const engine = new AIPipelineEngine();
    const result = await engine.executePipeline({
      userRequirement: "Create a 0-piece puzzle.",
    });

    expect(result.status).toBe("REJECTED");
    expect(result.rejectionDiagnostics.length).toBeGreaterThan(0);

    const pcError = result.rejectionDiagnostics.find((d) => d.code === "INVALID_PIECE_COUNT");
    expect(pcError).toBeDefined();
    expect(pcError?.message).toContain("invalid");
    expect(pcError?.suggestedFixForAI).toBeDefined();
  });

  it("3. rejects invalid material thickness (0.1 mm) with detailed rejection diagnostics for AI", async () => {
    const engine = new AIPipelineEngine();
    const result = await engine.executePipeline({
      userRequirement: "Create a 5-piece puzzle using 0.1 mm cardboard stock.",
    });

    expect(result.status).toBe("REJECTED");
    const matError = result.rejectionDiagnostics.find((d) => d.code === "INVALID_MATERIAL_THICKNESS");
    expect(matError).toBeDefined();
    expect(matError?.suggestedFixForAI).toContain("Set material thickness between");
  });

  it("4. verifies strict invariant: AI is NOT authoritative; canonical validation engine is authoritative", async () => {
    const engine = new AIPipelineEngine();
    const result = await engine.executePipeline({
      userRequirement: "Make a 500-piece puzzle with 0 mm cardboard and negative footprint.",
    });

    expect(result.status).toBe("REJECTED");
    expect(result.canonicalPuzzle).toBeUndefined(); // Cannot create CAD geometry for rejected AI proposal
    expect(result.rejectionDiagnostics.length).toBeGreaterThan(0);
  });
});
