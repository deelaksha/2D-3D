/**
 * Formal 3D Assembly State & Transition Representation Types (Phase 66).
 *
 * Provides complete, immutable, versioned representations of puzzle assemblies,
 * kinematic degrees of freedom, contact states, active/inactive connections,
 * collision/clearance states, and transition histories.
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { Advanced3DConnection, ContactRegion3D } from "../connection/types";

/** Piece state in the assembly context. */
export interface AssemblyPieceState {
  pieceId: ID;
  name: string;
  dimensions: {
    width: number;
    height: number;
    thickness: number;
  };
  interfaceIds: ID[];
  isPlaced: boolean;
}

/** Contact state between mated surfaces. */
export interface ContactState3D {
  contactId: ID;
  pieceAId: ID;
  pieceBId: ID;
  interfaceAId: ID;
  interfaceBId: ID;
  contactType: ContactRegion3D["contactType"];
  surfaceNormal: Vec3;
  contactAreaMm2: number;
  /** Distance between surfaces (negative = penetration/interference, positive = clearance). */
  separationMm: number;
  isActive: boolean;
}

/** Kinematic degrees of freedom remaining for a piece. */
export interface PieceDOF {
  pieceId: ID;
  translationalDOF: number; // 0 to 3
  rotationalDOF: number;    // 0 to 3
  allowedTranslationAxes: Vec3[];
  allowedRotationAxes: Vec3[];
  isFullyConstrained: boolean;
}

/** Assembly collision detection state. */
export interface AssemblyCollisionState {
  hasCollision: boolean;
  collidingPairs: Array<[ID, ID]>;
  minimumDistanceMm: number;
  diagnostics: string[];
}

/** Assembly clearance verification state. */
export interface AssemblyClearanceState {
  nominalClearanceMm: number;
  minObservedClearanceMm: number;
  maxObservedClearanceMm: number;
  isWithinTolerance: boolean;
  clearanceViolations: string[];
}

/** Single step in the ordered assembly sequence. */
export interface AssemblySequenceStep {
  stepNumber: number;
  action: "INSERT_PIECE" | "ROTATE_PIECE" | "TRANSLATE_PIECE" | "ACTIVATE_CONNECTION" | "DEACTIVATE_CONNECTION";
  targetPieceId?: ID;
  connectionId?: ID;
  description: string;
  timestamp: number;
}

/** Assembly spatial constraint status. */
export interface AssemblyConstraintState {
  constraintId: ID;
  type: "coplanar" | "perpendicular" | "angle" | "distance" | "nonInterpenetration";
  targetPieceIds: ID[];
  isSatisfied: boolean;
  deviation: number;
  description?: string;
}

/**
 * Complete, formal 3D Assembly State at a specific step in time.
 * Designed to be immutable; any operation returns a new versioned state.
 */
export interface AssemblyState {
  readonly stateId: ID;
  readonly version: number;
  readonly timestamp: number;

  /** All pieces in the puzzle (placed or unplaced). */
  readonly pieces: readonly AssemblyPieceState[];

  /** 3D spatial transforms per piece in world space. */
  readonly pieceTransforms: Readonly<Record<ID, RigidTransform3D>>;

  /** Active (mated / engaged) connections. */
  readonly activeConnections: readonly Advanced3DConnection[];

  /** Inactive (unmated / potential) connections. */
  readonly inactiveConnections: readonly Advanced3DConnection[];

  /** Physical contact states between pieces. */
  readonly contactStates: readonly ContactState3D[];

  /** Complete ordered assembly sequence leading to this state. */
  readonly assemblySequence: readonly AssemblySequenceStep[];

  /** Kinematic degrees of freedom per piece. */
  readonly degreesOfFreedom: Readonly<Record<ID, PieceDOF>>;

  /** Active assembly constraints. */
  readonly constraints: readonly AssemblyConstraintState[];

  /** Collision evaluation state. */
  readonly collisionState: AssemblyCollisionState;

  /** Clearance evaluation state. */
  readonly clearanceState: AssemblyClearanceState;

  /** Whether the assembly is fully locked and rigid. */
  readonly isLocked: boolean;
}

/**
 * Transition operation that moves an assembly from State A to State B.
 */
export interface AssemblyTransition {
  readonly transitionId: ID;
  readonly fromStateId: ID;
  readonly toStateId: ID;
  readonly type:
    | "INSERT_PIECE"
    | "ROTATE_PIECE"
    | "TRANSLATE_PIECE"
    | "ACTIVATE_CONNECTION"
    | "DEACTIVATE_CONNECTION";
  readonly params: {
    pieceId?: ID;
    initialTransform?: RigidTransform3D;
    rotationAxis?: Vec3;
    rotationAngleDeg?: number;
    translationVector?: Vec3;
    connectionId?: ID;
  };
  readonly timestamp: number;
  readonly success: boolean;
  readonly message: string;
}

/**
 * Immutable snapshot with cryptographic checksum.
 */
export interface AssemblySnapshot {
  readonly snapshotId: ID;
  readonly stepIndex: number;
  readonly state: AssemblyState;
  readonly checksum: string;
  readonly label: string;
  readonly createdAt: number;
}
