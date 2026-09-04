/**
 * Connection Kinematics & Engagement Trajectory Engine (Phase 65).
 *
 * Computes dynamic relative transformations during assembly engagement,
 * articulated hinge rotations, and linear sliding motions.
 */
import type { RigidTransform3D } from "../framesystem/types";
import type { Advanced3DConnection } from "./types";
import {
  add3,
  quatFromAxisAngle,
  quatMultiply,
  scale3,
  vec3,
} from "../geometry/math3d";

export class ConnectionKinematicsEngine {
  /**
   * Computes the intermediate relative transform during assembly engagement.
   *
   * @param connection The advanced connection definition.
   * @param progress Engagement ratio between 0.0 (initial standoff) and 1.0 (fully seated).
   * @param standoffDistanceMm Distance in mm along insertion direction at progress = 0 (default 20mm).
   */
  static interpolateEngagementTransform(
    connection: Advanced3DConnection,
    progress: number,
    standoffDistanceMm = 20.0
  ): RigidTransform3D {
    const clampedProgress = Math.max(0.0, Math.min(1.0, progress));
    const baseTransform = connection.relativeTransformation;

    // Remaining distance along insertion vector
    const remainingDistance = (1.0 - clampedProgress) * standoffDistanceMm;
    // Standoff vector pushes Interface A back along the negative insertion direction
    const offsetVector = scale3(connection.insertionDirection, -remainingDistance);

    return {
      position: add3(baseTransform.position, offsetVector),
      rotation: baseTransform.rotation,
      scale: vec3(1, 1, 1),
    };
  }

  /**
   * Computes the relative transform of a HINGE connection at a specified angle.
   *
   * @param connection HINGE connection instance.
   * @param angleDeg Current hinge angle in degrees (clamped to connection.angleLimits).
   */
  static computeArticulatedHingeTransform(
    connection: Advanced3DConnection,
    angleDeg: number
  ): RigidTransform3D {
    if (connection.behavior !== "HINGE") {
      throw new Error(`Cannot articulate non-HINGE connection '${connection.id}' (behavior=${connection.behavior}).`);
    }

    const limits = connection.angleLimits;
    const clampedAngle = Math.max(limits.minAngleDeg, Math.min(limits.maxAngleDeg, angleDeg));
    const angleDeltaRad = ((clampedAngle - limits.nominalAngleDeg) * Math.PI) / 180.0;

    const hingeAxis = connection.allowedRotationAxes[0] || connection.localFrames.frameA.binormal;
    const qDelta = quatFromAxisAngle(hingeAxis, angleDeltaRad);

    const articulatedRotation = quatMultiply(qDelta, connection.relativeTransformation.rotation);

    return {
      position: connection.relativeTransformation.position,
      rotation: articulatedRotation,
      scale: vec3(1, 1, 1),
    };
  }

  /**
   * Computes the relative transform of a SLIDING connection at a specified stroke displacement.
   *
   * @param connection SLIDING connection instance.
   * @param strokeMm Linear displacement along sliding axis in mm.
   */
  static computeSlidingDisplacementTransform(
    connection: Advanced3DConnection,
    strokeMm: number
  ): RigidTransform3D {
    if (connection.behavior !== "SLIDING") {
      throw new Error(`Cannot slide non-SLIDING connection '${connection.id}' (behavior=${connection.behavior}).`);
    }

    const slideAxis = connection.allowedTranslationAxes[0] || connection.localFrames.frameA.tangent;
    const strokeVector = scale3(slideAxis, strokeMm);

    return {
      position: add3(connection.relativeTransformation.position, strokeVector),
      rotation: connection.relativeTransformation.rotation,
      scale: vec3(1, 1, 1),
    };
  }
}
