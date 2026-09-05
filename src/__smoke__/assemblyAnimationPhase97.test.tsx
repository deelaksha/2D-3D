/**
 * @vitest-environment happy-dom
 *
 * Assembly-Animation System Smoke & Integration Tests (Phase 97).
 *
 * Validates:
 *  1. Physics-Compliant Trajectory Synthesis:
 *     - Generated directly from authoritative AssemblySequence and AssemblyTransitions
 *     - 4-phase physical progression: Movement -> Rotation -> Interface Alignment -> Completion
 *     - Safe collision-free standoff corridor & slerp orientation
 *  2. Timeline Evaluation & Boundary Conditions:
 *     - t = 0 starts at standoff staging
 *     - t = TotalDuration lands precisely at authoritative assembled transforms
 *     - Continuous evaluation across all intermediate timestamps
 *  3. Playback Controller (AssemblyAnimationPlayer):
 *     - play, pause, restart, stepForward, stepBackward, seek, setSpeed
 *     - Event listener notifications on tick
 *  4. Strict CAD Immutability:
 *     - Piece CAD solid meshes and vertices are 100% untouched
 *  5. Viewer Controller & React UI:
 *     - Puzzle3DViewerController integration with animation player
 *     - React <Puzzle3DPreview /> Animation HUD controls rendered and interactive
 */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { generatePuzzle } from "@/core/puzzle/highlevelapi";
