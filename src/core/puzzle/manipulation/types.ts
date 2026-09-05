/**
 * Connection Angle Inspection & Live Manipulation Domain Types (Phase 95).
 *
 * Implements domain models for:
 *  - Connection angle inspection (IDs, connector types, current angle, allowed ranges)
 *  - Kinematic recalculation of affected pieces
 *  - Live collision & connection validation
 *  - Diagnostic failure and warning reporting
 *  - Geometry immutability guarantee
 */

import type { RigidTransform3D } from "../framesystem/types";
import type { ConvertedPuzzle3D } from "../piece3d/types";
import type { AssemblyValidationReport } from "../assemblyvalidation/types";
import type { AssemblyConfiguration } from "../assembly3d/types";
import type { Puzzle3DVisualState } from "@/ui/preview3d/types";

/**
 * Inspection metadata for a selected connection.
 */
export interface ConnectionAngleInspection {
  /** Unique connection identifier. */
  connectionId: string;
  /** Identifier of piece A. */
  pieceAId: string;
  /** Identifier of piece B. */
  pieceBId: string;
  /** Physical connector type (tab_slot, notch, interlock, etc.). */
  connectorType: string;
  /** Currently applied joining angle in degrees. */
  currentAngleDeg: number;
  /** Allowed angle limits and discrete candidates permitted by connector kinematics. */
  allowedAngleRange: {
    min: number;
    max: number;
    validCandidates: number[];
    stepDeg?: number;
  };
  /** Standard quick presets available for testing (0°, 30°, 45°, 60°, 90°, 180°). */
  presetAngles: number[];
  /** Whether the connection is currently in a mated/valid state. */
  isValid: boolean;
}

/**
 * Request to adjust a connection angle.
 */
export interface AngleAdjustmentRequest {
  /** Authoritative 3D puzzle model. */
  puzzle: ConvertedPuzzle3D;
  /** Target connection ID to adjust. */
  connectionId: string;
  /** New desired joining angle in degrees. */
  newAngleDeg: number;
  /** Current active piece transforms. */
  currentTransforms: Record<string, RigidTransform3D>;
  /** Current active applied angles keyed by connectionId. */
  currentAngles: Record<string, number>;
  /** Optional root piece anchoring the assembly (defaults to piece 0). */
  rootPieceId?: string;
  /** Optional existing assembly configuration. */
  assemblyConfiguration?: AssemblyConfiguration;
}

/**
 * Result of an angle adjustment operation with live validation.
 */
export interface AngleAdjustmentResult {
  /** Master flag: true if adjustment succeeds with zero collision and valid connections. */
  success: boolean;
  /** Connection ID that was adjusted. */
  connectionId: string;
  /** Angle that was applied in degrees. */
  appliedAngleDeg: number;
  /** IDs of all pieces whose world transforms were modified (child piece + downstream subtree). */
  affectedPieceIds: string[];
  /** Updated world transforms for all pieces. */
  newTransforms: Record<string, RigidTransform3D>;
  /** Updated applied angles dictionary. */
  newAngles: Record<string, number>;
  /** Complete Phase 90 validation report for the new configuration. */
  validationReport: AssemblyValidationReport;
  /** Diagnostic visual state classification (VALID, WARNING, COLLISION, INVALID_CONNECTION). */
  visualState: Puzzle3DVisualState;
  /** Human-readable diagnostic description (e.g. success or reason for rejection). */
  diagnosticMessage: string;
  /** Updated formal assembly configuration. */
  updatedAssemblyConfiguration: AssemblyConfiguration;
  /** Strict guarantee flag confirming original CAD solid mesh geometry was NOT altered. */
  isOriginalGeometryUnchanged: boolean;
}
