/**
 * @vitest-environment happy-dom
 *
 * Interactive 3D Puzzle Preview Smoke & Integration Tests (Phase 94).
 *
 * Validates:
 *  1. ThreeSceneBridge:
 *     - Translates Phase 93 Scene into Three.js object hierarchy
 *     - Piece meshes, connection lines, status markers, coordinate axes
 *     - Diagnostic visual states (VALID, WARNING, COLLISION, INVALID_CONNECTION, SELECTED_PIECE)
 *     - Strict CAD immutability: userData retains isImmutableCadCopy
 *  2. Puzzle3DViewerController:
 *     - Orbit, Pan, Zoom, Reset Camera, Presets (ISO, Top, Front, Side)
 *     - Piece Selection
 *     - Piece Visibility (Hide, Show, Isolate, Restore)
 *     - Connection Highlighting
 *  3. React Component Mounting (<Puzzle3DPreview />):
 *     - Mounts cleanly in DOM test environment without crashing
 *     - Renders floating controls HUD (Orbit, Pan, Presets, Zoom, Reset)
 *     - Displays global status pill
 *     - Displays Pieces Drawer & Connections Drawer
 *     - Displays Loading Overlay with progress spinner
 *     - Displays Error Overlay with retry action
 */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { generatePuzzle } from "@/core/puzzle/highlevelapi";
