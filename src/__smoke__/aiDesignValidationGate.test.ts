import { describe, expect, it } from "vitest";
import { AIDesignValidationGate } from "../core/puzzle/aivalidationgate/aiDesignValidationGate";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../core/puzzle/canonical/defaults";

describe("AI Design Validation Gate (Phase 51)", () => {
  it("1. valid AI proposal passes all 9 validation passes (status: ACCEPTED)", () => {
    const puzzle = createEmptyCanonicalPuzzle("Valid Box");
    puzzle.pieces.push(
      createCanonicalPiece("Base", { width: 100, height: 100, depth: 3.0 }, 3.0),
      createCanonicalPiece("Side", { width: 100, height: 80, depth: 3.0 }, 3.0)
    );
    puzzle.pieces[0].id = "p_base";
    puzzle.pieces[1].id = "p_side";

    const result = AIDesignValidationGate.validateAIDesign(puzzle);

    expect(result.status).toBe("ACCEPTED");
    expect(result.errors.length).toBe(0);
    expect(result.validationPasses.schemaValidation).toBe(true);
    expect(result.validationPasses.parameterValidation).toBe(true);
    expect(result.validationPasses.materialCardboardValidation).toBe(true);

    expect(() => AIDesignValidationGate.assertExportAllowed(result)).not.toThrow();
  });

  it("2. invalid negative piece dimensions fail parameter validation (status: REJECTED)", () => {
    const puzzle = createEmptyCanonicalPuzzle("Negative Piece");
    const badPiece = createCanonicalPiece("Bad", { width: -50, height: 100, depth: 3.0 }, 3.0);
    badPiece.id = "p_bad";
    puzzle.pieces.push(badPiece);

    const result = AIDesignValidationGate.validateAIDesign(puzzle);

    expect(result.status).toBe("REJECTED");
    expect(result.errors.some((e) => e.includes("invalid dimensions"))).toBe(true);
    expect(result.affectedPieces).toContain("p_bad");
    expect(result.suggestedRepairTargets.length).toBeGreaterThan(0);

    expect(() => AIDesignValidationGate.assertExportAllowed(result)).toThrow("AI DESIGN EXPORT BLOCKED");
  });

  it("3. invalid cardboard thickness (0.1mm) fails material validation pass", () => {
    const puzzle = createEmptyCanonicalPuzzle("Thin Stock");
    const thinPiece = createCanonicalPiece("Thin", { width: 100, height: 100, depth: 0.1 }, 0.1);
    thinPiece.id = "p_thin";
    puzzle.pieces.push(thinPiece);

    const result = AIDesignValidationGate.validateAIDesign(puzzle);

    expect(result.status).toBe("REJECTED");
    expect(result.validationPasses.materialCardboardValidation).toBe(false);
    expect(result.violatedConstraints).toContain("CARDBOARD_MATERIAL_LIMITS");
    expect(result.suggestedRepairTargets.some((t) => t.targetType === "material")).toBe(true);
  });

  it("4. verifies strict export guard invariant: assertExportAllowed throws when design is rejected", () => {
    const puzzle = createEmptyCanonicalPuzzle("Empty Puzzle"); // 0 pieces -> fails 2D geometry pass
    const result = AIDesignValidationGate.validateAIDesign(puzzle);

    expect(result.status).toBe("REJECTED");
    expect(() => AIDesignValidationGate.assertExportAllowed(result)).toThrow();
  });
});
