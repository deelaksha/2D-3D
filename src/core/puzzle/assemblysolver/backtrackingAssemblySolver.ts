/**
 * Complete Automatic Assembly Solver (Phase 89).
 *
 * Master constraint-solving engine that combines:
 *  - Graph traversal (Frontier queue / MRV heuristic)
 *  - 3D rigid-body kinematics & loop-closure validation
 *  - High-precision 3D collision detection
 *  - Deterministic backtracking search across valid candidate angles
 *
 * Guarantees binary outcome:
 *  - Returns SuccessfulAssembly if and only if 100% of pieces are placed.
 *  - Returns AssemblyFailureReport otherwise (never accepts partial results).
 */

import type { ID } from "@/core/model/types";
import { quatIdentity, vec3 } from "../geometry/math3d";
import type { RigidTransform3D } from "../framesystem/types";
import type { ConvertedPuzzle3D, GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import type {
  AssemblyConfiguration as Automatic3DAssemblyConfiguration,
  AssemblyPlacement,
  ConnectionState3D,
  ConnectionStates,
  PieceTransforms,
} from "../assembly3d/types";
import type { AssemblyState } from "../assemblystate/types";
import { AssemblyStateEngine } from "../assemblystate/assemblyStateEngine";
import { AssemblyCollisionDetector } from "./assemblyCollisionDetector";
import { TransformEvaluator } from "./transformEvaluator";
import type {
  AssemblyFailureReport,
  AssemblySolverInput,
  AssemblySolverOptions,
  AssemblySolverResult,
  SolverMetrics,
  SolverStepDiagnostic,
  SuccessfulAssembly,
} from "./types";

export class BacktrackingAssemblySolver {
  /**
   * Primary entry point: solves the 3D assembly constraint problem.
   */
  public static solve(input: AssemblySolverInput): AssemblySolverResult {
    const startTime = performance.now();
    const { puzzle, validAngleCandidates, options = {} } = input;

    const maxBacktracks = options.maxBacktracks ?? 500;
    const maxStatesExplored = options.maxStatesExplored ?? 2000;
    const timeoutMs = options.timeoutMs ?? 5000;
    const collisionToleranceMm = options.collisionToleranceMm ?? 0.1;
    const searchStrategy = options.searchStrategy ?? "most_connected";

    const pieces = puzzle.pieces ?? [];
    const connections = puzzle.connections ?? [];

    if (pieces.length === 0) {
      return {
        success: false,
        puzzleId: puzzle.puzzleId,
        failureReason: "Puzzle contains zero pieces to assemble.",
        unplacedPieceIds: [],
        partiallyPlacedPieceIds: [],
        diagnostics: [],
        metrics: {
          totalPieces: 0,
          totalConnections: 0,
          placedCount: 0,
          statesExplored: 0,
          backtrackCount: 0,
          timedOut: false,
          solveDurationMs: 0,
        },
      };
    }

    const pieceMap = new Map<string, GeneratedPiece3D>();
    for (const p of pieces) {
      pieceMap.set(p.pieceId, p);
    }

    // Pre-build connection adjacency map for fast neighbor queries
    const adjacency = new Map<string, Array<{ neighborId: string; connection: RetainedConnection3D }>>();
    for (const p of pieces) {
      adjacency.set(p.pieceId, []);
    }
    for (const conn of connections) {
      adjacency.get(conn.pieceAId)?.push({ neighborId: conn.pieceBId, connection: conn });
      adjacency.get(conn.pieceBId)?.push({ neighborId: conn.pieceAId, connection: conn });
    }

    // 1. Choose Assembly Root
    const rootId = this.selectAssemblyRoot(pieces, adjacency, options.preferredRootPieceId);
    const rootPiece = pieceMap.get(rootId)!;

    // 2. Initialize Solver State
    const placedPieces = new Map<string, GeneratedPiece3D>();
    const placedTransforms: PieceTransforms = {};
    const placementOrder: string[] = [];
    const placements: AssemblyPlacement[] = [];
    const appliedAngles: Record<string, number> = {};
    const diagnostics: SolverStepDiagnostic[] = [];

    let statesExplored = 0;
    let backtrackCount = 0;
    let timedOut = false;
    let searchStatesExceeded = false;
    let maxBacktracksExceeded = false;
    let maxPlacedCount = 0;
    let bestPartialPlacement: string[] = [];

    // Place root piece at world origin
    const rootTransform: RigidTransform3D = {
      position: vec3(0, 0, 0),
      rotation: quatIdentity(),
      scale: vec3(1, 1, 1),
    };

    placedPieces.set(rootId, rootPiece);
    placedTransforms[rootId] = rootTransform;
    placementOrder.push(rootId);
    placements.push({
      pieceId: rootId,
      transform: rootTransform,
      isFixed: true,
      placementOrder: 0,
      parentPieceId: null,
      connectingConnectionId: null,
      appliedJoiningAngleDeg: 0.0,
    });
    maxPlacedCount = 1;
    bestPartialPlacement = [rootId];

    // 3. Recursive Backtracking Solver Function
    const search = (): boolean => {
      // Check limits
      statesExplored++;
      if (statesExplored > maxStatesExplored) {
        searchStatesExceeded = true;
        diagnostics.push({
          step: statesExplored,
          pieceId: "",
          rejectionCode: "search_limit_exceeded",
          message: `Exceeded maximum search states limit (${maxStatesExplored}).`,
          timestampMs: performance.now() - startTime,
        });
        return false;
      }

      if (performance.now() - startTime > timeoutMs) {
        timedOut = true;
        diagnostics.push({
          step: statesExplored,
          pieceId: "",
          rejectionCode: "search_limit_exceeded",
          message: `Solver timed out after ${timeoutMs}ms.`,
          timestampMs: performance.now() - startTime,
        });
        return false;
      }

      if (backtrackCount > maxBacktracks) {
        maxBacktracksExceeded = true;
        diagnostics.push({
          step: statesExplored,
          pieceId: "",
          rejectionCode: "search_limit_exceeded",
          message: `Exceeded maximum backtrack steps (${maxBacktracks}).`,
          timestampMs: performance.now() - startTime,
        });
        return false;
      }

      // Base Case: All pieces placed!
      if (placedPieces.size === pieces.length) {
        return true;
      }

      // Select candidate piece on the frontier adjacent to placed subassembly
      const candidateChoices = this.getFrontierChoices(
        placedPieces,
        adjacency,
        pieceMap,
        validAngleCandidates,
        searchStrategy
      );

      if (candidateChoices.length === 0) {
        // Disconnected or blocked frontier
        const unplaced = pieces.filter((p) => !placedPieces.has(p.pieceId)).map((p) => p.pieceId);
        diagnostics.push({
          step: statesExplored,
          pieceId: unplaced[0] ?? "unknown",
          rejectionCode: "unsupported_piece",
          message: `No connected unplaced pieces remaining on assembly frontier (remaining unplaced: ${unplaced.length}).`,
          timestampMs: performance.now() - startTime,
        });
        return false;
      }

      // Try placing the highest priority candidate piece
      const choice = candidateChoices[0];
      const candPiece = choice.candidatePiece;
      const parentPiece = choice.parentPiece;
      const parentTransform = placedTransforms[parentPiece.pieceId];
      const conn = choice.connection;

      // Get valid angles for this connection
      const angleRecord = validAngleCandidates[conn.connectionId];
      let candidateAngles = angleRecord?.validAngles ?? [];

      if (candidateAngles.length === 0) {
        // Fallback to connection's allowed angle or standard 180° / 90° if missing
        const fallback = conn.allowedAngleDeg ?? (conn.connectorType === "notch" ? 90.0 : 180.0);
        candidateAngles = [fallback];
      }

      // Order candidate angles (preferred nominal angle first)
      const orderedAngles = this.orderCandidateAngles(
        candidateAngles,
        angleRecord?.recommendedAngle,
        conn.allowedAngleDeg
      );

      // Pre-calculate direct neighbor IDs for collision evaluation
      const directNeighborIds = new Set<string>();
      for (const edge of adjacency.get(candPiece.pieceId) ?? []) {
        if (placedPieces.has(edge.neighborId)) {
          directNeighborIds.add(edge.neighborId);
        }
      }

      // Try each candidate angle
      for (const angle of orderedAngles) {
        // 1. Evaluate transform & loop closure
        const transformEval = TransformEvaluator.evaluatePlacementTransform(
          candPiece,
          parentPiece,
          parentTransform,
          conn,
          angle,
          placedPieces,
          placedTransforms,
          connections
        );

        if (!transformEval.valid || !transformEval.transform) {
          diagnostics.push({
            step: statesExplored,
            pieceId: candPiece.pieceId,
            connectionId: conn.connectionId,
            attemptedAngleDeg: angle,
            rejectionCode: "invalid_connection",
            message: transformEval.rejectionReason ?? "Transform computation or loop closure failed.",
            timestampMs: performance.now() - startTime,
          });
          continue;
        }

        // 2. Evaluate 3D spatial collisions with all placed pieces
        const collisionCheck = AssemblyCollisionDetector.checkCollisionWithSubassembly(
          candPiece,
          transformEval.transform,
          placedPieces,
          placedTransforms,
          directNeighborIds,
          collisionToleranceMm
        );

        if (collisionCheck.hasCollision) {
          diagnostics.push({
            step: statesExplored,
            pieceId: candPiece.pieceId,
            connectionId: conn.connectionId,
            attemptedAngleDeg: angle,
            rejectionCode: "collision",
            message: collisionCheck.message ?? "Spatial collision with placed piece.",
            conflictingPieceId: collisionCheck.conflictingPieceId,
            timestampMs: performance.now() - startTime,
          });
          continue;
        }

        // 3. Commit Placement
        placedPieces.set(candPiece.pieceId, candPiece);
        placedTransforms[candPiece.pieceId] = transformEval.transform;
        placementOrder.push(candPiece.pieceId);
        placements.push({
          pieceId: candPiece.pieceId,
          transform: transformEval.transform,
          isFixed: false,
          placementOrder: placementOrder.length - 1,
          parentPieceId: parentPiece.pieceId,
          connectingConnectionId: conn.connectionId,
          appliedJoiningAngleDeg: angle,
        });
        appliedAngles[conn.connectionId] = angle;

        if (placedPieces.size > maxPlacedCount) {
          maxPlacedCount = placedPieces.size;
          bestPartialPlacement = [...placementOrder];
        }

        // 4. Recurse to next step
        const success = search();
        if (success) {
          return true;
        }

        // 5. Backtrack
        backtrackCount++;
        placedPieces.delete(candPiece.pieceId);
        delete placedTransforms[candPiece.pieceId];
        placementOrder.pop();
        placements.pop();
        delete appliedAngles[conn.connectionId];

        if (timedOut || backtrackCount > maxBacktracks || statesExplored > maxStatesExplored) {
          return false;
        }
      }

      // All angles failed for this piece along this branch
      return false;
    };

    // Run the solver
    const solved = search();
    const duration = Number((performance.now() - startTime).toFixed(2));

    const metrics: SolverMetrics = {
      totalPieces: pieces.length,
      totalConnections: connections.length,
      placedCount: placedPieces.size,
      statesExplored,
      backtrackCount,
      timedOut,
      solveDurationMs: duration,
    };

    if (solved && placedPieces.size === pieces.length) {
      // Construct SuccessfulAssembly
      const connectionStates: ConnectionStates = {};
      for (const conn of connections) {
        const appliedAngle = appliedAngles[conn.connectionId] ?? conn.allowedAngleDeg ?? 180.0;
        connectionStates[conn.connectionId] = {
          connectionId: conn.connectionId,
          pieceAId: conn.pieceAId,
          pieceBId: conn.pieceBId,
          interfaceAId: conn.interfaceAId,
          interfaceBId: conn.interfaceBId,
          status: "ENGAGED",
          currentAngleDeg: appliedAngle,
          targetAngleDeg: appliedAngle,
          alignmentErrorMm: 0.0,
          clearanceMm: conn.clearanceMm ?? 0.15,
          isValid: true,
        };
      }

      const assemblyConfiguration: Automatic3DAssemblyConfiguration = {
        configurationId: `config_${puzzle.puzzleId}`,
        name: `Assembly for ${puzzle.name ?? puzzle.puzzleId}`,
        rootPieceId: rootId,
        defaultJoiningAngleDeg: 180.0,
        angleOverrides: appliedAngles,
        generationStrategy: "custom",
        placements,
        placementSequence: [...placementOrder],
      };

      // Create formal AssemblyState using Phase 66 engine
      const assemblyState = AssemblyStateEngine.createInitialState(
        pieces.map((p) => ({
          pieceId: p.pieceId,
          name: p.name,
          dimensions: {
            width: p.profile?.localBounds ? p.profile.localBounds.maxX - p.profile.localBounds.minX : 50,
            height: p.profile?.localBounds ? p.profile.localBounds.maxY - p.profile.localBounds.minY : 40,
            thickness: p.thickness ?? 3,
          },
          material: p.material,
          interfaceIds: p.interfaceIds,
          isPlaced: true,
          isFixed: p.pieceId === rootId,
        })),
        connections.map((c) => ({
          id: c.connectionId,
          sourcePieceId: c.pieceAId,
          targetPieceId: c.pieceBId,
          sourceInterfaceId: c.interfaceAId,
          targetInterfaceId: c.interfaceBId,
          connectorType: c.connectorType as any,
          clearanceMm: c.clearanceMm ?? 0.15,
          kinematicDof: { translation: [false, false, false], rotation: [false, false, false] },
        }))
      );

      return {
        success: true,
        puzzleId: puzzle.puzzleId,
        rootPieceId: rootId,
        assemblyConfiguration,
        assemblyState,
        pieceTransforms: placedTransforms,
        connectionStates,
        placementOrder,
        appliedAngles,
        placements,
        metrics,
      };
    }

    // Failure: Cleanly report failure, never return a partial assembly as success
    const placedSet = new Set(placedPieces.keys());
    const unplacedPieceIds = pieces.filter((p) => !placedSet.has(p.pieceId)).map((p) => p.pieceId);

    let failureReason = "Search space exhausted: No collision-free valid 3D configuration satisfies all connections.";
    if (timedOut) {
      failureReason = `Assembly solver timed out after ${timeoutMs}ms.`;
    } else if (searchStatesExceeded || statesExplored >= maxStatesExplored) {
      failureReason = `Exceeded maximum search states explored (${maxStatesExplored}).`;
    } else if (maxBacktracksExceeded || backtrackCount > maxBacktracks) {
      failureReason = `Exceeded maximum allowed backtracks limit (${maxBacktracks}).`;
    }

    return {
      success: false,
      puzzleId: puzzle.puzzleId,
      failureReason,
      unplacedPieceIds,
      partiallyPlacedPieceIds: bestPartialPlacement,
      diagnostics: diagnostics.slice(0, 5), // Keep top 5 diagnostics
      metrics,
    };
  }

  /**
   * Deterministically selects the optimal root piece using topological connectivity and centrality.
   */
  private static selectAssemblyRoot(
    pieces: GeneratedPiece3D[],
    adjacency: Map<string, Array<{ neighborId: string; connection: RetainedConnection3D }>>,
    preferredRootId?: string
  ): string {
    if (preferredRootId && pieces.some((p) => p.pieceId === preferredRootId)) {
      return preferredRootId;
    }

    let bestPieceId = pieces[0].pieceId;
    let maxDegree = -1;
    let maxArea = -1;

    for (const p of pieces) {
      const degree = adjacency.get(p.pieceId)?.length ?? 0;
      const area = p.profile?.areaMm2 ?? 0;

      // Primary heuristic: Higher degree (more connected)
      // Secondary heuristic: Larger area (more stable mechanical base)
      if (degree > maxDegree || (degree === maxDegree && area > maxArea)) {
        maxDegree = degree;
        maxArea = area;
        bestPieceId = p.pieceId;
      }
    }

    return bestPieceId;
  }

  /**
   * Identifies and ranks frontier candidate pieces adjacent to the currently placed subassembly.
   */
  private static getFrontierChoices(
    placedPieces: Map<string, GeneratedPiece3D>,
    adjacency: Map<string, Array<{ neighborId: string; connection: RetainedConnection3D }>>,
    pieceMap: Map<string, GeneratedPiece3D>,
    validAngleCandidates: Record<string, any>,
    strategy: string
  ): Array<{
    candidatePiece: GeneratedPiece3D;
    parentPiece: GeneratedPiece3D;
    connection: RetainedConnection3D;
    score: number;
  }> {
    const candidateMap = new Map<
      string,
      {
        candidatePiece: GeneratedPiece3D;
        parentPiece: GeneratedPiece3D;
        connection: RetainedConnection3D;
        placedNeighborCount: number;
        validAngleCount: number;
      }
    >();

    for (const [placedId, parentPiece] of placedPieces.entries()) {
      const edges = adjacency.get(placedId) ?? [];
      for (const edge of edges) {
        if (placedPieces.has(edge.neighborId)) continue; // Already placed

        const candPiece = pieceMap.get(edge.neighborId);
        if (!candPiece) continue;

        const existing = candidateMap.get(edge.neighborId);
        if (existing) {
          existing.placedNeighborCount++;
        } else {
          const angleRecord = validAngleCandidates[edge.connection.connectionId];
          const angleCount = angleRecord?.validAngles?.length ?? 1;

          candidateMap.set(edge.neighborId, {
            candidatePiece: candPiece,
            parentPiece,
            connection: edge.connection,
            placedNeighborCount: 1,
            validAngleCount: angleCount,
          });
        }
      }
    }

    const choices = Array.from(candidateMap.values()).map((c) => {
      // Scoring heuristic:
      // More placed neighbors = more constrained (MRV - Minimum Remaining Values) -> higher priority
      // Fewer valid candidate angles = more constrained -> higher priority
      let score = c.placedNeighborCount * 10 - c.validAngleCount;
      if (strategy === "bfs") {
        score = -c.candidatePiece.pieceId.localeCompare(c.parentPiece.pieceId);
      }
      return {
        candidatePiece: c.candidatePiece,
        parentPiece: c.parentPiece,
        connection: c.connection,
        score,
      };
    });

    // Sort descending by score (most constrained first)
    choices.sort((a, b) => b.score - a.score);

    return choices;
  }

  /**
   * Sorts candidate angles to test the most promising/nominal angle first.
   */
  private static orderCandidateAngles(
    angles: number[],
    recommendedAngle?: number,
    allowedAngle?: number
  ): number[] {
    const unique = Array.from(new Set(angles));
    const preferred = recommendedAngle ?? allowedAngle;

    if (preferred !== undefined && unique.includes(preferred)) {
      return [preferred, ...unique.filter((a) => a !== preferred)];
    }

    return unique;
  }
}

/**
 * Functional wrapper for BacktrackingAssemblySolver.solve.
 */
export function solveAutomaticAssembly(input: AssemblySolverInput): AssemblySolverResult {
  return BacktrackingAssemblySolver.solve(input);
}
