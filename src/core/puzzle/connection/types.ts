/**
 * Connection Domain Models & Advanced 3D Kinematics (Phase 65 Upgrade).
 *
 * CRITICAL REQUIREMENTS:
 *  - Never assume planar horizontal/vertical connections.
 *  - Support arbitrary 3D spatial coordinate frames and non-planar joining angles.
 *  - The connection model remains strictly independent from final assembly configuration.
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";

/**
 * Physical connection behaviors defining kinematic degrees of freedom and constraints.
 */
export type ConnectionBehavior =
  | "FIXED"        // 0 DOF: translation and rotation fully locked
  | "HINGE"        // 1 rotational DOF along a defined hinge axis, bounded by angle limits
  | "SLIDING"      // 1 translational DOF along slide vector
  | "ROTATIONAL"   // Multi-axis / spherical rotational DOF
  | "INTERLOCK"    // Multi-stage keyed insertion followed by drop/slide into locking detent
  | "SNAP"         // Elastic cantilever deflection during insertion, irreversible detent locking
  | "CUSTOM";      // Configurable kinematics and parametric constraints

/**
 * Assembly lifecycle state of an individual connection.
 */
export type AssemblyLifecycleState =
  | "UNASSEMBLED"
  | "ENGAGING"
  | "ENGAGED"
  | "LOCKED"
  | "DEFECTIVE";

/**
 * 3D Contact patch or region between mated interfaces.
 */
export interface ContactRegion3D {
  regionId: string;
  surfaceNormal: Vec3;
  contactAreaMm2: number;
  bounds: {
    min: Vec3;
    max: Vec3;
  };
  contactType:
    | "face_to_face"
    | "edge_to_face"
    | "tab_shoulder"
    | "detent_bearing"
    | "miter_face";
}

/**
 * Explicit 3D angular limits.
 */
export interface AngleLimits3D {
  minAngleDeg: number;
  maxAngleDeg: number;
  nominalAngleDeg: number;
}

/**
 * Real-time state of the connection during assembly execution.
 */
export interface AssemblyState3D {
  lifecycle: AssemblyLifecycleState;
  /** Insertion progress: 0.0 (initial contact) to 1.0 (fully seated). */
  progress: number;
  currentAngleDeg: number;
  currentDisplacementMm: Vec3;
  actualClearanceMm: number;
  isLocked: boolean;
}

/**
 * Advanced 3D Connection Model.
 * Formulates the complete kinematic, geometric, and assembly parameters between two interfaces.
 */
export interface Advanced3DConnection {
  id: ID;
  name?: string;

  /** Interface A (inserting / source port reference). */
  interfaceA: {
    interfaceId: ID;
    pieceId?: ID;
    name?: string;
  };

  /** Interface B (receiving / target port reference). */
  interfaceB: {
    interfaceId: ID;
    pieceId?: ID;
    name?: string;
  };

  /** Specific joint mechanism (e.g. "tab_slot", "finger_joint", "dovetail", "miter"). */
  connectionType: string;

  /** Mechanical behavior and kinematic classification. */
  behavior: ConnectionBehavior;

  /** Local coordinate frames for both interfaces. */
  localFrames: {
    frameA: CoordinateFrame3D;
    frameB: CoordinateFrame3D;
  };

  /**
   * Relative 3D transformation T_{A -> B} mapping Interface A frame to Interface B frame.
   * Independent of world coordinate placement.
   */
  relativeTransformation: RigidTransform3D;

  /** Allowed rotational unit axes in connection-local coordinates (empty for FIXED/SLIDING). */
  allowedRotationAxes: Vec3[];

  /** Allowed translational unit axes in connection-local coordinates (empty for FIXED/HINGE). */
  allowedTranslationAxes: Vec3[];

  /** Bounded angular range. */
  angleLimits: AngleLimits3D;

  /** Approach / insertion unit vector along which Interface A engages into Interface B. */
  insertionDirection: Vec3;

  /** Nominal clearance along mating normal/contact surfaces (mm). */
  clearance: number;

  /** Acceptable manufacturing/positional tolerance envelope (mm). */
  tolerance: number;

  /** Defined contact surface patches between the interfaces. */
  contactRegions: ContactRegion3D[];

  /** Current engagement state during assembly. */
  assemblyState: AssemblyState3D;

  metadata?: Record<string, string | number | boolean>;
}

/* ------------------------------------------------------------------ */
/* Backward-Compatibility Types (Phases 01–64 compatibility)          */
/* ------------------------------------------------------------------ */

export type PuzzleConnectionStatus = "valid" | "invalid" | "warning" | "unverified";

export interface PuzzleConnection {
  id: ID;
  /** Source piece ID. */
  sourcePieceId: ID;
  /** Source interface ID. */
  sourceInterfaceId: ID;
  /** Target piece ID. */
  targetPieceId: ID;
  /** Target interface ID. */
  targetInterfaceId: ID;
  /**
   * Arbitrary 3D joining angle in degrees (0 to 360).
   * E.g. 90.0 = right angle corner, 180.0 = coplanar extension, 45.0 = mitered roof joint.
   */
  joiningAngleDeg: number;
  /** Optional roll/twist angle around the mating normal in degrees (default 0). */
  rollAngleDeg?: number;
  /** Fit clearance / offset along normal (mm). */
  clearance: number;
  /** Connection validation status. */
  status: PuzzleConnectionStatus;
  /** Diagnostic error/warning message if status is invalid/warning. */
  reason?: string;

  /** Optional link to full advanced 3D connection model. */
  advancedModel?: Advanced3DConnection;
}
