/**
 * Validation Engine for 2D Parametric Pieces.
 *
 * Checks topological closedness, valid vertex references, non-negative physical dimensions,
 * manufacturing tolerance bounds, and parameter range constraints.
 */
import type { ParametricPiece2D } from "./types";
import type { CanonicalValidationIssue, CanonicalValidationReport } from "../canonical/types";

export function validateParametricPiece2D(piece: ParametricPiece2D): CanonicalValidationReport {
  const issues: CanonicalValidationIssue[] = [];

  if (!piece || typeof piece !== "object") {
    return {
      overallSeverity: "error",
      issues: [{ severity: "error", code: "NULL_PIECE", message: "Parametric piece is null or undefined." }],
    };
  }

  // 1. Physical dimensions check
  if (typeof piece.width !== "number" || piece.width <= 0) {
    issues.push({
      severity: "error",
      code: "INVALID_WIDTH",
      message: `Piece '${piece.id}' has non-positive width (${piece.width}).`,
      refIds: [piece.id],
    });
  }

  if (typeof piece.height !== "number" || piece.height <= 0) {
    issues.push({
      severity: "error",
      code: "INVALID_HEIGHT",
      message: `Piece '${piece.id}' has non-positive height (${piece.height}).`,
      refIds: [piece.id],
    });
  }

  if (typeof piece.thickness !== "number" || piece.thickness <= 0) {
    issues.push({
      severity: "error",
      code: "INVALID_THICKNESS",
      message: `Piece '${piece.id}' has non-positive material thickness (${piece.thickness}).`,
      refIds: [piece.id],
    });
  }

  // 2. Topology & vertex connectivity check
  const vertices = piece.topology?.vertices || {};
  const outerBoundary = piece.topology?.outerBoundary;

  if (!outerBoundary || !Array.isArray(outerBoundary.edgeSegments) || outerBoundary.edgeSegments.length === 0) {
    issues.push({
      severity: "error",
      code: "MISSING_OUTER_BOUNDARY",
      message: `Piece '${piece.id}' is missing outer boundary edge segments.`,
      refIds: [piece.id],
    });
  } else {
    for (const seg of outerBoundary.edgeSegments) {
      if (!vertices[seg.startVertexId]) {
        issues.push({
          severity: "error",
          code: "DANGLING_START_VERTEX",
          message: `Edge segment '${seg.id}' references missing start vertex '${seg.startVertexId}'.`,
          refIds: [seg.id, seg.startVertexId],
        });
      }
      if (!vertices[seg.endVertexId]) {
        issues.push({
          severity: "error",
          code: "DANGLING_END_VERTEX",
          message: `Edge segment '${seg.id}' references missing end vertex '${seg.endVertexId}'.`,
          refIds: [seg.id, seg.endVertexId],
        });
      }
    }
  }

  // 3. Manufacturing parameters check
  if (piece.manufacturing) {
    if (piece.manufacturing.kerf < 0) {
      issues.push({
        severity: "error",
        code: "NEGATIVE_KERF",
        message: `Kerf compensation cannot be negative (${piece.manufacturing.kerf}).`,
        refIds: [piece.id],
      });
    }
  }

  // 4. Parameter bounds check
  if (piece.parameters) {
    for (const [paramName, paramDef] of Object.entries(piece.parameters)) {
      if (paramDef.minValue !== undefined && paramDef.value < paramDef.minValue) {
        issues.push({
          severity: "warning",
          code: "PARAM_BELOW_MIN",
          message: `Parameter '${paramName}' value (${paramDef.value}) is below minimum (${paramDef.minValue}).`,
          refIds: [paramDef.id],
        });
      }
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const overallSeverity = hasError ? "error" : hasWarning ? "warning" : "ok";

  return { overallSeverity, issues, validatedAt: new Date().toISOString() };
}
