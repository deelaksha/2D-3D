/**
 * Canonical Internal Data Representation for Parametric 2D-to-3D Puzzle Assembly System.
 *
 * CRITICAL DESIGN REQUIREMENT:
 * Spatial concepts NEVER encode directional assumptions like "horizontal piece",
 * "vertical piece", "left piece", or "right piece". All spatial configurations are
 * defined strictly through geometric frames, connection interfaces, 3D rigid
 * transformations, and mathematical constraints.
 */
import type { Bounds, ID, Shape, Vec2, Vec3 } from "@/core/model/types";
import type { Quaternion, Transform3D } from "../geometry/types";
import type { CardboardSpecification } from "../domain/types";

export const CANONICAL_SCHEMA_VERSION = 2;

/* ------------------------------------------------------------------ */
/* Global & Local Coordinate Frames                                    */
/* ------------------------------------------------------------------ */

export interface CanonicalLocalFrame3D {
  /** Local origin point in piece coordinate space (mm). */
  origin: Vec3;
  /** Primary along-edge tangent vector (unit vector). */
  tangent: Vec3;
  /** Outward surface normal vector (unit vector). */
  normal: Vec3;
  /** Perpendicular binormal vector (cross product of tangent and normal). */
  binormal: Vec3;
}

/* ------------------------------------------------------------------ */
/* Allowed Degrees of Freedom (DOF)                                   */
/* ------------------------------------------------------------------ */

export interface AllowedDOF {
  /** Translation freedom along local frame axes. */
  translation: {
    x: boolean;
    y: boolean;
    z: boolean;
  };
  /** Rotation freedom around local frame axes. */
  rotation: {
    rx: boolean;
    ry: boolean;
    rz: boolean;
  };
}

/* ------------------------------------------------------------------ */
/* Piece Dimensions & Manufacturing Parameters                        */
/* ------------------------------------------------------------------ */

export interface PieceDimensions {
  width: number; // mm
  height: number; // mm
  depth: number; // mm (footprint thickness or bounding depth)
}

export interface ManufacturingParameters {
  /** Laser/saw kerf compensation offset (mm). */
  kerf: number;
  /** Material grain/flute angle in piece local plane (degrees). */
  grainAngleDeg: number;
  /** Minimum router cutter radius for inside corners (mm). */
  cutterRadius?: number;
  /** Custom manufacturing key-value parameters. */
  customParams?: Record<string, number | string | boolean>;
}

/* ------------------------------------------------------------------ */
/* 2D Geometry Reference                                              */
/* ------------------------------------------------------------------ */

export interface GeometryReference {
  /** Primary contour shape in piece-local space. */
  contour: Shape;
  /** Secondary cutout or modification shapes. */
  modifiers?: Shape[];
  /** Cached 2D local bounding box. */
  bounds?: Bounds;
}

/* ------------------------------------------------------------------ */
/* Piece Model (Orientation-Neutral Template)                         */
/* ------------------------------------------------------------------ */

export interface CanonicalPiece {
  /** Unique piece identifier. */
  id: ID;
  /** Human-readable piece label. */
  name: string;
  /** Reference to 2D geometry contour and modifiers. */
  geometryRef: GeometryReference;
  /** Nominal 2D footprint dimensions (mm). */
  dimensions: PieceDimensions;
  /** Stock material thickness (mm). */
  thickness: number;
  /** Material specification ID. */
  materialId: ID;
  /** Array of connection interface IDs belonging to this piece. */
  interfaceIds: ID[];
  /** Piece-local coordinate frame relative to piece origin. */
  localFrame: CanonicalLocalFrame3D;
  /** Fabrication & manufacturing parameters. */
  manufacturingParameters: ManufacturingParameters;
  /** Optional parameter overrides if piece dimensions are parameterized. */
  parameterOverrides?: Record<string, number>;
  color?: string;
  metadata?: Record<string, string | number | boolean>;
}

/* ------------------------------------------------------------------ */
/* Connection Interface (Port along Edge)                              */
/* ------------------------------------------------------------------ */

export type CanonicalInterfaceType =
  | "slot"
  | "tab"
  | "finger"
  | "dovetail"
  | "miter"
  | "butt"
  | "custom";

export type InterfaceGenderRole = "insert" | "receiver" | "neutral" | "custom";

export interface InterfaceEdgeGeometry {
  /** Edge segment designation or index. */
  edgeIndex: number;
  /** Parametric range along edge contour [0.0, 1.0]. */
  parametricStart: number;
  parametricEnd: number;
  /** Arc length along the edge (mm). */
  length: number;
}

export interface InterfaceProfile {
  profileKind: string;
  width: number; // Feature width (mm)
  depth: number; // Feature depth / penetration (mm)
  clearance: number; // Dedicated feature clearance (mm)
}

export interface InterfaceCompatibilityInfo {
  allowedTypes: CanonicalInterfaceType[];
  genderRole: InterfaceGenderRole;
  complementaryPatterns: string[];
}

export interface CanonicalInterface {
  id: ID;
  /** ID of the owning piece template. */
  owningPieceId: ID;
  name: string;
  /** Geometry segment location along piece edge. */
  edgeGeometry: InterfaceEdgeGeometry;
  /** Interface joint type. */
  interfaceType: CanonicalInterfaceType;
  /** Cross-section profile dimensions. */
  profile: InterfaceProfile;
  /** Compatibility allow-list & gender role. */
  compatibility: InterfaceCompatibilityInfo;
  /** Local 3D coordinate frame anchored at the interface center. */
  localFrame: CanonicalLocalFrame3D;
  /** Fit tolerance (mm) for mechanical mating. */
  tolerance: number;
  /** Allowed degrees of freedom when mated. */
  allowedDOF: AllowedDOF;
  metadata?: Record<string, string | number | boolean>;
}

