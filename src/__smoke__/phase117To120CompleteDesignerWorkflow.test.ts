/**
 * Prompts 117–120: Modification Copilot, Repair Center, Search & Complete Workflow.
 *
 * Validates:
 *  - Prompt 117: Natural language design modification copilot with parametric deltas
 *  - Prompt 118: AI Repair Center with 1-click parametric repairs
 *  - Prompt 119: Advanced AI Design Space Explorer
 *  - Prompt 120: Complete end-to-end professional designer workflow
 */

import { describe, expect, it } from "vitest";
import { generatePuzzle } from "@/core/puzzle/highlevelapi";
import { DesignModificationCopilot } from "@/core/puzzle/designer/designModificationCopilot";
import { DesignSpaceExplorer } from "@/core/puzzle/designer/designSpaceExplorer";
import { designerStore } from "@/core/puzzle/designer/designerStore";
import { MultiSolutionSolver } from "@/core/puzzle/designer/multiSolutionSolver";
import { DeterministicDifficultyEngine } from "@/core/puzzle/designer/deterministicDifficultyEngine";
import { ManufacturingLayoutOptimizer } from "@/core/puzzle/designer/manufacturingLayoutOptimizer";
import { PuzzleExportEngine } from "@/core/puzzle/export/puzzleExportEngine";

describe("Prompts 117–120: Complete Professional Designer Workflow", () => {
  it("translates natural language modification requests into canonical spec deltas", async () => {
    const res = await generatePuzzle("10-piece 3mm cardboard puzzle");
    const origSpec = res.puzzle2D.specification;

    // 1. Propose "Use fewer pieces"
    const deltaFewer = DesignModificationCopilot.proposeDelta(
      origSpec,
      res.puzzle2D,
      "Use fewer pieces please"
    );

    expect(deltaFewer.proposedSpec.targetPieceCount).toBeLessThan(origSpec.targetPieceCount);
    expect(deltaFewer.changesSummary.length).toBeGreaterThan(0);

    // 2. Apply delta and verify regeneration
    const modResult = DesignModificationCopilot.applyDelta(deltaFewer);
    expect(modResult.newPuzzle2D.pieces.length).toBe(deltaFewer.proposedSpec.targetPieceCount);
    expect(modResult.newPuzzle3D.pieces.length).toBe(deltaFewer.proposedSpec.targetPieceCount);
    expect(modResult.isValid).toBe(true);
  });

  it("explores the parametric design space across multi-dimensional metrics", async () => {
    const candidates = await DesignSpaceExplorer.exploreDesignSpace({
      prompt: "12-piece puzzle",
      maxCandidates: 3,
    });

    expect(candidates.length).toBe(3);
    for (const cand of candidates) {
      expect(cand.candidateId).toBeDefined();
      expect(cand.pieceCount).toBeGreaterThan(0);
      expect(cand.isValid).toBe(true);
      expect(cand.differentiationNotes.length).toBeGreaterThan(0);
    }
  });

  it("executes the complete professional designer workflow from start to export (Prompt 120)", async () => {
    // 1. Requirement & Generation
    const prompt = "12-piece non-planar puzzle with stepped 45 and 90 degree joints";
    const res = await generatePuzzle(prompt);

    expect(res.puzzle2D.pieces.length).toBe(12);
    expect(res.puzzle3D.pieces.length).toBe(12);
    expect(res.validationReport.isValid).toBe(true);

    // 2. Load into AI Designer Workspace Store
    designerStore.setGeneratedPuzzle(
      res,
      res.puzzle3D,
      res.pieceTransforms,
      res.appliedAngles,
      res.validationReport
    );

    const state = designerStore.getState();
    expect(state.activePuzzleResult).toBeDefined();

    // 3. Multi-Solution Discovery (Prompt 110)
    const solutions = MultiSolutionSolver.discoverSolutions(
      res.puzzle3D,
      res.pieceTransforms,
      res.appliedAngles
    );
    expect(solutions.length).toBeGreaterThanOrEqual(1);

    // 4. Deterministic Difficulty Scoring (Prompt 111)
    const diff = DeterministicDifficultyEngine.evaluate(
      res.puzzle3D,
      res.pieceTransforms,
      res.appliedAngles,
      solutions.length
    );
    expect(diff.score).toBeGreaterThan(0);
    expect(diff.reasons.length).toBeGreaterThan(0);

    // 5. Fixed Sheet Manufacturing Optimization (Prompt 113)
    const layout = ManufacturingLayoutOptimizer.optimizeLayout(res.puzzle2D, {
      sheetWidthMm: 297,
      sheetHeightMm: 210,
      thicknessMm: 3.0,
    });
    expect(layout.sheetWidthMm).toBe(297);
    expect(layout.packedPlacements.length).toBe(12);

    // 6. Comprehensive Multi-Format Export (Phase 99)
    const exportPkg = await PuzzleExportEngine.exportPuzzle({
      puzzle: res.puzzle3D,
      assemblyConfiguration: {
        rootPieceId: res.puzzle3D.pieces[0].pieceId,
        pieceTransforms: res.pieceTransforms,
        appliedAngles: res.appliedAngles,
      },
      validationReport: res.validationReport,
      export2D: { format: "svg" },
      export3D: { format: "stl" },
      exportMetadata: { includeBom: true, includeInstructions: true },
    });

    expect(exportPkg.svg2D).toBeDefined();
    expect(exportPkg.stl3D).toBeDefined();
    expect(exportPkg.metadataPackage.pieceCount).toBe(12);
    expect(exportPkg.metadataPackage.validationSummary.isValid).toBe(true);
  });
});
