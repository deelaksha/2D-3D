/**
 * AI Provider Abstraction & Deterministic Mock AI Provider (Phase 41).
 * Translates natural language prompts into structured DesignSpecification objects.
 * Zero direct geometry generation. Zero ML model training.
 */
import type { DesignSpecification, MissingInformationField } from "./types";

export interface AIRequest {
  prompt: string;
  previousSpec?: DesignSpecification;
  context?: Record<string, unknown>;
}

export interface AIResponse {
  rawText: string;
  specification: DesignSpecification;
  usageTokens: number;
  durationMs: number;
}

export interface AIProvider {
  parseRequirement(request: AIRequest): Promise<AIResponse>;
}

export class MockAIProvider implements AIProvider {
  async parseRequirement(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const prompt = request.prompt.trim();
    const lower = prompt.toLowerCase();

    const missingInformation: MissingInformationField[] = [];

    // 1. Piece Count Extraction
    let pieceCount: number | undefined = undefined;
    const pcMatch = lower.match(/(\d+)\s*-\s*piece|(\d+)\s*piece/);
    if (pcMatch) {
      pieceCount = parseInt(pcMatch[1] || pcMatch[2], 10);
    }

    // 2. Material Thickness Extraction
    let thicknessMm = 3.0; // default standard 3mm cardboard
    const thickMatch = lower.match(/(\d+(?:\.\d+)?)\s*mm/);
    if (thickMatch) {
      thicknessMm = parseFloat(thickMatch[1]);
    }

    // 3. Outer Boundary Dimensions Extraction
    let widthMm: number | undefined = undefined;
    let heightMm: number | undefined = undefined;
    const dimMatch = lower.match(/(\d+)\s*[x×]\s*(\d+)\s*mm/);
    if (dimMatch) {
      widthMm = parseInt(dimMatch[1], 10);
      heightMm = parseInt(dimMatch[2], 10);
    }

    // 4. Complexity & Connection Style Extraction
    let innerPieceComplexity: "simple" | "medium" | "complex" = "medium";
    if (lower.includes("more complex") || lower.includes("complex internal")) {
      innerPieceComplexity = "complex";
    } else if (lower.includes("simple")) {
      innerPieceComplexity = "simple";
    }

    let connectionStyle: "simple" | "complex" | "finger_joint" | "tab_slot" = "tab_slot";
    if (lower.includes("complex internal connections") || lower.includes("complex connections")) {
      connectionStyle = "complex";
    } else if (lower.includes("finger")) {
      connectionStyle = "finger_joint";
    }

    // 5. Assembly Angles & Articulation
    let allowedAssemblyAnglesDeg = [90.0, 180.0];
    let assemblyType: "rigid" | "articulated" | "multi_angle" = "rigid";
    if (lower.includes("different angles") || lower.includes("multi angle")) {
      allowedAssemblyAnglesDeg = [0.0, 45.0, 90.0, 135.0, 180.0];
      assemblyType = "multi_angle";
    }

    // 6. Ambiguous / Missing Information Check
    if ((lower.includes("large") || lower.includes("small") || lower.includes("huge")) && !widthMm && !heightMm) {
      missingInformation.push({
        fieldName: "outerBoundary",
        promptQuestion: "Please specify explicit outer boundary dimensions in mm (e.g. 200 x 300 mm).",
        isCritical: true,
      });
    }

    const specId = `spec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const specification: DesignSpecification = {
      specId,
      userIntent: {
        rawPrompt: prompt,
        summary: `Structured parametric specification for "${prompt.slice(0, 40)}..."`,
        category: lower.includes("furniture") ? "furniture" : "puzzle",
        primaryGoal: "Parametric 2D-to-3D cardboard puzzle assembly specification",
      },
      designParameters: {
        outerBoundary: {
          widthMm,
          heightMm,
        },
        pieceCount,
        innerPieceComplexity,
        connectionStyle,
      },
      assemblyParameters: {
        allowedAssemblyAnglesDeg,
        assemblyType,
      },
      materialParameters: {
        materialId: "cardboard_stock",
        thicknessMm,
        allowableKerfMm: 0.15,
        densityGramsPerCm3: 0.6,
      },
      hardConstraints: {
        minThicknessMm: 1.0,
        maxDimensionsMm: { widthMm: 1200, heightMm: 1200 },
        mandatoryPieceCount: pieceCount,
      },
      softPreferences: {
        preferredMaterial: "cardboard_3mm",
        preferredStyle: "interlocking_tab_slot",
        complexityPreference: innerPieceComplexity,
      },
      missingInformation,
      isValidSchema: true,
      schemaValidationErrors: [],
    };

    return {
      rawText: JSON.stringify(specification, null, 2),
      specification,
      usageTokens: 150,
      durationMs: Date.now() - startTime,
    };
  }
}
