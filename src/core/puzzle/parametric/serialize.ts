/**
 * Serialization and Deserialization Engine for 2D Parametric Pieces.
 */
import type { ParametricPiece2D } from "./types";
import { regenerateParametricPieceGeometry } from "./regenerator";
import { validateParametricPiece2D } from "./validate";

export function serializeParametricPiece2D(piece: ParametricPiece2D): string {
  return JSON.stringify(piece, null, 2);
}

export function deserializeParametricPiece2D(jsonString: string): ParametricPiece2D {
  if (!jsonString || typeof jsonString !== "string") {
    throw new Error("Cannot deserialize empty input string.");
  }

  const parsed = JSON.parse(jsonString) as ParametricPiece2D;

  // Validate structural integrity
  const validation = validateParametricPiece2D(parsed);
  if (validation.overallSeverity === "error") {
    const msgs = validation.issues.filter((i) => i.severity === "error").map((i) => i.message).join("; ");
    throw new Error(`Failed to deserialize parametric piece: ${msgs}`);
  }

  // Regenerate topology and geometry from parsed parameters
  return regenerateParametricPieceGeometry(parsed);
}
