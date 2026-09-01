import { describe, expect, it } from "vitest";
import { PuzzleReviewManager } from "../core/puzzle/annotation/reviewManager";
import { createEmptyCanonicalPuzzle } from "../core/puzzle/canonical/defaults";

describe("Dataset Annotation & Human Review Subsystem (Step 37)", () => {
  it("1. initializes human review session and marks evaluation status (CORRECT, INCORRECT, UNCERTAIN)", () => {
    const puzzle = createEmptyCanonicalPuzzle("Test Review Puzzle");
    puzzle.metadata.id = "puz_review_1";

    const manager = new PuzzleReviewManager();
    const session = manager.startReviewSession(puzzle, "reviewer_alice");

    expect(session.puzzleId).toBe("puz_review_1");
    expect(session.status).toBe("UNCERTAIN");

    const updated = manager.markStatus("puz_review_1", "CORRECT", "reviewer_alice", "Verified geometry and tab-slot interfaces.");

    expect(updated.status).toBe("CORRECT");
    expect(updated.version).toBe(2);
    expect(updated.notes).toContain("Verified geometry");
  });

  it("2. records manual edit history audit log without mutating original source data", () => {
    const puzzle = createEmptyCanonicalPuzzle("Test Edit Audit");
    puzzle.metadata.id = "puz_edit_1";

    const manager = new PuzzleReviewManager();
    manager.startReviewSession(puzzle, "reviewer_bob");

    const updated = manager.recordEdit(
      "puz_edit_1",
      "reviewer_bob",
      "parameter",
      "tab_width",
      10.0,
      10.2,
      "Adjusted tab width for cutter kerf tolerance."
    );

    expect(updated.edits.length).toBe(1);
    const edit = updated.edits[0];
    expect(edit.target).toBe("parameter");
    expect(edit.targetId).toBe("tab_width");
    expect(edit.oldValue).toBe(10.0);
    expect(edit.newValue).toBe(10.2);
    expect(edit.reason).toContain("cutter kerf");
  });
});
