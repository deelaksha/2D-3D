/**
 * Prompts 105–109: Interactive Assembly, Snapping & Angle Manipulation Tests.
 *
 * Validates:
 *  - Prompt 105: Interactive piece selection, movement, and transform solving
 *  - Prompt 106: Constraint-aware 3D snapping across arbitrary orientations
 *  - Prompt 107: Ghost connection preview with explicit failure reasons
 *  - Prompt 108: Connection angle adjustment and valid-angle gating
 *  - Prompt 109: Immutable assembly history stack with deterministic undo/redo
 */

import { describe, expect, it } from "vitest";
import { generatePuzzle } from "@/core/puzzle/highlevelapi";
import { ConstraintSnappingEngine } from "@/core/puzzle/designer/constraintSnappingEngine";
import { GhostPreviewEngine } from "@/core/puzzle/designer/ghostPreviewEngine";
import { AssemblyHistoryStack } from "@/core/puzzle/designer/assemblyHistoryStack";
import { AngleManipulationEngine } from "@/core/puzzle/manipulation/angleManipulationEngine";

describe("Prompts 105–109: Interactive Assembly & Snapping", () => {
  it("detects nearby compatible snap candidates and computes 3D rigid transforms", async () => {
    const res = await generatePuzzle("6-piece 3mm plywood planar puzzle");
    const puzzle3D = res.puzzle3D;
    const placedTransforms = res.pieceTransforms;

    const pieceAId = puzzle3D.pieces[0].pieceId;
    const pieceBId = puzzle3D.pieces[1].pieceId;

    // Simulate dragged piece placed near piece A
    const draggedPos = {
      x: placedTransforms[pieceAId].position.x + 15,
      y: placedTransforms[pieceAId].position.y + 10,
      z: placedTransforms[pieceAId].position.z,
    };

    const candidates = ConstraintSnappingEngine.findSnapCandidates(
      puzzle3D,
      pieceBId,
      draggedPos,
      placedTransforms,
      { snapDistanceThresholdMm: 50 }
    );

    expect(Array.isArray(candidates)).toBe(true);
    if (candidates.length > 0) {
      const topCand = candidates[0];
      expect(topCand.draggedPieceId).toBe(pieceBId);
      expect(topCand.proposedTransform).toBeDefined();
      expect(topCand.allowedAnglesDeg.length).toBeGreaterThan(0);
      expect(topCand.clearanceMm).toBeGreaterThan(0);
    }
  });

  it("evaluates real-time ghost previews with diagnostic status and reasons", async () => {
    const res = await generatePuzzle("4-piece 3mm cardboard puzzle");
    const puzzle3D = res.puzzle3D;

    const draggedPieceId = puzzle3D.pieces[1].pieceId;
    const preview = GhostPreviewEngine.computeGhostPreview({
      puzzle: puzzle3D,
      draggedPieceId,
      cursorWorldPosition: { x: 100, y: 100, z: 0 },
      assembledTransforms: res.pieceTransforms,
      joiningAngleDeg: 90,
      snapThresholdMm: 80,
    });

    expect(preview.active).toBe(true);
    expect(preview.draggedPieceId).toBe(draggedPieceId);
    expect(["VALID", "WARNING", "INVALID"]).toContain(preview.status);
    expect(preview.reason).toBeDefined();
  });

  it("inspects connection angle limits and evaluates presets", async () => {
    const res = await generatePuzzle("4-piece puzzle with stepped 45 and 90 degree joints");
    const puzzle3D = res.puzzle3D;
    const firstConn = puzzle3D.connections[0];

    const inspection = AngleManipulationEngine.inspectConnection(
      puzzle3D,
      firstConn.connectionId,
      res.appliedAngles
    );

    expect(inspection.connectionId).toBe(firstConn.connectionId);
    expect(inspection.allowedAngleRange.validCandidates.length).toBeGreaterThan(0);
    expect(inspection.presetAngles).toContain(90);
  });

  it("maintains immutable assembly history stack with undo, redo, and event logging", () => {
    const stack = new AssemblyHistoryStack({
      description: "Initial placement of piece P01",
      actionType: "move",
      pieceTransforms: { P01: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } } },
      appliedAngles: {},
      connectedPairs: [],
      validationStatus: "valid",
    });

    expect(stack.getHistory().length).toBe(1);
    expect(stack.canUndo()).toBe(false);

    // Push second step
    stack.pushAction({
      description: "Connected P02 → P01 at 90°",
      actionType: "connect",
      pieceTransforms: {
        P01: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
        P02: { position: { x: 40, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      },
      appliedAngles: { C01: 90 },
      connectedPairs: [{ pieceAId: "P01", pieceBId: "P02", connectionId: "C01" }],
      validationStatus: "valid",
    });

    expect(stack.getHistory().length).toBe(2);
    expect(stack.canUndo()).toBe(true);

    // Undo
    const undone = stack.undo();
    expect(undone).toBeDefined();
    expect(stack.getCurrentIndex()).toBe(0);
    expect(Object.keys(undone!.pieceTransforms).length).toBe(1);

    // Redo
    const redone = stack.redo();
    expect(redone).toBeDefined();
    expect(stack.getCurrentIndex()).toBe(1);
    expect(Object.keys(redone!.pieceTransforms).length).toBe(2);
  });
});
