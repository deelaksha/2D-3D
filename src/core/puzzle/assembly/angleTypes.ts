/**
 * Multi-Angle 3D Assembly Solver Types (Phase 67).
 *
 * Provides data structures for continuous angle ranges, discrete angle sets,
 * axis-constrained rotations, and 3-tier validity evaluation:
 *   - THEORETICALLY ALLOWED
 *   - GEOMETRICALLY VALID
 *   - PHYSICALLY ASSEMBLABLE
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import type { Advanced3DConnection } from "../connection/types";

/**
 * Specification of allowed joining angles on a connection.
 */
export type AngleSpecificationKind = "continuous_range" | "discrete_set" | "fixed";

export interface ContinuousAngleRange {
  kind: "continuous_range";
  minAngleDeg: number;
  maxAngleDeg: number;
  nominalAngleDeg: number;
  /** Permitted angular deviation tolerance in degrees (default 0.5°). */
  toleranceDeg?: number;
}

export interface DiscreteAngleSet {
  kind: "discrete_set";
  allowedAnglesDeg: number[];
  nominalAngleDeg: number;
  /** Permitted angular deviation tolerance in degrees (default 0.5°). */
  toleranceDeg?: number;
}

export interface FixedAngle {
  kind: "fixed";
  nominalAngleDeg: number;
  toleranceDeg?: number;
}

export type AngleSpecification = ContinuousAngleRange | DiscreteAngleSet | FixedAngle;

/**
 * Overall classification of candidate joining angle.
 */
export type AngleOverallStatus =
  | "FULLY_VALID"
  | "BLOCKED_ASSEMBLY_PATH"
  | "GEOMETRIC_SELF_COLLISION"
  | "THEORETICALLY_DISALLOWED";

/**
 * Piece geometry definition for multi-angle collision and sweep analysis.
 */
export interface SolvableAssemblyPiece {
  pieceId: ID;
  name?: string;
  dimensions: {
    width: number;
    height: number;
    thickness: number;
  };
  /** Local 2D boundary contour vertices in piece plane (z=0). */
  localBoundary2D?: Array<{ x: number; y: number }>;
  /** Interface coordinate frame in piece-local space. */
  interfaceFrame: CoordinateFrame3D;
  /** Base world transform of Piece A if already placed in assembly space. */
  worldTransform?: RigidTransform3D;
}

/**
 * Query submitted to the Multi-Angle Assembly Solver.
 */
export interface MultiAngleQuery {
  pieceA: SolvableAssemblyPiece;
  pieceB: SolvableAssemblyPiece;
  connection: Advanced3DConnection;
  /** Candidate joining angle in degrees. */
  desiredAngleDeg: number;
  /** Optional roll angle in degrees (default 0.0). */
  rollAngleDeg?: number;
  /** Optional specific rotation axis (defaults to connection's primary rotation axis or binormal). */
  rotationAxis?: Vec3;
  /** Overriding angle specification (if not using connection.angleLimits). */
  angleSpecification?: AngleSpecification;
  /** Assembly insertion path standoff distance in mm (default 25mm). */
  insertionStandoffMm?: number;
  /** Discretization steps for insertion sweep simulation (default 10). */
  sweepSampleSteps?: number;
}

/**
 * Granular 3-tier evaluation details.
 */
export interface TheoreticalAngleDetails {
  isAllowed: boolean;
  matchedSpecification: AngleSpecificationKind;
  allowedRange?: [number, number];
  discreteSet?: number[];
  rotationAxisUsed: Vec3;
  reason?: string;
}

export interface GeometricAngleDetails {
  isValid: boolean;
  hasBodyCollision: boolean;
  penetrationDepthMm: number;
  contactAreaMm2: number;
  reason?: string;
}

export interface PhysicalAngleDetails {
  isAssemblable: boolean;
  isInsertionClear: boolean;
  sweptInterferenceDepthMm: number;
  blockingStandoffMm?: number;
  reason?: string;
}

/**
 * Complete structured result returned by the MultiAngleAssemblySolver.
 */
export interface AngleEvaluationResult {
  desiredAngleDeg: number;
  rotationAxis: Vec3;
  rollAngleDeg: number;

  /** TIER 1: Satisfies kinematic angle limits and behavior constraints. */
  isTheoreticallyAllowed: boolean;

  /** TIER 2: Seated pose is collision-free outside registered joint area. */
  isGeometricallyValid: boolean;

  /** TIER 3: Sweep path along insertion vector is clear of mechanical obstructions. */
  isPhysicallyAssemblable: boolean;

  overallStatus: AngleOverallStatus;

  theoreticalDetails: TheoreticalAngleDetails;
  geometricDetails: GeometricAngleDetails;
  physicalDetails: PhysicalAngleDetails;

  /** Resulting 3D world placement transform of Piece B if geometrically valid. */
  resultingPlacement?: RigidTransform3D;

  diagnostics: string[];
}
