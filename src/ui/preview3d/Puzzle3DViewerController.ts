/**
 * Interactive 3D Puzzle Viewer Controller (Phase 94).
 *
 * Headless controller managing:
 *  - Three.js WebGL rendering loop
 *  - Spherical Orbit, Pan, Zoom, and Reset Camera controls
 *  - Raycasting for piece selection
 *  - Piece visibility management (Hide, Show, Isolate, Restore)
 *  - Connection highlighting
 *  - Diagnostic visual state mapping (VALID, WARNING, COLLISION, INVALID_CONNECTION, SELECTED_PIECE)
 *
 * Strict CAD Separation Guarantee:
 * This controller manipulates only Three.js viewport objects and viewer state;
 * it NEVER alters the authoritative CAD puzzle model.
 */

import * as THREE from "three";
import type { Scene } from "@/core/puzzle/scene/types";
import type { AssemblyValidationReport } from "@/core/puzzle/assemblyvalidation/types";
import type { ConvertedPuzzle3D } from "@/core/puzzle/piece3d/types";
import { AngleManipulationEngine } from "@/core/puzzle/manipulation/angleManipulationEngine";
import type {
  AngleAdjustmentResult,
  ConnectionAngleInspection,
} from "@/core/puzzle/manipulation/types";
import { ExplodedAssemblyEngine } from "@/core/puzzle/exploded/explodedAssemblyEngine";
import type {
  ExplodedAssemblyResult,
  ExplodedIndicatorOptions,
  ExplodedViewMode,
} from "@/core/puzzle/exploded/types";
import {
  AssemblyAnimationEngine,
  AssemblyAnimationPlayer,
  type AnimationPlaybackStatus,
  type AssemblyAnimationTimeline,
} from "@/core/puzzle/animation";
import {
  ThreeSceneBridge,
  type ThreeSceneBridgeResult,
} from "./threeSceneBridge";
import type {
  Puzzle3DVisualState,
  ViewerCameraPreset,
  ViewerCameraState,
  ViewerSelectionState,
} from "./types";

export interface ViewerControllerOptions {
  onSelectionChange?: (state: ViewerSelectionState) => void;
  onCameraChange?: (state: ViewerCameraState) => void;
  onExplodedResultChange?: (result: ExplodedAssemblyResult | null) => void;
  onAnimationStatusChange?: (status: AnimationPlaybackStatus | null) => void;
}

export class Puzzle3DViewerController {
  // Three.js Core
  public renderer: THREE.WebGLRenderer | null = null;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public bridgeResult: ThreeSceneBridgeResult | null = null;

  // Viewport & Lighting
  private ambientLight: THREE.AmbientLight;
  private dirLight1: THREE.DirectionalLight;
  private dirLight2: THREE.DirectionalLight;

  // Camera State
  private cameraState: ViewerCameraState = {
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    radius: 350,
    target: { x: 0, y: 0, z: 0 },
    fov: 45,
  };

  // Selection & Visibility State
  private selectionState: ViewerSelectionState = {
    selectedPieceId: null,
    highlightedConnectionId: null,
    hiddenPieceIds: new Set<string>(),
    isolatedPieceId: null,
    visualStateOverrides: new Map<string, Puzzle3DVisualState>(),
  };

  // Raycaster
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Active Phase 93 Scene & Validation
  private activeScene: Scene | null = null;
  private validationReport: AssemblyValidationReport | null = null;
  private activePuzzle3D: ConvertedPuzzle3D | null = null;
  private activeTransforms: Record<string, any> = {};
  private activeAngles: Record<string, number> = {};
  private options: ViewerControllerOptions;

  // Exploded Assembly State (Phase 96)
  private explodedResult: ExplodedAssemblyResult | null = null;
  private explodedGroup: THREE.Group = new THREE.Group();

  // Assembly Animation State (Phase 97)
  private animationPlayer: AssemblyAnimationPlayer | null = null;
  private animationRafId: number | null = null;
  private lastRafTime: number = 0;

  constructor(options: ViewerControllerOptions = {}) {
    this.options = options;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1d24);

