/**
 * Deterministic Assembly & Geometry Validator.
 *
 * CRITICAL REQUIREMENT:
 * Geometry correctness must be handled deterministically by geometry/constraint/validation code,
 * NOT hallucinated by an AI model.
 */
import type { PuzzleAssembly } from "../assembly/types";
import type { PuzzlePiece } from "../piece/types";
import type { PuzzleValidationIssue, PuzzleValidationReport } from "./types";

export function validatePuzzleAssembly(
  assembly: PuzzleAssembly,
  pieces: PuzzlePiece[],
): PuzzleValidationReport {
  const issues: PuzzleValidationIssue[] = [];

  // 1. Check for unplaced pieces
  for (const placement of assembly.placements) {
    if (!placement.placed) {
      issues.push({
        level: "warning",
        code: "UNPLACED_PIECE",
        message: `Piece ${placement.pieceId} is not placed in the 3D assembly.`,
        refs: [placement.pieceId],
      });
    }
  }

  // 2. Validate connection joining angles
  for (const connection of assembly.connections) {
    if (
      Number.isNaN(connection.joiningAngleDeg) ||
      connection.joiningAngleDeg < 0 ||
      connection.joiningAngleDeg > 360
    ) {
      issues.push({
        level: "error",
        code: "INVALID_JOINING_ANGLE",
        message: `Connection ${connection.id} has out-of-range 3D joining angle (${connection.joiningAngleDeg}°).`,
        refs: [connection.id, connection.sourcePieceId, connection.targetPieceId],
      });
    }
  }

  // Determine overall severity level
  const hasError = issues.some((i) => i.level === "error");
  const hasWarning = issues.some((i) => i.level === "warning");
  const level = hasError ? "error" : hasWarning ? "warning" : "ok";

  return { level, issues };
}
