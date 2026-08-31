/**
 * Connection domain models representing 3D mated relationships between piece interfaces.
 *
 * CRITICAL REQUIREMENT:
 * Never assume horizontal-to-horizontal connections.
 * The system supports arbitrary valid 3D joining angles (joiningAngleDeg).
 */
import type { ID } from "@/core/model/types";

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
}
