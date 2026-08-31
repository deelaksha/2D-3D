/**
 * Schema Validator for AI-Generated Parametric Design Specifications.
 *
 * Verifies that AI outputs conform to strict structural and numeric parameter rules
 * before being passed to the authoritative deterministic geometry engine.
 */
import type { AISpecificationValidationReport, ParametricDesignSpecification } from "./types";

export class AISpecificationValidationError extends Error {
  public errors: string[];

  constructor(errors: string[]) {
    super(`AI Specification Schema Validation Failed: ${errors.join("; ")}`);
    this.name = "AISpecificationValidationError";
    this.errors = errors;
  }
}

export function validateParametricDesignSpecification(
  spec: any,
): AISpecificationValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!spec || typeof spec !== "object") {
    return {
      isValid: false,
      errors: ["Specification payload is null, undefined, or non-object."],
      warnings: [],
    };
  }

  // 1. Specification ID check
  if (!spec.specificationId || typeof spec.specificationId !== "string") {
    errors.push("Missing or invalid string 'specificationId'.");
  }

  // 2. Overall Size check
  if (!spec.overall_size || typeof spec.overall_size !== "object") {
    errors.push("Missing 'overall_size' object.");
  } else {
    const { widthMm, heightMm, depthMm } = spec.overall_size;
    if (typeof widthMm !== "number" || widthMm <= 0) {
      errors.push(`overall_size.widthMm must be positive number (${widthMm}).`);
    }
    if (typeof heightMm !== "number" || heightMm <= 0) {
      errors.push(`overall_size.heightMm must be positive number (${heightMm}).`);
    }
    if (typeof depthMm !== "number" || depthMm <= 0) {
      errors.push(`overall_size.depthMm must be positive number (${depthMm}).`);
    }
  }

  // 3. Piece count check
  if (typeof spec.piece_count !== "number" || spec.piece_count < 1) {
    errors.push(`piece_count must be integer >= 1 (${spec.piece_count}).`);
  }

  // 4. Layers check
  if (typeof spec.layers !== "number" || spec.layers < 1) {
    errors.push(`layers must be integer >= 1 (${spec.layers}).`);
  }

  // 5. Material check
  if (!spec.material || typeof spec.material !== "object") {
    errors.push("Missing 'material' object.");
  } else {
    const { stockThicknessMm, stockWidthMm, stockHeightMm, materialId } = spec.material;
    if (typeof stockThicknessMm !== "number" || stockThicknessMm <= 0) {
      errors.push(`material.stockThicknessMm must be positive number (${stockThicknessMm}).`);
    }
    if (typeof stockWidthMm !== "number" || stockWidthMm <= 0) {
      errors.push(`material.stockWidthMm must be positive number (${stockWidthMm}).`);
    }
    if (typeof stockHeightMm !== "number" || stockHeightMm <= 0) {
      errors.push(`material.stockHeightMm must be positive number (${stockHeightMm}).`);
    }
    if (typeof materialId !== "string" || materialId.trim() === "") {
      errors.push("material.materialId must be non-empty string.");
    }
  }

  // 6. Connection preferences check
  if (!spec.connection_preferences || typeof spec.connection_preferences !== "object") {
    errors.push("Missing 'connection_preferences' object.");
  }

  // 7. Difficulty check
  if (!spec.difficulty || typeof spec.difficulty !== "object") {
    errors.push("Missing 'difficulty' object.");
  } else {
    const validLevels = ["easy", "medium", "hard", "expert"];
    if (!validLevels.includes(spec.difficulty.level)) {
      errors.push(`difficulty.level must be one of [${validLevels.join(", ")}] (${spec.difficulty.level}).`);
    }
  }

  // 8. Symmetry check
  if (!spec.symmetry || typeof spec.symmetry !== "object") {
    errors.push("Missing 'symmetry' object.");
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
  };
}

export function assertValidParametricDesignSpecification(spec: any): ParametricDesignSpecification {
  const report = validateParametricDesignSpecification(spec);
  if (!report.isValid) {
    throw new AISpecificationValidationError(report.errors);
  }
  return spec as ParametricDesignSpecification;
}
