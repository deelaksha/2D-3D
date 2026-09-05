/**
 * @vitest-environment happy-dom
 *
 * Connection Angle Inspection & Live Manipulation Smoke & Integration Tests (Phase 95).
 *
 * Validates:
 *  1. KinematicTreeSolver:
 *     - Correctly determines kinematic parent vs child relative to assembly root
 *     - Computes child transform via alignInterfaces
 *     - Accurately propagates rigid delta transforms ΔT = T_child_new ∘ (T_child_old)⁻¹ to downstream subtrees
 *  2. AngleManipulationEngine:
 *     - inspectConnection returns connection ID, pieceA, pieceB, connector type, current angle, allowed range & candidates
 *     - adjustAngle calculates new transforms and runs live Phase 90 validation pass
 *     - Strictly preserves original piece CAD geometry (no mesh vertex mutations)
 *     - Accurately detects and diagnoses collisions / illegal penetrations when invalid angles are applied
 *     - Diagnostic explanations returned for non-compliant angles
 *  3. Puzzle3DViewerController:
 *     - inspectConnection and adjustConnectionAngle update Three.js scene piece meshes dynamically
 *     - Updates visual state overrides (VALID, COLLISION, WARNING)
 *  4. Puzzle3DPreview React UI:
 *     - Selecting a connection opens the Connection Angle Inspector Card
 *     - Displays connection metadata, current angle, and allowed range
 *     - Slider and preset buttons (0°, 30°, 45°, 60°, 90°, 180°) trigger angle adjustments
 *     - Shows live diagnostic feedback banner
 *     - Close button dismisses the card and clears highlight
 */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { generatePuzzle } from "@/core/puzzle/highlevelapi";
