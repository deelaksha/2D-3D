/**
 * Serialization and Deserialization Engine for Canonical Puzzle Representations.
 *
 * Provides JSON import/export functions with schema version tracking and validation
 * against malformed data.
 */
import type { CanonicalPuzzle, CanonicalValidationReport } from "./types";
import { CANONICAL_SCHEMA_VERSION } from "./types";
import { validateCanonicalPuzzle } from "./validate";

export interface SerializationOptions {
  pretty?: boolean;
}

export function serializeCanonicalPuzzle(
  puzzle: CanonicalPuzzle,
  options: SerializationOptions = { pretty: true },
): string {
  // Ensure schema version is stamped before serialization
  const payload: CanonicalPuzzle = {
    ...puzzle,
    metadata: {
      ...puzzle.metadata,
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    },
  };

  return JSON.stringify(payload, null, options.pretty ? 2 : undefined);
}

export interface DeserializationResult {
  puzzle: CanonicalPuzzle;
  validationReport: CanonicalValidationReport;
}

export function deserializeCanonicalPuzzle(jsonString: string): DeserializationResult {
  if (!jsonString || typeof jsonString !== "string") {
    throw new Error("Cannot deserialize empty or non-string input JSON.");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error(`JSON syntax error during deserialization: ${err?.message || err}`);
  }

  // Schema version migration check (if schema version is older, migrate here in future)
  if (!parsed.metadata) {
    parsed.metadata = { id: "migrated_puzzle", name: "Imported Puzzle", schemaVersion: CANONICAL_SCHEMA_VERSION };
  }

  const validationReport = validateCanonicalPuzzle(parsed);

  if (validationReport.overallSeverity === "error") {
    const errorMessages = validationReport.issues
      .filter((i) => i.severity === "error")
      .map((i) => `[${i.code}] ${i.message}`)
      .join("; ");
    throw new Error(`Deserialized canonical puzzle failed validation: ${errorMessages}`);
  }

  return {
    puzzle: parsed as CanonicalPuzzle,
    validationReport,
  };
}
