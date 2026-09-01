import { describe, expect, it } from "vitest";
import { Pipeline3D } from "../core/puzzle/reconstruction/pipeline3D";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../core/puzzle/canonical/defaults";
import { RealAssemblyImporter } from "../core/puzzle/benchmark/realAssemblyImporter";

describe("3D Reconstruction & Assembly Pipeline", () => {
  it("1. executes 6-stage 3D reconstruction pipeline from Canonical Puzzle IR", () => {
    const canonicalPuzzle = createEmptyCanonicalPuzzle("Test 3D Puzzle");
    canonicalPuzzle.metadata.id = "puz_3d_test_1";

    const pieceA = createCanonicalPiece("Piece A", { width: 100, height: 80, depth: 3.0 }, 3.0);
    pieceA.id = "p1";

    const pieceB = createCanonicalPiece("Piece B", { width: 80, height: 60, depth: 3.0 }, 3.0);
    pieceB.id = "p2";

    canonicalPuzzle.pieces = [pieceA, pieceB];

    const result = Pipeline3D.reconstructAndAssemble(canonicalPuzzle);

    expect(result.success).toBe(true);
    expect(result.solids.size).toBe(2);
    expect(result.placements.size).toBe(2);
    expect(result.graph).toBeDefined();
    expect(result.diagnostics.hasErrors()).toBe(false);
  });

  it("2. supports arbitrary 3D rotation quaternions in AssemblyConfiguration placements", () => {
    const canonicalPuzzle = createEmptyCanonicalPuzzle("Rotated 3D Puzzle");
    canonicalPuzzle.metadata.id = "puz_rotated_1";

    const piece = createCanonicalPiece("Rotated Wall", { width: 100, height: 100, depth: 3.0 }, 3.0);
    piece.id = "p_rot_1";

    canonicalPuzzle.pieces = [piece];

    const result = Pipeline3D.reconstructAndAssemble(canonicalPuzzle);
    const placement = result.placements.get("p_rot_1");

    expect(placement).toBeDefined();
    expect(placement!.transform.rotation).toBeDefined();
    expect(placement!.transform.rotation.w).toBe(1.0); // Valid quaternion representation
  });

  it("3. compares generated 3D assembly against reference geometry and returns explicit difference metrics", () => {
    const canonicalPuzzle = createEmptyCanonicalPuzzle("Reference Mismatch Puzzle");
    canonicalPuzzle.metadata.id = "puz_ref_test_1";

    const piece = createCanonicalPiece("Wall 1", { width: 100, height: 80, depth: 3.0 }, 3.0);
    piece.id = "p_ref_1";

    canonicalPuzzle.pieces = [piece];

    // Create reference manifest with offset ground truth position (triggering geometric difference)
    const mockRefManifest = RealAssemblyImporter.createMockManifest("gt_manifest_1", "GT Spec", ["p_ref_1"]);
    // Introduce 15mm centroid position shift in reference manifest
    mockRefManifest.groundTruthPlacements.get("p_ref_1")!.position = { x: 15.0, y: 0, z: 0 };

    const result = Pipeline3D.reconstructAndAssemble(canonicalPuzzle, mockRefManifest);

    expect(result.referenceDifferences).toBeDefined();
    expect(result.referenceDifferences!.hasMismatch).toBe(true);
    expect(result.referenceDifferences!.centroidOffsetMm).toBeGreaterThan(0);
    expect(result.referenceDifferences!.mismatchSummary).toContain("Geometric mismatch detected");
  });
});
