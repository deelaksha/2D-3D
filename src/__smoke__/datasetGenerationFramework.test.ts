import { describe, expect, it } from "vitest";
import {
  createEmptyCanonicalPuzzle,
  FormatAdapterRegistry,
  identityTransform,
  PuzzleAssemblyGraph,
  PuzzleDatasetExporter,
  PuzzleDatasetImporter,
  translationTransform,
  vec3,
} from "@/core/puzzle";

describe("Phase 18: Dataset-Generation Framework", () => {
  const exporter = new PuzzleDatasetExporter();
  const importer = new PuzzleDatasetImporter();

  it("performs clean round-trip export and import (CanonicalPuzzle -> CompleteDatasetItem -> CanonicalPuzzle)", async () => {
    const puzzle = createEmptyCanonicalPuzzle("RoundTrip_Puzzle");
    puzzle.pieces.push({
      id: "p1",
      name: "Plate P1",
      geometryRef: { contour: { kind: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0 } },
      dimensions: { width: 100, height: 100, depth: 2 },
      thickness: 2.0,
      materialId: "cardboard-2mm",
      interfaceIds: [],
      localFrame: { origin: vec3(0, 0, 0), tangent: vec3(1, 0, 0), normal: vec3(0, -1, 0), binormal: vec3(0, 0, -1) },
      manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
    });

    const placements = {
      p1: { pieceId: "p1", transform: identityTransform() },
      p2: { pieceId: "p2", transform: translationTransform(vec3(120, 0, 0)) },
    };

    const graph = new PuzzleAssemblyGraph();
    graph.addPieceNode("p1");

    // 1. Export canonical puzzle to dataset item
    const datasetItem = await exporter.exportPuzzleToDatasetItem(
      puzzle,
      placements,
      {},
      graph,
    );

    expect(datasetItem.version).toBe("1.0.0");
    expect(datasetItem.pieces.length).toBe(1);
    expect(datasetItem.pieces[0].designParameters.widthMm).toBe(100);

    // 2. Import dataset item back into canonical puzzle
    const reconstructed = await importer.reconstructCanonicalPuzzle(datasetItem);
    expect(reconstructed.puzzle.pieces.length).toBe(1);
    expect(reconstructed.puzzle.pieces[0].id).toBe("p1");
    expect(reconstructed.puzzle.pieces[0].dimensions.width).toBe(100);
  });

  it("enforces schema versioning (rejecting unsupported versions)", async () => {
    const invalidVersionItem = {
      itemId: "ds_bad",
      version: "9.9.9", // Incompatible version
      userRequirement: { prompt: "Test" },
      pieces: [],
      assembly: { pieceTransforms: {} },
      validation: { isValid: true },
    };

    await expect(
      importer.importDatasetItem(JSON.stringify(invalidVersionItem)),
    ).rejects.toThrow(/Invalid dataset item schema version/);
  });

  it("supports pluggable format adapters (PNG, SVG, DXF, STEP, STL, JSON) without altering canonical models", async () => {
    const registry = new FormatAdapterRegistry();

    expect(registry.hasAdapter("PNG")).toBe(true);
    expect(registry.hasAdapter("SVG")).toBe(true);
    expect(registry.hasAdapter("DXF")).toBe(true);
    expect(registry.hasAdapter("STEP")).toBe(true);
    expect(registry.hasAdapter("STL")).toBe(true);
    expect(registry.hasAdapter("JSON")).toBe(true);

    const stepAdapter = registry.getAdapter("STEP");
    expect(stepAdapter).toBeDefined();

    const puzzle = createEmptyCanonicalPuzzle("STEP Test");
    const exportedStep = await stepAdapter!.exportFromCanonical(puzzle);
    expect(exportedStep).toContain("ISO-10303-21");

    const importedFromStep = await stepAdapter!.importToCanonical(exportedStep);
    expect(importedFromStep.metadata.name).toBe("STEP Imported Puzzle");
  });
});
