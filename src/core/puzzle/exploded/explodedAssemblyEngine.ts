/**
 * Exploded Assembly Visualization Engine (Phase 96).
 *
 * Implements automated exploded view and assembly sequence derivation:
 *  - Derives layout deterministically from authoritative assembly graph
 *  - Traverses BFS from root piece to establish 1-indexed assembly order
 *  - Calculates branch-wise cumulative outward explosion displacements
 *  - Computes 3D connection indicator lines, assembly directions, and interface ports
 *  - Supports Normal View, Exploded View (0% - 100%), and Assembly-Step View (Step 1..N)
 *  - Strictly guarantees zero CAD geometry mutation
 */

import type { Vec3 } from "@/core/model/types";
import {
  add3,
  len3,
  normalize3,
  scale3,
  sub3,
  vec3,
} from "../geometry/math3d";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import {
  transformPoint,
  transformVector,
} from "../framesystem/transformEngine";
import type { ConvertedPuzzle3D, GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import type {
  AssemblyStepState,
  ExplodedAssemblyConfig,
  ExplodedAssemblyResult,
  ExplodedConnectionIndicator,
  ExplodedInterfaceIndicator,
  ExplodedPieceState,
  ExplodedViewMode,
} from "./types";

export class ExplodedAssemblyEngine {
  public static readonly DEFAULT_BASE_DISTANCE_MM = 60;

  /**
   * Automatically calculates the complete exploded assembly layout from the puzzle.
   */
  public static calculateExplodedLayout(
    puzzle: ConvertedPuzzle3D,
    assembledTransforms: Record<string, RigidTransform3D>,
    configOverrides: Partial<ExplodedAssemblyConfig> = {}
  ): ExplodedAssemblyResult {
    const config: ExplodedAssemblyConfig = {
      mode: configOverrides.mode ?? "normal",
      explosionFactor: configOverrides.explosionFactor ?? 0.0,
      currentStep: configOverrides.currentStep ?? 1,
      baseExplosionDistanceMm:
        configOverrides.baseExplosionDistanceMm ?? this.DEFAULT_BASE_DISTANCE_MM,
      indicators: {
        showPieceNumbers: configOverrides.indicators?.showPieceNumbers ?? true,
        showConnectionIndicators:
          configOverrides.indicators?.showConnectionIndicators ?? true,
        showAssemblyDirections:
          configOverrides.indicators?.showAssemblyDirections ?? true,
        showJoiningInterfaces:
          configOverrides.indicators?.showJoiningInterfaces ?? true,
      },
    };

    const rootPieceId = puzzle.pieces[0]?.pieceId || "piece_0";

    // 1. Traverse Assembly Graph to establish deterministic assembly order and parent-child tree
    const { orderedPieceIds, parentMap, depthMap } = this.traverseAssemblyGraph(
      puzzle,
      rootPieceId
    );

    // 2. Compute piece centroids in assembled coordinates
    const pieceCentroids = this.computePieceCentroids(puzzle, assembledTransforms);

    // 3. Compute deterministic branch explosion vectors
    const branchDisplacements = this.computeBranchDisplacements(
      puzzle,
      orderedPieceIds,
      parentMap,
      depthMap,
      pieceCentroids,
      assembledTransforms,
      config.baseExplosionDistanceMm
    );

    // 4. Build ExplodedPieceState for every piece
    const pieces: ExplodedPieceState[] = [];
    const pieceMap: Record<string, ExplodedPieceState> = {};

    orderedPieceIds.forEach((pieceId, idx) => {
      const piece = puzzle.pieces.find((p) => p.pieceId === pieceId)!;
      const pieceNumber = idx + 1; // 1-indexed
      const stepIndex = pieceNumber;
      const depth = depthMap.get(pieceId) ?? 0;
      const parentId = parentMap.get(pieceId);
      const assembledT = assembledTransforms[pieceId] || this.createIdentityTransform();
      const displacement = branchDisplacements.get(pieceId) || vec3(0, 0, 0);
      const maxDistance = len3(displacement);
      const explosionVector = maxDistance > 0.001 ? normalize3(displacement) : vec3(0, 0, 0);

      const explodedT: RigidTransform3D = {
        position: add3(assembledT.position, displacement),
        rotation: { ...assembledT.rotation },
        scale: assembledT.scale ? { ...assembledT.scale } : vec3(1, 1, 1),
      };

      // Extract interface indicators
      const interfaceIndicators: ExplodedInterfaceIndicator[] = piece.interfaces.map(
        (iface) => {
          // Find connected partner if any
          const conn = puzzle.connections.find(
            (c) =>
              (c.pieceAId === pieceId && c.interfaceAId === iface.id) ||
              (c.pieceBId === pieceId && c.interfaceBId === iface.id)
          );
          const pairingPieceId = conn
            ? conn.pieceAId === pieceId
              ? conn.pieceBId
              : conn.pieceAId
            : undefined;
          const pairingInterfaceId = conn
            ? conn.pieceAId === pieceId
              ? conn.interfaceBId
              : conn.interfaceAId
            : undefined;

          const worldPos = transformPoint(assembledT, iface.localFrame.origin);
          const worldNormal = transformVector(assembledT, iface.localFrame.normal);

          return {
            interfaceId: iface.id,
            pieceId,
            localFrame: { ...iface.localFrame },
            worldPosition: worldPos,
            worldNormal,
            pairingPieceId,
            pairingInterfaceId,
          };
        }
      );

      const pieceState: ExplodedPieceState = {
        pieceId,
        pieceNumber,
        stepIndex,
        graphDepth: depth,
        parentPieceId: parentId,
        explosionVector,
        maxExplosionDistanceMm: maxDistance,
        assembledTransform: assembledT,
        explodedTransform: explodedT,
        currentTransform: assembledT,
        interfaces: interfaceIndicators,
        isVisible: true,
        isHighlighted: false,
      };

      pieces.push(pieceState);
      pieceMap[pieceId] = pieceState;
    });

    // 5. Build Discrete Assembly Sequence Steps
    const steps = this.buildAssemblySteps(puzzle, orderedPieceIds, pieceMap, branchDisplacements);

    // Clamp current step to valid range [1, totalSteps]
    config.currentStep = Math.max(1, Math.min(config.currentStep, steps.length));

    // 6. Build Connection Indicators
    const connections = this.buildConnectionIndicators(puzzle, pieceMap);

    const initialResult: ExplodedAssemblyResult = {
      puzzleId: puzzle.puzzleId,
      config,
      totalPieces: pieces.length,
      totalSteps: steps.length,
      rootPieceId,
      pieces,
      pieceMap,
      currentPieceTransforms: { ...assembledTransforms },
      connections,
      steps,
      isOriginalGeometryUnchanged: true,
    };

    // 7. Evaluate transforms and indicator positions for active config
    return this.evaluateResult(initialResult);
  }

  /**
   * Re-evaluates piece transforms, visibilities, and connection lines for a given mode and parameter.
   */
  public static evaluateResult(result: ExplodedAssemblyResult): ExplodedAssemblyResult {
    const { mode, explosionFactor, currentStep } = result.config;

    const evaluatedTransforms: Record<string, RigidTransform3D> = {};

    if (mode === "normal") {
      // Normal View: All pieces visible at assembled poses
      result.pieces.forEach((p) => {
        p.isVisible = true;
        p.isHighlighted = false;
        p.currentTransform = {
          position: { ...p.assembledTransform.position },
          rotation: { ...p.assembledTransform.rotation },
          scale: p.assembledTransform.scale ? { ...p.assembledTransform.scale } : vec3(1, 1, 1),
        };
        evaluatedTransforms[p.pieceId] = p.currentTransform;
        this.updateInterfacePositions(p);
      });

      result.connections.forEach((conn) => {
        conn.isVisible = false; // Hidden in normal assembled view
        this.updateConnectionPoints(conn, result.pieceMap);
      });
    } else if (mode === "exploded") {
      // Exploded View: Continuous explosion factor [0.0, 1.0]
      const factor = Math.max(0.0, Math.min(1.0, explosionFactor));

      result.pieces.forEach((p) => {
        p.isVisible = true;
        p.isHighlighted = false;

        // Linear interpolation of translation between assembled and exploded poses
        const disp = scale3(
          sub3(p.explodedTransform.position, p.assembledTransform.position),
          factor
        );

        p.currentTransform = {
          position: add3(p.assembledTransform.position, disp),
          rotation: { ...p.assembledTransform.rotation },
          scale: p.assembledTransform.scale ? { ...p.assembledTransform.scale } : vec3(1, 1, 1),
        };
        evaluatedTransforms[p.pieceId] = p.currentTransform;
        this.updateInterfacePositions(p);
      });

      result.connections.forEach((conn) => {
        // Visible when explosion factor > 0.05
        conn.isVisible = factor > 0.05 && result.config.indicators.showConnectionIndicators;
        this.updateConnectionPoints(conn, result.pieceMap);
      });
    } else if (mode === "assembly_step") {
      // Assembly-Step View: Step 1..N progression
      const activeStep = result.steps[currentStep - 1] || result.steps[0];
      const incomingId = activeStep.incomingPieceId;

      result.pieces.forEach((p) => {
        const isIncoming = p.pieceId === incomingId;
        const isAssembled = p.pieceNumber < activeStep.stepNumber;
        const isVisible = p.pieceNumber <= activeStep.stepNumber;

        p.isVisible = isVisible;
        p.isHighlighted = isIncoming;

        if (isIncoming) {
          // Incoming piece is offset along its insertion trajectory
          const insertionOffset = scale3(activeStep.insertionVector, 50.0);
          p.currentTransform = {
            position: add3(p.assembledTransform.position, insertionOffset),
            rotation: { ...p.assembledTransform.rotation },
            scale: p.assembledTransform.scale ? { ...p.assembledTransform.scale } : vec3(1, 1, 1),
          };
        } else if (isAssembled) {
          // Already assembled pieces are in their exact assembled pose
          p.currentTransform = {
            position: { ...p.assembledTransform.position },
            rotation: { ...p.assembledTransform.rotation },
            scale: p.assembledTransform.scale ? { ...p.assembledTransform.scale } : vec3(1, 1, 1),
          };
        } else {
          // Future pieces
          p.currentTransform = {
            position: { ...p.assembledTransform.position },
            rotation: { ...p.assembledTransform.rotation },
            scale: p.assembledTransform.scale ? { ...p.assembledTransform.scale } : vec3(1, 1, 1),
          };
        }

        evaluatedTransforms[p.pieceId] = p.currentTransform;
        this.updateInterfacePositions(p);
      });

      result.connections.forEach((conn) => {
        const isStepConnection = activeStep.activeConnectionIds.includes(conn.connectionId);
        conn.isVisible = isStepConnection && result.config.indicators.showConnectionIndicators;
        this.updateConnectionPoints(conn, result.pieceMap);
      });
    }

    result.currentPieceTransforms = evaluatedTransforms;
    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Internal Graph & Layout Solvers
  // ─────────────────────────────────────────────────────────────

  /**
   * Traverses the connection graph using BFS starting from rootPieceId.
   */
  private static traverseAssemblyGraph(
    puzzle: ConvertedPuzzle3D,
    rootPieceId: string
  ): {
    orderedPieceIds: string[];
    parentMap: Map<string, string>;
    depthMap: Map<string, number>;
  } {
    const orderedPieceIds: string[] = [];
    const parentMap = new Map<string, string>();
    const depthMap = new Map<string, number>();
    const visited = new Set<string>();

    const queue: string[] = [rootPieceId];
    visited.add(rootPieceId);
    depthMap.set(rootPieceId, 0);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      orderedPieceIds.push(currentId);
      const currentDepth = depthMap.get(currentId)!;

      // Find all connected neighbors
      for (const conn of puzzle.connections) {
        let neighborId: string | null = null;
        if (conn.pieceAId === currentId && !visited.has(conn.pieceBId)) {
          neighborId = conn.pieceBId;
        } else if (conn.pieceBId === currentId && !visited.has(conn.pieceAId)) {
          neighborId = conn.pieceAId;
        }

        if (neighborId && !visited.has(neighborId)) {
          visited.add(neighborId);
          parentMap.set(neighborId, currentId);
          depthMap.set(neighborId, currentDepth + 1);
          queue.push(neighborId);
        }
      }
    }

    // Include any disconnected pieces deterministically
    for (const piece of puzzle.pieces) {
      if (!visited.has(piece.pieceId)) {
        visited.add(piece.pieceId);
        orderedPieceIds.push(piece.pieceId);
        depthMap.set(piece.pieceId, 1);
      }
    }

    return { orderedPieceIds, parentMap, depthMap };
  }

  /**
   * Computes approximate piece centroids in assembled coordinates.
   */
  private static computePieceCentroids(
    puzzle: ConvertedPuzzle3D,
    assembledTransforms: Record<string, RigidTransform3D>
  ): Map<string, Vec3> {
    const centroids = new Map<string, Vec3>();

    for (const piece of puzzle.pieces) {
      const transform = assembledTransforms[piece.pieceId] || this.createIdentityTransform();
      const pos = piece.solid.localMesh.positions;

      let sumX = 0;
      let sumY = 0;
      let sumZ = 0;
      const count = pos.length / 3;

      if (count > 0) {
        for (let i = 0; i < pos.length; i += 3) {
          sumX += pos[i];
          sumY += pos[i + 1];
          sumZ += pos[i + 2];
        }
        const localCenter = vec3(sumX / count, sumY / count, sumZ / count);
        centroids.set(piece.pieceId, transformPoint(transform, localCenter));
      } else {
        centroids.set(piece.pieceId, transform.position);
      }
    }

    return centroids;
  }

  /**
   * Computes deterministic outward branch displacements for all pieces.
   */
  private static computeBranchDisplacements(
    puzzle: ConvertedPuzzle3D,
    orderedPieceIds: string[],
    parentMap: Map<string, string>,
    depthMap: Map<string, number>,
    centroids: Map<string, Vec3>,
    assembledTransforms: Record<string, RigidTransform3D>,
    baseDistanceMm: number
  ): Map<string, Vec3> {
    const displacements = new Map<string, Vec3>();
    const rootId = orderedPieceIds[0];
    displacements.set(rootId, vec3(0, 0, 0)); // Root remains stationary

    for (let i = 1; i < orderedPieceIds.length; i++) {
      const pieceId = orderedPieceIds[i];
      const parentId = parentMap.get(pieceId) || rootId;
      const parentDisp = displacements.get(parentId) || vec3(0, 0, 0);

      // Find connection between child and parent
      const conn = puzzle.connections.find(
        (c) =>
          (c.pieceAId === pieceId && c.pieceBId === parentId) ||
          (c.pieceBId === pieceId && c.pieceAId === parentId)
      );

      let relativeDir: Vec3;

      const childCentroid = centroids.get(pieceId) || vec3(0, 0, 0);
      const parentCentroid = centroids.get(parentId) || vec3(0, 0, 0);
      const centroidDiff = sub3(childCentroid, parentCentroid);

      if (len3(centroidDiff) > 1.0) {
        relativeDir = normalize3(centroidDiff);
      } else if (conn) {
        // Fall back to interface normal
        const childPiece = puzzle.pieces.find((p) => p.pieceId === pieceId);
        const ifaceId = conn.pieceAId === pieceId ? conn.interfaceAId : conn.interfaceBId;
        const iface = childPiece?.interfaces.find((ifc) => ifc.id === ifaceId);
        const childT = assembledTransforms[pieceId] || this.createIdentityTransform();

        if (iface) {
          relativeDir = normalize3(transformVector(childT, iface.localFrame.normal));
        } else {
          relativeDir = this.deterministicFallbackVector(i);
        }
      } else {
        relativeDir = this.deterministicFallbackVector(i);
      }

      // Branch displacement = Parent's displacement + Step distance along relative direction
      const stepOffset = scale3(relativeDir, baseDistanceMm);
      const totalDisp = add3(parentDisp, stepOffset);
      displacements.set(pieceId, totalDisp);
    }

    return displacements;
  }

  /**
   * Builds discrete assembly sequence steps.
   */
  private static buildAssemblySteps(
    puzzle: ConvertedPuzzle3D,
    orderedPieceIds: string[],
    pieceMap: Record<string, ExplodedPieceState>,
    branchDisplacements: Map<string, Vec3>
  ): AssemblyStepState[] {
    const steps: AssemblyStepState[] = [];
    const totalSteps = orderedPieceIds.length;
    const assembledSoFar: string[] = [];

    orderedPieceIds.forEach((pieceId, index) => {
      const stepNumber = index + 1;
      const pieceState = pieceMap[pieceId];
      const parentId = pieceState.parentPieceId;

      // Connections formed in this step
      const activeConnections = puzzle.connections
        .filter(
          (c) =>
            (c.pieceAId === pieceId && assembledSoFar.includes(c.pieceBId)) ||
            (c.pieceBId === pieceId && assembledSoFar.includes(c.pieceAId))
        )
        .map((c) => c.connectionId);

      // Insertion trajectory vector (opposite of explosion displacement or outward relative vector)
      let insertionVector: Vec3;
      const disp = branchDisplacements.get(pieceId) || vec3(0, 0, 0);
      if (len3(disp) > 0.001) {
        insertionVector = normalize3(disp);
      } else {
        insertionVector = vec3(0, 0, 1);
      }

      const visiblePieces = [...assembledSoFar, pieceId];

      const stepDesc =
        stepNumber === 1
          ? `Step 1: Anchor root piece ${pieceId} as assembly foundation.`
          : `Step ${stepNumber}: Join piece ${pieceId} to ${parentId || "base"} via ${
              activeConnections.length > 0 ? "connection " + activeConnections[0] : "mating joints"
            }.`;

      steps.push({
        stepNumber,
        totalSteps,
        incomingPieceId: pieceId,
        incomingPieceNumber: stepNumber,
        assembledPieceIds: [...assembledSoFar],
        visiblePieceIds: visiblePieces,
        insertionVector,
        activeConnectionIds: activeConnections,
        stepDescription: stepDesc,
      });

      assembledSoFar.push(pieceId);
    });

    return steps;
  }

  /**
   * Builds physical connection indicator items.
   */
  private static buildConnectionIndicators(
    puzzle: ConvertedPuzzle3D,
    pieceMap: Record<string, ExplodedPieceState>
  ): ExplodedConnectionIndicator[] {
    const indicators: ExplodedConnectionIndicator[] = [];

    puzzle.connections.forEach((conn) => {
      const pieceA = pieceMap[conn.pieceAId];
      const pieceB = pieceMap[conn.pieceBId];

      const ifaceA = pieceA?.interfaces.find((i) => i.interfaceId === conn.interfaceAId);
      const ifaceB = pieceB?.interfaces.find((i) => i.interfaceId === conn.interfaceBId);

      const pA = ifaceA?.worldPosition || pieceA?.assembledTransform.position || vec3(0, 0, 0);
      const pB = ifaceB?.worldPosition || pieceB?.assembledTransform.position || vec3(0, 0, 0);
      const midPoint = scale3(add3(pA, pB), 0.5);

      const diff = sub3(pA, pB);
      const assemblyDir = len3(diff) > 0.001 ? normalize3(diff) : vec3(0, 0, 1);

      const stepA = pieceA?.stepIndex || 1;
      const stepB = pieceB?.stepIndex || 1;
      const stepIntroduced = Math.max(stepA, stepB);

      indicators.push({
        connectionId: conn.connectionId,
        pieceAId: conn.pieceAId,
        pieceBId: conn.pieceBId,
        interfaceAId: conn.interfaceAId,
        interfaceBId: conn.interfaceBId,
        connectorType: conn.connectorType,
        pointA: pA,
        pointB: pB,
        midPoint,
        assemblyDirection: assemblyDir,
        state: "MATED",
        stepIntroduced,
        isVisible: false,
      });
    });

    return indicators;
  }

  /**
   * Updates interface world positions and normals under current piece transform.
   */
  private static updateInterfacePositions(pieceState: ExplodedPieceState): void {
    pieceState.interfaces.forEach((ifc) => {
      ifc.worldPosition = transformPoint(pieceState.currentTransform, ifc.localFrame.origin);
      ifc.worldNormal = transformVector(pieceState.currentTransform, ifc.localFrame.normal);
    });
  }

  /**
   * Updates connection indicator end points based on updated piece interface positions.
   */
  private static updateConnectionPoints(
    conn: ExplodedConnectionIndicator,
    pieceMap: Record<string, ExplodedPieceState>
  ): void {
    const pieceA = pieceMap[conn.pieceAId];
    const pieceB = pieceMap[conn.pieceBId];

    const ifaceA = pieceA?.interfaces.find((i) => i.interfaceId === conn.interfaceAId);
    const ifaceB = pieceB?.interfaces.find((i) => i.interfaceId === conn.interfaceBId);

    conn.pointA = ifaceA?.worldPosition || pieceA?.currentTransform.position || vec3(0, 0, 0);
    conn.pointB = ifaceB?.worldPosition || pieceB?.currentTransform.position || vec3(0, 0, 0);
    conn.midPoint = scale3(add3(conn.pointA, conn.pointB), 0.5);

    const diff = sub3(conn.pointA, conn.pointB);
    if (len3(diff) > 0.001) {
      conn.assemblyDirection = normalize3(diff);
    }
  }

  /**
   * Deterministic radial fallback unit vector for pieces with identical or zero relative offsets.
   */
  private static deterministicFallbackVector(index: number): Vec3 {
    const angle = (index * 2 * Math.PI) / 8;
    return normalize3(vec3(Math.cos(angle), Math.sin(angle), (index % 3) * 0.5));
  }

  private static createIdentityTransform(): RigidTransform3D {
    return {
      position: vec3(0, 0, 0),
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: vec3(1, 1, 1),
    };
  }
}
