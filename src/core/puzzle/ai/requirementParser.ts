/**
 * Requirement Parser Coordinator (Phase 41).
 * Main entrypoint for translating natural language requirement prompts into validated DesignSpecification objects.
 */
import type { AIProvider, AIRequest } from "./aiProvider";
import { MockAIProvider } from "./aiProvider";
import type { DesignSpecification } from "./types";

export interface RequirementParserInterface {
  parseRequirement(promptOrRequest: string | AIRequest): Promise<DesignSpecification>;
}

export class RequirementParser implements RequirementParserInterface {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || new MockAIProvider();
  }

  /**
   * Translates a natural language user prompt into a structured, validated DesignSpecification.
   */
  async parseRequirement(promptOrRequest: string | AIRequest): Promise<DesignSpecification> {
    const request: AIRequest =
      typeof promptOrRequest === "string"
        ? { prompt: promptOrRequest }
        : promptOrRequest;

    const response = await this.provider.parseRequirement(request);
    const spec = response.specification;

    // Execute deterministic schema validation
    const errors: string[] = [];

    if (!spec.userIntent || !spec.userIntent.rawPrompt) {
      errors.push("Missing required userIntent metadata.");
    }

    if (!spec.materialParameters || spec.materialParameters.thicknessMm <= 0) {
      errors.push("Material thickness must be greater than zero.");
    }

    spec.isValidSchema = errors.length === 0;
    spec.schemaValidationErrors = errors;

    return spec;
  }
}