import { SceneBuilder } from "@/core/puzzle/scene";
import {
  Puzzle3DPreview,
  Puzzle3DViewerController,
  ThreeSceneBridge,
} from "@/ui/preview3d";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Phase 94: Interactive 3D Puzzle Preview", () => {
  describe("ThreeSceneBridge Translation", () => {
    it("converts renderer-independent Scene into Three.js object hierarchy with visual states", async () => {
      const puzzleResult = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );
      const scene = SceneBuilder.buildFromPuzzle(puzzleResult);

      const bridgeResult = ThreeSceneBridge.buildThreeScene(scene);

      expect(bridgeResult).toBeDefined();
      expect(bridgeResult.rootGroup).toBeDefined();
      expect(bridgeResult.pieceMeshes.size).toBe(16);
      expect(bridgeResult.connectionLines.size).toBe(scene.connections.length);
      expect(bridgeResult.connectionMarkers.size).toBe(scene.connections.length);
      expect(bridgeResult.axesGroup.children.length).toBe(3); // X, Y, Z
      expect(bridgeResult.boundingBox.isEmpty()).toBe(false);

      // Verify piece mesh metadata and CAD immutability
      for (const [pieceId, mesh] of bridgeResult.pieceMeshes.entries()) {
        expect(mesh.userData.pieceId).toBe(pieceId);
        expect(mesh.userData.isImmutableCadCopy).toBe(true);
        expect(mesh.geometry.attributes.position.count).toBeGreaterThan(0);
        expect(mesh.geometry.attributes.normal.count).toBe(mesh.geometry.attributes.position.count);
      }
    });

    it("applies diagnostic visual states (VALID, WARNING, COLLISION, INVALID_CONNECTION, SELECTED_PIECE)", async () => {
      const puzzleResult = await generatePuzzle("4-piece 3mm plywood planar puzzle");
      const scene = SceneBuilder.buildFromPuzzle(puzzleResult);

      const states = new Map();
      const firstPieceId = scene.pieces[0].pieceId!;
      const secondPieceId = scene.pieces[1].pieceId!;
      states.set(firstPieceId, "SELECTED_PIECE");
      states.set(secondPieceId, "COLLISION");

      const bridgeResult = ThreeSceneBridge.buildThreeScene(scene, states);

      const mesh1 = bridgeResult.pieceMeshes.get(firstPieceId)!;
      const mat1 = mesh1.material as any;
      expect(mat1.color.getHexString()).toBe("00e5ff"); // Cyan for selected

      const mesh2 = bridgeResult.pieceMeshes.get(secondPieceId)!;
      const mat2 = mesh2.material as any;
      expect(mat2.color.getHexString()).toBe("e74c3c"); // Red for collision
    });
  });

  describe("Puzzle3DViewerController", () => {
    it("manages camera controls: orbit, pan, zoom, presets, and reset", async () => {
      const puzzleResult = await generatePuzzle("4-piece 3mm plywood planar puzzle");
      const scene = SceneBuilder.buildFromPuzzle(puzzleResult);

      const controller = new Puzzle3DViewerController();
      controller.loadScene(scene, puzzleResult.validationReport);

      const initialCam = controller.getCameraState();
      expect(initialCam.radius).toBeGreaterThan(0);

      // 1. Orbit
      controller.orbit(10, 5);
      const orbitCam = controller.getCameraState();
      expect(orbitCam.theta).not.toBe(initialCam.theta);
      expect(orbitCam.phi).not.toBe(initialCam.phi);

      // 2. Pan
      controller.pan(20, 10);
      const panCam = controller.getCameraState();
      expect(panCam.target.x).not.toBe(initialCam.target.x);

      // 3. Zoom
      controller.zoom(1);
      const zoomCam = controller.getCameraState();
      expect(zoomCam.radius).toBeLessThan(orbitCam.radius);

      // 4. Presets
      controller.setCameraPreset("top");
      expect(controller.getCameraState().theta).toBe(0);
      controller.setCameraPreset("front");
      expect(controller.getCameraState().theta).toBe(0);

      // 5. Reset Camera
      controller.resetCamera();
      const resetCam = controller.getCameraState();
      expect(resetCam.theta).toBeCloseTo(Math.PI / 4, 3);
      expect(resetCam.phi).toBeCloseTo(Math.PI / 3, 3);

      controller.dispose();
    });

    it("manages piece selection, visibility, isolation, and connection highlighting", async () => {
      const puzzleResult = await generatePuzzle("4-piece 3mm plywood planar puzzle");
      const scene = SceneBuilder.buildFromPuzzle(puzzleResult);

      const controller = new Puzzle3DViewerController();
      controller.loadScene(scene, puzzleResult.validationReport);

      const p0 = scene.pieces[0].pieceId!;
      const p1 = scene.pieces[1].pieceId!;
      const c0 = scene.connections[0].connectionId;

      // 1. Select Piece
      controller.selectPiece(p0);
      expect(controller.getSelectionState().selectedPieceId).toBe(p0);

      // 2. Hide & Show Piece
      controller.hidePiece(p1);
      expect(controller.getSelectionState().hiddenPieceIds.has(p1)).toBe(true);
      controller.showPiece(p1);
      expect(controller.getSelectionState().hiddenPieceIds.has(p1)).toBe(false);

      // 3. Isolate Piece
      controller.isolatePiece(p0);
      expect(controller.getSelectionState().isolatedPieceId).toBe(p0);
      controller.unisolate();
      expect(controller.getSelectionState().isolatedPieceId).toBeNull();

      // 4. Highlight Connection
      controller.highlightConnection(c0);
      expect(controller.getSelectionState().highlightedConnectionId).toBe(c0);
      controller.clearHighlight();
      expect(controller.getSelectionState().highlightedConnectionId).toBeNull();

      controller.dispose();
    });
  });

  describe("React Component Mounting (<Puzzle3DPreview />)", () => {
    it("mounts and renders the full interactive HUD with pieces and connection drawers", async () => {
      const puzzleResult = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );

      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);

      await act(async () => {
        root.render(<Puzzle3DPreview puzzleResult={puzzleResult} />);
      });

      // 1. Container & Canvas
      expect(host.querySelector("[data-testid='puzzle-3d-preview']")).toBeTruthy();
      expect(host.querySelector("[data-testid='puzzle-3d-canvas']")).toBeTruthy();

      // 2. Floating Top Controls HUD
      expect(host.querySelector("[data-testid='puzzle-3d-controls-hud']")).toBeTruthy();
      expect(host.querySelector("[data-testid='puzzle-3d-status-pill']")).toBeTruthy();
      expect(host.querySelector("[data-testid='puzzle-3d-status-pill']")?.textContent).toContain("VALID");

      // 3. Drawer Toggles
      const piecesBtn = host.querySelector("[data-testid='toggle-pieces-drawer']") as HTMLButtonElement;
      const connsBtn = host.querySelector("[data-testid='toggle-connections-drawer']") as HTMLButtonElement;
      expect(piecesBtn).toBeTruthy();
      expect(connsBtn).toBeTruthy();
      expect(piecesBtn.textContent).toContain("Pieces (16)");

      // 4. Toggle Pieces Drawer
      await act(async () => {
        piecesBtn.click();
      });
      expect(host.querySelector("[data-testid='pieces-drawer']")).toBeTruthy();

      // 5. Toggle Connections Drawer
      await act(async () => {
        connsBtn.click();
      });
      expect(host.querySelector("[data-testid='connections-drawer']")).toBeTruthy();

      await act(async () => {
        root.unmount();
      });
      host.remove();
    });

    it("renders loading and error overlays properly", async () => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);

      // Loading state
      await act(async () => {
        root.render(<Puzzle3DPreview isLoading={true} loadingMessage="Assembling 3D solids..." />);
      });
      expect(host.querySelector("[data-testid='puzzle-3d-loading-overlay']")).toBeTruthy();
      expect(host.textContent).toContain("Assembling 3D solids...");

      // Error state
      let retried = false;
      await act(async () => {
        root.render(
          <Puzzle3DPreview
            isLoading={false}
            error="Backtracking search limit exceeded"
            onRetry={() => { retried = true; }}
          />
        );
      });
      expect(host.querySelector("[data-testid='puzzle-3d-error-overlay']")).toBeTruthy();
      expect(host.textContent).toContain("Backtracking search limit exceeded");

      const retryBtn = host.querySelector("[data-testid='puzzle-3d-retry-button']") as HTMLButtonElement;
      expect(retryBtn).toBeTruthy();
      await act(async () => {
        retryBtn.click();
      });
      expect(retried).toBe(true);

      await act(async () => {
        root.unmount();
      });
      host.remove();
    });
  });
});
