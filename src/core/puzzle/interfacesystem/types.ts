/**
 * Connection-Interface System Domain Types.
 *
 * CRITICAL DESIGN PRINCIPLE:
 * Connections are established between explicit, mathematically rigorous 3D interfaces
 * rather than simplistic directional assumptions (e.g. "piece A right -> piece B left").
 */
import type { ID, Vec2, Vec3 } from "@/core/model/types";
import type { AllowedAngleRange, AllowedDOF, CanonicalLocalFrame3D, InterfaceGenderRole } from "../canonical/types";

export type { InterfaceGenderRole, AllowedAngleRange };

/* ------------------------------------------------------------------ */
/* Connection Types & Gender Roles                                     */
/* ------------------------------------------------------------------ */

export type ConnectionType =
  | "tab_slot"
  | "interlock"
  | "edge_contact"
  | "hinge_like"
  | "slot"
  | "custom";

/* ------------------------------------------------------------------ */
/* Connection Profile                                                 */
/* ------------------------------------------------------------------ */

export interface ConnectionProfile {
  kind: string; // e.g. "rectangular_tab", "female_slot", "interlock_finger", "hinge_knuckle"
  width: number; // Feature width along tangent axis (mm)
  depth: number; // Feature depth along insertion axis (mm)
  height: number; // Feature height along binormal / thickness axis (mm)
  chamfer?: number; // Lead-in chamfer or radius (mm)
}

/* ------------------------------------------------------------------ */
/* Connection Compatibility Information                               */
/* ------------------------------------------------------------------ */

export interface ConnectionCompatibility {
  genderRole: InterfaceGenderRole;
  allowedTypes: ConnectionType[];
  compatibleGenderRoles: InterfaceGenderRole[];
  allowSameGenderOverride?: boolean;
  customRules?: string[];
}

/* ------------------------------------------------------------------ */
/* Kinematic Constraints & Non-Planar Mating Parameters              */
/* ------------------------------------------------------------------ */

export interface KinematicConstraints {
  /** 3D unit vector along insertion axis in interface local space. */
  insertionDirection: Vec3;
  /** Translation lock flags (x, y, z). True = locked. */
  translationConstraints: {
    tx: boolean;
    ty: boolean;
    tz: boolean;
  };
  /** Rotation lock flags (rx, ry, rz). True = locked. */
  rotationConstraints: {
    rx: boolean;
    ry: boolean;
    rz: boolean;
  };
  /** Allowed 3D joining angle range in degrees (e.g. 90deg corner, 0-180deg hinge). */
  allowedAngleRange: AllowedAngleRange;
  allowedDOF: AllowedDOF;
}

/* ------------------------------------------------------------------ */
/* Interface Geometry                                                 */
/* ------------------------------------------------------------------ */

export interface InterfaceGeometry2D {
  edgeIndex: number;
  parametricStart: number;
  parametricEnd: number;
  length: number;
}

/* ------------------------------------------------------------------ */
/* Top-Level Connection Interface Model                               */
/* ------------------------------------------------------------------ */

export interface ConnectionInterfaceSystem {
  id: ID;
  owningPieceId: ID;
  name: string;
  type: ConnectionType;
  /** Local 3D coordinate frame: origin, tangent, normal, binormal. */
  localFrame: CanonicalLocalFrame3D;
  /** 2D edge location along piece contour. */
  interfaceGeometry: InterfaceGeometry2D;
  /** Mating cross-section profile. */
  profile: ConnectionProfile;
  /** Compatibility allow-list & gender rules. */
  compatibility: ConnectionCompatibility;
  /** Mechanical fit tolerance (mm). */
  tolerance: number;
  /** Clearance offset along normal/insertion axis (mm). */
  clearance: number;
  /** 3D insertion direction unit vector in interface local space. */
  insertionDirection: Vec3;
  /** Kinematic constraints and allowed 3D angle range. */
  kinematicConstraints: KinematicConstraints;
  metadata?: Record<string, string | number | boolean>;
}

/* ------------------------------------------------------------------ */
/* Compatibility Result Report                                        */
/* ------------------------------------------------------------------ */

export interface CompatibilityResult {
  compatible: boolean;
  score: number; // 0.0 (incompatible) to 1.0 (perfect match)
  reasons: string[];
  warnings?: string[];
}
