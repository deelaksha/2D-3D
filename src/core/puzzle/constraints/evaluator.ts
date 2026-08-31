/**
 * Deterministic constraint evaluator for geometric & kinematic rules.
 */
import type { PuzzleConstraint } from "./types";
import type { PuzzleConnection } from "../connection/types";

export interface KinematicConstraintResult {
  constraintId: string;
  satisfied: boolean;
  residual: number; // 0 if perfectly satisfied
  message?: string;
}

export function evaluateJoiningAngleConstraint(
  constraint: PuzzleConstraint,
  connection: PuzzleConnection,
): KinematicConstraintResult {
  if (constraint.kind === "fixedJoiningAngle" && constraint.targetValue !== undefined) {
    const diff = Math.abs(connection.joiningAngleDeg - constraint.targetValue);
    const satisfied = diff <= 0.5; // 0.5 degree tolerance
    return {
      constraintId: constraint.id,
      satisfied,
      residual: diff,
      message: satisfied
        ? undefined
        : `Joining angle ${connection.joiningAngleDeg}° deviates from fixed target ${constraint.targetValue}°`,
    };
  }

  if (constraint.kind === "angleRange") {
    const min = constraint.minValue ?? 0;
    const max = constraint.maxValue ?? 360;
    const satisfied = connection.joiningAngleDeg >= min && connection.joiningAngleDeg <= max;
    const residual = satisfied
      ? 0
      : connection.joiningAngleDeg < min
      ? min - connection.joiningAngleDeg
      : connection.joiningAngleDeg - max;
    return {
      constraintId: constraint.id,
      satisfied,
      residual,
      message: satisfied
        ? undefined
        : `Joining angle ${connection.joiningAngleDeg}° outside allowed range [${min}°, ${max}°]`,
    };
  }

  return {
    constraintId: constraint.id,
    satisfied: true,
    residual: 0,
  };
}
