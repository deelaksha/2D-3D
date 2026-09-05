/**
 * Complete Automatic Assembly Solver Domain Types (Phase 89).
 *
 * Requirements:
 *  - Input: Complete generated puzzle + connection graph + valid angle candidates.
 *  - Discovers at least one valid complete 3D configuration.
 *  - Uses:
 *      1. graph traversal
 *      2. constraint solving
 *      3. collision detection
 *      4. angle constraints
 *      5. assembly feasibility
 *  - Chooses an assembly root.
 *  - Places pieces progressively.
 *  - Evaluates candidate transforms.
 *  - Rejects collisions.
 *  - Rejects invalid connections.
 *  - Backtracks when necessary.
 *  - Continues until all pieces are assembled.
 *  - Configurable search limits (maxBacktracks, maxStatesExplored, timeoutMs).
 *  - Returns: SuccessfulAssembly OR AssemblyFailureReport (never accepts partial results).
 */

import type { ID, Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { AssemblyState } from "../assemblystate/types";
import type { ConvertedPuzzle3D, GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";
import type {
  AssemblyConfiguration as Automatic3DAssemblyConfiguration,
  AssemblyPlacement,
  ConnectionStates,
  PieceTransforms,
} from "../assembly3d/types";
import type { ValidAngleCandidates } from "../anglegeneration/types";

/**
 * Rejection classification code for an attempted placement step during search.
 */
export type PlacementRejectionCode =
  | "collision"
  | "invalid_connection"
  | "unsupported_piece"
  | "search_limit_exceeded"
  | "no_valid_angles"
  | "transform_error";

/**
 * Diagnostic step log recorded during backtracking search.
 */
export interface SolverStepDiagnostic {
  step: number;
  pieceId: string;
  connectionId?: string;
  attemptedAngleDeg?: number;
  rejectionCode: PlacementRejectionCode;
  message: string;
  conflictingPieceId?: string;
  timestampMs: number;
}

/**
 * Configurable options for the backtracking assembly solver.
 */
export interface AssemblySolverOptions {
  /** Maximum number of backtracking steps before aborting (default: 500). */
  maxBacktracks?: number;

  /** Maximum number of states/nodes explored in search tree (default: 2000). */
  maxStatesExplored?: number;

  /** Maximum execution time in milliseconds (default: 5000ms). */
  timeoutMs?: number;

  /** Collision tolerance threshold in mm (default: 0.1 mm). */
  collisionToleranceMm?: number;

  /** Preferred root piece ID override. */
  preferredRootPieceId?: string;

  /** Graph traversal / expansion strategy. Default: "most_connected". */
  searchStrategy?: "bfs" | "dfs" | "most_connected" | "minimum_remaining_angles";

  /** Strategy for ordering candidate angles. Default: "preferred_first". */
  angleOrderingStrategy?: "preferred_first" | "nominal_first" | "ascending";
}

/**
 * Primary input container for the assembly solver.
 */
export interface AssemblySolverInput {
  /** Converted 3D puzzle with independent pieces in local frames. */
  puzzle: ConvertedPuzzle3D;

  /** Optional pre-built connection graph (synthesized automatically if omitted). */
  connectionGraph?: PuzzleAssemblyGraph;

  /** Precomputed valid candidate angles per connection (from Phase 88). */
  validAngleCandidates: Record<string, ValidAngleCandidates>;

  /** Solver search configuration and limits. */
  options?: AssemblySolverOptions;
}

/**
 * Performance and search metrics recorded during solving.
 */
export interface SolverMetrics {
  totalPieces: number;
  totalConnections: number;
  placedCount: number;
  statesExplored: number;
  backtrackCount: number;
  timedOut: boolean;
  solveDurationMs: number;
}

/**
 * Fully verified complete 3D assembly result.
 */
export interface SuccessfulAssembly {
  success: true;

  /** Puzzle identifier. */
  puzzleId: string;

  /** Root piece chosen to anchor the assembly in world space. */
  rootPieceId: string;

  /** Formal assembly configuration with placement sequence and strategies. */
  assemblyConfiguration: Automatic3DAssemblyConfiguration;

  /** Runtime formal assembly state with collision clearance and DOF metrics. */
  assemblyState: AssemblyState;

  /** Complete rigid-body transforms for 100% of pieces in the puzzle. */
  pieceTransforms: PieceTransforms;

  /** Engagement and geometric status for all connections. */
  connectionStates: ConnectionStates;

  /** Step-by-step placement order of pieces (length == totalPieces). */
  placementOrder: string[];

  /** Final applied joining angles keyed by connectionId. */
  appliedAngles: Record<string, number>;

  /** List of complete individual piece spatial placements. */
  placements: AssemblyPlacement[];

  /** Execution and search metrics. */
  metrics: SolverMetrics;
}

/**
 * Detailed failure report when no complete valid 3D configuration can be found.
 */
export interface AssemblyFailureReport {
  success: false;

  /** Puzzle identifier if available. */
  puzzleId?: string;

  /** High-level summary of why the solver failed. */
  failureReason: string;

  /** Pieces that could not be successfully placed. */
  unplacedPieceIds: string[];

  /** Pieces placed up to the furthest valid state before backtracking failed. */
  partiallyPlacedPieceIds: string[];

  /** Detailed diagnostic logs for rejected branches. */
  diagnostics: SolverStepDiagnostic[];

  /** Execution and search metrics. */
  metrics: SolverMetrics;
}

/**
 * Unified return type: either 100% success or explicit failure report.
 * (Partial assemblies are never returned as success).
 */
export type AssemblySolverResult = SuccessfulAssembly | AssemblyFailureReport;
