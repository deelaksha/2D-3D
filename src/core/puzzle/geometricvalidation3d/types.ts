/**
 * 3D Geometric Validation Domain Types.
 *
 * Provides structured 3D spatial collision, clearance, and interface alignment diagnostics.
 * Crucially distinguishes EXPECTED CONTACT (intentional tab/slot mating)
 * from UNEXPECTED COLLISION (illegal interpenetration).
 */
import type { ID, Vec3 } from "@/core/model/types";

export type CollisionType =
  | "expected_contact"
  | "unexpected_collision"
  | "insufficient_clearance"
  | "invalid_penetration"
  | "disconnected_interface"
  | "invalid_interface_alignment";

export interface Diagnostic3DCollision {
  pieceIdA: ID;
  pieceIdB: ID;
  interfaceIdA?: ID;
  interfaceIdB?: ID;
  /** 3D spatial coordinate of interaction. */
  location: Vec3;
  collisionType: CollisionType;
  severity: "info" | "warning" | "error";
  /** Measured 3D gap in mm (positive for gap, negative for penetration). */
  measuredClearance: number;
  /** Required minimum clearance threshold in mm. */
  requiredClearance: number;
  description: string;
}

export interface Assembly3DValidationReport {
  /** True if zero 'error' severity issues exist. */
  isValid: boolean;
  diagnostics: Diagnostic3DCollision[];
  expectedContacts: Diagnostic3DCollision[];
  unexpectedCollisions: Diagnostic3DCollision[];
  misalignments: Diagnostic3DCollision[];
}
