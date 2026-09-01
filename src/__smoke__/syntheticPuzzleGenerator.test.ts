import { describe, expect, it } from "vitest";
import { SyntheticPuzzleGenerator } from "../core/puzzle/generator/syntheticGenerator";
import type { SyntheticGenerationConfig } from "../core/puzzle/generator/types";

describe("Synthetic Puzzle Data Generator Subsystem (Phase 42)", () => {
  const defaultConfig: SyntheticGenerationConfig = {
    seed: 42,
    pieceCountRange: [3, 5],
    thicknessMmRange: [3.0, 3.0],
    dimensionMmRange: [60, 100],
    tabWidthMmRange: [15, 20],
    slotWidthMmRange: [15, 20],
    clearanceMmRange: [0.1, 0.2],
    connectionTypes: ["tab_slot"],
    joiningAnglesDeg: [90],
    symmetryMode: "none",
    layers: 1,
    targetValidity: "valid",
  };

  it("1. guarantees seed determinism (same seed produces identical synthetic puzzle examples)", () => {
    const ex1 = SyntheticPuzzleGenerator.generateExample(defaultConfig);
    const ex2 = SyntheticPuzzleGenerator.generateExample(defaultConfig);

    expect(ex1.exampleId).toBe(ex2.exampleId);
    expect(ex1.canonicalPuzzle.pieces.length).toBe(ex2.canonicalPuzzle.pieces.length);
    expect(ex1.canonicalPuzzle.pieces[0].dimensions.width).toBe(ex2.canonicalPuzzle.pieces[0].dimensions.width);
  });

  it("2. generates valid synthetic puzzle examples (isValid: true, validationStatus: PASS)", () => {
    const ex = SyntheticPuzzleGenerator.generateExample(defaultConfig);

    expect(ex.isValid).toBe(true);
    expect(ex.validationResult.status).toBe("PASS");
    expect(ex.canonicalPuzzle.pieces.length).toBeGreaterThanOrEqual(3);
    expect(ex.canonicalPuzzle.connections.length).toBeGreaterThan(0);
    expect(ex.connectionGraph).toBeDefined();
    expect(ex.assemblyPlacements.size).toBe(ex.canonicalPuzzle.pieces.length);
  });

  it("3. generates invalid synthetic puzzle examples with explicit failure reasons (incompatible_interfaces)", () => {
    const invalidConfig: SyntheticGenerationConfig = {
      ...defaultConfig,
      seed: 101,
      targetValidity: "invalid",
      specificInvalidityReason: "incompatible_interfaces",
    };

    const ex = SyntheticPuzzleGenerator.generateExample(invalidConfig);

    expect(ex.isValid).toBe(false);
    expect(ex.invalidityReason).toBe("incompatible_interfaces");
    expect(ex.validationResult.status).toBe("FAIL");
    expect(ex.validationResult.failureReasons.some((r) => r.includes("INCORRECT") || r.includes("Incompatible"))).toBe(true);
  });

  it("4. generates invalid synthetic puzzle examples with degenerate dimensions (invalid_dimensions)", () => {
    const invalidConfig: SyntheticGenerationConfig = {
      ...defaultConfig,
      seed: 202,
      targetValidity: "invalid",
      specificInvalidityReason: "invalid_dimensions",
    };

    const ex = SyntheticPuzzleGenerator.generateExample(invalidConfig);

    expect(ex.isValid).toBe(false);
    expect(ex.invalidityReason).toBe("invalid_dimensions");
    expect(ex.validationResult.status).toBe("FAIL");
    expect(ex.validationResult.failureReasons.some((r) => r.includes("dimensions"))).toBe(true);
  });

  it("5. verifies complete output object structure", () => {
    const ex = SyntheticPuzzleGenerator.generateExample(defaultConfig);

    expect(ex.exampleId).toBeDefined();
    expect(ex.inputParameters).toBeDefined();
    expect(ex.canonicalPuzzle).toBeDefined();
    expect(ex.geometry).toBeDefined();
    expect(ex.connectionGraph).toBeDefined();
    expect(ex.assemblyPlacements).toBeDefined();
    expect(ex.validationResult).toBeDefined();
  });
});
