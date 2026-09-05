/**
 * Automatic Joining-Angle Generation System Domain Types (Phase 88).
 *
 * Requirements:
 *  - For each connection determine possible valid joining angles based on:
 *      1. connector type
 *      2. interface frame
 *      3. piece geometry
 *      4. collision constraints
 *      5. clearance
 *      6. assembly constraints
 *  - Generates candidate angles (e.g. 0°, 15°, 30°, 45°, 60°, 90°, etc.).
 *  - Evaluates each candidate and removes angles causing:
 *      - collision
 *      - invalid connector alignment
 *      - insufficient clearance
 *      - impossible insertion
 *      - invalid geometry
 *  - Returns: ValidAngleCandidates.
 *  - Explicitly distinguishes:
 *      - mathematically possible
 *      - geometrically valid
 *      - physically assemblable
 *  - Strictly deterministic (no AI).
 */

import type { ID, Vec2, Vec3 } from "@/core/model/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import type { ConnectorType } from "../connectorgeneration/types";
import type { CanonicalInterface } from "../canonical/types";
import type { GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";

/**
 * Explicit categorization of why a candidate joining angle is rejected.
 */
export type AngleRejectionReason =
  | "collision"
  | "invalid_connector_alignment"
  | "insufficient_clearance"
  | "impossible_insertion"
  | "invalid_geometry";

/**
 * 3-Tier validity status for a candidate joining angle.
 */
export interface TierStatus {
  /** Tier 1: Satisfies connector type kinematics, rotation axis, and allowed angle limits. */
  mathematicallyPossible: boolean;
  /** Tier 2: Seated resting pose is collision-free with valid alignment and clearance >= min. */
  geometricallyValid: boolean;
  /** Tier 3: Linear or swept insertion approach trajectory is free of mechanical obstructions. */
  physicallyAssemblable: boolean;
}

/**
 * Evaluation record for a single candidate angle.
 */
export interface CandidateAngleEvaluation extends TierStatus {
  /** Joining angle in degrees (e.g. 0, 15, 30, 45, 60, 90). */
  angleDeg: number;

  /** True only if all 3 tiers are satisfied. */
  isValid: boolean;

  /** Failure reason if rejected (null if fully valid). */
  rejectionReason?: AngleRejectionReason;

  /** Detailed diagnostic message explaining the decision. */
  diagnosticMessage: string;

  /** Geometric measurements during evaluation. */
  metrics: {
    penetrationDepthMm: number;
    alignmentErrorMm: number;
    clearanceMm: number;
    insertionClearanceMm: number;
  };

  /** Resulting world-space rigid-body transform of Piece B relative to Piece A. */
  placementTransform?: RigidTransform3D;
}

/**
 * Information regarding a rejected candidate angle.
 */
export interface RejectedAngleInfo {
  angleDeg: number;
  reason: AngleRejectionReason;
  details: string;
}

/**
 * Primary output model for a single connection: ValidAngleCandidates.
 */
export interface ValidAngleCandidates {
  connectionId: string;
  pieceAId: string;
  pieceBId: string;
  connectorType: ConnectorType;

  /** All generated candidate angles evaluated across the 3 tiers. */
  allCandidates: CandidateAngleEvaluation[];

  /** Final filtered list of angles that are 100% valid (all 3 tiers satisfied). */
  validAngles: number[];

  /** Angles that satisfy Tier 1 (mathematically possible). */
  mathematicallyPossibleAngles: number[];

  /** Angles that satisfy Tier 2 (geometrically valid). */
  geometricallyValidAngles: number[];

  /** Angles that satisfy Tier 3 (physically assemblable). */
  physicallyAssemblableAngles: number[];

  /** Explicit list of rejected angles with defect reasons. */
  rejectedAngles: RejectedAngleInfo[];

  /** Highest-rated nominal or recommended joining angle. */
  recommendedAngle: number;
}

/**
 * Configuration options for candidate generation and validation.
 */
export interface AngleGenerationOptions {
  /** Angular step size in degrees for candidate generation (default: 15°). */
  angleStepDeg?: number;

  /** Custom candidate angles to evaluate (e.g. [0, 15, 30, 45, 60, 90]). */
  customCandidates?: number[];

  /** Minimum allowed angle in degrees (default: 0°). */
  minAngleDeg?: number;

  /** Maximum allowed angle in degrees (default: 180°). */
  maxAngleDeg?: number;

  /** Minimum required manufacturing clearance in mm (default: 0.1 mm). */
  minClearanceMm?: number;

  /** Insertion standoff distance in mm for sweep check (default: 20.0 mm). */
  insertionStandoffMm?: number;
}

/**
 * Request payload to evaluate angles on a connection.
 */
export interface AngleGenerationRequest {
  pieceA: GeneratedPiece3D | {
    pieceId: ID;
    dimensions: { width: number; height: number; thickness: number };
    localVertices?: Vec2[];
    interfaceFrame: CoordinateFrame3D;
  };
  pieceB: GeneratedPiece3D | {
    pieceId: ID;
    dimensions: { width: number; height: number; thickness: number };
    localVertices?: Vec2[];
    interfaceFrame: CoordinateFrame3D;
  };
  connection: RetainedConnection3D | {
    connectionId: string;
    connectorType: ConnectorType;
    clearanceMm?: number;
    allowedAngleDeg?: number;
    parameters?: Record<string, any>;
  };
  options?: AngleGenerationOptions;
}

/**
 * Puzzle-wide joining-angle evaluation result.
 */
export interface PuzzleJoiningAnglesResult {
  puzzleId?: string;
  connectionAngles: Record<string, ValidAngleCandidates>;
  totalConnectionsEvaluated: number;
  allConnectionsHaveValidAngle: boolean;
  executionDurationMs: number;
}
