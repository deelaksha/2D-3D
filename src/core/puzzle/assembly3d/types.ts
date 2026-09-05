/**
 * Automatic 3D Assembly Generator Domain Types (Phase 87).
 *
 * Requirements:
 *  - Automatically assembles 3D pieces into complete 3D assemblies.
 *  - 7-step pipeline:
 *      1. select a root piece
 *      2. place the root
 *      3. select connected pieces
 *      4. align connection interfaces
 *      5. apply relative transforms
 *      6. apply joining angles
 *      7. continue until all pieces are placed
 *  - Supports non-coplanar 3D angles: 30°, 45°, 60°, 90°, etc.
 *  - Angles originate from: assembly configuration, connection constraints, or generation strategy.
 *  - Never alters underlying piece geometry (rigid-body transforms only).
 *  - Returns: AssemblyConfiguration, AssemblyState, PieceTransforms, ConnectionStates.
 *  - Validates every placement.
 */

import type { ID, Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { AssemblyState } from "../assemblystate/types";
import type { GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";

/**
 * Desired assembly configuration specifying target angles and assembly strategy.
 */
export interface DesiredAssemblyConfiguration {
  configurationId?: string;
  name?: string;

  /** Optional explicit root piece override. */
  rootPieceId?: string;

  /** Default joining angle in degrees if not specified by connection or override (default: 180 or 90). */
  defaultJoiningAngleDeg?: number;

  /** Explicit angle overrides keyed by connectionId or piece pair (e.g. "pieceA_pieceB"). */
  angleOverrides?: Record<string, number>;

  /** High-level assembly generation strategy. */
  generationStrategy?: "planar" | "box_enclosure" | "angled_facet" | "prism" | "custom";
}

/**
 * Spatial placement record for a single piece in assembly world space.
 */
export interface AssemblyPlacement {
  pieceId: ID;
  /** Spatial rigid-body transform mapping piece-local space to assembly world space. */
  transform: RigidTransform3D;
  /** Whether the piece is fixed in world space (e.g. the root piece). */
  isFixed: boolean;
  /** Step number in the sequential assembly placement order (0-indexed). */
  placementOrder: number;
  /** ID of the parent piece through which this piece was placed (null for root). */
  parentPieceId: ID | null;
  /** ID of the connection used to attach this piece to its parent. */
  connectingConnectionId: ID | null;
  /** Joining angle applied during placement in degrees. */
  appliedJoiningAngleDeg: number;
}

/**
 * Mapping of Piece ID to 3D Rigid Transform.
 */
export type PieceTransforms = Record<ID, RigidTransform3D>;

/**
 * Runtime engagement state of a connection in the 3D assembly.
 */
export interface ConnectionState3D {
  connectionId: ID;
  pieceAId: ID;
  pieceBId: ID;
  interfaceAId: ID;
  interfaceBId: ID;
  status: "MATED" | "ENGAGED" | "DISENGAGED";
  /** Current 3D angle between mating pieces in degrees. */
  currentAngleDeg: number;
  /** Target nominal angle in degrees. */
  targetAngleDeg: number;
  /** Distance between mated interface origins in world space (mm). */
  alignmentErrorMm: number;
  /** Manufacturing clearance in mm. */
  clearanceMm: number;
  /** Whether this connection satisfies all geometric tolerances. */
  isValid: boolean;
}

/**
 * Mapping of Connection ID to 3D Connection State.
 */
export type ConnectionStates = Record<ID, ConnectionState3D>;

/**
 * Formal Assembly Configuration representing the completed 3D assembly.
 */
export interface AssemblyConfiguration {
  configurationId: string;
  name: string;
  rootPieceId: string;
  placements: Record<ID, AssemblyPlacement>;
  targetAngles: Record<ID, number>;
  generationStrategy: string;
  assemblySequence: string[];
  createdAt: string;
}

/**
 * Single placement validation record.
 */
export interface PlacementValidationResult {
  pieceId: ID;
  isValid: boolean;
  alignmentErrorMm: number;
  hasFiniteCoordinates: boolean;
  isUnitQuaternion: boolean;
  angleWithinLimits: boolean;
  issues: string[];
}

/**
 * Overall assembly validation report.
 */
export interface AssemblyValidationReport {
  isValid: boolean;
  totalPieces: number;
  placedPiecesCount: number;
  totalConnections: number;
  matedConnectionsCount: number;
  averageAlignmentErrorMm: number;
  maxAlignmentErrorMm: number;
  placementResults: Record<ID, PlacementValidationResult>;
  errors: string[];
  warnings: string[];
}

/**
 * Input request to the Automatic 3D Assembly Generator.
 */
export interface AutomaticAssemblyRequest {
  pieces: GeneratedPiece3D[];
  graph: PuzzleAssemblyGraph;
  connections: RetainedConnection3D[];
  desiredConfiguration?: DesiredAssemblyConfiguration;
}

/**
 * Complete, single 3D assembly output returned by Phase 87.
 */
export interface GeneratedAssembly3D {
  /** Formal assembly configuration containing piece poses and sequence. */
  assemblyConfiguration: AssemblyConfiguration;

  /** Formal versioned assembly state (stateId, pieces, activeConnections, collision/clearance). */
  assemblyState: AssemblyState;

  /** PieceTransforms mapping piece ID to rigid-body world transform. */
  pieceTransforms: PieceTransforms;

  /** ConnectionStates mapping connection ID to connection status and mating metrics. */
  connectionStates: ConnectionStates;

  /** Comprehensive placement and geometric validation report. */
  validation: AssemblyValidationReport;

  /** ID of the automatically selected root piece. */
  rootPieceId: string;

  /** Array of all placements in order of assembly. */
  allPlacements: AssemblyPlacement[];

  /** Assembly metadata. */
  metadata: {
    generatedAt: string;
    executionDurationMs: number;
    generatorVersion: string;
  };
}
