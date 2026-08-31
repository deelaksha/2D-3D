/**
 * Generic Constraint Framework Domain Types.
 *
 * Distinctly separates HARD constraints (must never be silently violated)
 * from SOFT constraints (guidance & penalties for optimization).
 */
import type { ID } from "@/core/model/types";

export type ConstraintSeverity = "HARD" | "SOFT";

export type ConstraintType =
  | "distance"
  | "alignment"
  | "angle"
  | "contact"
  | "clearance"
  | "non_overlap"
  | "interface_compatibility"
  | "dimension"
  | "position"
  | "rotation"
  | "symmetry"
  | "material_constraints";

export interface DeclarativeConstraint {
  id: ID;
  type: ConstraintType;
  /** Severity level: HARD must never be silently violated; SOFT is for optimization guidance. */
  severity: ConstraintSeverity;
  /** Entity IDs involved in this constraint (piece IDs, interface IDs, connection IDs). */
  involvedEntityIds: ID[];
  /** Parameter map (e.g. targetValue, minValue, maxValue, tolerance, axis, etc.). */
  parameters: Record<string, number | string | boolean>;
  label?: string;
}

export interface ConstraintEvaluationResult {
  constraintId: ID;
  type: ConstraintType;
  severity: ConstraintSeverity;
  satisfied: boolean;
  /** 0.0 if perfectly satisfied, positive numeric error value otherwise. */
  residual: number;
  diagnosticInfo: string;
}

export interface ConstraintFrameworkReport {
  /** True if ALL HARD constraints pass. False if ANY HARD constraint fails. */
  overallSatisfied: boolean;
  hardViolations: ConstraintEvaluationResult[];
  softViolations: ConstraintEvaluationResult[];
  results: ConstraintEvaluationResult[];
}
