import { describe, expect, it } from "vitest";
import {
  createEmptyCanonicalPuzzle,
  DesignRepairEngine,
  MockAIRepairStrategy,
  PuzzleValidationEngine,
} from "@/core/puzzle";

describe("Phase 20: Automatic Design Repair Subsystem", () => {
  it("consumes diagnostic ValidationReport and generates structured ParameterAdjustments", async () => {
    const puzzle = createEmptyCanonicalPuzzle("Defective_Puzzle");

    // Add oversized piece violating manufacturing sheet width bounds (700mm > 580mm usable)
    puzzle.pieces.push({
      id: "p_over",
      name: "Oversized Piece",
      geometryRef: { contour: { kind: "rect", x: 0, y: 0, width: 700, height: 100, rotation: 0 } },
      dimensions: { width: 700, height: 100, depth: 2 },
      thickness: 2.0,
      materialId: "cardboard-2mm",
      interfaceIds: [],
      localFrame: { origin: { x: 0, y: 0, z: 0 }, tangent: { x: 1, y: 0, z: 0 }, normal: { x: 0, y: -1, z: 0 }, binormal: { x: 0, y: 0, z: -1 } },
      manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
    });

    const validationReport = PuzzleValidationEngine.validatePuzzle({
      puzzle,
      globalMaterialParams: { stockWidth: 600, stockHeight: 400, stockThickness: 2.0, stockTolerance: 0.15, density: 0.68, grainDirectionDeg: 0, minBendRadius: 4.0 },
      designParams: { manufacturingMargin: 10, minClearance: 3, minFeatureSize: 1.5, isLockedByDesign: true },
    });

    expect(validationReport.isValid).toBe(false);

    const strategy = new MockAIRepairStrategy();
    const proposal = await strategy.proposeRepairs({ puzzle, validationReport });

    expect(proposal.adjustments.length).toBeGreaterThan(0);
    const adj = proposal.adjustments[0];

    // Verify mandatory proposal field identification
    expect(adj.parameterName).toBeDefined();
    expect(adj.oldValue).toBeDefined();
    expect(adj.proposedValue).toBeDefined();
    expect(adj.reason).toBeDefined();
    expect(adj.expectedEffect).toBeDefined();
  });

  it("applies repair proposal parameter adjustments and verifies deterministic re-validation succeeds", async () => {
    const puzzle = createEmptyCanonicalPuzzle("Defective_Puzzle");
    puzzle.pieces.push({
      id: "p_over",
      name: "Oversized Piece",
      geometryRef: { contour: { kind: "rect", x: 0, y: 0, width: 700, height: 100, rotation: 0 } },
      dimensions: { width: 700, height: 100, depth: 2 },
      thickness: 2.0,
      materialId: "cardboard-2mm",
      interfaceIds: [],
      localFrame: { origin: { x: 0, y: 0, z: 0 }, tangent: { x: 1, y: 0, z: 0 }, normal: { x: 0, y: -1, z: 0 }, binormal: { x: 0, y: 0, z: -1 } },
      manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
    });

    const validationReport = PuzzleValidationEngine.validatePuzzle({
      puzzle,
      globalMaterialParams: { stockWidth: 600, stockHeight: 400, stockThickness: 2.0, stockTolerance: 0.15, density: 0.68, grainDirectionDeg: 0, minBendRadius: 4.0 },
      designParams: { manufacturingMargin: 10, minClearance: 3, minFeatureSize: 1.5, isLockedByDesign: true },
    });

    const result = await DesignRepairEngine.attemptRepair({ puzzle, validationReport });

    expect(result.appliedProposal).toBeDefined();
    expect(result.repairedPuzzle).toBeDefined();

    // Verify stock width parameter was adjusted to 800mm
    const repairedMat = result.repairedPuzzle.materialSpecification[0] as any;
    expect(repairedMat.stockWidthMm).toBe(800);
  });
});
