/**
 * Autonomous Generator to Repair System Types (Phase 91).
 *
 * Implements full domain models for:
 *   - Closed-loop repair iterations
 *   - Parametric fault localization & adjustment records
 *   - Local-first geometry regeneration logs
 *   - Infinite loop & cycle prevention
 *   - Auditable repair histories & final status
 */

import type { ID, Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { ConvertedPuzzle3D } from "../piece3d/types";
import type {
  AssemblyValidationReport,
  ValidationFailureItem,
} from "../assemblyvalidation/types";
import type { DesignSpecification2D } from "../automatic2d/types";

/**
 * Record of a single parameter modification.
 */
export interface ParameterModification {
  /** Name of the modified parameter (e.g. "slotWidth", "tabWidth", "clearance", "joiningAngleDeg"). */
  parameterName: string;
  /** Target entity ID (connectionId, pieceId, or interfaceId). */
  entityId: string;
  /** Previous value prior to modification. */
  oldValue: number | string | boolean;
  /** Repaired value after modification. */
  newValue: number | string | boolean;
  /** Explanation of why this modification was selected. */
  reason: string;
}

/**
 * Record of a single repair attempt / iteration.
 */
export interface RepairAttempt {
  /** Iteration sequence number (1-based). */
  iteration: number;
  /** Scope of this repair attempt. */
  scope: "local" | "global";
  /** Target connection ID if local repair. */
  targetConnectionId?: string;
  /** Target piece ID if local repair. */
  targetPieceId?: string;
  /** Specific validation failure addressed in this attempt. */
  detectedFailure: ValidationFailureItem;
  /** Parametric modifications applied in this attempt. */
  modifications: ParameterModification[];
  /** Whether the re-validation passed after this attempt. */
  revalidatedValid: boolean;
  /** Number of validation errors remaining after this attempt. */
  remainingErrorCount: number;
  /** Iteration execution duration in milliseconds. */
  durationMs: number;
}

/**
 * Complete chronological repair history across all iterations.
 */
export interface RepairHistory {
  /** Total repair attempts performed. */
  totalAttempts: number;
  /** Count of attempts using local repair. */
  localAttemptsCount: number;
  /** Count of attempts using global regeneration fallback. */
  globalAttemptsCount: number;
  /** Chronological attempt log. */
  attempts: RepairAttempt[];
  /** Sequence of deterministic state hashes to detect cycles. */
  stateHashes: string[];
}

/**
 * Configurable Options for the Autonomous Repair Engine.
 */
export interface AutonomousRepairConfig {
  /** Maximum overall closed-loop retry attempts (default: 5). */
  maxRetries?: number;
  /** Maximum local repair attempts before attempting global fallback (default: 3). */
  maxLocalRetries?: number;
  /** Maximum global regeneration attempts (default: 2). */
  maxGlobalRetries?: number;
  /** Whether to prefer local repair over global regeneration (default: true). */
  preferLocal?: boolean;
  /** Minimum allowable clearance in mm (default: 0.05 mm). */
  minClearanceMm?: number;
  /** Default recommended manufacturing clearance in mm (default: 0.15 mm). */
  defaultClearanceMm?: number;
  /** Optional original 2D design specification for global regeneration fallback. */
  specification?: DesignSpecification2D;
}

/**
 * Final Repair Status returned by the autonomous repair pipeline.
 */
export interface FinalRepairStatus {
  /** Final outcome status of the repair process. */
  status: "repaired" | "unrepaired" | "max_retries_exceeded" | "cycle_detected" | "failed";
  /** True if the final assembly is 100% valid with 0 errors. */
  repaired: boolean;
  /** Final updated 3D puzzle model. */
  repairedPuzzle: ConvertedPuzzle3D;
  /** Final piece placement transforms in 3D world space. */
  pieceTransforms: Record<string, RigidTransform3D>;
  /** Final applied joining angles per connection. */
  appliedAngles: Record<string, number>;
  /** Complete validation report from the final verification pass. */
  validationReport: AssemblyValidationReport;
  /** Complete auditable iteration history. */
  history: RepairHistory;
  /** Total repair iterations executed. */
  totalIterations: number;
  /** Count of distinct parameters modified. */
  repairedParametersCount: number;
  /** Overall execution wall-clock time in milliseconds. */
  durationMs: number;
}