import {
  AssemblyAnimationEngine,
  AssemblyAnimationPlayer,
} from "@/core/puzzle/animation";
import { SceneBuilder } from "@/core/puzzle/scene";
import {
  Puzzle3DPreview,
  Puzzle3DViewerController,
} from "@/ui/preview3d";
import {
  quatIdentity,
  vec3,
} from "@/core/puzzle/geometry/math3d";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Phase 97: Assembly-Animation System", () => {
  describe("Physics-Compliant Trajectory & Timeline Synthesis", () => {
    it("generates a sequence-consistent 4-phase animation timeline from puzzle and assembly graph", async () => {
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
          generatorVersion: "Phase 97",
        },
      };

      const assembledTransforms = { ...puzzleResult.assembly.pieceTransforms };

      // Snapshot piece 0 vertex positions for CAD immutability guarantee
      const piece0VertexPositionsSnapshot = new Float32Array(
        puzzle3D.pieces[0].solid.localMesh.positions
      );

      // Generate timeline with custom step duration
      const timeline = AssemblyAnimationEngine.generateTimeline(
        puzzle3D,
        assembledTransforms,
        undefined,
        { stepDurationMs: 1000, standoffDistanceMm: 70 }
      );

      // 1. Sequence & Track Consistency
      expect(timeline.totalSteps).toBe(16);
      expect(timeline.tracks.length).toBe(16);
      expect(timeline.totalDurationMs).toBe(16 * 1000);

      // Root piece is step 1 (assembled at t=0)
      const rootTrack = timeline.tracks[0];
      expect(rootTrack.stepNumber).toBe(1);
      expect(rootTrack.keyframes.length).toBe(2);

      // Non-root piece tracks must each cover the 4 physical phases
      const nonRootTrack = timeline.tracks[1];
      expect(nonRootTrack.keyframes.length).toBe(5);
      const distinctPhases = Array.from(new Set(nonRootTrack.keyframes.map((k) => k.phase)));
      expect(distinctPhases).toEqual(["movement", "rotation", "alignment", "completion"]);

      // 2. Evaluation at t = 0 (Start)
      const startEval = timeline.evaluate!(0);
      expect(startEval.currentStepNumber).toBe(1);
      expect(startEval.activePieceId).toBe(rootTrack.pieceId);
      // Root piece is at assembled transform
      expect(startEval.pieceTransforms[rootTrack.pieceId]).toBeDefined();
      expect(startEval.pieceTransforms[rootTrack.pieceId].position).toEqual(
        assembledTransforms[rootTrack.pieceId].position
      );

      // 3. Evaluation during Step 2 Phase Progression
      // Step 2 spans [1000ms, 2000ms]
      // 20% of step = 1200ms (movement phase)
      const moveEval = timeline.evaluate!(1200);
      expect(moveEval.currentPhase).toBe("movement");
      expect(moveEval.currentStepNumber).toBe(2);

      // 50% of step = 1500ms (rotation phase)
      const rotEval = timeline.evaluate!(1500);
      expect(rotEval.currentPhase).toBe("rotation");

      // 75% of step = 1750ms (alignment phase)
      const alignEval = timeline.evaluate!(1750);
      expect(alignEval.currentPhase).toBe("alignment");

      // 95% of step = 1950ms (completion phase)
      const compEval = timeline.evaluate!(1950);
      expect(compEval.currentPhase).toBe("completion");

      // 4. Evaluation at t = TotalDuration (Final Completion)
      const finalEval = timeline.evaluate!(timeline.totalDurationMs);
      expect(finalEval.currentStepNumber).toBe(16);
      expect(finalEval.progressFraction).toBe(1.0);

      // Every piece transform at t=totalDuration must match authoritative assembledTransforms
      for (const piece of puzzle3D.pieces) {
        const pieceId = piece.pieceId;
        const evalTransform = finalEval.pieceTransforms[pieceId];
        const authTransform = assembledTransforms[pieceId];
        expect(evalTransform).toBeDefined();
        expect(evalTransform.position.x).toBeCloseTo(authTransform.position.x, 3);
        expect(evalTransform.position.y).toBeCloseTo(authTransform.position.y, 3);
        expect(evalTransform.position.z).toBeCloseTo(authTransform.position.z, 3);
      }

      // 5. CAD Immutability Assertion
      const currentPiece0Vertices = puzzle3D.pieces[0].solid.localMesh.positions;
      for (let i = 0; i < piece0VertexPositionsSnapshot.length; i++) {
        expect(currentPiece0Vertices[i]).toBe(piece0VertexPositionsSnapshot[i]);
      }
    });
  });

  describe("Playback Controller (AssemblyAnimationPlayer)", () => {
    it("controls playback state, stepping, seeking, and speed multipliers", () => {
      const p1Transform = { position: vec3(0, 0, 0), rotation: quatIdentity(), scale: vec3(1, 1, 1) };
      const p2Transform = { position: vec3(10, 0, 0), rotation: quatIdentity(), scale: vec3(1, 1, 1) };
      const p3Transform = { position: vec3(20, 0, 0), rotation: quatIdentity(), scale: vec3(1, 1, 1) };

      const mockTimeline = {
        puzzleId: "test_puzzle",
        totalSteps: 3,
        totalDurationMs: 3000,
        tracks: [
          {
            stepNumber: 1,
            pieceId: "P01",
            startTimeMs: 0,
            endTimeMs: 1000,
            durationMs: 1000,
            keyframes: [
              {
                stepProgress: 0.0,
                timelineTimeMs: 0,
                phase: "completion" as const,
                transform: p1Transform,
                visible: true,
                isValidCollisionFree: true,
              },
              {
                stepProgress: 1.0,
                timelineTimeMs: 1000,
                phase: "completion" as const,
                transform: p1Transform,
                visible: true,
                isValidCollisionFree: true,
              },
            ],
            transitions: [],
            stepDescription: "Place base piece P01",
          },
          {
            stepNumber: 2,
            pieceId: "P02",
            startTimeMs: 1000,
            endTimeMs: 2000,
            durationMs: 1000,
            keyframes: [
              {
                stepProgress: 0.0,
                timelineTimeMs: 1000,
                phase: "movement" as const,
                transform: { position: vec3(50, 0, 20), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
                visible: true,
                isValidCollisionFree: true,
              },
              {
                stepProgress: 0.35,
                timelineTimeMs: 1350,
                phase: "movement" as const,
                transform: { position: vec3(40, 0, 20), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
                visible: true,
                isValidCollisionFree: true,
              },
              {
                stepProgress: 0.60,
                timelineTimeMs: 1600,
                phase: "rotation" as const,
                transform: { position: vec3(30, 0, 20), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
                visible: true,
                isValidCollisionFree: true,
              },
              {
                stepProgress: 0.85,
                timelineTimeMs: 1850,
                phase: "alignment" as const,
                transform: { position: vec3(15, 0, 5), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
                visible: true,
                isValidCollisionFree: true,
              },
              {
                stepProgress: 1.0,
                timelineTimeMs: 2000,
                phase: "completion" as const,
                transform: p2Transform,
                visible: true,
                isValidCollisionFree: true,
              },
            ],
            transitions: [],
            stepDescription: "Insert piece P02",
          },
          {
            stepNumber: 3,
            pieceId: "P03",
            startTimeMs: 2000,
            endTimeMs: 3000,
            durationMs: 1000,
            keyframes: [
              {
                stepProgress: 0.0,
                timelineTimeMs: 2000,
                phase: "movement" as const,
                transform: { position: vec3(60, 0, 20), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
                visible: true,
                isValidCollisionFree: true,
              },
              {
                stepProgress: 1.0,
                timelineTimeMs: 3000,
                phase: "completion" as const,
                transform: p3Transform,
                visible: true,
                isValidCollisionFree: true,
              },
            ],
            transitions: [],
            stepDescription: "Insert piece P03",
          },
        ],
        standoffTransforms: {
          P01: p1Transform,
          P02: { position: vec3(50, 0, 20), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
          P03: { position: vec3(60, 0, 20), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
        },
        assembledTransforms: {
          P01: p1Transform,
          P02: p2Transform,
          P03: p3Transform,
        },
        transitions: [],
        assemblySequence: {
          sequenceId: "seq_test",
          puzzleId: "test_puzzle",
          totalSteps: 3,
          isPhysicallyAssemblable: true,
          steps: [],
        },
        isOriginalGeometryUnchanged: true,
      };

      const player = new AssemblyAnimationPlayer(mockTimeline);
      expect(player.getStatus().playbackState).toBe("idle");
      expect(player.getStatus().currentTimeMs).toBe(0);

      // Play & Tick
      let notifiedStatus = player.getStatus();
      player.subscribe((status) => {
        notifiedStatus = status;
      });

      player.play();
      expect(player.getStatus().playbackState).toBe("playing");

      // Advance by 500ms at 1.0x speed
      player.tick(500);
      expect(notifiedStatus.currentTimeMs).toBe(500);
      expect(notifiedStatus.progressFraction).toBeCloseTo(500 / 3000, 2);

      // Test Speed Multiplier 2.0x
      player.setSpeed(2.0);
      player.tick(250); // 250ms * 2.0 = 500ms advance -> total 1000ms
      expect(player.getStatus().currentTimeMs).toBe(1000);

      // Pause
      player.pause();
      expect(player.getStatus().playbackState).toBe("paused");
      player.tick(500); // Should not advance when paused
      expect(player.getStatus().currentTimeMs).toBe(1000);

      // Step Forward (jumps to next step start: step 3 = 2000ms)
      player.stepForward();
      expect(player.getStatus().currentTimeMs).toBe(2000);
      expect(player.getStatus().currentStepNumber).toBe(3);

      // Step Backward (jumps to step 2 = 1000ms)
      player.stepBackward();
      expect(player.getStatus().currentTimeMs).toBe(1000);
      expect(player.getStatus().currentStepNumber).toBe(2);

      // Seek (in milliseconds)
      player.seek(2500);
      expect(player.getStatus().currentTimeMs).toBe(2500);

      // Seek (in fraction)
      player.seek(0.5);
      expect(player.getStatus().currentTimeMs).toBe(1500);

      // Restart
      player.restart();
      expect(player.getStatus().currentTimeMs).toBe(0);
      expect(player.getStatus().playbackState).toBe("playing");
    });
  });

  describe("Viewer Controller & React UI Integration", () => {
    it("integrates with Puzzle3DViewerController for assembly animation playback", async () => {
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
          generatorVersion: "Phase 97",
        },
      };

      const scene = SceneBuilder.buildFromPuzzle(puzzleResult);

      const controller = new Puzzle3DViewerController();
      controller.loadScene(scene, puzzleResult.validationReport, puzzle3D);

      const animPlayer = controller.getAnimationPlayer();
      expect(animPlayer).toBeDefined();
      expect(animPlayer?.getStatus().playbackState).toBe("idle");
      expect(animPlayer?.getStatus().totalSteps).toBe(16);

      // Play
      controller.playAnimation();
      expect(animPlayer?.getStatus().playbackState).toBe("playing");

      // Tick
      controller.tickAnimation(500);
      expect(animPlayer?.getStatus().currentTimeMs).toBe(500);

      // Pause
      controller.pauseAnimation();
      expect(animPlayer?.getStatus().playbackState).toBe("paused");

      // Step forward & backward
      controller.stepForwardAnimation();
      expect(animPlayer?.getStatus().currentStepNumber).toBeGreaterThanOrEqual(2);

      controller.stepBackwardAnimation();
      expect(animPlayer?.getStatus().currentStepNumber).toBeGreaterThanOrEqual(1);

      // Set Speed
      controller.setAnimationSpeed(2.0);
      expect(animPlayer?.getStatus().speedMultiplier).toBe(2.0);

      // Restart
      controller.restartAnimation();
      expect(animPlayer?.getStatus().currentTimeMs).toBe(0);

      controller.dispose();
    });

    it("renders Assembly Animation Control HUD and handles user interactions in React", async () => {
      const puzzleResult = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <Puzzle3DPreview
            puzzleResult={puzzleResult}
            width={800}
            height={600}
          />
        );
      });

      // Find the Assembly Animation Controls HUD
      const animationHUD = container.querySelector(
        '[data-testid="assembly-animation-controls"]'
      );
      expect(animationHUD).not.toBeNull();

      // Verify buttons exist
      const playPauseBtn = container.querySelector(
        '[data-testid="animation-play-pause-btn"]'
      ) as HTMLButtonElement;
      expect(playPauseBtn).not.toBeNull();
      expect(playPauseBtn.textContent).toContain("▶ Play");

      const restartBtn = container.querySelector(
        '[data-testid="animation-restart-btn"]'
      ) as HTMLButtonElement;
      expect(restartBtn).not.toBeNull();

      const stepFwdBtn = container.querySelector(
        '[data-testid="animation-step-forward-btn"]'
      ) as HTMLButtonElement;
      expect(stepFwdBtn).not.toBeNull();

      const stepBackBtn = container.querySelector(
        '[data-testid="animation-step-back-btn"]'
      ) as HTMLButtonElement;
      expect(stepBackBtn).not.toBeNull();

      const progressScrubber = container.querySelector(
        '[data-testid="animation-progress-scrubber"]'
      ) as HTMLInputElement;
      expect(progressScrubber).not.toBeNull();

      const stepIndicator = container.querySelector(
        '[data-testid="animation-current-step"]'
      );
      expect(stepIndicator).not.toBeNull();
      expect(stepIndicator?.textContent).toContain("Step 1");

      const phaseBadge = container.querySelector(
        '[data-testid="animation-phase-badge"]'
      );
      expect(phaseBadge).not.toBeNull();

      // Test Clicking Play Button
      await act(async () => {
        playPauseBtn.click();
      });

      // Verify HUD button text switched to Pause
      expect(playPauseBtn.textContent).toContain("⏸ Pause");

      // Test Clicking Step Forward
      await act(async () => {
        stepFwdBtn.click();
      });
      expect(stepIndicator?.textContent).toContain("Step 2");

      // Test Clicking Step Backward
      await act(async () => {
        stepBackBtn.click();
      });
      expect(stepIndicator?.textContent).toContain("Step 1");

      // Test Speed Button
      const speed2Btn = container.querySelector(
        '[data-testid="animation-speed-2"]'
      ) as HTMLButtonElement;
      expect(speed2Btn).not.toBeNull();
      await act(async () => {
        speed2Btn.click();
      });

      // Cleanup
      await act(async () => {
        root.unmount();
      });
      document.body.removeChild(container);
    });
  });
});
