/**
 * Automatic Connector Generation Engine Domain Types (Phase 83).
 *
 * Requirements:
 *  - Supports 7 connector types: tab-slot, notch, interlock, keyed, hinge, rotational, custom.
 *  - Fully parametric calculation of widths, depths, position, clearances.
 *  - Non-coplanar 3D joining support (180°, 90°, 45°, dynamic angle ranges).
 *  - Explicit outputs: Interface A, Interface B, Connector geometry, parameters,
 *    compatibility rules, clearance, allowed angle range, assembly constraints.
 *  - Strict deterministic validation (no AI).
 */

import type { ID, Shape, Vec2, Vec3 } from "@/core/model/types";
import type { CanonicalInterface } from "../canonical/types";
import type { Advanced3DConnection } from "../connection/types";

export type ConnectorType =
  | "tab_slot"
  | "notch"
  | "interlock"
  | "keyed"
  | "hinge"
  | "rotational"
  | "custom";

export interface ConnectorPieceInput {
  id: ID;
  name?: string;
  thicknessMm: number;
  materialId?: ID;
  edgeLengthMm?: number;
}

export interface SharedInterfaceInput {
  contactCenter: Vec2;
  contactNormal: Vec2; // Outward from Piece A toward Piece B
  contactTangent?: Vec2;
  edgeLengthMm: number;
  preferredType?: ConnectorType;
  /** Nominal joining angle in degrees (e.g. 180 for planar, 90 for perpendicular). */
  targetJoiningAngleDeg?: number;
  clearanceOverrideMm?: number;
  customParameters?: Record<string, any>;
}

export interface ConnectorGenerationRequest {
  pieceA: ConnectorPieceInput;
  pieceB: ConnectorPieceInput;
  interface: SharedInterfaceInput;
}

export interface ConnectorParameters {
  tabWidth: number;
  tabDepth: number;
  slotWidth: number;
  slotDepth: number;
  position: Vec2;
  clearance: number;
  materialThickness: number;
  joiningAngleDeg: number;
  extraParams: Record<string, any>;
}

export interface ConnectorGeometry {
  /** 2D plug contour on Piece A (male protrusion). */
  plugShape: Shape;
  /** 2D socket cutout contour on Piece B (female receiver cavity). */
  socketShape: Shape;
  plugOutline: Vec2[];
  socketOutline: Vec2[];
}

export interface CompatibilityRules {
  allowedTypes: string[];
  genderPair: {
    roleA: "insert" | "receiver";
    roleB: "insert" | "receiver";
  };
  materialCompatible: boolean;
  notes: string[];
}

export interface AllowedAngleRange {
  nominalAngleDeg: number;
  minAngleDeg: number;
  maxAngleDeg: number;
  rotationAxis: Vec3;
}

export interface AssemblyConstraints {
  insertionDirection: Vec3;
  allowedDOF: {
    translation: { x: boolean; y: boolean; z: boolean };
    rotation: { rx: boolean; ry: boolean; rz: boolean };
  };
  lockingMechanism: "friction" | "detent" | "keyed" | "gravity";
  reversible: boolean;
}

export interface GeneratedConnectorPair {
  connectionId: string;
  type: ConnectorType;
  interfaceA: CanonicalInterface;
  interfaceB: CanonicalInterface;
  geometry: ConnectorGeometry;
  parameters: ConnectorParameters;
  compatibility: CompatibilityRules;
  clearance: number;
  allowedAngleRange: AllowedAngleRange;
  assemblyConstraints: AssemblyConstraints;
  advancedConnection: Advanced3DConnection;
}

export interface ConnectorValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    complementarityValid: boolean;
    clearanceValid: boolean;
    physicalProportionsValid: boolean;
    angleRangeValid: boolean;
    dofConsistent: boolean;
  };
}