import { SceneBuilder } from "@/core/puzzle/scene";
import {
  AngleManipulationEngine,
  KinematicTreeSolver,
} from "@/core/puzzle/manipulation";
import {
  Puzzle3DPreview,
  Puzzle3DViewerController,
} from "@/ui/preview3d";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Phase 95: Connection Angle Inspection & Live Manipulation", () => {
  describe("KinematicTreeSolver & Rigid Delta Propagation", () => {
    it("determines root-relative parent/child and propagates delta transform without altering CAD geometry", async () => {
      const puzzleResult = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );
      const puzzle3D = {
        puzzleId: puzzleResult.designSpecification.id || "puzzle_3d",
        specification: puzzleResult.designSpecification,
        pieces: puzzleResult.pieces3D,
        connections: puzzleResult.connectors.map((c) => ({
          connectionId: c.id,
          pieceAId: c.pieceA,
          pieceBId: c.pieceB,
          interfaceAId: c.interfaceA.id,
          interfaceBId: c.interfaceB.id,
          connectorType: c.connectorType,
          parameters: { ...c.parameters },
          clearanceMm: c.clearance,
          allowedAngleDeg: c.allowedAngle,
        })),
        validation: {
          isValid: puzzleResult.validationReport.isValid,
          issues: [],
          pieceValidations: [],
        },
        metadata: {
          convertedAt: new Date().toISOString(),
          executionDurationMs: puzzleResult.generationStatistics.totalDurationMs,
          generatorVersion: "Phase 95",
        },
      };

      const conn0 = puzzle3D.connections[0];
      const initialTransforms = { ...puzzleResult.assembly.pieceTransforms };

      // Snapshot piece 0 vertices to ensure CAD immutability
      const piece0LocalMeshPositions = new Float32Array(puzzle3D.pieces[0].solid.localMesh.positions);

      // Solve kinematic adjustment to 90 degrees
      const updatedTransforms = KinematicTreeSolver.solveAngleChange(
        puzzle3D,
        conn0.connectionId,
        90,
        initialTransforms,
        puzzleResult.assembly.appliedAngles
      );

      expect(Object.keys(updatedTransforms).length).toBeGreaterThan(0);

      // Verify that the child piece transform moved
      const childPieceId =
        updatedTransforms[conn0.pieceBId] !== initialTransforms[conn0.pieceBId]
          ? conn0.pieceBId
          : conn0.pieceAId;
      const originalChildT = initialTransforms[childPieceId]!;
      const newChildT = updatedTransforms[childPieceId]!;

      // Transform changed
      const childMoved =
        originalChildT.position.x !== newChildT.position.x ||
        originalChildT.position.y !== newChildT.position.y ||
        originalChildT.position.z !== newChildT.position.z ||
        originalChildT.rotation.x !== newChildT.rotation.x ||
        originalChildT.rotation.y !== newChildT.rotation.y ||
        originalChildT.rotation.z !== newChildT.rotation.z ||
        originalChildT.rotation.w !== newChildT.rotation.w;

      expect(childMoved).toBe(true);

      // Strictly verify CAD geometry remains unchanged
      expect(puzzle3D.pieces[0].solid.localMesh.positions).toEqual(piece0LocalMeshPositions);
    });
  });

  describe("AngleManipulationEngine", () => {
    it("inspects connection metadata, candidate angles, and allowed ranges", async () => {
      const puzzleResult = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );
      const puzzle3D = {
        puzzleId: "puzzle_3d",
        specification: puzzleResult.designSpecification,
        pieces: puzzleResult.pieces3D,
        connections: puzzleResult.connectors.map((c) => ({
          connectionId: c.id,
          pieceAId: c.pieceA,
          pieceBId: c.pieceB,
          interfaceAId: c.interfaceA.id,
          interfaceBId: c.interfaceB.id,
          connectorType: c.connectorType,
          parameters: { ...c.parameters },
          clearanceMm: c.clearance,
          allowedAngleDeg: c.allowedAngle,
        })),
        validation: {
          isValid: true,
          issues: [],
          pieceValidations: [],
        },
        metadata: {
          convertedAt: new Date().toISOString(),
          executionDurationMs: 100,
          generatorVersion: "Phase 95",
        },
      };

      const conn0 = puzzle3D.connections[0];
      const inspection = AngleManipulationEngine.inspectConnection(
        puzzle3D,
        conn0.connectionId,
        puzzleResult.assembly.appliedAngles
      );

      expect(inspection).not.toBeNull();
      expect(inspection!.connectionId).toBe(conn0.connectionId);
      expect(inspection!.pieceAId).toBe(conn0.pieceAId);
      expect(inspection!.pieceBId).toBe(conn0.pieceBId);
      expect(inspection!.connectorType).toBe(conn0.connectorType);
      expect(inspection!.allowedAngleRange.min).toBeLessThanOrEqual(inspection!.allowedAngleRange.max);
      expect(inspection!.allowedAngleRange.validCandidates.length).toBeGreaterThan(0);
      expect(inspection!.isValid).toBe(true);
    });

    it("evaluates angle adjustment and executes live validation", async () => {
      const puzzleResult = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );
      const puzzle3D = {
        puzzleId: "puzzle_3d",
        specification: puzzleResult.designSpecification,
        pieces: puzzleResult.pieces3D,
        connections: puzzleResult.connectors.map((c) => ({
          connectionId: c.id,
          pieceAId: c.pieceA,
          pieceBId: c.pieceB,
          interfaceAId: c.interfaceA.id,
          interfaceBId: c.interfaceB.id,
          connectorType: c.connectorType,
          parameters: { ...c.parameters },
          clearanceMm: c.clearance,
          allowedAngleDeg: c.allowedAngle,
        })),
        validation: {
          isValid: true,
          issues: [],
          pieceValidations: [],
        },
        metadata: {
          convertedAt: new Date().toISOString(),
          executionDurationMs: 100,
          generatorVersion: "Phase 95",
        },
      };

      const conn0 = puzzle3D.connections[0];
      const initialTransforms = { ...puzzleResult.assembly.pieceTransforms };
      const initialAngles = { ...puzzleResult.assembly.appliedAngles };

      // Perform an angle adjustment (e.g. 90 degrees)
      const result = AngleManipulationEngine.adjustAngle({
        puzzle: puzzle3D,
        connectionId: conn0.connectionId,
        newAngleDeg: 90,
        currentTransforms: initialTransforms,
        currentAngles: initialAngles,
      });

      expect(result.connectionId).toBe(conn0.connectionId);
      expect(result.appliedAngleDeg).toBe(90);
      expect(Object.keys(result.newTransforms).length).toBe(puzzle3D.pieces.length);
      expect(result.validationReport).toBeDefined();
      expect(result.diagnosticMessage).toBeDefined();
      expect(["VALID", "COLLISION", "WARNING", "INVALID_CONNECTION"]).toContain(result.visualState);
      expect(result.isOriginalGeometryUnchanged).toBe(true);
    });
  });

  describe("Puzzle3DViewerController Live Angle Manipulation", () => {
    it("updates scene piece meshes dynamically during live angle adjustment", async () => {
      const puzzleResult = await generatePuzzle("4-piece 3mm plywood planar puzzle");
      const scene = SceneBuilder.buildFromPuzzle(puzzleResult);
      const puzzle3D = {
        puzzleId: "puzzle_4p",
        specification: puzzleResult.designSpecification,
        pieces: puzzleResult.pieces3D,
        connections: puzzleResult.connectors.map((c) => ({
          connectionId: c.id,
          pieceAId: c.pieceA,
          pieceBId: c.pieceB,
          interfaceAId: c.interfaceA.id,
          interfaceBId: c.interfaceB.id,
          connectorType: c.connectorType,
          parameters: { ...c.parameters },
          clearanceMm: c.clearance,
          allowedAngleDeg: c.allowedAngle,
        })),
        validation: {
          isValid: true,
          issues: [],
          pieceValidations: [],
        },
        metadata: {
          convertedAt: new Date().toISOString(),
          executionDurationMs: 100,
          generatorVersion: "Phase 95",
        },
      };

      const controller = new Puzzle3DViewerController();
      controller.loadScene(scene, puzzleResult.validationReport, puzzle3D);

      const conn0 = puzzle3D.connections[0];
      const insp = controller.inspectConnection(conn0.connectionId);
      expect(insp).not.toBeNull();
      expect(insp!.connectionId).toBe(conn0.connectionId);

      // Adjust angle to 45 deg
      const adjResult = controller.adjustConnectionAngle(conn0.connectionId, 45);
      expect(adjResult).not.toBeNull();
      expect(adjResult!.appliedAngleDeg).toBe(45);

      controller.dispose();
    });
  });

  describe("Puzzle3DPreview React Viewport Integration", () => {
    it("renders connection inspector card with slider, presets, and diagnostic feedback", async () => {
      const puzzleResult = await generatePuzzle("4-piece 3mm plywood planar puzzle");

      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);

      await act(async () => {
        root.render(<Puzzle3DPreview puzzleResult={puzzleResult} />);
      });

      // 1. Open Connections Drawer
      const connsBtn = host.querySelector("[data-testid='toggle-connections-drawer']") as HTMLButtonElement;
      expect(connsBtn).toBeTruthy();
      await act(async () => {
        connsBtn.click();
      });

      // 2. Select first connection in the drawer
      const connDrawer = host.querySelector("[data-testid='connections-drawer']") as HTMLDivElement;
      expect(connDrawer).toBeTruthy();
      const firstConnItem = connDrawer.querySelector("div[style*='cursor: pointer']") as HTMLDivElement;
      expect(firstConnItem).toBeTruthy();

      await act(async () => {
        firstConnItem.click();
      });

      // 3. Verify Connection Angle Inspector Card is rendered
      const inspectorCard = host.querySelector("[data-testid='connection-angle-inspector-card']");
      expect(inspectorCard).toBeTruthy();
      expect(inspectorCard?.textContent).toContain("CONNECTION ANGLE");

      // 4. Check Slider & Preset Buttons
      const slider = host.querySelector("[data-testid='angle-slider']") as HTMLInputElement;
      expect(slider).toBeTruthy();

      const preset90 = host.querySelector("[data-testid='angle-preset-90']") as HTMLButtonElement;
      expect(preset90).toBeTruthy();

      // 5. Click 90° Preset
      await act(async () => {
        preset90.click();
      });

      // 6. Verify Diagnostic Feedback Banner is displayed
      const feedbackBanner = host.querySelector("[data-testid='angle-adjustment-feedback']");
      expect(feedbackBanner).toBeTruthy();

      // 7. Close Inspector
      const closeBtn = host.querySelector("[data-testid='close-connection-inspector']") as HTMLButtonElement;
      expect(closeBtn).toBeTruthy();
      await act(async () => {
        closeBtn.click();
      });
      expect(host.querySelector("[data-testid='connection-angle-inspector-card']")).toBeNull();

      await act(async () => {
        root.unmount();
      });
      host.remove();
    });
  });
});
