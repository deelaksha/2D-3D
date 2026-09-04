/**
 * Assembly-Feasibility Validation Subsystem Types (Phase 68).
 *
 * Defines data structures for deterministic assembly path evaluation,
 * 6 motion-planning failure reason categories, and structured feasibility results.
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import type { Advanced3DConnection } from "../connection/types";

/**
 * The 6 failure reason categories detected by the motion planner.
 */
export type FailureReasonCode =
  | "COLLISION_DURING_MOVEMENT"
  | "IMPOSSIBLE_INSERTION_DIRECTION"
  | "BLOCKED_CONNECTION"
  | "IMPOSSIBLE_ROTATION"
  | "INTERFERENCE_FROM_ASSEMBLED_PIECES"
  | "INVALID_FINAL_CONFIGURATION";

/**
 * Granular diagnostics for an assembly failure.
 */
export interface AssemblyFailureReason {
  code: FailureReasonCode;
  message: string;
  pieceId?: ID;
  conflictingPieceId?: ID;
  connectionId?: ID;
  stepIndex?: number;
  waypointIndex?: number;
  penetrationDepthMm?: number;
  location?: Vec3;
}

/**
 * Single step in the continuous motion path of a piece.
 */
export interface AssemblyPathStep {
  stepIndex: number;
  pieceId: ID;
  actionType: "APPROACH" | "INSERT" | "ROTATE" | "LOCK";
  startTransform: RigidTransform3D;
  targetTransform: RigidTransform3D;
  /** Discretized 3D trajectory waypoints from start to target pose. */
  waypoints: RigidTransform3D[];
  /** Travel distance in mm. */
  travelDistanceMm: number;
  /** Rotation angle swept in degrees. */
  sweptRotationDeg: number;
  /** Minimum clearance margin observed during motion (mm). */
  clearanceMarginMm: number;
}

/**
 * Complete continuous assembly path from staging to final configuration.
 */
export interface AssemblyPath {
  pathId: ID;
  isFeasible: boolean;
  steps: AssemblyPathStep[];
  totalLengthMm: number;
  totalRotationDeg: number;
  collisionFree: boolean;
  assembledPieceOrder: ID[];
}

/**
 * Piece geometry model for spatial feasibility checking.
 */
export interface FeasibilityPieceGeometry {
  pieceId: ID;
  name?: string;
  dimensions: {
    width: number;
    height: number;
    thickness: number;
  };
  /** Local coordinate frame for mating interface. */
  interfaceFrames?: Record<ID, CoordinateFrame3D>;
}

/**
 * Configuration options for the baseline motion planner.
 */
export interface MotionPlanningOptions {
  /** Initial standoff distance along insertion vector before final seating (default 30mm). */
  standoffDistanceMm?: number;
  /** Number of discrete interpolation waypoints along each motion segment (default 10). */
  interpolationSteps?: number;
  /** Minimum allowable clearance before flagging a collision (default 0.05mm). */
  collisionToleranceMm?: number;
  /** Allowable intentional joint overlap threshold (mm³). */
  jointVolumeThresholdMm3?: number;
}

/**
 * Query submitted to the Assembly Feasibility Validation Subsystem.
 */
export interface AssemblyFeasibilityQuery {
  pieces: FeasibilityPieceGeometry[];
  /** Target final resting poses of all pieces in the assembly. */
  targetConfiguration: Record<ID, RigidTransform3D>;
  /** Optional initial staging poses of pieces (e.g. laid flat on table). */
  initialConfiguration?: Record<ID, RigidTransform3D>;
  /** Connection constraints linking interfaces. */
  connections: Advanced3DConnection[];
  /** Optional prescribed order of assembly (if not provided, solver determines sequence). */
  prescribedOrder?: ID[];
  options?: MotionPlanningOptions;
}

/**
 * Comprehensive structured result returned by the validator.
 */
export interface AssemblyFeasibilityResult {
  isFeasible: boolean;
  status: "FEASIBLE" | "INFEASIBLE";
  path?: AssemblyPath;
  failureReasons: AssemblyFailureReason[];
  assembledPieces: ID[];
  remainingPieces: ID[];
  diagnostics: string[];
}
