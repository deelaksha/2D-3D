/**
 * Automatic 3D Assembly Generator (Phase 87).
 *
 * Automatically generates a complete 3D assembly from:
 *   3D pieces + connection graph + connector definitions + desired assembly configuration
 *
 * 7-step pipeline:
 *   1. select a root piece
 *   2. place the root
 *   3. select connected pieces
 *   4. align connection interfaces
 *   5. apply relative transforms
 *   6. apply joining angles
 *   7. continue until all pieces are placed
 *
 * Returns:
 *   AssemblyConfiguration
 *   AssemblyState
 *   PieceTransforms
 *   ConnectionStates
 *
 * Validates every placement.
 */

import { uid } from "@/core/model/ids";
import type { ID } from "@/core/model/types";
import { quatIdentity, vec3 } from "../geometry/math3d";
import type { RigidTransform3D } from "../framesystem/types";
import { AssemblyStateEngine } from "../assemblystate/assemblyStateEngine";
import type { AssemblyPieceState, AssemblyState } from "../assemblystate/types";
import type { GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";
import { RootSelector } from "./rootSelector";
import { InterfaceAligner } from "./interfaceAligner";
import { PlacementValidator } from "./placementValidator";
import type {
  AssemblyConfiguration,
  AssemblyPlacement,
  AutomaticAssemblyRequest,
  ConnectionState3D,
  ConnectionStates,
  DesiredAssemblyConfiguration,
  GeneratedAssembly3D,
  PieceTransforms,
  PlacementValidationResult,
} from "./types";

export class Automatic3DAssemblyGenerator {
  /**
   * Automatically generates a complete 3D assembly from 3D pieces and connection constraints.
   */
  public static generateAssembly(request: AutomaticAssemblyRequest): GeneratedAssembly3D {
    const startTime = performance.now();
    const { pieces, graph, connections, desiredConfiguration } = request;

    if (!pieces || pieces.length === 0) {
      throw new Error("Cannot assemble empty piece set.");
    }

    const configId = desiredConfiguration?.configurationId ?? uid("config_3d_");
    const configName = desiredConfiguration?.name ?? `3D Assembly (${pieces.length} pieces)`;
    const strategy = desiredConfiguration?.generationStrategy ?? "custom";

    const pieceMap = new Map<ID, GeneratedPiece3D>();
    for (const p of pieces) {
      pieceMap.set(p.pieceId, p);
    }

    // Step 1: Select a root piece
    const rootPieceId = RootSelector.selectRootPiece(pieces, graph, desiredConfiguration);
    const rootPiece = pieceMap.get(rootPieceId)!;

    // Step 2: Place the root piece at world space origin
    const rootTransform: RigidTransform3D = {
      position: vec3(0, 0, 0),
      rotation: quatIdentity(),
      scale: vec3(1, 1, 1),
    };

    const rootPlacement: AssemblyPlacement = {
      pieceId: rootPieceId,
      transform: rootTransform,
      isFixed: true,
      placementOrder: 0,
      parentPieceId: null,
      connectingConnectionId: null,
      appliedJoiningAngleDeg: 180.0,
    };

    const placementsMap = new Map<ID, AssemblyPlacement>();
    placementsMap.set(rootPieceId, rootPlacement);

    const placementResults: Record<ID, PlacementValidationResult> = {};
    placementResults[rootPieceId] = PlacementValidator.validatePlacement(rootPlacement, 0.0);

    const appliedAngles: Record<ID, number> = {};

    // Steps 3 to 7: BFS traversal across the connection graph
    const placedSet = new Set<ID>([rootPieceId]);
    const queue: ID[] = [rootPieceId];
    const sequenceOrder: string[] = [rootPieceId];

    while (queue.length > 0) {
      const sourcePieceId = queue.shift()!;
      const sourcePlacement = placementsMap.get(sourcePieceId)!;
      const sourcePiece = pieceMap.get(sourcePieceId)!;

      // Find all connections touching sourcePieceId
      const candidateConnections = connections.filter(
        (c) => c.pieceAId === sourcePieceId || c.pieceBId === sourcePieceId
      );

      for (const conn of candidateConnections) {
        const neighborId = conn.pieceAId === sourcePieceId ? conn.pieceBId : conn.pieceAId;
        if (placedSet.has(neighborId)) continue;

        const targetPiece = pieceMap.get(neighborId);
        if (!targetPiece) continue;

        // Step 4, 5 & 6: Align connection interfaces and apply joining angles
        const matingResult = InterfaceAligner.alignTargetPiece(
          sourcePiece,
          sourcePlacement.transform,
          targetPiece,
          conn,
          desiredConfiguration
        );

        appliedAngles[conn.connectionId] = matingResult.appliedJoiningAngleDeg;

        const targetPlacement: AssemblyPlacement = {
          pieceId: neighborId,
          transform: matingResult.targetWorldTransform,
          isFixed: false,
          placementOrder: placementsMap.size,
          parentPieceId: sourcePieceId,
          connectingConnectionId: conn.connectionId,
          appliedJoiningAngleDeg: matingResult.appliedJoiningAngleDeg,
        };

        // Validate placement
        const validationResult = PlacementValidator.validatePlacement(
          targetPlacement,
          matingResult.alignmentErrorMm
        );

        placementsMap.set(neighborId, targetPlacement);
        placementResults[neighborId] = validationResult;
        placedSet.add(neighborId);
        queue.push(neighborId);
        sequenceOrder.push(neighborId);
      }
    }

    // Handle any unplaced pieces (if disconnected)
    for (const piece of pieces) {
      if (!placedSet.has(piece.pieceId)) {
        const fallbackPlacement: AssemblyPlacement = {
          pieceId: piece.pieceId,
          transform: {
            position: vec3(0, 0, 0),
            rotation: quatIdentity(),
            scale: vec3(1, 1, 1),
          },
          isFixed: false,
          placementOrder: placementsMap.size,
          parentPieceId: null,
          connectingConnectionId: null,
          appliedJoiningAngleDeg: 180.0,
        };
        placementsMap.set(piece.pieceId, fallbackPlacement);
        placementResults[piece.pieceId] = PlacementValidator.validatePlacement(fallbackPlacement, 0.0);
        placedSet.add(piece.pieceId);
        sequenceOrder.push(piece.pieceId);
      }
    }

    // 1. Build PieceTransforms
    const pieceTransforms: PieceTransforms = {};
    for (const [id, placement] of placementsMap.entries()) {
      pieceTransforms[id] = { ...placement.transform };
    }

    // 2. Build ConnectionStates
    const connectionStates: ConnectionStates = {};
    for (const conn of connections) {
      const isMated = placedSet.has(conn.pieceAId) && placedSet.has(conn.pieceBId);
      const angle =
        appliedAngles[conn.connectionId] ??
        InterfaceAligner.resolveJoiningAngle(conn, conn.pieceAId, conn.pieceBId, desiredConfiguration);
      appliedAngles[conn.connectionId] = angle;

      connectionStates[conn.connectionId] = {
        connectionId: conn.connectionId,
        pieceAId: conn.pieceAId,
        pieceBId: conn.pieceBId,
        interfaceAId: conn.interfaceAId,
        interfaceBId: conn.interfaceBId,
        status: isMated ? "MATED" : "DISENGAGED",
        currentAngleDeg: angle,
        targetAngleDeg: angle,
        alignmentErrorMm: isMated ? 0.0 : 999.0,
        clearanceMm: conn.clearanceMm,
        isValid: isMated,
      };
    }

    // 3. Build AssemblyConfiguration
    const placementsRecord: Record<ID, AssemblyPlacement> = {};
    for (const [id, pl] of placementsMap.entries()) {
      placementsRecord[id] = pl;
    }

    const assemblyConfiguration: AssemblyConfiguration = {
      configurationId: configId,
      name: configName,
      rootPieceId,
      placements: placementsRecord,
      targetAngles: appliedAngles,
      generationStrategy: strategy,
      assemblySequence: sequenceOrder,
      createdAt: new Date().toISOString(),
    };

    // 4. Build formal AssemblyState
    const pieceStates: AssemblyPieceState[] = pieces.map((p) => ({
      pieceId: p.pieceId,
      name: p.name,
      dimensions: {
        width: p.profile.localBounds.maxX - p.profile.localBounds.minX,
        height: p.profile.localBounds.maxY - p.profile.localBounds.minY,
        thickness: p.thickness,
      },
      interfaceIds: p.interfaceIds,
      isPlaced: true,
      currentSubAssemblyId: "sub_assembly_root",
      isBase: p.pieceId === rootPieceId,
    }));

    const assemblyState: AssemblyState = AssemblyStateEngine.createInitialState(
      pieceStates,
      [], // Connection models are registered during assembly
      pieceTransforms
    );

    // 5. Build overall validation report
    const allPlacementsList = Array.from(placementsMap.values());
    const validation = PlacementValidator.compileAssemblyReport(
      pieces.length,
      allPlacementsList,
      placementResults,
      connectionStates
    );

    const executionDurationMs = Number((performance.now() - startTime).toFixed(2));

    return {
      assemblyConfiguration,
      assemblyState,
      pieceTransforms,
      connectionStates,
      validation,
      rootPieceId,
      allPlacements: allPlacementsList,
      metadata: {
        generatedAt: new Date().toISOString(),
        executionDurationMs,
        generatorVersion: "Phase 87 (v1.0)",
      },
    };
  }
}
