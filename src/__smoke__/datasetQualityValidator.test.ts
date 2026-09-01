import { describe, expect, it } from "vitest";
import { DatasetQualityValidator } from "../core/puzzle/validation/datasetQualityValidator";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../core/puzzle/canonical/defaults";

describe("Dataset Quality Validator Subsystem (Step 38)", () => {
  it("1. passes quality checks (PASS) for valid canonical puzzle with annotation", () => {
    const puzzle = createEmptyCanonicalPuzzle("Valid Dataset Item");
    puzzle.metadata.id = "puz_valid_1";
    puzzle.pieces = [createCanonicalPiece("Piece A", { width: 100, height: 80, depth: 3 }, 3)];

    const annotation = {
      annotationId: "ann_valid_1",
      puzzleId: "puz_valid_1",
      version: 1,
      status: "CORRECT" as const,
      edits: [],
      reviewerId: "alice",
      createdIso: new Date().toISOString(),
      lastModifiedIso: new Date().toISOString(),
    };

    const report = DatasetQualityValidator.validateItem(puzzle, annotation);

    expect(report.status).toBe("PASS");
    expect(report.failureReasons.length).toBe(0);
    expect(report.reviewReasons.length).toBe(0);
    expect(report.overallScore).toBe(1.0);
  });

  it("2. fails quality checks (FAIL) when puzzle contains 0 pieces or schema violations", () => {
    const puzzle = createEmptyCanonicalPuzzle("Empty Puzzle");
    puzzle.metadata.id = "puz_invalid_1";
    puzzle.pieces = []; // 0 pieces

    const report = DatasetQualityValidator.validateItem(puzzle);

    expect(report.status).toBe("FAIL");
    expect(report.failureReasons.some((r) => r.includes("0 pieces"))).toBe(true);
  });

  it("3. requires review (REVIEW_REQUIRED) when annotation is missing or status is UNCERTAIN", () => {
    const puzzle = createEmptyCanonicalPuzzle("Unannotated Item");
    puzzle.metadata.id = "puz_unannotated_1";
    puzzle.pieces = [createCanonicalPiece("Piece A", { width: 100, height: 80, depth: 3 }, 3)];

    const report = DatasetQualityValidator.validateItem(puzzle);

    expect(report.status).toBe("REVIEW_REQUIRED");
    expect(report.reviewReasons.some((r) => r.includes("Missing human review"))).toBe(true);
  });
});
