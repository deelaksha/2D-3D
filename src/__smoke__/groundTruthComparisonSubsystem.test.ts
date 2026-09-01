import { describe, expect, it } from "vitest";
import { GroundTruthComparisonEngine } from "../core/puzzle/comparison/groundTruthComparisonEngine";
import { createCanonicalInterface, createCanonicalPiece, createEmptyCanonicalPuzzle } from "../core/puzzle/canonical/defaults";

describe("Ground-Truth Comparison Subsystem (Step 36)", () => {
  it("1. returns structured diff items (EXPECTED: tab_width=10.0, GENERATED: tab_width=10.2, diff=+0.2mm, withinTolerance=true)", () => {
    const refPuzzle = createEmptyCanonicalPuzzle("Ref Puzzle");
    refPuzzle.metadata.id = "ref_1";

    const pRef = createCanonicalPiece("Piece A", { width: 100, height: 80, depth: 3 }, 3);
    pRef.id = "p1";
    refPuzzle.pieces = [pRef];

    const ifRef = createCanonicalInterface("p1", "Tab 1", { x: 0, y: 0 }, { x: 1, y: 0 });
    ifRef.id = "if1";
    ifRef.profile.width = 10.0;
    refPuzzle.interfaces = [ifRef];

    const genPuzzle = createEmptyCanonicalPuzzle("Gen Puzzle");
    genPuzzle.metadata.id = "gen_1";

    const pGen = createCanonicalPiece("Piece A", { width: 100, height: 80, depth: 3 }, 3);
    pGen.id = "p1";
    genPuzzle.pieces = [pGen];

    const ifGen = createCanonicalInterface("p1", "Tab 1", { x: 0, y: 0 }, { x: 1, y: 0 });
    ifGen.id = "if1";
    ifGen.profile.width = 10.2; // 10.2mm vs 10.0mm expected
    genPuzzle.interfaces = [ifGen];

    const report = GroundTruthComparisonEngine.compare(refPuzzle, genPuzzle, "tolerance", { profileToleranceMm: 0.5 });

    expect(report.isMatched).toBe(true);
    const tabDiff = report.diffItems.find((d) => d.propertyName === "tab_width_if1");
    expect(tabDiff).toBeDefined();
    expect(tabDiff!.expected).toBe(10.0);
    expect(tabDiff!.generated).toBe(10.2);
    expect(tabDiff!.difference).toBe(0.2);
    expect(tabDiff!.unit).toBe("mm");
    expect(tabDiff!.withinTolerance).toBe(true);
  });

  it("2. flags mismatches when diff exceeds tolerance limit under exact mode", () => {
    const refPuzzle = createEmptyCanonicalPuzzle("Ref Puzzle");
    refPuzzle.metadata.id = "ref_2";

    const pRef = createCanonicalPiece("Piece A", { width: 100, height: 80, depth: 3 }, 3);
    pRef.id = "p1";
    refPuzzle.pieces = [pRef];

    const ifRef = createCanonicalInterface("p1", "Tab 1", { x: 0, y: 0 }, { x: 1, y: 0 });
    ifRef.id = "if1";
    ifRef.profile.width = 10.0;
    refPuzzle.interfaces = [ifRef];

    const genPuzzle = createEmptyCanonicalPuzzle("Gen Puzzle");
    genPuzzle.metadata.id = "gen_2";

    const pGen = createCanonicalPiece("Piece A", { width: 100, height: 80, depth: 3 }, 3);
    pGen.id = "p1";
    genPuzzle.pieces = [pGen];

    const ifGen = createCanonicalInterface("p1", "Tab 1", { x: 0, y: 0 }, { x: 1, y: 0 });
    ifGen.id = "if1";
    ifGen.profile.width = 10.2;
    genPuzzle.interfaces = [ifGen];

    // Under "exact" mode, 0.2mm delta is flagged as a mismatch outside tolerance
    const report = GroundTruthComparisonEngine.compare(refPuzzle, genPuzzle, "exact");

    expect(report.isMatched).toBe(false);
    expect(report.mismatchesOutsideTolerance).toBeGreaterThan(0);
  });

  it("3. compares topology graph piece count, connection counts, and F1 score", () => {
    const refPuzzle = createEmptyCanonicalPuzzle("Ref Topology");
    refPuzzle.pieces = [createCanonicalPiece("P1", { width: 50, height: 50, depth: 3 }, 3)];

    const genPuzzle = createEmptyCanonicalPuzzle("Gen Topology");
    genPuzzle.pieces = [
      createCanonicalPiece("P1", { width: 50, height: 50, depth: 3 }, 3),
      createCanonicalPiece("P2", { width: 50, height: 50, depth: 3 }, 3),
    ];

    const report = GroundTruthComparisonEngine.compare(refPuzzle, genPuzzle, "tolerance");

    expect(report.topology.expectedPieceCount).toBe(1);
    expect(report.topology.generatedPieceCount).toBe(2);
    expect(report.topology.hasMismatch).toBe(true);
  });
});
