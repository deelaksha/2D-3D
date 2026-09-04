/**
 * Trajectory Planner (Phase 68 Baseline).
 *
 * Deterministically generates discretized 3D motion paths from standoff positions
 * along insertion vectors to final seated poses.
 */
import type { Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { Quaternion } from "../geometry/types";
import {
  add3,
  dot3,
  len3,
  normalize3,
  scale3,
  sub3,
  vec3,
} from "../geometry/math3d";

export class TrajectoryPlanner {
  /**
   * Generates discrete waypoints from standoff pose along insertion vector to target pose.
   */
  static generateInsertionPath(
    targetTransform: RigidTransform3D,
    insertionVector: Vec3,
    standoffDistanceMm = 30.0,
    steps = 10
  ): {
    startTransform: RigidTransform3D;
    waypoints: RigidTransform3D[];
    travelDistanceMm: number;
    sweptRotationDeg: number;
  } {
    const normIns = normalize3(insertionVector);
    // Start pose is pulled back along negative insertion vector by standoff distance
    const startPos = sub3(targetTransform.position, scale3(normIns, standoffDistanceMm));

    const startTransform: RigidTransform3D = {
      position: startPos,
      rotation: targetTransform.rotation,
      scale: vec3(1, 1, 1),
    };

    const waypoints: RigidTransform3D[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps; // 0.0 to 1.0
      const currentPos = add3(startPos, scale3(normIns, standoffDistanceMm * t));
      waypoints.push({
        position: currentPos,
        rotation: targetTransform.rotation,
        scale: vec3(1, 1, 1),
      });
    }

    return {
      startTransform,
      waypoints,
      travelDistanceMm: standoffDistanceMm,
      sweptRotationDeg: 0.0,
    };
  }

  /**
   * Generates rotational sweep waypoints around an axis.
   */
  static generateRotationPath(
    baseTransform: RigidTransform3D,
    rotationAxis: Vec3,
    angleDeg: number,
    steps = 8
  ): {
    waypoints: RigidTransform3D[];
    sweptRotationDeg: number;
  } {
    const waypoints: RigidTransform3D[] = [];
    const normAxis = normalize3(rotationAxis);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const currentAngleRad = (angleDeg * t * Math.PI) / 180.0;
      const s = Math.sin(currentAngleRad / 2);
      const qDelta: Quaternion = {
        x: normAxis.x * s,
        y: normAxis.y * s,
        z: normAxis.z * s,
        w: Math.cos(currentAngleRad / 2),
      };

      // Multiply rotation: q_current = qDelta * baseRotation
      const qRot: Quaternion = {
        x: qDelta.w * baseTransform.rotation.x + qDelta.x * baseTransform.rotation.w + qDelta.y * baseTransform.rotation.z - qDelta.z * baseTransform.rotation.y,
        y: qDelta.w * baseTransform.rotation.y - qDelta.x * baseTransform.rotation.z + qDelta.y * baseTransform.rotation.w + qDelta.z * baseTransform.rotation.x,
        z: qDelta.w * baseTransform.rotation.z + qDelta.x * baseTransform.rotation.y - qDelta.y * baseTransform.rotation.x + qDelta.z * baseTransform.rotation.w,
        w: qDelta.w * baseTransform.rotation.w - qDelta.x * baseTransform.rotation.x - qDelta.y * baseTransform.rotation.y - qDelta.z * baseTransform.rotation.z,
      };

      waypoints.push({
        position: baseTransform.position,
        rotation: qRot,
        scale: vec3(1, 1, 1),
      });
    }

    return {
      waypoints,
      sweptRotationDeg: Math.abs(angleDeg),
    };
  }
}
