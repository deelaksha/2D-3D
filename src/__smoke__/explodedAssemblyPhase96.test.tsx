/**
 * @vitest-environment happy-dom
 *
 * Exploded Assembly Visualization Smoke & Integration Tests (Phase 96).
 *
 * Validates:
 *  1. Deterministic Exploded Layout Engine:
 *     - Layout derivation from authoritative assembly graph
 *     - 100% deterministic layout calculation (identical explosion vectors on repeated runs)
 *     - Preservation of piece identity, connection relationships, and assembly order
 *     - Root piece remains stationary while child pieces disperse outward
 *  2. View Modes:
 *     - Normal View (factor = 0, assembled transforms, all pieces visible)
 *     - Exploded View (continuous factor 0..1, connection lines and indicator lines)
 *     - Assembly-Step View (step-by-step 1..N progression, incoming piece highlighted with insertion vector)
 *  3. Strict CAD Immutability:
 *     - Guarantees piece CAD mesh vertices and profiles are strictly untouched
 *  4. Viewer Controller Integration:
 *     - setExplodedViewMode, setExplosionFactor, setAssemblyStep, nextAssemblyStep, prevAssemblyStep, toggleExplodedIndicator
 *  5. React Preview UI Component:
 *     - Renders exploded view control panel
 *     - Switches modes (Normal, Exploded, Step View)
 *     - Slider and step navigation buttons functional
 *     - Indicator toggles functional
 */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { generatePuzzle } from "@/core/puzzle/highlevelapi";
