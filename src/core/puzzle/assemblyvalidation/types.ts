/**
 * Complete Connector & Assembly Validation Subsystem Types (Phase 90).
 *
 * Implements full domain models for:
 *   - 9-point Connection Validation Pass
 *   - 8-point Assembly-Level Validation Pass
 *   - Granular Diagnostic Failure Reporting
 *   - Strict Binary Assembly Validation Report
 */

import type { ID, Vec3 } from "@/core/model/types";
import type { Quaternion } from "../geometry/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { ConvertedPuzzle3D, GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";

/**
 * Granular Failure Item identifying the exact entity, location, and reason.
 */
export interface ValidationFailureItem {
  /** Relevant piece ID (if applicable). */
  pieceId?: string;
  /** Relevant interface ID (if applicable). */
  interfaceId?: string;
  /** Relevant connection ID (if applicable). */
  connectionId?: string;
  /** 3D world position where the failure occurred. */
  position?: Vec3;
  /** Applied or evaluated joining angle (in degrees). */
  angleDeg?: number;
  /** Explicit failure description. */
  failureReason: string;
  /** Severity level. */
  severity: "error" | "warning";
  /** Categorization of the validation defect. */
  category:
    | "interface_pairing"
    | "connector_type"
    | "geometry"
    | "alignment"
    | "joining_angle"
    | "clearance"
    | "penetration"
    | "insertion"
    | "connection_state"
    | "missing_piece"
    | "collision"
    | "connectivity"
    | "mandatory_connection"
    | "transform"
    | "material"
    | "thickness";
}

/**
 * 9-Point Connection Validation Details.
 */
export interface ConnectionValidationDetail {
  connectionId: string;
  pieceAId: string;
  pieceBId: string;
  interfaceAId: string;
  interfaceBId: string;
  connectorType: string;
  isValid: boolean;

  // 1. Correct interface pairing (ports exist and have compatible roles/gender)
  interfacePairingValid: boolean;
  // 2. Correct connector type (consistent connector definitions)
  connectorTypeValid: boolean;
  // 3. Correct geometry (dimensions match: width, depth, lengths)
  geometryValid: boolean;
  // 4. Correct alignment (interface port origins coincide in 3D world space)
  alignmentValid: boolean;
  alignmentErrorMm: number;
  // 5. Valid joining angle (satisfies connector kinematic ranges)
  joiningAngleValid: boolean;
  appliedAngleDeg: number;
  // 6. Valid clearance (clearance >= minClearance)
  clearanceValid: boolean;
  clearanceMm: number;
  // 7. No unintended penetration (tabs seat properly without excess penetration)
  noUnintendedPenetration: boolean;
  penetrationDepthMm: number;
  // 8. Insertion feasibility (unobstructed linear insertion path)
  insertionFeasible: boolean;
  // 9. Final connection state
  finalConnectionState: "MATED" | "ENGAGED" | "DISENGAGED" | "FAILED";

  failureReasons: string[];
}

/**
 * Piece-Level Validation Details.
 */
export interface PieceValidationDetail {
  pieceId: string;
  isValid: boolean;
  hasValidTransform: boolean;
  position: Vec3;
  rotation: Quaternion;
  materialDimensionsValid: boolean;
  thicknessValid: boolean;
  thicknessMm: number;
  geometryValid: boolean;
  closedProfile: boolean;
  areaMm2: number;
  issues: string[];
}

/**
 * Configurable Validation Options.
 */
export interface AssemblyValidationOptions {
  /** Maximum allowable distance between interface origins in 3D world space (default: 0.5 mm). */
  maxAlignmentErrorMm?: number;
  /** Minimum allowable manufacturing clearance (default: 0.05 mm). */
  minClearanceMm?: number;
  /** Collision tolerance for 3D body interpenetration (default: 0.1 mm). */
  collisionToleranceMm?: number;
  /** Insertion approach standoff distance in mm (default: 20.0 mm). */
  insertionStandoffMm?: number;
  /** List of connection IDs that must be satisfied. If omitted, all connections are mandatory. */
  mandatoryConnectionIds?: string[];
  /** Allow partial assembly without failing (default: false - strictly required to fail partials). */
  allowPartial?: boolean;
}

/**
 * Structured Input for the Assembly Validation Pass.
 */
export interface AssemblyValidationInput {
  /** Complete 3D converted puzzle model. */
  puzzle: ConvertedPuzzle3D;
  /** Placed 3D rigid transforms for pieces. */
  pieceTransforms: Record<string, RigidTransform3D>;
  /** Optional custom applied joining angles per connection ID. */
  appliedAngles?: Record<string, number>;
  /** Optional options override. */
  options?: AssemblyValidationOptions;
}

/**
 * Complete Connector & Assembly Validation Report (Phase 90).
 */
export interface AssemblyValidationReport {
  /** Master binary result: STRICTLY FALSE if any mandatory validation fails. */
  isValid: boolean;

  // Assembly Level Verification Status
  totalPieces: number;
  placedPiecesCount: number;
  allPiecesIncluded: boolean;
  noUnintendedCollisions: boolean;
  noDisconnectedPieces: boolean;
  allMandatoryConnectionsSatisfied: boolean;
  validTransforms: boolean;
  validMaterialDimensions: boolean;
  validThickness: boolean;
  validGeometry: boolean;

  // Connection Level Verification Status
  totalConnections: number;
  validConnectionsCount: number;

  // Granular Diagnostics
  failures: ValidationFailureItem[];
  failureCount?: number;
  assemblyLevelValidation?: {
    allPiecesIncluded: boolean;
    noUnintendedCollisions: boolean;
    noDisconnectedPieces: boolean;
    allMandatoryConnectionsSatisfied: boolean;
    validTransforms: boolean;
    validMaterialDimensions: boolean;
    validThickness: boolean;
    validGeometry: boolean;
  };
  connectionDetails: Record<string, ConnectionValidationDetail>;
  pieceDetails: Record<string, PieceValidationDetail>;

  summary: {
    errorCount: number;
    warningCount: number;
    message: string;
    executionDurationMs: number;
  };
}
