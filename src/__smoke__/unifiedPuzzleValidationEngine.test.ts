import { describe, expect, it } from "vitest";
import {
  convert2DTo3DSolid,
  createEmptyCanonicalPuzzle,
  createDefaultParametricPiece2D,
  identityTransform,
  PuzzleAssemblyGraph,
  PuzzleValidationEngine,
  translationTransform,
  vec3,
} from "@/core/puzzle";

describe("Phase 15: Unified Puzzle Validation Engine", () => {
  it("validates a 100% valid puzzle across all 5 domains (isValid = true)", () => {
    const puzzle = createEmptyCanonicalPuzzle("puzzle_valid");

    const p1 = createDefaultParametricPiece2D(100, 100, 2.0);
    const p2 = createDefaultParametricPiece2D(100, 100, 2.0);

    const s1 = convert2DTo3DSolid(p1).solid;
    const s2 = convert2DTo3DSolid(p2).solid;

    const placements = {
      p1: { pieceId: "p1", transform: identityTransform() },
      p2: { pieceId: "p2", transform: translationTransform(vec3(120, 0, 0)) },
    };

    const graph = new PuzzleAssemblyGraph();
    graph.addConnectionEdge({
      connectionId: "c12",
      sourcePieceId: "p1",
      sourceInterfaceId: "if1",
      targetPieceId: "p2",
      targetInterfaceId: "if2",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    const report = PuzzleValidationEngine.validatePuzzle({
      puzzle,
      placements,
      solids: { p1: s1, p2: s2 },
      graph,
      globalMaterialParams: { stockWidth: 600, stockHeight: 400, stockThickness: 2.0, stockTolerance: 0.15, density: 0.68, grainDirectionDeg: 0, minBendRadius: 4.0 },
      designParams: { manufacturingMargin: 10, minClearance: 3, minFeatureSize: 1.5, isLockedByDesign: true },
    });

    expect(report.isValid).toBe(true);
    expect(report.overallLevel).toBe("ok");
    expect(report.overallScore).toBeGreaterThan(0.9);
    expect(report.domainReports.structural.isValid).toBe(true);
    expect(report.domainReports.geometric.isValid).toBe(true);
    expect(report.domainReports.manufacturing.isValid).toBe(true);
    expect(report.domainReports.assembly.isValid).toBe(true);
  });

  it("detects multi-domain defects and compiles machine-readable AIRepairDirectives", () => {
    const puzzle = createEmptyCanonicalPuzzle("puzzle_invalid");

    // Add oversized piece violating manufacturing sheet width bounds (700mm > 580mm usable)
    puzzle.pieces.push({
      id: "p_over",
      name: "Oversized Piece",
      geometryRef: { contour: { kind: "rect", x: 0, y: 0, width: 700, height: 100, rotation: 0 } },
      dimensions: { width: 700, height: 100, depth: 2 },
      thickness: 2.0,
      materialId: "cardboard-2mm",
      interfaceIds: [],
      localFrame: { origin: vec3(0, 0, 0), tangent: vec3(1, 0, 0), normal: vec3(0, -1, 0), binormal: vec3(0, 0, -1) },
      manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
    });

    const placements = {
      p1: { pieceId: "p1", transform: identityTransform() },
      p2: { pieceId: "p2", transform: translationTransform(vec3(50, 0, 0)) }, // UNEXPECTED COLLISION with p1
    };

    const p1 = createDefaultParametricPiece2D(100, 100, 2.0);
    const p2 = createDefaultParametricPiece2D(100, 100, 2.0);
    const s1 = convert2DTo3DSolid(p1).solid;
    const s2 = convert2DTo3DSolid(p2).solid;

    const graph = new PuzzleAssemblyGraph();
    graph.addPieceNode("p1");
    graph.addPieceNode("p2");

    const report = PuzzleValidationEngine.validatePuzzle({
      puzzle,
      placements,
      solids: { p1: s1, p2: s2 },
      graph,
      globalMaterialParams: { stockWidth: 600, stockHeight: 400, stockThickness: 2.0, stockTolerance: 0.15, density: 0.68, grainDirectionDeg: 0, minBendRadius: 4.0 },
      designParams: { manufacturingMargin: 10, minClearance: 3, minFeatureSize: 1.5, isLockedByDesign: true },
    });

    expect(report.isValid).toBe(false);
    expect(report.overallLevel).toBe("error");
    expect(report.aiRepairDirectives.length).toBeGreaterThan(0);

    // Verify presence of geometric collision directive
    expect(report.aiRepairDirectives.some((d) => d.defectCode === "UNEXPECTED_COLLISION")).toBe(true);

    // Verify presence of manufacturing bounds directive
    expect(report.aiRepairDirectives.some((d) => d.defectCode === "PIECE_WIDTH_BOUNDS")).toBe(true);
  });
});
