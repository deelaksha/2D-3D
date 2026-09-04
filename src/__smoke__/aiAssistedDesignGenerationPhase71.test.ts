/**
 * End-to-End Tests for Phase 71:
 * AI-Assisted Puzzle Design Generation Workflow
 */

import { describe, it, expect } from "vitest";
import {
  AIDesignGenerator,
  AIDesignGenerationRequest,
  DesignValidationPipeline,
} from "../core/puzzle/designgeneration";
import { DesignRetriever, ReferenceDesignProtector } from "../core/puzzle/retrievalsystem";

describe("Phase 71: AI-Assisted Puzzle Design Generation Workflow", () => {
  describe("1. Pure Natural-Language Prompt Generation", () => {
    it("generates an accepted parametric design specification passing all 5 validation gates", async () => {
      const request: AIDesignGenerationRequest = {
        prompt: "Create a sturdy desk organizer with 4 interlocking pieces for stationery",
        userPreferences: {
          targetPieceCount: 4,
          targetDimensions: { widthMm: 220, heightMm: 140, depthMm: 120 },
          preferredJointType: "tab_slot",
          targetDifficulty: "medium",
        },
      };

      const result = await AIDesignGenerator.generateDesign(request);

      // Verify overall acceptance
      expect(result.status).toBe("ACCEPTED");
      expect(result.generationId).toBeDefined();

      // Verify specification structure (Strictly NO raw mesh vertices or CAD meshes)
      expect(result.specification).toBeDefined();
      expect(result.specification.specificationId).toBeDefined();
      expect(result.specification.piece_count).toBe(4);
      expect(result.specification.overall_size.widthMm).toBe(220);
      expect((result.specification as any).vertices).toBeUndefined();
      expect((result.specification as any).mesh).toBeUndefined();

      // Verify 11-domain reasoning summary
      const reasoning = result.reasoningSummary;
      expect(reasoning.pieceCountReasoning).toContain("4 pieces");
      expect(reasoning.geometryReasoning).toContain("220x140x120");
      expect(reasoning.interfacesReasoning).toContain("tab_slot");
      expect(reasoning.connectionsReasoning).toContain("interconnected");
      expect(reasoning.materialReasoning).toContain("cardboard");
      expect(reasoning.cardboardDimensionsReasoning).toContain("cardboard sheet");
      expect(reasoning.difficultyReasoning).toContain("medium");
      expect(reasoning.assemblyFlexibilityReasoning).toContain("linear insertion");
      expect(reasoning.allowedAnglesReasoning).toContain("joining angle");
      expect(reasoning.layersReasoning).toContain("layer");
      expect(reasoning.manufacturingConstraintsReasoning).toContain("kerf");

      // Verify all 5 validation gates passed
      const passes = result.validationReport.passes;
      expect(passes.schemaValidation).toBe(true);
      expect(passes.hardConstraintValidation).toBe(true);
      expect(passes.geometryValidation).toBe(true);
      expect(passes.connectionValidation).toBe(true);
      expect(passes.validation3D).toBe(true);
      expect(passes.overallPassed).toBe(true);
      expect(result.validationReport.errors.length).toBe(0);

      // Verify compiled CanonicalPuzzle
      expect(result.canonicalPuzzle).toBeDefined();
      expect(result.canonicalPuzzle!.pieces.length).toBe(4);
      expect(result.canonicalPuzzle!.interfaces.length).toBe(6); // 3 pairs
      expect(result.canonicalPuzzle!.connections.length).toBe(3);
    });
  });

  describe("2. Generation with Retrieved Design References (Anti-Cloning Enforcement)", () => {
    it("adapts a retrieved reference design without cloning its IDs or geometry", async () => {
      const retriever = new DesignRetriever();
      const retrievalRes = await retriever.retrieveDesigns({ naturalLanguagePrompt: "storage box" }, 1);
      const ref = retrievalRes.topMatch;
      expect(ref).toBeDefined();

      const request: AIDesignGenerationRequest = {
        prompt: "Design a customized modular box with adapted dimensions",
        retrievedDesigns: [ref!],
        userPreferences: {
          targetPieceCount: 5, // Requesting 5 pieces instead of reference's 3 pieces
          targetDimensions: { widthMm: 180, heightMm: 120, depthMm: 80 },
        },
      };

      const result = await AIDesignGenerator.generateDesign(request);

      expect(result.status).toBe("ACCEPTED");
      expect(result.specification.piece_count).toBe(5);

      // Verify adaptation notes exist
      expect(result.referenceAdaptationNotes).toBeDefined();
      expect(result.referenceAdaptationNotes!.length).toBeGreaterThan(0);

      // Verify Anti-Cloning invariant using ReferenceDesignProtector
      const audit = ReferenceDesignProtector.assertNotCloned(
        ref!.canonicalPuzzle,
        result.canonicalPuzzle!
      );
      expect(audit.isDifferent).toBe(true);
      expect(audit.auditReasons.length).toBeGreaterThan(0);
    });
  });

  describe("3. Generation with Optional Reference Image", () => {
    it("infers geometric proportion adjustments from reference image input", async () => {
      const request: AIDesignGenerationRequest = {
        prompt: "Hexagonal tabletop puzzle container",
        referenceImageBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        userPreferences: {
          targetPieceCount: 3,
          targetDimensions: { widthMm: 150, heightMm: 100, depthMm: 90 },
        },
      };

      const result = await AIDesignGenerator.generateDesign(request);

      expect(result.status).toBe("ACCEPTED");
      expect(result.specification.overall_size.widthMm).toBe(165); // 150 * 1.1 = 165
      expect(result.specification.overall_size.heightMm).toBe(95);  // 100 * 0.95 = 95
      expect(result.validationReport.passes.overallPassed).toBe(true);
    });
  });

  describe("4. Non-90-Degree Joining Angle Reasoning", () => {
    it("reasons about and compiles a 45.0° angled puzzle assembly specification", async () => {
      const request: AIDesignGenerationRequest = {
        prompt: "Create an angled corner display stand with 45 degree miter joints",
        userPreferences: {
          targetPieceCount: 3,
          defaultJoiningAngleDeg: 45.0,
        },
      };

      const result = await AIDesignGenerator.generateDesign(request);

      expect(result.status).toBe("ACCEPTED");
      expect(result.specification.connection_preferences.preferredJoiningAngleDeg).toBe(45.0);
      expect(result.reasoningSummary.allowedAnglesReasoning).toContain("45°");

      // Verify compiled puzzle connection angle
      const conn = result.canonicalPuzzle!.connections[0];
      expect(conn.allowedAngleRange?.targetAngleDeg).toBe(45.0);
      expect(result.validationReport.passes.validation3D).toBe(true);
    });
  });

  describe("5. Rejection of Invalid Specifications", () => {
    it("strictly rejects a specification with piece_count < 2 (Hard Constraint failure)", () => {
      const invalidSpec = {
        specificationId: "spec_invalid_1pc",
        overall_size: { widthMm: 100, heightMm: 100, depthMm: 50 },
        piece_count: 1, // INVALID: < 2 pieces
        layers: 1,
        material: {
          stockThicknessMm: 2.0,
          stockWidthMm: 600,
          stockHeightMm: 400,
          materialId: "cardboard-2mm",
        },
        connection_preferences: {
          defaultType: "tab_slot",
          preferredJoiningAngleDeg: 90.0,
          genderStyle: "complementary",
        },
        difficulty: { level: "easy" as const, maxUniquePieces: 1 },
        symmetry: { isSymmetrical: false, symmetryAxis: "y" as const },
        constraints: [],
      };

      const validation = DesignValidationPipeline.validateDesign(invalidSpec);

      expect(validation.overallPassed).toBe(false);
      expect(validation.passes.hardConstraintValidation).toBe(false);
      expect(validation.errors.some((e) => e.includes("piece count must be >= 2"))).toBe(true);
    });

    it("strictly rejects a specification that exceeds cardboard sheet stock dimensions", () => {
      const oversizedSpec = {
        specificationId: "spec_oversized",
        overall_size: { widthMm: 950, heightMm: 100, depthMm: 50 }, // 950 > 600mm stock
        piece_count: 4,
        layers: 1,
        material: {
          stockThicknessMm: 2.0,
          stockWidthMm: 600,
          stockHeightMm: 400,
          materialId: "cardboard-2mm",
        },
        connection_preferences: {
          defaultType: "tab_slot",
          preferredJoiningAngleDeg: 90.0,
          genderStyle: "complementary",
        },
        difficulty: { level: "easy" as const, maxUniquePieces: 4 },
        symmetry: { isSymmetrical: false, symmetryAxis: "y" as const },
        constraints: [],
      };

      const validation = DesignValidationPipeline.validateDesign(oversizedSpec);

      expect(validation.overallPassed).toBe(false);
      expect(validation.passes.hardConstraintValidation).toBe(false);
      expect(validation.errors.some((e) => e.includes("exceeds stock width"))).toBe(true);
    });
  });
});