/* ------------------------------------------------------------------ */
/* Connection (Mating Relationship)                                   */
/* ------------------------------------------------------------------ */

export type CanonicalConnectionType =
  | "rigid"
  | "revolute_hinge"
  | "prismatic_sliding"
  | "miter_corner"
  | "butt_joint"
  | "custom";

export interface AllowedAngleRange {
  /** Minimum permitted 3D joining angle in degrees (0..360). */
  minAngleDeg: number;
  /** Maximum permitted 3D joining angle in degrees (0..360). */
  maxAngleDeg: number;
  /** Nominal/target joining angle in degrees. */
  targetAngleDeg: number;
}

export interface AllowedRelativeTransform {
  /** Target relative translation offset from interface A frame (mm). */
  positionOffset: Vec3;
  /** Target relative rotation quaternion from interface A frame. */
  rotationQuaternion: Quaternion;
}

export interface ConnectionCompatibilityRules {
  requireMatchingProfileWidth: boolean;
  maxToleranceDiff: number;
  customRules?: string[];
}

export interface CanonicalConnection {
  id: ID;
  name?: string;
  /** Interface A (source port ID). */
  interfaceAId: ID;
  /** Interface B (target port ID). */
  interfaceBId: ID;
  /** Mechanical joint connection type. */
  connectionType: CanonicalConnectionType;
  /** Explicit compatibility rule parameters. */
  compatibilityRules: ConnectionCompatibilityRules;
  /** Target relative 3D transform between interface frames. */
  allowedRelativeTransform: AllowedRelativeTransform;
  /** Allowed 3D joining angle range (\theta \in [\text{min}, \text{max}]). */
  allowedAngleRange: AllowedAngleRange;
  /** Fit clearance distance along normal (mm). */
  clearance: number;
  /** Connection-specific assembly constraint IDs. */
  constraintIds: ID[];
  metadata?: Record<string, string | number | boolean>;
}

/* ------------------------------------------------------------------ */
/* Canonical Constraint                                               */
/* ------------------------------------------------------------------ */

export type CanonicalConstraintType =
  | "fixedAngle"
  | "angleRange"
  | "coplanar"
  | "perpendicular"
  | "fixedDistance"
  | "nonInterpenetration";

export interface CanonicalConstraint {
  id: ID;
  type: CanonicalConstraintType;
  targetPieceIds: ID[];
  targetInterfaceIds?: ID[];
  targetValue?: number;
  minValue?: number;
  maxValue?: number;
  label?: string;
}

/* ------------------------------------------------------------------ */
/* Assembly Sequence & Configuration                                   */
/* ------------------------------------------------------------------ */

export type ConnectionStateStatus = "connected" | "disconnected" | "misaligned" | "interfering";

export interface CanonicalConnectionState {
  connectionId: ID;
  status: ConnectionStateStatus;
  actualJoiningAngleDeg: number;
  alignmentErrorMm: number;
  reason?: string;
}

export interface AssemblyStep {
  stepIndex: number;
  pieceId: ID;
  installedConnectionIds: ID[];
  instructionNotes?: string;
}

export interface CanonicalAssemblyConfiguration {
  id: ID;
  name: string;
  /** Global 3D placement transform (position & rotation) for each piece ID. */
  pieceTransforms: Record<ID, Transform3D>;
  /** Global assembly root position in world space (mm). */
  position: Vec3;
  /** Global assembly root rotation in world space. */
  rotation: Quaternion;
  /** Per-connection runtime state. */
  connectionStates: Record<ID, CanonicalConnectionState>;
  /** Ordered step-by-step assembly sequence. */
  assemblySequence: AssemblyStep[];
  /** Assembly validation state report. */
  validationState: CanonicalValidationReport;
}

/* ------------------------------------------------------------------ */
/* Validation Results                                                 */
/* ------------------------------------------------------------------ */

export type CanonicalIssueSeverity = "ok" | "warning" | "error";

export interface CanonicalValidationIssue {
  severity: CanonicalIssueSeverity;
  code: string;
  message: string;
  refIds?: ID[];
}

export interface CanonicalValidationReport {
  overallSeverity: CanonicalIssueSeverity;
  issues: CanonicalValidationIssue[];
  validatedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Global Parameter Definitions                                       */
/* ------------------------------------------------------------------ */

export interface GlobalParameter {
  id: ID;
  name: string;
  value: number;
  defaultValue: number;
  minValue?: number;
  maxValue?: number;
  unit?: string;
  description?: string;
}

/* ------------------------------------------------------------------ */
/* Top-Level Canonical Puzzle Project Model                           */
/* ------------------------------------------------------------------ */

export interface CanonicalPuzzleMetadata {
  id: ID;
  name: string;
  schemaVersion: number;
  createdAt?: string;
  updatedAt?: string;
  author?: string;
  description?: string;
  displayUnit: "mm" | "cm" | "inch";
}

export interface CanonicalPuzzle {
  metadata: CanonicalPuzzleMetadata;
  materialSpecification: CardboardSpecification[];
  globalParameters: Record<string, GlobalParameter>;
  pieces: CanonicalPiece[];
  interfaces: CanonicalInterface[];
  connections: CanonicalConnection[];
  constraints: CanonicalConstraint[];
  assemblyConfigurations: CanonicalAssemblyConfiguration[];
  validationResults: CanonicalValidationReport;
}
