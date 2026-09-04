/**
 * Theoretical Angle Constraint Evaluator (Tier 1).
 *
 * Evaluates candidate joining angles against continuous angle ranges,
 * discrete angle sets, and behavior rotation axis constraints.
 */
import type { Vec3 } from "@/core/model/types";
import type { Advanced3DConnection } from "../connection/types";
import type {
  AngleSpecification,
  TheoreticalAngleDetails,
} from "./angleTypes";
import { dot3, len3, normalize3 } from "../geometry/math3d";

export class AngleConstraintEvaluator {
  private static readonly EPSILON = 1e-4;

  /**
   * Evaluates whether a desired angle and rotation axis are theoretically allowed.
   */
  static evaluateTheoretical(
    desiredAngleDeg: number,
    connection: Advanced3DConnection,
    specOverride?: AngleSpecification,
    requestedAxis?: Vec3
  ): TheoreticalAngleDetails {
    // 1. Determine active angle specification
    const spec: AngleSpecification =
      specOverride || this.deriveSpecFromConnection(connection);

    // 2. Determine rotation axis
    const axis = requestedAxis
      ? normalize3(requestedAxis)
      : connection.allowedRotationAxes[0] || connection.localFrames.frameA.binormal;

    // 3. Behavior-specific kinematic gate
    const behaviorGate = this.checkBehaviorKinematics(connection, desiredAngleDeg, axis);
    if (!behaviorGate.isAllowed) {
      return {
        isAllowed: false,
        matchedSpecification: spec.kind,
        rotationAxisUsed: axis,
        reason: behaviorGate.reason,
      };
    }

    // 4. Angle range/set validation
    const tol = spec.toleranceDeg ?? 0.5;

    switch (spec.kind) {
      case "continuous_range": {
        const inRange =
          desiredAngleDeg >= spec.minAngleDeg - tol &&
          desiredAngleDeg <= spec.maxAngleDeg + tol;

        return {
          isAllowed: inRange,
          matchedSpecification: "continuous_range",
          allowedRange: [spec.minAngleDeg, spec.maxAngleDeg],
          rotationAxisUsed: axis,
          reason: inRange
            ? undefined
            : `Desired angle ${desiredAngleDeg.toFixed(1)}° is outside permitted continuous range [${spec.minAngleDeg}°, ${spec.maxAngleDeg}°].`,
        };
      }

      case "discrete_set": {
        const matched = spec.allowedAnglesDeg.some(
          (allowed) => Math.abs(allowed - desiredAngleDeg) <= tol
        );

        return {
          isAllowed: matched,
          matchedSpecification: "discrete_set",
          discreteSet: spec.allowedAnglesDeg,
          rotationAxisUsed: axis,
          reason: matched
            ? undefined
            : `Desired angle ${desiredAngleDeg.toFixed(1)}° does not match any discrete permitted angle [${spec.allowedAnglesDeg.join("°, ")}°].`,
        };
      }

      case "fixed": {
        const matched = Math.abs(spec.nominalAngleDeg - desiredAngleDeg) <= tol;

        return {
          isAllowed: matched,
          matchedSpecification: "fixed",
          allowedRange: [spec.nominalAngleDeg, spec.nominalAngleDeg],
          rotationAxisUsed: axis,
          reason: matched
            ? undefined
            : `Fixed connection expects nominal angle ${spec.nominalAngleDeg}°, received ${desiredAngleDeg.toFixed(1)}°.`,
        };
      }
    }
  }

  private static deriveSpecFromConnection(connection: Advanced3DConnection): AngleSpecification {
    const limits = connection.angleLimits;
    if (connection.behavior === "ROTATIONAL") {
      return {
        kind: "continuous_range",
        minAngleDeg: limits?.minAngleDeg ?? 0.0,
        maxAngleDeg: limits?.maxAngleDeg && limits.maxAngleDeg > (limits.minAngleDeg ?? 0) ? limits.maxAngleDeg : 360.0,
        nominalAngleDeg: limits?.nominalAngleDeg ?? 0.0,
      };
    }

    if (connection.behavior === "FIXED") {
      return {
        kind: "fixed",
        nominalAngleDeg: limits.nominalAngleDeg,
      };
    }

    if (Math.abs(limits.minAngleDeg - limits.maxAngleDeg) < this.EPSILON) {
      return {
        kind: "fixed",
        nominalAngleDeg: limits.nominalAngleDeg,
      };
    }

    return {
      kind: "continuous_range",
      minAngleDeg: limits.minAngleDeg,
      maxAngleDeg: limits.maxAngleDeg,
      nominalAngleDeg: limits.nominalAngleDeg,
    };
  }

  private static checkBehaviorKinematics(
    connection: Advanced3DConnection,
    desiredAngleDeg: number,
    axis: Vec3
  ): { isAllowed: boolean; reason?: string } {
    switch (connection.behavior) {
      case "FIXED":
      case "INTERLOCK":
      case "SNAP":
        if (
          Math.abs(desiredAngleDeg - connection.angleLimits.nominalAngleDeg) > 0.5
        ) {
          return {
            isAllowed: false,
            reason: `${connection.behavior} connection cannot articulate to ${desiredAngleDeg}° (fixed nominal=${connection.angleLimits.nominalAngleDeg}°).`,
          };
        }
        return { isAllowed: true };

      case "SLIDING":
        return {
          isAllowed: false,
          reason: "SLIDING connections have 0 rotational DOFs; joining angle cannot vary.",
        };

      case "HINGE": {
        if (connection.allowedRotationAxes.length === 0) {
          return { isAllowed: true };
        }
        const allowedAxis = connection.allowedRotationAxes[0];
        const alignment = Math.abs(dot3(axis, allowedAxis));
        if (Math.abs(alignment - 1.0) > 0.05) {
          return {
            isAllowed: false,
            reason: `Rotation axis [${axis.x}, ${axis.y}, ${axis.z}] is not aligned with hinge axis [${allowedAxis.x}, ${allowedAxis.y}, ${allowedAxis.z}].`,
          };
        }
        return { isAllowed: true };
      }

      case "ROTATIONAL": {
        if (connection.allowedRotationAxes.length === 0) {
          return { isAllowed: true };
        }
        const matchesAny = connection.allowedRotationAxes.some(
          (allowedAxis) => Math.abs(Math.abs(dot3(axis, allowedAxis)) - 1.0) <= 0.05
        );
        if (!matchesAny) {
          return {
            isAllowed: false,
            reason: `Requested axis [${axis.x}, ${axis.y}, ${axis.z}] is not in connection's allowed rotation axes.`,
          };
        }
        return { isAllowed: true };
      }

      case "CUSTOM":
      default:
        return { isAllowed: true };
    }
  }
}
