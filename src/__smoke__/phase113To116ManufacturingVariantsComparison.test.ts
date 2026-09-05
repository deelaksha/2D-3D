/**
 * Prompts 113–116: Manufacturing Layout, Variants & Comparison Tests.
 *
 * Validates:
 *  - Prompt 113: Fixed sheet layout optimization (never enlarges sheet, reports overflow)
 *  - Prompt 114: Production layout piece placements, cut paths, and margins
 *  - Prompt 115: Design variants generation (Easy, Balanced, Expert) preserving constraints
 *  - Prompt 116: Multi-metric design comparison
 */

import { describe, expect, it } from "vitest";
import { generatePuzzle } from "@/core/puzzle/highlevelapi";
import { ManufacturingLayoutOptimizer } from "@/core/puzzle/designer/manufacturingLayoutOptimizer";
import { DesignVariantsGenerator } from "@/core/puzzle/designer/designVariantsGenerator";

describe("Prompts 113–116: Manufacturing, Variants & Comparison", () => {
  it("optimizes manufacturing layout strictly within fixed sheet dimensions", async () => {
    const res = await generatePuzzle("8-piece 3mm cardboard puzzle");

    const layout = ManufacturingLayoutOptimizer.optimizeLayout(res.puzzle2D, {
      sheetWidthMm: 297, // Fixed standard A4
      sheetHeightMm: 210,
      thicknessMm: 3.0,
      marginMm: 8.0,
      spacingMm: 4.0,
    });

    expect(layout.sheetWidthMm).toBe(297);
    expect(layout.sheetHeightMm).toBe(210);
    expect(layout.materialThicknessMm).toBe(3.0);
    expect(layout.materialUtilizationPercent).toBeGreaterThan(0);
    expect(layout.totalCutLengthMm).toBeGreaterThan(0);
    expect(layout.packedPlacements.length).toBe(res.puzzle2D.pieces.length);
  });

  it("reports failure and suggests valid alternatives if pieces exceed configured sheet", async () => {
    const res = await generatePuzzle("16-piece 3mm cardboard puzzle");

    // Intentionally tiny sheet (50 x 50 mm)
    const layout = ManufacturingLayoutOptimizer.optimizeLayout(res.puzzle2D, {
      sheetWidthMm: 50,
      sheetHeightMm: 50,
      marginMm: 5,
    });

    expect(layout.sheetWidthMm).toBe(50); // Sheet is NEVER silently expanded
    expect(layout.fitsOnConfiguredSheet).toBe(false);
    expect(layout.warnings.length).toBeGreaterThan(0);
    expect(layout.suggestedAlternatives?.length).toBeGreaterThan(0);
  });

  it("generates 3 diverse design variants (Easy, Balanced, Expert)", async () => {
    const variants = await DesignVariantsGenerator.generateThreeVariants("puzzle");

    expect(variants.length).toBe(3);
    const [varA, varB, varC] = variants;

    expect(varA.difficultyLabel).toBe("Easy");
    expect(varB.difficultyLabel).toBe("Balanced");
    expect(varC.difficultyLabel).toBe("Expert");

    expect(varA.pieceCount).toBeLessThan(varC.pieceCount);
    expect(varA.difficultyScore).toBeLessThan(varC.difficultyScore);

    // Verify comparison table generation (Prompt 116)
    const comparisonItems = DesignVariantsGenerator.compareVariants(variants);
    expect(comparisonItems.length).toBeGreaterThan(0);

    const pieceCountItem = comparisonItems.find((c) => c.metricName === "Piece Count");
    expect(pieceCountItem).toBeDefined();
    expect(pieceCountItem?.values[varA.id]).toBe(varA.pieceCount);
  });
});