import { SceneBuilder } from "@/core/puzzle/scene";
import { ExplodedAssemblyEngine } from "@/core/puzzle/exploded";
import {
  Puzzle3DPreview,
  Puzzle3DViewerController,
} from "@/ui/preview3d";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Phase 96: Exploded Assembly Visualization", () => {
  describe("Deterministic Exploded Layout Engine", () => {
    it("calculates deterministic exploded layouts while preserving piece identity, connections, and assembly order", async () => {
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
          executionDurationMs: 100,
          generatorVersion: "Phase 96",
        },
      };

      const assembledTransforms = { ...puzzleResult.assembly.pieceTransforms };

      // Snapshot piece 0 vertices to ensure CAD immutability
      const piece0PositionsSnapshot = new Float32Array(puzzle3D.pieces[0].solid.localMesh.positions);

      // Run layout solver run 1
      const layout1 = ExplodedAssemblyEngine.calculateExplodedLayout(
        puzzle3D,
        assembledTransforms,
        { baseExplosionDistanceMm: 60 }
      );

      // Run layout solver run 2
      const layout2 = ExplodedAssemblyEngine.calculateExplodedLayout(
        puzzle3D,
        assembledTransforms,
        { baseExplosionDistanceMm: 60 }
      );

      // 1. Piece Identity & Count
      expect(layout1.totalPieces).toBe(16);
      expect(layout1.pieces.length).toBe(16);

      // 2. Determinism Assertion (Bit-identical across runs)
      for (let i = 0; i < layout1.pieces.length; i++) {
        const p1 = layout1.pieces[i];
        const p2 = layout2.pieces[i];
        expect(p1.pieceId).toBe(p2.pieceId);
        expect(p1.pieceNumber).toBe(p2.pieceNumber);
        expect(p1.explosionVector).toEqual(p2.explosionVector);
        expect(p1.explodedTransform.position).toEqual(p2.explodedTransform.position);
      }

      // 3. Root piece remains stationary
      const rootPiece = layout1.pieces[0];
      expect(rootPiece.pieceNumber).toBe(1);
      expect(rootPiece.graphDepth).toBe(0);
      expect(rootPiece.maxExplosionDistanceMm).toBeCloseTo(0, 3);
      expect(rootPiece.explodedTransform.position.x).toBeCloseTo(
        rootPiece.assembledTransform.position.x,
        3
      );
      expect(rootPiece.explodedTransform.position.y).toBeCloseTo(
        rootPiece.assembledTransform.position.y,
        3
      );

      // 4. Child pieces disperse outward
      const nonRootPieces = layout1.pieces.slice(1);
      expect(nonRootPieces.length).toBe(15);
      for (const child of nonRootPieces) {
        expect(child.pieceNumber).toBeGreaterThan(1);
        expect(child.maxExplosionDistanceMm).toBeGreaterThan(10);
      }

      // 5. Connection Relationships Preserved
      expect(layout1.connections.length).toBe(puzzle3D.connections.length);
      for (const conn of layout1.connections) {
        expect(conn.pieceAId).toBeDefined();
        expect(conn.pieceBId).toBeDefined();
        expect(conn.connectorType).toBeDefined();
        expect(conn.stepIntroduced).toBeGreaterThanOrEqual(1);
      }

      // 6. CAD Immutability Guarantee
      expect(puzzle3D.pieces[0].solid.localMesh.positions).toEqual(piece0PositionsSnapshot);
      expect(layout1.isOriginalGeometryUnchanged).toBe(true);
    });

    it("evaluates Normal View, Exploded View, and Assembly-Step View properly", async () => {
      const puzzleResult = await generatePuzzle("4-piece 3mm plywood planar puzzle");
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
          executionDurationMs: 50,
          generatorVersion: "Phase 96",
        },
      };

      const assembledTransforms = { ...puzzleResult.assembly.pieceTransforms };
      const layout = ExplodedAssemblyEngine.calculateExplodedLayout(puzzle3D, assembledTransforms);

      // 1. Normal View (factor = 0)
      layout.config.mode = "normal";
      ExplodedAssemblyEngine.evaluateResult(layout);
      for (const p of layout.pieces) {
        expect(p.isVisible).toBe(true);
        expect(p.currentTransform.position.x).toBeCloseTo(p.assembledTransform.position.x, 3);
        expect(p.currentTransform.position.y).toBeCloseTo(p.assembledTransform.position.y, 3);
      }
      expect(layout.connections.every((c) => !c.isVisible)).toBe(true);

      // 2. Exploded View (factor = 1.0)
      layout.config.mode = "exploded";
      layout.config.explosionFactor = 1.0;
      ExplodedAssemblyEngine.evaluateResult(layout);
      const piece1 = layout.pieces[1];
      expect(piece1.currentTransform.position.x).toBeCloseTo(
        piece1.explodedTransform.position.x,
        3
      );
      expect(piece1.currentTransform.position.y).toBeCloseTo(
        piece1.explodedTransform.position.y,
        3
      );
      expect(layout.connections.some((c) => c.isVisible)).toBe(true);

      // 3. Assembly-Step View (Step 1: Root only; Step 2: Root + piece 2)
      layout.config.mode = "assembly_step";
      layout.config.currentStep = 1;
      ExplodedAssemblyEngine.evaluateResult(layout);
      expect(layout.pieces[0].isVisible).toBe(true);
      expect(layout.pieces[1].isVisible).toBe(false);

      layout.config.currentStep = 2;
      ExplodedAssemblyEngine.evaluateResult(layout);
      expect(layout.pieces[0].isVisible).toBe(true);
      expect(layout.pieces[1].isVisible).toBe(true);
      expect(layout.pieces[1].isHighlighted).toBe(true); // Incoming piece is highlighted
      expect(layout.steps[1].incomingPieceId).toBe(layout.pieces[1].pieceId);
      expect(layout.steps[1].stepDescription).toContain("Step 2");
    });
  });

  describe("Puzzle3DViewerController Exploded Integration", () => {
    it("controls view modes, explosion factor, step navigation, and indicator toggles", async () => {
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
          executionDurationMs: 50,
          generatorVersion: "Phase 96",
        },
      };

      const controller = new Puzzle3DViewerController();
      controller.loadScene(scene, puzzleResult.validationReport, puzzle3D);

      const initialResult = controller.getExplodedResult();
      expect(initialResult).not.toBeNull();
      expect(initialResult!.totalPieces).toBe(4);

      // Switch to exploded view
      const explodedResult = controller.setExplodedViewMode("exploded");
      expect(explodedResult!.config.mode).toBe("exploded");

      // Set explosion factor
      controller.setExplosionFactor(0.75);
      expect(controller.getExplodedResult()!.config.explosionFactor).toBe(0.75);

      // Switch to assembly step view
      controller.setExplodedViewMode("assembly_step");
      expect(controller.getExplodedResult()!.config.mode).toBe("assembly_step");

      // Step navigation
      controller.setAssemblyStep(2);
      expect(controller.getExplodedResult()!.config.currentStep).toBe(2);

      controller.nextAssemblyStep();
      expect(controller.getExplodedResult()!.config.currentStep).toBe(3);

      controller.prevAssemblyStep();
      expect(controller.getExplodedResult()!.config.currentStep).toBe(2);

      // Indicator toggling
      controller.toggleExplodedIndicator("showPieceNumbers");
      expect(controller.getExplodedResult()!.config.indicators.showPieceNumbers).toBe(false);

      controller.dispose();
    });
  });

  describe("Puzzle3DPreview React Viewport UI", () => {
    it("renders exploded view controls, switches modes, and interacts with slider and step buttons", async () => {
      const puzzleResult = await generatePuzzle("4-piece 3mm plywood planar puzzle");

      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);

      await act(async () => {
        root.render(<Puzzle3DPreview puzzleResult={puzzleResult} />);
      });

      // 1. Exploded Controls HUD rendered
      const controls = host.querySelector("[data-testid='exploded-view-controls']");
      expect(controls).toBeTruthy();

      // 2. Mode buttons present
      const normalBtn = host.querySelector("[data-testid='view-mode-normal']") as HTMLButtonElement;
      const explodedBtn = host.querySelector("[data-testid='view-mode-exploded']") as HTMLButtonElement;
      const stepBtn = host.querySelector("[data-testid='view-mode-step']") as HTMLButtonElement;
      expect(normalBtn).toBeTruthy();
      expect(explodedBtn).toBeTruthy();
      expect(stepBtn).toBeTruthy();

      // 3. Switch to Exploded View
      await act(async () => {
        explodedBtn.click();
      });

      const slider = host.querySelector("[data-testid='explosion-factor-slider']") as HTMLInputElement;
      expect(slider).toBeTruthy();

      // 4. Switch to Assembly-Step View
      await act(async () => {
        stepBtn.click();
      });

      const prevBtn = host.querySelector("[data-testid='prev-step-btn']") as HTMLButtonElement;
      const nextBtn = host.querySelector("[data-testid='next-step-btn']") as HTMLButtonElement;
      const stepIndicator = host.querySelector("[data-testid='step-indicator']");
      const stepDesc = host.querySelector("[data-testid='step-description']");

      expect(prevBtn).toBeTruthy();
      expect(nextBtn).toBeTruthy();
      expect(stepIndicator).toBeTruthy();
      expect(stepIndicator?.textContent).toContain("Step");
      expect(stepDesc).toBeTruthy();

      // Step Forward
      await act(async () => {
        nextBtn.click();
      });
      expect(stepIndicator?.textContent).toContain("Step 2");

      // 5. Indicator buttons functional
      const numbersToggle = host.querySelector("[data-testid='toggle-piece-numbers']") as HTMLButtonElement;
      expect(numbersToggle).toBeTruthy();
      await act(async () => {
        numbersToggle.click();
      });

      await act(async () => {
        root.unmount();
      });
      host.remove();
    });
  });
});
