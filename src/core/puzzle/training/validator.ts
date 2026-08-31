/**
 * Dataset Schema Validator for Future ML Training Pipelines.
 *
 * Verifies that a dataset item complies strictly with the 17-step parametric puzzle schema
 * and preserves the clear boundary between DESIGN PARAMETERS and ASSEMBLY PARAMETERS.
 */
import type { CompleteDatasetItem } from "./types";

export interface DatasetValidationReport {
  isValid: boolean;
  errors: string[];
}

export function validateDatasetItem(item: any): DatasetValidationReport {
  const errors: string[] = [];

  if (!item || typeof item !== "object") {
    return {
      isValid: false,
      errors: ["Dataset item payload is null, undefined, or non-object."],
    };
  }

  // 1. Version check
  if (item.version !== "1.0.0") {
    errors.push(`Invalid dataset item schema version: expected '1.0.0', got '${item.version}'.`);
  }

  // 2. User Requirement check
  if (!item.userRequirement || typeof item.userRequirement.prompt !== "string") {
    errors.push("Missing or invalid 'userRequirement.prompt'.");
  }

  // 3. Pieces & Design Parameters check
  if (!Array.isArray(item.pieces) || item.pieces.length === 0) {
    errors.push("Dataset item must contain non-empty 'pieces' array.");
  } else {
    for (const p of item.pieces) {
      if (!p.designParameters || typeof p.designParameters.widthMm !== "number") {
        errors.push(`Piece '${p.pieceId}' is missing native 2D DESIGN PARAMETER 'widthMm'.`);
      }
    }
  }

  // 4. Assembly Parameters check
  if (!item.assembly || typeof item.assembly.pieceTransforms !== "object") {
    errors.push("Dataset item missing ASSEMBLY PARAMETER 'assembly.pieceTransforms' object.");
  }

  // 5. Connections & Joining Angles check
  if (Array.isArray(item.connections)) {
    for (const c of item.connections) {
      if (typeof c.joiningAngleDeg !== "number") {
        errors.push(`Connection '${c.connectionId}' missing ASSEMBLY PARAMETER 'joiningAngleDeg'.`);
      }
    }
  }

  // 6. Validation & Failure reasons check
  if (!item.validation || typeof item.validation.isValid !== "boolean") {
    errors.push("Dataset item missing 'validation.isValid' boolean status.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
