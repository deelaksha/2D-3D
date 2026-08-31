/**
 * 3D Interface Frame Math & Non-Planar Mating Utilities.
 */
import type { Vec2, Vec3 } from "@/core/model/types";
import type { CanonicalLocalFrame3D } from "../canonical/types";
import type { Quaternion } from "../geometry/types";
import {
  cross3,
  normalize3,
  quatFromAxisAngle,
  quatMultiply,
  quatRotateVector,
  vec3,
} from "../geometry/math3d";

export function createInterfaceLocalFrame3D(
  origin: Vec3,
  tangent: Vec3,
  normal: Vec3,
): CanonicalLocalFrame3D {
  const normTangent = normalize3(tangent);
  const normNormal = normalize3(normal);
  const normBinormal = normalize3(cross3(normTangent, normNormal));

  return {
    origin,
    tangent: normTangent,
    normal: normNormal,
    binormal: normBinormal,
  };
}

export function computeNonPlanarMatingTransform(
  sourceFrame: CanonicalLocalFrame3D,
  targetJoiningAngleDeg: number,
  rollAngleDeg = 0.0,
): Quaternion {
  const joiningRad = (targetJoiningAngleDeg * Math.PI) / 180;
  const rollRad = (rollAngleDeg * Math.PI) / 180;

  // 180 degree flip around binormal so interface normals oppose each other
  const qOppose = quatFromAxisAngle(sourceFrame.binormal, Math.PI);
  // Rotation by target joining angle around tangent axis
  const qAngle = quatFromAxisAngle(sourceFrame.tangent, joiningRad);
  // Roll rotation around normal axis
  const qRoll = quatFromAxisAngle(sourceFrame.normal, rollRad);

  return quatMultiply(qAngle, quatMultiply(qRoll, qOppose));
}

export function transformInsertionVector(
  insertionVector: Vec3,
  rotation: Quaternion,
): Vec3 {
  return normalize3(quatRotateVector(rotation, insertionVector));
}
