import { describe, expect, it } from "vitest";
import { RequirementParser } from "../core/puzzle/ai/requirementParser";

describe("AI Requirement Parser Subsystem (Phase 41)", () => {
  it("1. parses piece count and material thickness from natural language prompt", async () => {
    const parser = new RequirementParser();
    const spec = await parser.parseRequirement("Create a 30-piece puzzle using 3 mm cardboard.");

    expect(spec.isValidSchema).toBe(true);
    expect(spec.designParameters.pieceCount).toBe(30);
    expect(spec.materialParameters.thicknessMm).toBe(3.0);
    expect(spec.missingInformation.length).toBe(0);
  });

  it("2. parses outer boundary dimensions (200 x 300 mm)", async () => {
    const parser = new RequirementParser();
    const spec = await parser.parseRequirement("Make the outer boundary 200 x 300 mm.");

    expect(spec.designParameters.outerBoundary.widthMm).toBe(200);
    expect(spec.designParameters.outerBoundary.heightMm).toBe(300);
  });

  it("3. rejects ambiguous prompts (e.g. 'Make a large puzzle') and returns explicit missing-information requirement", async () => {
    const parser = new RequirementParser();
    const spec = await parser.parseRequirement("Make a large puzzle.");

    expect(spec.missingInformation.length).toBeGreaterThan(0);
    const missing = spec.missingInformation[0];
    expect(missing.fieldName).toBe("outerBoundary");
    expect(missing.isCritical).toBe(true);
    expect(missing.promptQuestion).toContain("outer boundary dimensions");
  });

  it("4. parses assembly angle constraints and complexity preferences", async () => {
    const parser = new RequirementParser();
    const spec = await parser.parseRequirement("Allow pieces to be assembled at different angles and use complex internal connections.");

    expect(spec.assemblyParameters.assemblyType).toBe("multi_angle");
    expect(spec.assemblyParameters.allowedAssemblyAnglesDeg).toContain(45);
    expect(spec.designParameters.connectionStyle).toBe("complex");
  });

  it("5. verifies explicit separation across intent, design, material, assembly, hard constraints, and soft preferences", async () => {
    const parser = new RequirementParser();
    const spec = await parser.parseRequirement("Create a 20-piece puzzle using 3 mm cardboard.");

    expect(spec.userIntent).toBeDefined();
    expect(spec.designParameters).toBeDefined();
    expect(spec.materialParameters).toBeDefined();
    expect(spec.assemblyParameters).toBeDefined();
    expect(spec.hardConstraints).toBeDefined();
    expect(spec.softPreferences).toBeDefined();
  });
});