    this.explodedGroup.name = "ExplodedVisualIndicators";
    this.scene.add(this.explodedGroup);

    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 50000);
    this.updateCamera();

    // Studio Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    this.dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight1.position.set(300, 400, 300);
    this.scene.add(this.dirLight1);

    this.dirLight2 = new THREE.DirectionalLight(0x88bbff, 0.4);
    this.dirLight2.position.set(-300, -200, -300);
    this.scene.add(this.dirLight2);
  }

  /**
   * Initializes or attaches the WebGL renderer to a canvas element.
   */
  public attachCanvas(canvas: HTMLCanvasElement): void {
    if (!canvas || typeof canvas.getContext !== "function") {
      this.renderer = null;
      return;
    }
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      this.renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 600, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.render();
    } catch {
      // In headless or test environments without WebGL, proceed smoothly
      this.renderer = null;
    }
  }

  /**
   * Loads a Phase 93 Scene into the viewport with optional validation diagnostics.
   */
  public loadScene(
    scene: Scene,
    validationReport?: AssemblyValidationReport | null,
    puzzle3D?: ConvertedPuzzle3D | null
  ): void {
    this.activeScene = scene;
    this.validationReport = validationReport || null;
    this.activePuzzle3D = puzzle3D || null;
    this.activeTransforms = { ...scene.assemblyTransforms };
    this.activeAngles = {};
    for (const conn of scene.connections) {
      this.activeAngles[conn.connectionId] = conn.joiningAngleDeg;
    }

    // Reset selection state
    this.selectionState = {
      selectedPieceId: null,
      highlightedConnectionId: null,
      hiddenPieceIds: new Set<string>(),
      isolatedPieceId: null,
      visualStateOverrides: new Map<string, Puzzle3DVisualState>(),
    };

    // Evaluate diagnostic visual states from validation report
    this.evaluateDiagnosticVisualStates();

    // Remove previous scene group
    if (this.bridgeResult) {
      this.scene.remove(this.bridgeResult.rootGroup);
    }

    // Build Three.js hierarchy
    this.bridgeResult = ThreeSceneBridge.buildThreeScene(
      scene,
      this.selectionState.visualStateOverrides
    );
    this.scene.add(this.bridgeResult.rootGroup);

    // Exploded Assembly Layout Calculation (Phase 96)
    if (puzzle3D) {
      this.explodedResult = ExplodedAssemblyEngine.calculateExplodedLayout(
        puzzle3D,
        this.activeTransforms
      );
    } else {
      this.explodedResult = null;
    }
    this.syncExplodedVisuals();

    // Assembly Animation Timeline Calculation (Phase 97)
    this.stopAnimationLoop();
    if (puzzle3D) {
      const timeline = AssemblyAnimationEngine.generateTimeline(
        puzzle3D,
        this.activeTransforms
      );
      this.animationPlayer = new AssemblyAnimationPlayer(timeline);
      this.animationPlayer.subscribe((status) => {
        if (this.options.onAnimationStatusChange) {
          this.options.onAnimationStatusChange(status);
        }
      });
    } else {
      this.animationPlayer = null;
      if (this.options.onAnimationStatusChange) {
        this.options.onAnimationStatusChange(null);
      }
    }

    // Frame camera on entire puzzle assembly
    this.resetCamera();
    this.notifySelectionChange();
    this.render();
  }

  /**
   * Evaluates diagnostic visual states (VALID, WARNING, COLLISION, INVALID_CONNECTION)
   * from the active scene and optional validation report.
   */
  private evaluateDiagnosticVisualStates(): void {
    this.selectionState.visualStateOverrides.clear();

    if (!this.validationReport) {
      // If no validation report provided, mark all pieces default
      return;
    }

    // Check Failures
    for (const fail of this.validationReport.failures) {
      if (fail.category === "collision" && fail.pieceId) {
        this.selectionState.visualStateOverrides.set(fail.pieceId, "COLLISION");
      } else if (fail.category === "clearance" && fail.pieceId) {
        this.selectionState.visualStateOverrides.set(fail.pieceId, "WARNING");
      } else if (
        fail.category === "mandatory_connection" ||
        fail.category === "interface_pairing" ||
        fail.category === "connector_type"
      ) {
        if (fail.connectionId) {
          this.selectionState.visualStateOverrides.set(
            fail.connectionId,
            "INVALID_CONNECTION"
          );
        }
      }
    }

    // If master assembly is valid, tag all unflagged pieces VALID
    if (this.validationReport.isValid && this.activeScene) {
      for (const p of this.activeScene.pieces) {
        if (p.pieceId && !this.selectionState.visualStateOverrides.has(p.pieceId)) {
          this.selectionState.visualStateOverrides.set(p.pieceId, "VALID");
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Camera & Viewport Controls
  // ─────────────────────────────────────────────────────────────

  /**
   * Orbit camera around target.
   * deltaX, deltaY in radians or pixel offsets.
   */
  public orbit(deltaX: number, deltaY: number): void {
    this.cameraState.theta -= deltaX * 0.01;
    this.cameraState.phi -= deltaY * 0.01;

    // Constrain phi to avoid flipping at poles
    const eps = 0.01;
    this.cameraState.phi = Math.max(eps, Math.min(Math.PI - eps, this.cameraState.phi));

    this.updateCamera();
    this.render();
  }

  /**
   * Pan camera in screen space.
   */
  public pan(deltaX: number, deltaY: number): void {
    const factor = this.cameraState.radius * 0.0015;

    // Calculate camera right and up vectors in world space
    const forward = new THREE.Vector3().subVectors(
      new THREE.Vector3(
        this.cameraState.target.x,
        this.cameraState.target.y,
        this.cameraState.target.z
      ),
      this.camera.position
    ).normalize();

    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    this.cameraState.target.x -= (right.x * deltaX + up.x * deltaY) * factor;
    this.cameraState.target.y -= (right.y * deltaX + up.y * deltaY) * factor;
    this.cameraState.target.z -= (right.z * deltaX + up.z * deltaY) * factor;

    this.updateCamera();
    this.render();
  }

  /**
   * Zoom camera in/out. Positive zooms in, negative zooms out.
   */
  public zoom(delta: number): void {
    const zoomSpeed = 0.15;
    const factor = 1 - delta * zoomSpeed;
    this.cameraState.radius = Math.max(20, Math.min(5000, this.cameraState.radius * factor));

    this.updateCamera();
    this.render();
  }

  /**
   * Sets camera to one of the standard presets (iso, top, front, side).
   */
  public setCameraPreset(preset: ViewerCameraPreset): void {
    switch (preset) {
      case "iso":
        this.cameraState.theta = Math.PI / 4;
        this.cameraState.phi = Math.PI / 3;
        break;
      case "top":
        this.cameraState.theta = 0;
        this.cameraState.phi = 0.01; // Slightly off 0 to preserve up vector
        break;
      case "front":
        this.cameraState.theta = 0;
        this.cameraState.phi = Math.PI / 2;
        break;
      case "side":
        this.cameraState.theta = Math.PI / 2;
        this.cameraState.phi = Math.PI / 2;
        break;
    }
    this.updateCamera();
    this.render();
  }

  /**
   * Resets camera to smoothly frame the entire assembly bounding box.
   */
  public resetCamera(): void {
    if (!this.bridgeResult) return;

    const bbox = this.bridgeResult.boundingBox;
    const center = new THREE.Vector3();
    bbox.getCenter(center);

    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 50);

    this.cameraState.target = { x: center.x, y: center.y, z: center.z };
    this.cameraState.theta = Math.PI / 4;
    this.cameraState.phi = Math.PI / 3;
    this.cameraState.radius = maxDim * 2.2;

    this.updateCamera();
    this.render();
  }

  /**
   * Updates Three.js camera position from spherical coordinates.
   */
  private updateCamera(): void {
    const s = this.cameraState;
    const x = s.target.x + s.radius * Math.sin(s.phi) * Math.sin(s.theta);
    const y = s.target.y + s.radius * Math.cos(s.phi);
    const z = s.target.z + s.radius * Math.sin(s.phi) * Math.cos(s.theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(s.target.x, s.target.y, s.target.z);
    this.camera.updateProjectionMatrix();

    if (this.options.onCameraChange) {
      this.options.onCameraChange({ ...this.cameraState });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Piece Selection & Visibility Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Selects a piece by ID (or deselects if null).
   */
  public selectPiece(pieceId: string | null): void {
    this.selectionState.selectedPieceId = pieceId;
    this.rebuildThreeVisuals();
    this.notifySelectionChange();
    this.render();
  }

  /**
   * Hides a piece by ID.
   */
  public hidePiece(pieceId: string): void {
    this.selectionState.hiddenPieceIds.add(pieceId);
    this.applyVisibilityState();
    this.notifySelectionChange();
    this.render();
  }

  /**
   * Shows a previously hidden piece.
   */
  public showPiece(pieceId: string): void {
    this.selectionState.hiddenPieceIds.delete(pieceId);
    this.applyVisibilityState();
    this.notifySelectionChange();
    this.render();
  }

  /**
   * Toggles piece visibility between hidden and visible.
   */
  public togglePieceVisibility(pieceId: string): void {
    if (this.selectionState.hiddenPieceIds.has(pieceId)) {
      this.showPiece(pieceId);
    } else {
      this.hidePiece(pieceId);
    }
  }

  /**
   * Isolates a single piece (hiding all others). Passing null unisolates.
   */
  public isolatePiece(pieceId: string | null): void {
    this.selectionState.isolatedPieceId = pieceId;
    this.applyVisibilityState();
    this.notifySelectionChange();
    this.render();
  }

  /**
   * Unisolates pieces, restoring normal visibility.
   */
  public unisolate(): void {
    this.isolatePiece(null);
  }

  /**
   * Resets all hidden pieces to fully visible.
   */
  public resetVisibility(): void {
    this.selectionState.hiddenPieceIds.clear();
    this.selectionState.isolatedPieceId = null;
    this.applyVisibilityState();
    this.notifySelectionChange();
    this.render();
  }

  /**
   * Highlights a physical connection and its joined pieces.
   */
  public highlightConnection(connectionId: string | null): void {
    this.selectionState.highlightedConnectionId = connectionId;
    this.rebuildThreeVisuals();
    this.notifySelectionChange();
    this.render();
  }

  /**
   * Clears active connection highlight.
   */
  public clearHighlight(): void {
    this.highlightConnection(null);
  }

  /**
   * Raycasts into the scene from normalized device coordinates to pick a piece.
   */
  public pickPiece(clientX: number, clientY: number, width: number, height: number): string | null {
    if (!this.bridgeResult) return null;

    this.mouse.x = (clientX / width) * 2 - 1;
    this.mouse.y = -(clientY / height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const pieceObjects = Array.from(this.bridgeResult.pieceMeshes.values()).filter(
      (mesh) => mesh.visible
    );

    const intersects = this.raycaster.intersectObjects(pieceObjects, true);
    if (intersects.length > 0) {
      let topObj: THREE.Object3D | null = intersects[0].object;
      while (topObj && !topObj.userData?.pieceId) {
        topObj = topObj.parent;
      }
      return topObj?.userData?.pieceId || null;
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // Internal State Application
  // ─────────────────────────────────────────────────────────────

  private applyVisibilityState(): void {
    if (!this.bridgeResult) return;

    const { hiddenPieceIds, isolatedPieceId } = this.selectionState;

    for (const [pieceId, mesh] of this.bridgeResult.pieceMeshes.entries()) {
      if (isolatedPieceId !== null) {
        mesh.visible = pieceId === isolatedPieceId;
      } else {
        mesh.visible = !hiddenPieceIds.has(pieceId);
      }
    }
  }

  private rebuildThreeVisuals(): void {
    if (!this.activeScene || !this.bridgeResult) return;

    // Combine base diagnostic overrides with selection & highlight
    const effectiveStates = new Map(this.selectionState.visualStateOverrides);

    if (this.selectionState.selectedPieceId) {
      effectiveStates.set(this.selectionState.selectedPieceId, "SELECTED_PIECE");
    }

    if (this.selectionState.highlightedConnectionId) {
      const conn = this.activeScene.connections.find(
        (c) => c.connectionId === this.selectionState.highlightedConnectionId
      );
      if (conn) {
        if (!effectiveStates.has(conn.pieceAId)) effectiveStates.set(conn.pieceAId, "SELECTED_PIECE");
        if (!effectiveStates.has(conn.pieceBId)) effectiveStates.set(conn.pieceBId, "SELECTED_PIECE");
        effectiveStates.set(conn.connectionId, "SELECTED_PIECE");
      }
    }

    // Rebuild visual meshes while preserving camera position
    this.scene.remove(this.bridgeResult.rootGroup);
    this.bridgeResult = ThreeSceneBridge.buildThreeScene(this.activeScene, effectiveStates);
    this.scene.add(this.bridgeResult.rootGroup);
    this.applyVisibilityState();
  }

  private notifySelectionChange(): void {
    if (this.options.onSelectionChange) {
      this.options.onSelectionChange({ ...this.selectionState });
    }
  }

  /**
   * Performs a single render pass.
   */
  public render(): void {
    if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Resizes the viewport.
   */
  public resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    if (this.renderer) {
      this.renderer.setSize(width, height, false);
      this.render();
    }
  }

  /**
   * Inspects a connection and returns its metadata, current angle, and allowed kinematic range.
   */
  public inspectConnection(connectionId: string): ConnectionAngleInspection | null {
    if (!this.activePuzzle3D) {
      if (!this.activeScene) return null;
      const conn = this.activeScene.connections.find((c) => c.connectionId === connectionId);
      if (!conn) return null;
      return {
        connectionId: conn.connectionId,
        pieceAId: conn.pieceAId,
        pieceBId: conn.pieceBId,
        connectorType: conn.connectorType,
        currentAngleDeg: this.activeAngles[connectionId] ?? conn.joiningAngleDeg,
        allowedAngleRange: { min: 0, max: 180, validCandidates: [0, 30, 45, 60, 90, 180], stepDeg: 15 },
        presetAngles: [0, 30, 45, 60, 90, 180],
        isValid: conn.state === "MATED",
      };
    }
    return AngleManipulationEngine.inspectConnection(this.activePuzzle3D, connectionId, this.activeAngles);
  }

  /**
   * Adjusts a connection's joining angle in real-time:
   * 1. Recalculates affected piece transforms via forward kinematics
   * 2. Updates assembly configuration
   * 3. Runs collision/clearance validation & connection validation
   * 4. Updates 3D scene visuals and diagnostic states
   */
  public adjustConnectionAngle(connectionId: string, newAngleDeg: number): AngleAdjustmentResult | null {
    if (!this.activePuzzle3D) return null;

    const result = AngleManipulationEngine.adjustAngle({
      puzzle: this.activePuzzle3D,
      connectionId,
      newAngleDeg,
      currentTransforms: this.activeTransforms,
      currentAngles: this.activeAngles,
    });

    this.activeTransforms = { ...result.newTransforms };
    this.activeAngles = { ...result.newAngles };
    this.validationReport = result.validationReport;

    // Update activeScene transforms & applied angles
    if (this.activeScene) {
      this.activeScene.assemblyTransforms = { ...result.newTransforms };
      for (const conn of this.activeScene.connections) {
        if (conn.connectionId === connectionId) {
          conn.joiningAngleDeg = newAngleDeg;
          conn.state = result.success ? "MATED" : "FAILED";
        }
      }
      for (const piece of this.activeScene.pieces) {
        if (piece.pieceId && result.newTransforms[piece.pieceId]) {
          piece.worldTransform = { ...result.newTransforms[piece.pieceId] };
          piece.transform = { ...result.newTransforms[piece.pieceId] };
        }
      }
    }

    // Apply visual states: if invalid, highlight the problem visually
    this.evaluateDiagnosticVisualStates();
    if (!result.success) {
      for (const affectedId of result.affectedPieceIds) {
        this.selectionState.visualStateOverrides.set(affectedId, result.visualState);
      }
      this.selectionState.visualStateOverrides.set(connectionId, result.visualState);
    } else {
      this.selectionState.visualStateOverrides.set(connectionId, "VALID");
    }

    this.rebuildThreeVisuals();
    if (this.activePuzzle3D) {
      this.explodedResult = ExplodedAssemblyEngine.calculateExplodedLayout(
        this.activePuzzle3D,
        this.activeTransforms,
        this.explodedResult?.config
      );
      this.syncExplodedVisuals();
    }
    this.notifySelectionChange();
    this.render();

    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Exploded Assembly Methods (Phase 96)
  // ─────────────────────────────────────────────────────────────

  /**
   * Returns current active exploded assembly result (if available).
   */
  public getExplodedResult(): ExplodedAssemblyResult | null {
    return this.explodedResult;
  }

  /**
   * Switches view mode between normal, exploded, and assembly_step.
   */
  public setExplodedViewMode(mode: ExplodedViewMode): ExplodedAssemblyResult | null {
    if (!this.explodedResult) return null;
    this.explodedResult.config.mode = mode;
    if (mode === "exploded" && this.explodedResult.config.explosionFactor === 0) {
      this.explodedResult.config.explosionFactor = 0.5; // Default half explosion
    }
    this.syncExplodedVisuals();
    return this.explodedResult;
  }

  /**
   * Sets continuous explosion factor [0.0, 1.0].
   */
  public setExplosionFactor(factor: number): ExplodedAssemblyResult | null {
    if (!this.explodedResult) return null;
    this.explodedResult.config.explosionFactor = Math.max(0, Math.min(1, factor));
    this.syncExplodedVisuals();
    return this.explodedResult;
  }

  /**
   * Sets discrete step in assembly sequence [1, totalSteps].
   */
  public setAssemblyStep(stepNumber: number): ExplodedAssemblyResult | null {
    if (!this.explodedResult) return null;
    this.explodedResult.config.currentStep = Math.max(
      1,
      Math.min(stepNumber, this.explodedResult.totalSteps)
    );
    this.syncExplodedVisuals();
    return this.explodedResult;
  }

  /**
   * Advances to next assembly step.
   */
  public nextAssemblyStep(): ExplodedAssemblyResult | null {
    if (!this.explodedResult) return null;
    return this.setAssemblyStep(this.explodedResult.config.currentStep + 1);
  }

  /**
   * Steps back to previous assembly step.
   */
  public prevAssemblyStep(): ExplodedAssemblyResult | null {
    if (!this.explodedResult) return null;
    return this.setAssemblyStep(this.explodedResult.config.currentStep - 1);
  }

  /**
   * Toggles a visual indicator option (piece numbers, connection indicators, assembly directions, joining interfaces).
   */
  public toggleExplodedIndicator(indicator: keyof ExplodedIndicatorOptions): ExplodedAssemblyResult | null {
    if (!this.explodedResult) return null;
    this.explodedResult.config.indicators[indicator] = !this.explodedResult.config.indicators[indicator];
    this.syncExplodedVisuals();
    return this.explodedResult;
  }

  /**
   * Synchronizes Three.js piece meshes and visual indicators with current exploded layout.
   */
  public syncExplodedVisuals(): void {
    if (!this.explodedResult) return;

    // 1. Evaluate engine calculations
    ExplodedAssemblyEngine.evaluateResult(this.explodedResult);

    // 2. Displace piece meshes according to current evaluated exploded transforms
    if (this.bridgeResult) {
      for (const pieceState of this.explodedResult.pieces) {
        const mesh = this.bridgeResult.pieceMeshes.get(pieceState.pieceId);
        if (mesh) {
          mesh.position.set(
            pieceState.currentTransform.position.x,
            pieceState.currentTransform.position.y,
            pieceState.currentTransform.position.z
          );
          mesh.visible =
            pieceState.isVisible &&
            !this.selectionState.hiddenPieceIds.has(pieceState.pieceId);
        }
      }
    }

    // 3. Clear and rebuild explodedGroup indicators
    while (this.explodedGroup.children.length > 0) {
      const child = this.explodedGroup.children.pop()!;
      if ((child as any).geometry) (child as any).geometry.dispose?.();
      if ((child as any).material) {
        if (Array.isArray((child as any).material)) {
          (child as any).material.forEach((m: any) => m.dispose?.());
        } else {
          (child as any).material.dispose?.();
        }
      }
    }

    const { indicators, mode } = this.explodedResult.config;

    // 4. Connection Indicator Lines
    if (indicators.showConnectionIndicators && mode !== "normal") {
      const lineMaterial = new THREE.LineDashedMaterial({
        color: 0x00e5ff,
        dashSize: 4,
        gapSize: 2,
        linewidth: 2,
      });

      for (const conn of this.explodedResult.connections) {
        if (conn.isVisible) {
          const points = [
            new THREE.Vector3(conn.pointA.x, conn.pointA.y, conn.pointA.z),
            new THREE.Vector3(conn.pointB.x, conn.pointB.y, conn.pointB.z),
          ];
          const geom = new THREE.BufferGeometry().setFromPoints(points);
          const line = new THREE.Line(geom, lineMaterial);
          line.computeLineDistances();
          this.explodedGroup.add(line);
        }
      }
    }

    // 5. Assembly Direction Arrows
    if (indicators.showAssemblyDirections && mode !== "normal") {
      if (mode === "assembly_step") {
        const step = this.explodedResult.steps[this.explodedResult.config.currentStep - 1];
        if (step && step.stepNumber > 1) {
          const piece = this.explodedResult.pieceMap[step.incomingPieceId];
          if (piece) {
            const origin = new THREE.Vector3(
              piece.currentTransform.position.x,
              piece.currentTransform.position.y,
              piece.currentTransform.position.z
            );
            const dir = new THREE.Vector3(
              -step.insertionVector.x,
              -step.insertionVector.y,
              -step.insertionVector.z
            ).normalize();
            const arrow = new THREE.ArrowHelper(dir, origin, 35, 0x2ecc71, 8, 5);
            this.explodedGroup.add(arrow);
          }
        }
      } else {
        // In exploded mode, display trajectory arrows for exploded pieces
        for (const piece of this.explodedResult.pieces) {
          if (piece.graphDepth > 0 && piece.maxExplosionDistanceMm > 0.1) {
            const origin = new THREE.Vector3(
              piece.assembledTransform.position.x,
              piece.assembledTransform.position.y,
              piece.assembledTransform.position.z
            );
            const dir = new THREE.Vector3(
              piece.explosionVector.x,
              piece.explosionVector.y,
              piece.explosionVector.z
            ).normalize();
            const length = Math.min(
              30,
              piece.maxExplosionDistanceMm * this.explodedResult.config.explosionFactor
            );
            if (length > 5) {
              const arrow = new THREE.ArrowHelper(dir, origin, length, 0xf39c12, 6, 4);
              this.explodedGroup.add(arrow);
            }
          }
        }
      }
    }

    // 6. Joining Interface Markers
    if (indicators.showJoiningInterfaces && mode !== "normal") {
      const ifaceGeom = new THREE.SphereGeometry(2, 8, 8);
      const ifaceMat = new THREE.MeshBasicMaterial({ color: 0xe67e22 });

      for (const piece of this.explodedResult.pieces) {
        if (piece.isVisible) {
          for (const ifc of piece.interfaces) {
            const marker = new THREE.Mesh(ifaceGeom, ifaceMat);
            marker.position.set(ifc.worldPosition.x, ifc.worldPosition.y, ifc.worldPosition.z);
            this.explodedGroup.add(marker);
          }
        }
      }
    }

    // 7. Piece Numbers (Badges)
    if (indicators.showPieceNumbers && mode !== "normal") {
      for (const piece of this.explodedResult.pieces) {
        if (piece.isVisible) {
          const badge = this.createPieceNumberBadge(piece.pieceNumber);
          badge.position.set(
            piece.currentTransform.position.x,
            piece.currentTransform.position.y + 15,
            piece.currentTransform.position.z
          );
          this.explodedGroup.add(badge);
        }
      }
    }

    if (this.options.onExplodedResultChange) {
      this.options.onExplodedResultChange(this.explodedResult);
    }

    this.render();
  }

  private createPieceNumberBadge(number: number): THREE.Object3D {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "rgba(41, 128, 185, 0.9)";
        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, 2 * Math.PI);
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 26px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(number), 32, 33);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(16, 16, 1);
        return sprite;
      }
    } catch {
      // Fallback in headless environment without canvas 2D
    }

    // Fallback: simple colored sphere marker
    const geom = new THREE.SphereGeometry(4, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x3498db });
    return new THREE.Mesh(geom, mat);
  }

  // ─────────────────────────────────────────────────────────────
  // Assembly Animation Methods (Phase 97)
  // ─────────────────────────────────────────────────────────────

  public getAnimationPlayer(): AssemblyAnimationPlayer | null {
    return this.animationPlayer;
  }

  public getAnimationStatus(): AnimationPlaybackStatus | null {
    return this.animationPlayer?.getStatus() || null;
  }

  public playAnimation(): void {
    if (!this.animationPlayer) return;
    this.animationPlayer.play();
    this.startAnimationLoop();
  }

  public pauseAnimation(): void {
    if (!this.animationPlayer) return;
    this.animationPlayer.pause();
    this.stopAnimationLoop();
  }

  public togglePlayPauseAnimation(): void {
    if (!this.animationPlayer) return;
    if (this.animationPlayer.getStatus().playbackState === "playing") {
      this.pauseAnimation();
    } else {
      this.playAnimation();
    }
  }

  public restartAnimation(): void {
    if (!this.animationPlayer) return;
    this.animationPlayer.restart();
    this.startAnimationLoop();
  }

  public stepForwardAnimation(): void {
    if (!this.animationPlayer) return;
    this.animationPlayer.stepForward();
    this.applyAnimationTransformsToScene(this.animationPlayer.getStatus());
  }

  public stepBackwardAnimation(): void {
    if (!this.animationPlayer) return;
    this.animationPlayer.stepBackward();
    this.applyAnimationTransformsToScene(this.animationPlayer.getStatus());
  }

  public setAnimationSpeed(speed: number): void {
    this.animationPlayer?.setSpeed(speed);
  }

  public seekAnimation(fraction: number): void {
    if (!this.animationPlayer) return;
    this.animationPlayer.seek(fraction);
    this.applyAnimationTransformsToScene(this.animationPlayer.getStatus());
  }

  public tickAnimation(deltaMs: number): AnimationPlaybackStatus | null {
    if (!this.animationPlayer) return null;
    const status = this.animationPlayer.tick(deltaMs);
    this.applyAnimationTransformsToScene(status);
    return status;
  }

  private startAnimationLoop(): void {
    if (this.animationRafId !== null) return;
    if (typeof requestAnimationFrame === "undefined") return;
    // Prevent unconstrained RAF loops in headless test environments (Vitest / happy-dom)
    if (typeof process !== "undefined" && process.env && process.env.VITEST) {
      return;
    }
    this.lastRafTime = typeof performance !== "undefined" ? performance.now() : Date.now();

    const loop = (now: number) => {
      const deltaMs = now - this.lastRafTime;
      this.lastRafTime = now;

      if (this.animationPlayer) {
        const status = this.animationPlayer.tick(deltaMs);
        this.applyAnimationTransformsToScene(status);

        if (status.playbackState === "completed" || status.playbackState === "paused") {
          this.stopAnimationLoop();
          return;
        }
      }

      try {
        this.animationRafId = requestAnimationFrame(loop);
      } catch {
        this.animationRafId = null;
      }
    };

    try {
      this.animationRafId = requestAnimationFrame(loop);
    } catch {
      this.animationRafId = null;
    }
  }

  private stopAnimationLoop(): void {
    if (this.animationRafId !== null) {
      try {
        cancelAnimationFrame(this.animationRafId);
      } catch {}
      this.animationRafId = null;
    }
  }

  public applyAnimationTransformsToScene(status: AnimationPlaybackStatus): void {
    if (!this.bridgeResult) return;

    for (const [pieceId, transform] of Object.entries(status.pieceTransforms)) {
      const mesh = this.bridgeResult.pieceMeshes.get(pieceId);
      if (mesh) {
        mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
        mesh.quaternion.set(
          transform.rotation.x,
          transform.rotation.y,
          transform.rotation.z,
          transform.rotation.w
        );
        mesh.visible =
          !!status.pieceVisibilities[pieceId] &&
          !this.selectionState.hiddenPieceIds.has(pieceId);
      }
    }

    this.render();
  }

  public getSelectionState(): ViewerSelectionState {
    return { ...this.selectionState };
  }

  public getCameraState(): ViewerCameraState {
    return {
      ...this.cameraState,
      target: { ...this.cameraState.target },
    };
  }

  /**
   * Returns the current overall visual state of the preview.
   */
  public getVisualState(): Puzzle3DVisualState {
    if (this.selectionState.selectedPieceId) {
      return "SELECTED_PIECE";
    }
    if (this.validationReport) {
      if (!this.validationReport.isValid) {
        const hasCollision = this.validationReport.issues.some(
          (i) =>
            i.code?.includes("COLLISION") ||
            i.message?.toLowerCase().includes("collision")
        );
        if (hasCollision) return "COLLISION";
        const hasInvalidConn = this.validationReport.issues.some(
          (i) =>
            i.code?.includes("CONN") ||
            i.message?.toLowerCase().includes("connection")
        );
        if (hasInvalidConn) return "INVALID_CONNECTION";
        return "WARNING";
      }
    }
    return "VALID";
  }

  /**
   * Disposes of WebGL resources.
   */
  public dispose(): void {
    this.stopAnimationLoop();
    if (this.bridgeResult) {
      this.scene.remove(this.bridgeResult.rootGroup);
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}
