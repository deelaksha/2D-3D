/**
 * Connection Compatibility Engine Domain Types.
 *
 * Models the 7 compatibility checks:
 * 1. Interface Types
 * 2. Profiles
 * 3. Joining Angles
 * 4. Insertion Directions
 * 5. Clearances
 * 6. Degrees of Freedom (DOF)
 * 7. Physical Relationships
 */
import type { ID } from "@/core/model/types";
import type { CanonicalInterface } from "../canonical/types";
import type { RigidTransform3D } from "../framesystem/types";

export type ConnectionCompatibilityCheckKind =
  | "type"
  | "profile"
  | "angle"
  | "insertion"
  | "clearance"
  | "dof"
  | "physical";

export interface CompatibilityCheckDetail {
  checkKind: ConnectionCompatibilityCheckKind;
  satisfied: boolean;
  /** Numeric score between 0.0 (incompatible) and 1.0 (perfectly compatible). */
  score: number;
  message: string;
  diagnosticInfo?: Record<string, string | number | boolean>;
}

export interface ConnectionCompatibilityReport {
  /** True if ALL 7 compatibility criteria pass. */
  isCompatible: boolean;
  /** Aggregate overall score (0.0 to 1.0). */
  overallScore: number;
  checks: Record<ConnectionCompatibilityCheckKind, CompatibilityCheckDetail>;
  diagnostics: string[];
}

export interface CompatibilityEvaluationContext {
  interfaceA: CanonicalInterface;
  interfaceB: CanonicalInterface;
  transformA?: RigidTransform3D;
  transformB?: RigidTransform3D;
  joiningAngleDeg?: number;
  clearanceMm?: number;
  toleranceMm?: number;
  insertionVectorA?: { x: number; y: number; z: number };
  insertionVectorB?: { x: number; y: number; z: number };
  proposedTranslationDOF?: number;
  proposedRotationDOF?: number;
}

export interface ExtensibleCompatibilityRule {
  name: string;
  description: string;
  evaluate: (ctx: CompatibilityEvaluationContext) => CompatibilityCheckDetail | null;
}
