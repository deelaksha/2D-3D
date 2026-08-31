/**
 * Constraint Evaluation Logic for 12 Declarative Constraint Kinds.
 */
import type { ConstraintEvaluationResult, DeclarativeConstraint } from "./types";
import { len3, sub3, vec3 } from "../geometry/math3d";

export function evaluateDeclarativeConstraint(
  constraint: DeclarativeConstraint,
  context: any = {},
): ConstraintEvaluationResult {
  const { id, type, severity, parameters } = constraint;

  switch (type) {
    case "distance": {
      const dist = context.distance ?? (parameters.currentValue as number) ?? 0;
      const target = (parameters.targetValue as number) ?? 0;
      const tol = (parameters.tolerance as number) ?? 0.1;
      const diff = Math.abs(dist - target);
      const satisfied = diff <= tol;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual: diff,
        diagnosticInfo: satisfied
          ? `Distance constraint satisfied (${dist.toFixed(2)}mm).`
          : `Distance constraint violated: actual ${dist.toFixed(2)}mm vs target ${target.toFixed(2)}mm (diff: ${diff.toFixed(2)}mm > tol ${tol}mm).`,
      };
    }

    case "alignment": {
      const dot = context.alignmentDot ?? (parameters.currentDot as number) ?? 1.0;
      const targetDot = (parameters.targetDot as number) ?? 1.0;
      const diff = Math.abs(dot - targetDot);
      const satisfied = diff <= 0.05;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual: diff,
        diagnosticInfo: satisfied
          ? `Alignment vector constraint satisfied.`
          : `Alignment vector constraint violated: dot product diff ${diff.toFixed(3)}.`,
      };
    }

    case "angle": {
      const angle = context.joiningAngleDeg ?? (parameters.currentAngleDeg as number) ?? 90.0;
      const minAngle = (parameters.minAngleDeg as number) ?? (parameters.targetValue as number) ?? 90.0;
      const maxAngle = (parameters.maxAngleDeg as number) ?? (parameters.targetValue as number) ?? 90.0;
      const satisfied = angle >= minAngle - 0.5 && angle <= maxAngle + 0.5;
      const residual = satisfied
        ? 0.0
        : angle < minAngle
        ? minAngle - angle
        : angle - maxAngle;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual,
        diagnosticInfo: satisfied
          ? `Angle constraint satisfied (${angle}°).`
          : `Angle constraint violated: actual ${angle}° outside allowed range [${minAngle}°, ${maxAngle}°].`,
      };
    }

    case "contact": {
      const gap = context.clearanceMm ?? (parameters.currentGapMm as number) ?? 0.0;
      const tol = (parameters.tolerance as number) ?? 0.1;
      const satisfied = Math.abs(gap) <= tol;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual: Math.abs(gap),
        diagnosticInfo: satisfied
          ? `Surface contact constraint satisfied.`
          : `Surface contact constraint violated: gap ${gap.toFixed(2)}mm > tolerance ${tol}mm.`,
      };
    }

    case "clearance": {
      const clearance = context.clearanceMm ?? (parameters.currentClearanceMm as number) ?? 0.0;
      const minClearance = (parameters.minClearanceMm as number) ?? 0.0;
      const satisfied = clearance >= minClearance - 1e-4;
      const residual = satisfied ? 0.0 : minClearance - clearance;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual,
        diagnosticInfo: satisfied
          ? `Clearance constraint satisfied (${clearance.toFixed(2)}mm).`
          : `Clearance constraint violated: actual ${clearance.toFixed(2)}mm < required min ${minClearance.toFixed(2)}mm.`,
      };
    }

    case "non_overlap": {
      const isColliding = context.isColliding ?? (parameters.isColliding as boolean) ?? false;
      const overlapDepth = context.overlapDepth ?? (parameters.overlapDepth as number) ?? (isColliding ? 1.0 : 0.0);
      const satisfied = !isColliding && overlapDepth <= 0;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual: overlapDepth,
        diagnosticInfo: satisfied
          ? `Non-overlap constraint satisfied (no collision).`
          : `Non-overlap constraint VIOLATED: interpenetration collision detected (depth: ${overlapDepth.toFixed(2)}mm).`,
      };
    }

    case "interface_compatibility": {
      const isCompatible = context.isCompatible ?? (parameters.isCompatible as boolean) ?? true;
      const score = context.score ?? (parameters.score as number) ?? (isCompatible ? 1.0 : 0.0);
      const satisfied = isCompatible && score > 0.5;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual: 1.0 - score,
        diagnosticInfo: satisfied
          ? `Interface compatibility constraint satisfied.`
          : `Interface compatibility constraint violated: interfaces are incompatible (score: ${score.toFixed(2)}).`,
      };
    }

    case "dimension": {
      const dimVal = context.dimensionValue ?? (parameters.currentValue as number) ?? 100;
      const minDim = (parameters.minValue as number) ?? 0;
      const maxDim = (parameters.maxValue as number) ?? Infinity;
      const satisfied = dimVal >= minDim && dimVal <= maxDim;
      const residual = satisfied ? 0.0 : dimVal < minDim ? minDim - dimVal : dimVal - maxDim;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual,
        diagnosticInfo: satisfied
          ? `Dimension constraint satisfied (${dimVal.toFixed(2)}mm).`
          : `Dimension constraint violated: actual ${dimVal.toFixed(2)}mm outside allowed bounds [${minDim}, ${maxDim}].`,
      };
    }

    case "position": {
      const currentPos = context.position ?? (parameters.currentPosition as any) ?? vec3(0, 0, 0);
      const targetPos = (parameters.targetPosition as any) ?? vec3(0, 0, 0);
      const tol = (parameters.tolerance as number) ?? 0.1;
      const dist = len3(sub3(currentPos, targetPos));
      const satisfied = dist <= tol;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual: dist,
        diagnosticInfo: satisfied
          ? `3D Position constraint satisfied.`
          : `3D Position constraint violated: distance to target ${dist.toFixed(2)}mm > tol ${tol}mm.`,
      };
    }

    case "rotation": {
      const angleDiff = context.rotationErrorDeg ?? (parameters.rotationErrorDeg as number) ?? 0.0;
      const tol = (parameters.toleranceDeg as number) ?? 0.5;
      const satisfied = Math.abs(angleDiff) <= tol;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual: Math.abs(angleDiff),
        diagnosticInfo: satisfied
          ? `3D Rotation constraint satisfied.`
          : `3D Rotation constraint violated: angular error ${angleDiff.toFixed(2)}° > tol ${tol}°.`,
      };
    }

    case "symmetry": {
      const symDiff = context.symmetryErrorMm ?? (parameters.symmetryErrorMm as number) ?? 0.0;
      const tol = (parameters.tolerance as number) ?? 0.2;
      const satisfied = Math.abs(symDiff) <= tol;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual: Math.abs(symDiff),
        diagnosticInfo: satisfied
          ? `Symmetry constraint satisfied.`
          : `Symmetry constraint violated: asymmetry error ${symDiff.toFixed(2)}mm > tol ${tol}mm.`,
      };
    }

    case "material_constraints": {
      const thickness = context.thickness ?? (parameters.thickness as number) ?? 2.0;
      const slotWidth = context.slotWidth ?? (parameters.slotWidth as number) ?? 2.15;
      const satisfied = slotWidth >= thickness;
      const residual = satisfied ? 0.0 : thickness - slotWidth;
      return {
        constraintId: id,
        type,
        severity,
        satisfied,
        residual,
        diagnosticInfo: satisfied
          ? `Cardboard material constraint satisfied.`
          : `Cardboard material constraint VIOLATED: slot width (${slotWidth}mm) is smaller than stock thickness (${thickness}mm). Risk of crushing cardboard.`,
      };
    }

    default:
      return {
        constraintId: id,
        type,
        severity,
        satisfied: true,
        residual: 0.0,
        diagnosticInfo: `Unknown constraint type '${type}', passing by default.`,
      };
  }
}
