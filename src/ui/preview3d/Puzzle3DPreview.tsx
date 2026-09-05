/**
 * Interactive 3D Puzzle Preview Component (Phase 94).
 *
 * Full-featured React viewport component displaying generated puzzles:
 *  - Automatic 3D assembly, pieces, connectors, joining interfaces, IDs
 *  - Orbit, rotate, zoom, pan, reset camera controls
 *  - Interactive piece selection, hide/show, isolation, and connection highlighting
 *  - Visual states: VALID, WARNING, COLLISION, INVALID_CONNECTION, SELECTED_PIECE
 *  - Loading skeleton & error handling with retry trigger
 *  - Renderer-independent: Consumes Phase 93 Scene representation
 *  - Visualization only: strictly zero mutation of authoritative CAD model
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { SceneBuilder } from "@/core/puzzle/scene/sceneBuilder";
import type { Scene } from "@/core/puzzle/scene/types";
import type {
  AngleAdjustmentResult,
  ConnectionAngleInspection,
} from "@/core/puzzle/manipulation/types";
import type {
  ExplodedAssemblyResult,
  ExplodedIndicatorOptions,
  ExplodedViewMode,
} from "@/core/puzzle/exploded/types";
import type { AnimationPlaybackStatus } from "@/core/puzzle/animation/types";
import { Puzzle3DViewerController } from "./Puzzle3DViewerController";
import type {
  Puzzle3DPreviewProps,
  Puzzle3DVisualState,
  ViewerCameraPreset,
  ViewerSelectionState,
} from "./types";

export const Puzzle3DPreview: React.FC<Puzzle3DPreviewProps> = ({
  puzzleResult,
  scene: propScene,
  isLoading = false,
  loadingMessage = "Synthesizing 3D assembly...",
  error = null,
  onRetry,
  onPieceSelect,
  onConnectionSelect,
  showControlsHUD = true,
  showPiecesDrawer = true,
  showConnectionsDrawer = true,
  showStatusPill = true,
  className = "",
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<Puzzle3DViewerController | null>(null);

  // Resolved Phase 93 Scene
  const [resolvedScene, setResolvedScene] = useState<Scene | null>(null);

  // UI state
  const [selection, setSelection] = useState<ViewerSelectionState>({
    selectedPieceId: null,
    highlightedConnectionId: null,
    hiddenPieceIds: new Set<string>(),
    isolatedPieceId: null,
    visualStateOverrides: new Map<string, Puzzle3DVisualState>(),
  });

  const [interactionMode, setInteractionMode] = useState<"orbit" | "pan">("orbit");
  const [isDragging, setIsDragging] = useState(false);
  const [lastPointer, setLastPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPiecesDrawerOpen, setIsPiecesDrawerOpen] = useState(false);
  const [isConnectionsDrawerOpen, setIsConnectionsDrawerOpen] = useState(false);

  // Connection Inspection & Manipulation State (Phase 95)
  const [activeInspection, setActiveInspection] = useState<ConnectionAngleInspection | null>(null);
  const [lastAdjustment, setLastAdjustment] = useState<AngleAdjustmentResult | null>(null);

  // Exploded Assembly Visualization State (Phase 96)
  const [explodedResult, setExplodedResult] = useState<ExplodedAssemblyResult | null>(null);

  // Assembly Animation State (Phase 97)
  const [animationStatus, setAnimationStatus] = useState<AnimationPlaybackStatus | null>(null);

  // ─────────────────────────────────────────────────────────────
  // 1. Controller Initialization
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new Puzzle3DViewerController({
      onSelectionChange: (newSelection) => {
        setSelection(newSelection);
        if (onPieceSelect) onPieceSelect(newSelection.selectedPieceId);
        if (onConnectionSelect) onConnectionSelect(newSelection.highlightedConnectionId);

        if (newSelection.highlightedConnectionId && controllerRef.current) {
          const insp = controllerRef.current.inspectConnection(newSelection.highlightedConnectionId);
          setActiveInspection(insp);
          setLastAdjustment(null);
        } else {
          setActiveInspection(null);
          setLastAdjustment(null);
        }
      },
      onExplodedResultChange: (newResult) => {
        setExplodedResult(newResult ? { ...newResult } : null);
      },
      onAnimationStatusChange: (status) => {
        setAnimationStatus(status ? { ...status } : null);
      },
    });
    controllerRef.current = controller;

    if (canvasRef.current) {
      controller.attachCanvas(canvasRef.current);
    }

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [onPieceSelect, onConnectionSelect]);

  // ─────────────────────────────────────────────────────────────
  // 2. Scene Resolution & Loading
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let sceneToLoad: Scene | null = null;

    if (propScene) {
      sceneToLoad = propScene;
    } else if (puzzleResult) {
      sceneToLoad = SceneBuilder.buildFromPuzzle(puzzleResult, {
        colorScheme: "distinct_pieces",
        includeCoordinateAxes: true,
        includeConnectionVisualizations: true,
      });
    }

    setResolvedScene(sceneToLoad);

    if (controllerRef.current && sceneToLoad) {
      const report = puzzleResult ? puzzleResult.validationReport : null;
      const puzzle3D = puzzleResult
        ? {
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
          }
        : null;

      controllerRef.current.loadScene(sceneToLoad, report, puzzle3D);
      setExplodedResult(controllerRef.current.getExplodedResult());
      setAnimationStatus(controllerRef.current.getAnimationStatus());
    }
  }, [puzzleResult, propScene]);

  // ─────────────────────────────────────────────────────────────
  // 3. Resize Observer
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (controllerRef.current && width > 0 && height > 0) {
          controllerRef.current.resize(width, height);
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 4. Pointer Interaction Handlers (Orbit, Pan, Zoom, Pick)
  // ─────────────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setLastPointer({ x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !controllerRef.current) return;

    const deltaX = e.clientX - lastPointer.x;
    const deltaY = e.clientY - lastPointer.y;
    setLastPointer({ x: e.clientX, y: e.clientY });

    // Right-click or middle-click or pan mode triggers Pan
    if (e.buttons === 2 || e.buttons === 4 || interactionMode === "pan") {
      controllerRef.current.pan(deltaX, deltaY);
    } else {
      // Left-click triggers Orbit
      controllerRef.current.orbit(deltaX, deltaY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!controllerRef.current) return;
    const delta = Math.sign(e.deltaY) * -0.5;
    controllerRef.current.zoom(delta);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!controllerRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedPieceId = controllerRef.current.pickPiece(x, y, rect.width, rect.height);
    controllerRef.current.selectPiece(clickedPieceId);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent browser context menu during right-click pan
  };

  // ─────────────────────────────────────────────────────────────
  // 5. Camera & Viewport Actions
  // ─────────────────────────────────────────────────────────────
  const handleResetCamera = useCallback(() => {
    controllerRef.current?.resetCamera();
  }, []);

  const handleCameraPreset = useCallback((preset: ViewerCameraPreset) => {
    controllerRef.current?.setCameraPreset(preset);
  }, []);

  const handleZoomIn = useCallback(() => {
    controllerRef.current?.zoom(0.8);
  }, []);

  const handleZoomOut = useCallback(() => {
    controllerRef.current?.zoom(-0.8);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 6. Piece & Connection Actions
  // ─────────────────────────────────────────────────────────────
  const handlePieceClick = useCallback((pieceId: string) => {
    if (selection.selectedPieceId === pieceId) {
      controllerRef.current?.selectPiece(null);
    } else {
      controllerRef.current?.selectPiece(pieceId);
    }
  }, [selection.selectedPieceId]);

  const handleToggleHide = useCallback((pieceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    controllerRef.current?.togglePieceVisibility(pieceId);
  }, []);

  const handleIsolate = useCallback((pieceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selection.isolatedPieceId === pieceId) {
      controllerRef.current?.unisolate();
    } else {
      controllerRef.current?.isolatePiece(pieceId);
    }
  }, [selection.isolatedPieceId]);

  const handleResetVisibility = useCallback(() => {
    controllerRef.current?.resetVisibility();
  }, []);

  const handleConnectionClick = useCallback((connectionId: string) => {
    if (selection.highlightedConnectionId === connectionId) {
      controllerRef.current?.clearHighlight();
    } else {
      controllerRef.current?.highlightConnection(connectionId);
    }
  }, [selection.highlightedConnectionId]);

  const handleAngleChange = useCallback((newAngleDeg: number) => {
    if (!activeInspection || !controllerRef.current) return;
    const result = controllerRef.current.adjustConnectionAngle(
      activeInspection.connectionId,
      newAngleDeg
    );
    setLastAdjustment(result);
    setActiveInspection((prev) =>
      prev ? { ...prev, currentAngleDeg: newAngleDeg } : null
    );
  }, [activeInspection]);

  const handleCloseInspection = useCallback(() => {
    controllerRef.current?.clearHighlight();
    setActiveInspection(null);
    setLastAdjustment(null);
  }, []);

  // Exploded Assembly Actions (Phase 96)
  const handleSetExplodedMode = useCallback((mode: ExplodedViewMode) => {
    const res = controllerRef.current?.setExplodedViewMode(mode);
    setExplodedResult(res ? { ...res } : null);
  }, []);

  const handleExplosionFactorChange = useCallback((factor: number) => {
    const res = controllerRef.current?.setExplosionFactor(factor);
    setExplodedResult(res ? { ...res } : null);
  }, []);

  const handleAssemblyStepChange = useCallback((step: number) => {
    const res = controllerRef.current?.setAssemblyStep(step);
    setExplodedResult(res ? { ...res } : null);
  }, []);

  const handleNextStep = useCallback(() => {
    const res = controllerRef.current?.nextAssemblyStep();
    setExplodedResult(res ? { ...res } : null);
  }, []);

  const handlePrevStep = useCallback(() => {
    const res = controllerRef.current?.prevAssemblyStep();
    setExplodedResult(res ? { ...res } : null);
  }, []);

  const handleToggleIndicator = useCallback((key: keyof ExplodedIndicatorOptions) => {
    const res = controllerRef.current?.toggleExplodedIndicator(key);
    setExplodedResult(res ? { ...res } : null);
  }, []);

  // Assembly Animation Actions (Phase 97)
  const handleTogglePlayPause = useCallback(() => {
    controllerRef.current?.togglePlayPauseAnimation();
    setAnimationStatus(controllerRef.current?.getAnimationStatus() || null);
  }, []);

  const handleRestartAnimation = useCallback(() => {
    controllerRef.current?.restartAnimation();
    setAnimationStatus(controllerRef.current?.getAnimationStatus() || null);
  }, []);

  const handleStepForwardAnimation = useCallback(() => {
    controllerRef.current?.stepForwardAnimation();
    setAnimationStatus(controllerRef.current?.getAnimationStatus() || null);
  }, []);

  const handleStepBackwardAnimation = useCallback(() => {
    controllerRef.current?.stepBackwardAnimation();
    setAnimationStatus(controllerRef.current?.getAnimationStatus() || null);
  }, []);

  const handleSetSpeed = useCallback((speed: number) => {
    controllerRef.current?.setAnimationSpeed(speed);
    setAnimationStatus(controllerRef.current?.getAnimationStatus() || null);
  }, []);

  const handleSeekAnimation = useCallback((fraction: number) => {
    controllerRef.current?.seekAnimation(fraction);
    setAnimationStatus(controllerRef.current?.getAnimationStatus() || null);
  }, []);

  // Determine Overall Visual State
  const globalValidation = puzzleResult?.validationReport;
  let overallVisualState: Puzzle3DVisualState = "VALID";
  if (globalValidation) {
    if (globalValidation.failures.some((f) => f.category === "collision")) {
      overallVisualState = "COLLISION";
    } else if (globalValidation.failures.some((f) => f.category === "mandatory_connection")) {
      overallVisualState = "INVALID_CONNECTION";
    } else if (globalValidation.failures.some((f) => f.category === "clearance")) {
      overallVisualState = "WARNING";
    } else if (!globalValidation.isValid) {
      overallVisualState = "WARNING";
    }
  }

  const selectedPiece = resolvedScene?.pieces.find(
    (p) => p.pieceId === selection.selectedPieceId
  );

  return (
    <div
      ref={containerRef}
      className={`puzzle-3d-preview-container ${className}`}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "420px",
        backgroundColor: "#16181d",
        overflow: "hidden",
        userSelect: "none",
        fontFamily: "system-ui, -apple-system, sans-serif",
        ...style,
      }}
      data-testid="puzzle-3d-preview"
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        data-testid="puzzle-3d-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: interactionMode === "pan" ? "grab" : "crosshair",
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          Floating Top Controls HUD
         ───────────────────────────────────────────────────────────── */}
      {showControlsHUD && (
        <div
          data-testid="puzzle-3d-controls-hud"
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            right: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          {/* Left: Mode & Camera Presets */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              background: "rgba(22, 24, 29, 0.85)",
              backdropFilter: "blur(12px)",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              pointerEvents: "auto",
            }}
          >
            <button
              onClick={() => setInteractionMode("orbit")}
              title="Orbit Mode (Left Drag)"
              style={{
                background: interactionMode === "orbit" ? "#3498db" : "transparent",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                padding: "4px 8px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Orbit
            </button>
            <button
              onClick={() => setInteractionMode("pan")}
              title="Pan Mode (Left Drag or Right Drag)"
              style={{
                background: interactionMode === "pan" ? "#3498db" : "transparent",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                padding: "4px 8px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Pan
            </button>
            <span style={{ width: "1px", background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
            <button
              onClick={() => handleCameraPreset("iso")}
              style={presetBtnStyle}
              title="Isometric 3D View"
            >
              ISO
            </button>
            <button
              onClick={() => handleCameraPreset("top")}
              style={presetBtnStyle}
              title="Top View"
            >
              Top
            </button>
            <button
              onClick={() => handleCameraPreset("front")}
              style={presetBtnStyle}
              title="Front View"
            >
              Front
            </button>
            <button
              onClick={() => handleCameraPreset("side")}
              style={presetBtnStyle}
              title="Side View"
            >
              Side
            </button>
            <span style={{ width: "1px", background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
            <button onClick={handleZoomIn} style={presetBtnStyle} title="Zoom In">
              +
            </button>
            <button onClick={handleZoomOut} style={presetBtnStyle} title="Zoom Out">
              -
            </button>
            <button
              onClick={handleResetCamera}
              style={{ ...presetBtnStyle, color: "#2ecc71" }}
              title="Reset Camera Framing"
            >
              Reset
            </button>
          </div>

          {/* Right: Status Pill & Drawer Toggles */}
          <div style={{ display: "flex", gap: "8px", pointerEvents: "auto" }}>
            {showStatusPill && (
              <div
                data-testid="puzzle-3d-status-pill"
                style={{
                  ...statusPillStyle(overallVisualState),
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 600,
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: statusDotColor(overallVisualState),
                  }}
                />
                {overallVisualState}
              </div>
            )}

            {showPiecesDrawer && (
              <button
                onClick={() => setIsPiecesDrawerOpen(!isPiecesDrawerOpen)}
                style={{
                  ...drawerToggleBtnStyle,
                  background: isPiecesDrawerOpen ? "#3498db" : "rgba(22, 24, 29, 0.85)",
                }}
                data-testid="toggle-pieces-drawer"
              >
                Pieces ({resolvedScene?.pieces.length || 0})
              </button>
            )}

            {showConnectionsDrawer && (
              <button
                onClick={() => setIsConnectionsDrawerOpen(!isConnectionsDrawerOpen)}
                style={{
                  ...drawerToggleBtnStyle,
                  background: isConnectionsDrawerOpen ? "#3498db" : "rgba(22, 24, 29, 0.85)",
                }}
                data-testid="toggle-connections-drawer"
              >
                Connections ({resolvedScene?.connections.length || 0})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Exploded Assembly Control HUD (Phase 96)
         ───────────────────────────────────────────────────────────── */}
      {explodedResult && (
        <div
          data-testid="exploded-view-controls"
          style={{
            position: "absolute",
            top: "56px",
            left: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            background: "rgba(22, 24, 29, 0.92)",
            backdropFilter: "blur(14px)",
            padding: "8px 12px",
            borderRadius: "10px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#fff",
            fontSize: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            zIndex: 10,
            maxWidth: "380px",
          }}
        >
          {/* View Mode Switcher */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#aaa", fontSize: "11px", fontWeight: 600 }}>VIEW:</span>
            <button
              data-testid="view-mode-normal"
              onClick={() => handleSetExplodedMode("normal")}
              style={{
                background: explodedResult.config.mode === "normal" ? "#3498db" : "rgba(255,255,255,0.06)",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                cursor: "pointer",
                fontWeight: explodedResult.config.mode === "normal" ? 600 : 400,
              }}
            >
              Normal
            </button>
            <button
              data-testid="view-mode-exploded"
              onClick={() => handleSetExplodedMode("exploded")}
              style={{
                background: explodedResult.config.mode === "exploded" ? "#3498db" : "rgba(255,255,255,0.06)",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                cursor: "pointer",
                fontWeight: explodedResult.config.mode === "exploded" ? 600 : 400,
              }}
            >
              Exploded
            </button>
            <button
              data-testid="view-mode-step"
              onClick={() => handleSetExplodedMode("assembly_step")}
              style={{
                background: explodedResult.config.mode === "assembly_step" ? "#3498db" : "rgba(255,255,255,0.06)",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                cursor: "pointer",
                fontWeight: explodedResult.config.mode === "assembly_step" ? 600 : 400,
              }}
            >
              Step View
            </button>
          </div>

          {/* Exploded Mode Slider */}
          {explodedResult.config.mode === "exploded" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#aaa", fontSize: "11px" }}>Explosion:</span>
              <input
                type="range"
                data-testid="explosion-factor-slider"
                min={0}
                max={100}
                value={Math.round(explodedResult.config.explosionFactor * 100)}
                onChange={(e) => handleExplosionFactorChange(Number(e.target.value) / 100)}
                style={{ flex: 1, accentColor: "#3498db", cursor: "pointer" }}
              />
              <span style={{ fontSize: "11px", minWidth: "34px", textAlign: "right" }}>
                {Math.round(explodedResult.config.explosionFactor * 100)}%
              </span>
            </div>
          )}

          {/* Assembly-Step Mode Controls */}
          {explodedResult.config.mode === "assembly_step" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <button
                  data-testid="prev-step-btn"
                  onClick={handlePrevStep}
                  disabled={explodedResult.config.currentStep <= 1}
                  style={{
                    background: explodedResult.config.currentStep <= 1 ? "rgba(255,255,255,0.04)" : "#34495e",
                    color: explodedResult.config.currentStep <= 1 ? "#666" : "#fff",
                    border: "none",
                    borderRadius: "4px",
                    padding: "3px 10px",
                    cursor: explodedResult.config.currentStep <= 1 ? "default" : "pointer",
                    fontSize: "11px",
                  }}
                >
                  ◀ Prev
                </button>
                <span data-testid="step-indicator" style={{ fontWeight: 600, color: "#00e5ff" }}>
                  Step {explodedResult.config.currentStep} / {explodedResult.totalSteps}
                </span>
                <button
                  data-testid="next-step-btn"
                  onClick={handleNextStep}
                  disabled={explodedResult.config.currentStep >= explodedResult.totalSteps}
                  style={{
                    background:
                      explodedResult.config.currentStep >= explodedResult.totalSteps
                        ? "rgba(255,255,255,0.04)"
                        : "#34495e",
                    color:
                      explodedResult.config.currentStep >= explodedResult.totalSteps ? "#666" : "#fff",
                    border: "none",
                    borderRadius: "4px",
                    padding: "3px 10px",
                    cursor:
                      explodedResult.config.currentStep >= explodedResult.totalSteps
                        ? "default"
                        : "pointer",
                    fontSize: "11px",
                  }}
                >
                  Next ▶
                </button>
              </div>

              {/* Step Description */}
              <div
                data-testid="step-description"
                style={{
                  fontSize: "11px",
                  color: "#ddd",
                  background: "rgba(0,0,0,0.25)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  borderLeft: "2px solid #00e5ff",
                }}
              >
                {explodedResult.steps[explodedResult.config.currentStep - 1]?.stepDescription || ""}
              </div>
            </div>
          )}

          {/* Indicator Toggles */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", paddingTop: "2px" }}>
            <span style={{ color: "#888", fontSize: "10px" }}>SHOW:</span>
            <button
              data-testid="toggle-piece-numbers"
              onClick={() => handleToggleIndicator("showPieceNumbers")}
              style={{
                ...indicatorBtnStyle,
                background: explodedResult.config.indicators.showPieceNumbers ? "#2980b9" : "transparent",
                color: explodedResult.config.indicators.showPieceNumbers ? "#fff" : "#888",
              }}
              title="Toggle Piece Number Badges"
            >
              # Numbers
            </button>
            <button
              data-testid="toggle-connection-lines"
              onClick={() => handleToggleIndicator("showConnectionIndicators")}
              style={{
                ...indicatorBtnStyle,
                background: explodedResult.config.indicators.showConnectionIndicators ? "#16a085" : "transparent",
                color: explodedResult.config.indicators.showConnectionIndicators ? "#fff" : "#888",
              }}
              title="Toggle Connection Guide Lines"
            >
              Lines
            </button>
            <button
              data-testid="toggle-assembly-directions"
              onClick={() => handleToggleIndicator("showAssemblyDirections")}
              style={{
                ...indicatorBtnStyle,
                background: explodedResult.config.indicators.showAssemblyDirections ? "#d35400" : "transparent",
                color: explodedResult.config.indicators.showAssemblyDirections ? "#fff" : "#888",
              }}
              title="Toggle Assembly Trajectory Arrows"
            >
              Directions
            </button>
            <button
              data-testid="toggle-joining-interfaces"
              onClick={() => handleToggleIndicator("showJoiningInterfaces")}
              style={{
                ...indicatorBtnStyle,
                background: explodedResult.config.indicators.showJoiningInterfaces ? "#8e44ad" : "transparent",
                color: explodedResult.config.indicators.showJoiningInterfaces ? "#fff" : "#888",
              }}
              title="Toggle Joining Interface Ports"
            >
              Interfaces
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Assembly Animation Control HUD (Phase 97)
         ───────────────────────────────────────────────────────────── */}
      {animationStatus && (
        <div
          data-testid="assembly-animation-controls"
          style={{
            position: "absolute",
            bottom: "16px",
            right: isConnectionsDrawerOpen || isPiecesDrawerOpen ? "300px" : "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            background: "rgba(22, 24, 29, 0.94)",
            backdropFilter: "blur(14px)",
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#fff",
            fontSize: "12px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
            zIndex: 10,
            width: "360px",
            maxWidth: "90vw",
          }}
        >
          {/* Header Row: Step, Phase & State */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#3498db", fontWeight: 700, fontSize: "11px" }}>ANIMATION</span>
              <span
                data-testid="animation-current-step"
                style={{
                  background: "rgba(52, 152, 219, 0.2)",
                  color: "#3498db",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: 600,
                  fontSize: "11px",
                }}
              >
                Step {animationStatus.currentStepNumber} of {animationStatus.totalSteps}
              </span>
            </div>
            <div
              data-testid="animation-phase-badge"
              style={{
                background: phaseBadgeColor(animationStatus.currentPhase),
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {animationStatus.currentPhase}
            </div>
          </div>

          {/* Step Description */}
          <div
            data-testid="animation-step-description"
            style={{
              fontSize: "11px",
              color: "#ccc",
              background: "rgba(0,0,0,0.2)",
              padding: "4px 8px",
              borderRadius: "4px",
              borderLeft: "2px solid #3498db",
            }}
          >
            {animationStatus.stepDescription}
          </div>

          {/* Progress Scrubber */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "10px", color: "#888", minWidth: "28px" }}>
              {Math.round(animationStatus.progressFraction * 100)}%
            </span>
            <input
              type="range"
              data-testid="animation-progress-scrubber"
              min={0}
              max={100}
              value={Math.round(animationStatus.progressFraction * 100)}
              onChange={(e) => handleSeekAnimation(Number(e.target.value) / 100)}
              style={{ flex: 1, accentColor: "#3498db", cursor: "pointer" }}
            />
            <span style={{ fontSize: "10px", color: "#888" }}>
              {Math.round(animationStatus.currentTimeMs / 1000)}s / {Math.round(animationStatus.totalDurationMs / 1000)}s
            </span>
          </div>

          {/* Control Buttons Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                data-testid="animation-step-back-btn"
                onClick={handleStepBackwardAnimation}
                title="Step Backward"
                style={playbackBtnStyle}
              >
                ⏮
              </button>
              <button
                data-testid="animation-play-pause-btn"
                onClick={handleTogglePlayPause}
                style={{
                  ...playbackBtnStyle,
                  background: animationStatus.playbackState === "playing" ? "#e67e22" : "#2ecc71",
                  color: "#fff",
                  fontWeight: 600,
                  padding: "4px 12px",
                }}
              >
                {animationStatus.playbackState === "playing" ? "⏸ Pause" : "▶ Play"}
              </button>
              <button
                data-testid="animation-restart-btn"
                onClick={handleRestartAnimation}
                title="Restart Animation"
                style={playbackBtnStyle}
              >
                ↺
              </button>
              <button
                data-testid="animation-step-forward-btn"
                onClick={handleStepForwardAnimation}
                title="Step Forward"
                style={playbackBtnStyle}
              >
                ⏭
              </button>
            </div>

            {/* Speed Multiplier */}
            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              {[0.5, 1, 2].map((s) => (
                <button
                  key={s}
                  data-testid={`animation-speed-${s}`}
                  onClick={() => handleSetSpeed(s)}
                  style={{
                    background: animationStatus.speedMultiplier === s ? "#3498db" : "rgba(255,255,255,0.06)",
                    color: animationStatus.speedMultiplier === s ? "#fff" : "#888",
                    border: "none",
                    borderRadius: "3px",
                    padding: "2px 5px",
                    fontSize: "10px",
                    cursor: "pointer",
                    fontWeight: animationStatus.speedMultiplier === s ? 700 : 400,
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Selected Piece Inspector Card (Bottom Left)
         ───────────────────────────────────────────────────────────── */}
      {selectedPiece && (
        <div
          data-testid="selected-piece-card"
          style={{
            position: "absolute",
            bottom: "16px",
            left: "16px",
            background: "rgba(22, 24, 29, 0.9)",
            backdropFilter: "blur(12px)",
            border: "1px solid #00e5ff",
            boxShadow: "0 4px 20px rgba(0, 229, 255, 0.2)",
            borderRadius: "8px",
            padding: "12px 16px",
            color: "#fff",
            maxWidth: "280px",
            fontSize: "13px",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, color: "#00e5ff" }}>SELECTED PIECE</span>
            <button
              onClick={() => handlePieceClick(selectedPiece.pieceId!)}
              style={{
                background: "transparent",
                border: "none",
                color: "#888",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ marginTop: "6px" }}>
            <strong>Piece ID:</strong> <code>{selectedPiece.pieceId}</code>
          </div>
          <div>
            <strong>Name:</strong> {selectedPiece.name}
          </div>
          <div>
            <strong>Connections:</strong> {selectedPiece.connectionIds?.length || 0}
          </div>
          <div style={{ marginTop: "8px", display: "flex", gap: "6px" }}>
            <button
              onClick={(e) => handleIsolate(selectedPiece.pieceId!, e)}
              style={{
                background: selection.isolatedPieceId === selectedPiece.pieceId ? "#e67e22" : "#34495e",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              {selection.isolatedPieceId === selectedPiece.pieceId ? "Unisolate" : "Isolate"}
            </button>
            <button
              onClick={(e) => handleToggleHide(selectedPiece.pieceId!, e)}
              style={{
                background: "#34495e",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Hide
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Connection Angle Inspector & Manipulation Card (Phase 95)
         ───────────────────────────────────────────────────────────── */}
      {activeInspection && (
        <div
          data-testid="connection-angle-inspector-card"
          style={{
            position: "absolute",
            bottom: "16px",
            left: selectedPiece ? "312px" : "16px",
            background: "rgba(22, 24, 29, 0.95)",
            backdropFilter: "blur(14px)",
            border: lastAdjustment && !lastAdjustment.isValid
              ? "1px solid #e74c3c"
              : "1px solid #3498db",
            boxShadow: lastAdjustment && !lastAdjustment.isValid
              ? "0 4px 24px rgba(231, 76, 60, 0.3)"
              : "0 4px 24px rgba(52, 152, 219, 0.25)",
            borderRadius: "10px",
            padding: "14px 18px",
            color: "#fff",
            width: "340px",
            maxWidth: "90vw",
            fontSize: "13px",
            zIndex: 12,
            transition: "border 0.2s, box-shadow 0.2s",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 700, color: "#3498db", fontSize: "12px", letterSpacing: "0.5px" }}>
                CONNECTION ANGLE
              </span>
              <span
                style={{
                  background: "rgba(52, 152, 219, 0.2)",
                  color: "#3498db",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                {activeInspection.connectorType}
              </span>
            </div>
            <button
              onClick={handleCloseInspection}
              data-testid="close-connection-inspector"
              style={{
                background: "transparent",
                border: "none",
                color: "#888",
                cursor: "pointer",
                fontSize: "14px",
              }}
              title="Close Inspector"
            >
              ✕
            </button>
          </div>

          {/* Details */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "10px", fontSize: "12px" }}>
            <div>
              <span style={{ color: "#888" }}>ID: </span>
              <code style={{ color: "#00e5ff" }}>{activeInspection.connectionId}</code>
            </div>
            <div>
              <span style={{ color: "#888" }}>Pieces: </span>
              <span>{activeInspection.pieceAId} ↔ {activeInspection.pieceBId}</span>
            </div>
            <div>
              <span style={{ color: "#888" }}>Current: </span>
              <strong style={{ color: "#fff" }}>{activeInspection.currentAngleDeg}°</strong>
            </div>
            <div>
              <span style={{ color: "#888" }}>Range: </span>
              <span>
                {activeInspection.allowedAngleRange.min}° – {activeInspection.allowedAngleRange.max}°
              </span>
            </div>
          </div>

          {/* Slider */}
          <div style={{ marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#aaa", marginBottom: "4px" }}>
              <span>Adjust Angle</span>
              <span>{activeInspection.currentAngleDeg}°</span>
            </div>
            <input
              type="range"
              data-testid="angle-slider"
              min={activeInspection.allowedAngleRange.min}
              max={activeInspection.allowedAngleRange.max}
              step={1}
              value={activeInspection.currentAngleDeg}
              onChange={(e) => handleAngleChange(Number(e.target.value))}
              style={{
                width: "100%",
                cursor: "pointer",
                accentColor: lastAdjustment && !lastAdjustment.success ? "#e74c3c" : "#3498db",
              }}
            />
          </div>

          {/* Preset Buttons */}
          <div style={{ marginBottom: "10px" }}>
            <div style={{ fontSize: "11px", color: "#aaa", marginBottom: "4px" }}>Preset Angles:</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {[0, 30, 45, 60, 90, 180].map((deg) => {
                const isActive = activeInspection.currentAngleDeg === deg;
                const isCandidate = (activeInspection.allowedAngleRange.validCandidates || []).includes(deg);
                return (
                  <button
                    key={deg}
                    data-testid={`angle-preset-${deg}`}
                    onClick={() => handleAngleChange(deg)}
                    style={{
                      background: isActive
                        ? "#3498db"
                        : isCandidate
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(255, 255, 255, 0.03)",
                      color: isActive ? "#fff" : isCandidate ? "#eee" : "#888",
                      border: isActive
                        ? "1px solid #3498db"
                        : "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "4px",
                      padding: "3px 8px",
                      fontSize: "11px",
                      cursor: "pointer",
                      fontWeight: isActive ? 600 : 400,
                    }}
                    title={`${deg}° preset`}
                  >
                    {deg}°
                  </button>
                );
              })}
            </div>
          </div>

          {/* Diagnostic & Validation Feedback Banner */}
          {lastAdjustment ? (
            <div
              data-testid="angle-adjustment-feedback"
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                background: lastAdjustment.success
                  ? "rgba(46, 204, 113, 0.15)"
                  : "rgba(231, 76, 60, 0.2)",
                border: lastAdjustment.success
                  ? "1px solid #2ecc71"
                  : "1px solid #e74c3c",
                color: lastAdjustment.success ? "#2ecc71" : "#e74c3c",
                fontSize: "11px",
                lineHeight: "1.4",
              }}
            >
              <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", marginBottom: "2px" }}>
                <span>{lastAdjustment.success ? "✓" : "⚠"}</span>
                <span>
                  {lastAdjustment.success
                    ? `Valid Pose (${lastAdjustment.appliedAngleDeg}°)`
                    : `Invalid (${lastAdjustment.visualState})`}
                </span>
              </div>
              <div>{lastAdjustment.diagnosticMessage}</div>
            </div>
          ) : (
            <div style={{ fontSize: "11px", color: "#777", fontStyle: "italic" }}>
              Select a preset or drag slider to dynamically rotate assembly joint.
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Collapsible Pieces Drawer (Right)
         ───────────────────────────────────────────────────────────── */}
      {isPiecesDrawerOpen && resolvedScene && (
        <div
          data-testid="pieces-drawer"
          style={{
            position: "absolute",
            top: "60px",
            right: "12px",
            bottom: "16px",
            width: "260px",
            background: "rgba(22, 24, 29, 0.95)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "10px",
            padding: "12px",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            zIndex: 15,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontWeight: 600, fontSize: "13px" }}>Pieces ({resolvedScene.pieces.length})</span>
            {selection.hiddenPieceIds.size > 0 || selection.isolatedPieceId ? (
              <button
                onClick={handleResetVisibility}
                style={{
                  background: "transparent",
                  color: "#3498db",
                  border: "none",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Show All
              </button>
            ) : null}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {resolvedScene.pieces.map((piece) => {
              const isSelected = selection.selectedPieceId === piece.pieceId;
              const isHidden = selection.hiddenPieceIds.has(piece.pieceId!);
              const isIsolated = selection.isolatedPieceId === piece.pieceId;

              return (
                <div
                  key={piece.id}
                  onClick={() => handlePieceClick(piece.pieceId!)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    margin: "2px 0",
                    borderRadius: "6px",
                    background: isSelected ? "rgba(0, 229, 255, 0.15)" : "rgba(255, 255, 255, 0.04)",
                    border: isSelected ? "1px solid #00e5ff" : "1px solid transparent",
                    cursor: "pointer",
                    fontSize: "12px",
                    opacity: isHidden ? 0.4 : 1,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {piece.name}
                  </span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={(e) => handleIsolate(piece.pieceId!, e)}
                      title={isIsolated ? "Unisolate piece" : "Isolate piece"}
                      style={{
                        background: isIsolated ? "#e67e22" : "transparent",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "3px",
                        fontSize: "10px",
                        padding: "2px 4px",
                        cursor: "pointer",
                      }}
                    >
                      {isIsolated ? "★" : "☆"}
                    </button>
                    <button
                      onClick={(e) => handleToggleHide(piece.pieceId!, e)}
                      title={isHidden ? "Show piece" : "Hide piece"}
                      style={{
                        background: "transparent",
                        color: isHidden ? "#888" : "#fff",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "3px",
                        fontSize: "10px",
                        padding: "2px 4px",
                        cursor: "pointer",
                      }}
                    >
                      {isHidden ? "👁‍🗨" : "👁"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Collapsible Connections Drawer (Right)
         ───────────────────────────────────────────────────────────── */}
      {isConnectionsDrawerOpen && resolvedScene && (
        <div
          data-testid="connections-drawer"
          style={{
            position: "absolute",
            top: "60px",
            right: isPiecesDrawerOpen ? "280px" : "12px",
            bottom: "16px",
            width: "280px",
            background: "rgba(22, 24, 29, 0.95)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "10px",
            padding: "12px",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            zIndex: 15,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontWeight: 600, fontSize: "13px" }}>Connections ({resolvedScene.connections.length})</span>
            {selection.highlightedConnectionId && (
              <button
                onClick={() => controllerRef.current?.clearHighlight()}
                style={{
                  background: "transparent",
                  color: "#3498db",
                  border: "none",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {resolvedScene.connections.map((conn) => {
              const isHighlighted = selection.highlightedConnectionId === conn.connectionId;
              return (
                <div
                  key={conn.id}
                  onClick={() => handleConnectionClick(conn.connectionId)}
                  style={{
                    padding: "8px",
                    margin: "4px 0",
                    borderRadius: "6px",
                    background: isHighlighted ? "rgba(0, 229, 255, 0.15)" : "rgba(255, 255, 255, 0.04)",
                    border: isHighlighted ? "1px solid #00e5ff" : "1px solid rgba(255, 255, 255, 0.06)",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                    <span>{conn.connectionId}</span>
                    <span style={{ color: conn.state === "MATED" ? "#2ecc71" : "#e67e22" }}>
                      {conn.state}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#aaa", marginTop: "2px" }}>
                    Type: {conn.connectorType} | Angle: {conn.joiningAngleDeg}°
                  </div>
                  <div style={{ fontSize: "11px", color: "#888" }}>
                    {conn.pieceAId} ↔ {conn.pieceBId}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Loading Overlay
         ───────────────────────────────────────────────────────────── */}
      {isLoading && (
        <div
          data-testid="puzzle-3d-loading-overlay"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(22, 24, 29, 0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            zIndex: 30,
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "3px solid rgba(255,255,255,0.1)",
              borderTopColor: "#3498db",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <p style={{ marginTop: "16px", fontSize: "14px", fontWeight: 500, color: "#ccc" }}>
            {loadingMessage}
          </p>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Error Overlay
         ───────────────────────────────────────────────────────────── */}
      {error && !isLoading && (
        <div
          data-testid="puzzle-3d-error-overlay"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(22, 24, 29, 0.92)",
            backdropFilter: "blur(10px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            padding: "24px",
            textAlign: "center",
            zIndex: 30,
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>⚠️</div>
          <h3 style={{ margin: "0 0 8px 0", color: "#e74c3c" }}>3D Preview Error</h3>
          <p style={{ margin: "0 0 16px 0", maxWidth: "420px", color: "#bbb", fontSize: "13px" }}>
            {typeof error === "string" ? error : error.message || "Failed to render 3D puzzle assembly."}
          </p>
          {onRetry && (
            <button
              data-testid="puzzle-3d-retry-button"
              onClick={onRetry}
              style={{
                background: "#e74c3c",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry Generation
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const presetBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "#ccc",
  border: "none",
  borderRadius: "4px",
  padding: "4px 8px",
  fontSize: "12px",
  cursor: "pointer",
};

const drawerToggleBtnStyle: React.CSSProperties = {
  color: "#fff",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "8px",
  padding: "6px 12px",
  fontSize: "12px",
  cursor: "pointer",
  fontWeight: 500,
  backdropFilter: "blur(12px)",
};

const indicatorBtnStyle: React.CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "4px",
  padding: "2px 6px",
  fontSize: "10px",
  cursor: "pointer",
  fontWeight: 500,
  transition: "background 0.2s, color 0.2s",
};

function statusPillStyle(state: Puzzle3DVisualState): React.CSSProperties {
  switch (state) {
    case "COLLISION":
      return { background: "rgba(231, 76, 60, 0.2)", border: "1px solid #e74c3c", color: "#e74c3c" };
    case "INVALID_CONNECTION":
      return { background: "rgba(233, 30, 99, 0.2)", border: "1px solid #e91e63", color: "#e91e63" };
    case "WARNING":
      return { background: "rgba(243, 156, 18, 0.2)", border: "1px solid #f39c12", color: "#f39c12" };
    case "VALID":
    default:
      return { background: "rgba(46, 204, 113, 0.2)", border: "1px solid #2ecc71", color: "#2ecc71" };
  }
}

function statusDotColor(state: Puzzle3DVisualState): string {
  switch (state) {
    case "COLLISION": return "#e74c3c";
    case "INVALID_CONNECTION": return "#e91e63";
    case "WARNING": return "#f39c12";
    case "VALID":
    default: return "#2ecc71";
  }
}

const playbackBtnStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.08)",
  color: "#fff",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "4px",
  padding: "4px 8px",
  fontSize: "11px",
  cursor: "pointer",
};

function phaseBadgeColor(phase: string): string {
  switch (phase) {
    case "movement": return "rgba(52, 152, 219, 0.35)";
    case "rotation": return "rgba(155, 89, 182, 0.35)";
    case "alignment": return "rgba(243, 156, 18, 0.35)";
    case "completion": return "rgba(46, 204, 113, 0.35)";
    default: return "rgba(255, 255, 255, 0.15)";
  }
}

