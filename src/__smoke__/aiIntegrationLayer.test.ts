import { describe, expect, it } from "vitest";
import {
  AIJSONParseError,
  AIMockProviderError,
  AISpecificationValidationError,
  MockAIProvider,
  parseAISpecificationJSON,
  validateParametricDesignSpecification,
} from "@/core/puzzle";

describe("Phase 16: AI Integration Layer", () => {
  it("generates a valid ParametricDesignSpecification via MockAIProvider", async () => {
    const provider = new MockAIProvider();
    const spec = await provider.generateDesignSpecification({
      prompt: "Create a 3D cardboard castle puzzle with 20 pieces and 3 layers",
      userPreferences: { defaultJoiningAngleDeg: 90.0 },
    });

    expect(spec.specificationId).toBeDefined();
    expect(spec.piece_count).toBe(20);
    expect(spec.layers).toBe(3);
    expect(spec.overall_size.widthMm).toBe(300);
    expect(spec.connection_preferences.preferredJoiningAngleDeg).toBe(90.0);

    const report = validateParametricDesignSpecification(spec);
    expect(report.isValid).toBe(true);
    expect(report.errors.length).toBe(0);
  });

  it("parses raw response JSON wrapped in markdown code fences", () => {
    const jsonBody = JSON.stringify({
      specificationId: "spec_test_101",
      overall_size: { widthMm: 250, heightMm: 150, depthMm: 100 },
      piece_count: 15,
      layers: 2,
      material: { stockThicknessMm: 2.0, stockWidthMm: 600, stockHeightMm: 400, materialId: "cardboard-2mm" },
      connection_preferences: { defaultType: "tab_slot", preferredJoiningAngleDeg: 90.0, genderStyle: "complementary" },
      difficulty: { level: "easy", maxUniquePieces: 5 },
      symmetry: { isSymmetrical: false, symmetryAxis: "x" },
      constraints: [],
    });

    const rawMarkdown = "```json\n" + jsonBody + "\n```";

    const parsed = parseAISpecificationJSON(rawMarkdown);
    expect(parsed.specificationId).toBe("spec_test_101");
    expect(parsed.piece_count).toBe(15);
    expect(parsed.layers).toBe(2);
  });

  it("rejects invalid specifications via schema validator", () => {
    const invalidSpec = {
      specificationId: "spec_invalid",
      overall_size: { widthMm: -100, heightMm: 0, depthMm: 50 }, // Non-positive
      piece_count: 0, // < 1
      layers: 0, // < 1
      material: { stockThicknessMm: 0, stockWidthMm: 600, stockHeightMm: 400, materialId: "" },
      connection_preferences: { defaultType: "tab_slot", preferredJoiningAngleDeg: 90, genderStyle: "normal" },
      difficulty: { level: "ultra_hard", maxUniquePieces: 0 }, // Invalid level
      symmetry: { isSymmetrical: true, symmetryAxis: "y" },
      constraints: [],
    };

    const report = validateParametricDesignSpecification(invalidSpec);
    expect(report.isValid).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors.some((e) => e.includes("overall_size.widthMm"))).toBe(true);
    expect(report.errors.some((e) => e.includes("piece_count"))).toBe(true);
  });

  it("throws AISpecificationValidationError when parsing invalid schema JSON", () => {
    const invalidJSON = JSON.stringify({
      specificationId: "spec_bad",
      overall_size: { widthMm: -50, heightMm: 100, depthMm: 100 },
      piece_count: 5,
    });

    expect(() => parseAISpecificationJSON(invalidJSON)).toThrow(AISpecificationValidationError);
  });

  it("handles mock AI provider simulated error responses", async () => {
    const provider = new MockAIProvider();
    provider.simulateMalformedResponse = true;

    await expect(
      provider.generateDesignSpecification({ prompt: "Test prompt" }),
    ).rejects.toThrow(AIMockProviderError);
  });
});
