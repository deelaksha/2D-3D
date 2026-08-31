import { describe, expect, it } from "vitest";
import {
  DesignExample,
  MockDesignRetrievalSystem,
} from "@/core/puzzle";

describe("Phase 19: Design Knowledge & Retrieval Subsystem", () => {
  const retrievalSystem = new MockDesignRetrievalSystem();

  it("retrieves similar reference designs ranked by similarity score", async () => {
    const results = await retrievalSystem.findSimilarDesigns({
      targetPieceCount: 20,
      preferredConnectionType: "tab_slot",
      geometryStyle: "castle",
      difficulty: "medium",
    });

    expect(results.length).toBeGreaterThan(0);

    const topResult = results[0];
    expect(topResult.design.name).toBe("Castle Fortress 3D Box");
    expect(topResult.similarityScore).toBe(1.0);
    expect(topResult.matchingCriteria.length).toBeGreaterThan(0);
  });

  it("strictly enforces the Non-Blind-Copy mandate in referenceAdaptationGuidelines", async () => {
    const results = await retrievalSystem.findSimilarDesigns({
      targetPieceCount: 12,
      geometryStyle: "bridge",
    });

    expect(results.length).toBeGreaterThan(0);
    const topResult = results[0];

    // Verify non-blind-copy adaptation guidelines
    expect(topResult.referenceAdaptationGuidelines).toContain("DO NOT BLINDLY COPY THIS DESIGN");
    expect(topResult.referenceAdaptationGuidelines).toContain("Treat strictly as a structural & parametric reference");
  });

  it("allows indexing new reference designs into retrieval memory", async () => {
    const customDesign: DesignExample = {
      designId: "design_custom_001",
      name: "Custom Modular Tower",
      metadata: {
        pieceCount: 15,
        connectionTypes: ["dovetail"],
        difficulty: "hard",
        geometryStyle: "tower",
        materialId: "cardboard-2mm",
        dimensions: { widthMm: 150, heightMm: 350, depthMm: 150 },
        assemblyCharacteristics: { maxJoiningAngleDeg: 60.0, isNonPlanar: true, totalSteps: 5 },
        topology: { connectedComponents: 1, isTreeStructure: true, averageDegree: 2.2 },
        interfacePatterns: ["dovetail_joint"],
        tags: ["tower", "dovetail"],
      },
      parametricSpec: {
        specificationId: "spec_custom",
        overall_size: { widthMm: 150, heightMm: 350, depthMm: 150 },
        piece_count: 15,
        layers: 4,
        material: { stockThicknessMm: 2.0, stockWidthMm: 600, stockHeightMm: 400, materialId: "cardboard-2mm" },
        connection_preferences: { defaultType: "dovetail", preferredJoiningAngleDeg: 60.0, genderStyle: "neutral" },
        difficulty: { level: "hard", maxUniquePieces: 6 },
        symmetry: { isSymmetrical: true, symmetryAxis: "z" },
        constraints: [],
      },
      canonicalModelSummary: "Custom Modular Tower with 15 pieces and 60° dovetail joints.",
    };

    await retrievalSystem.indexDesign(customDesign);

    const searchResults = await retrievalSystem.findSimilarDesigns({
      preferredConnectionType: "dovetail",
      geometryStyle: "tower",
    });

    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].design.designId).toBe("design_custom_001");
  });
});
