/**
 * Mock AI Provider implementation for testing without live LLM calls.
 *
 * Implements AIGeneratorInterface, returning deterministic ParametricDesignSpecification
 * JSON objects or simulating error conditions for testing.
 */
import type { AIDesignRequest, AIGeneratorInterface, ParametricDesignSpecification } from "./types";
import { uid } from "@/core/model/ids";

export class AIMockProviderError extends Error {
  constructor(message: string) {
    super(`AIMockProviderError: ${message}`);
    this.name = "AIMockProviderError";
  }
}

export class MockAIProvider implements AIGeneratorInterface {
  public simulateMalformedResponse = false;

  async generateDesignSpecification(
    request: AIDesignRequest,
  ): Promise<ParametricDesignSpecification> {
    if (this.simulateMalformedResponse) {
      throw new AIMockProviderError("Simulated LLM network timeout / malformed response.");
    }

    if (!request.prompt || request.prompt.trim() === "") {
      throw new AIMockProviderError("Natural-language request prompt cannot be empty.");
    }

    const prefAngle = request.userPreferences?.defaultJoiningAngleDeg ?? 90.0;
    const prefMaterial = request.userPreferences?.preferredMaterialId ?? "cardboard-2mm";

    // Deterministic mock specification response
    return {
      specificationId: uid("spec_mock_"),
      overall_size: {
        widthMm: 300,
        heightMm: 200,
        depthMm: 150,
      },
      piece_count: 20,
      layers: 3,
      material: {
        stockThicknessMm: 2.0,
        stockWidthMm: 600,
        stockHeightMm: 400,
        materialId: prefMaterial,
      },
      connection_preferences: {
        defaultType: "tab_slot",
        preferredJoiningAngleDeg: prefAngle,
        genderStyle: "complementary",
      },
      difficulty: {
        level: "medium",
        maxUniquePieces: 8,
      },
      symmetry: {
        isSymmetrical: true,
        symmetryAxis: "y",
      },
      constraints: [],
    };
  }
}
