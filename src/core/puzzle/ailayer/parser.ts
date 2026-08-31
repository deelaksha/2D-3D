/**
 * Robust JSON Parser for AI-Generated Specification Responses.
 *
 * Strips markdown code fences (```json ... ```) and parses structured JSON payloads.
 */
import type { ParametricDesignSpecification } from "./types";
import { assertValidParametricDesignSpecification } from "./validator";

export class AIJSONParseError extends Error {
  public rawInput: string;

  constructor(message: string, rawInput: string) {
    super(`AI JSON Parse Error: ${message}`);
    this.name = "AIJSONParseError";
    this.rawInput = rawInput;
  }
}

export function parseAISpecificationJSON(rawInput: string): ParametricDesignSpecification {
  if (!rawInput || typeof rawInput !== "string") {
    throw new AIJSONParseError("Input text is empty or non-string.", rawInput || "");
  }

  let cleaned = rawInput.trim();

  // Strip markdown code block wrapper if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    throw new AIJSONParseError(err.message || "Failed to parse JSON text.", rawInput);
  }

  // Validate parsed JSON object against strict schema
  return assertValidParametricDesignSpecification(parsed);
}
