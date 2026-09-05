/**
 * Mathematically Rigorous 3D Transformation Engine.
 *
 * Implements rigid body kinematics:
 *  - Translation
 *  - Axis-angle & Quaternion Rotation
 *  - Transformation Composition (T1 o T2)
 *  - Inverse Transformation (T^-1)
 *  - Local-to-World & World-to-Local Coordinate Conversions
 *  - Interface-to-Interface Mating Alignment
 */
import type { Vec3 } from "@/core/model/types";
import type { CoordinateFrame3D, RigidTransform3D } from "./types";
import type { Quaternion } from "../geometry/types";
import {
  add3,
  cross3,
  normalize3,
  quatFromAxisAngle,
  quatIdentity,
  quatMultiply,
  quatRotateVector,
  scale3,
  sub3,
  vec3,
} from "../geometry/math3d";

export function identityTransform(): RigidTransform3D {
  return {
    position: vec3(0, 0, 0),
    rotation: quatIdentity(),
    scale: vec3(1, 1, 1),
  };
}

export function translationTransform(offset: Vec3): RigidTransform3D {
  return {
    position: offset,
    rotation: quatIdentity(),
    scale: vec3(1, 1, 1),
  };
}

export function rotationTransform(axis: Vec3, angleRad: number): RigidTransform3D {
  return {
    position: vec3(0, 0, 0),
    rotation: quatFromAxisAngle(axis, angleRad),
    scale: vec3(1, 1, 1),
  };
}

export function quatConjugate(q: Quaternion): Quaternion {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

/** Transform a 3D point: p' = R * p + t */
export function transformPoint(t: RigidTransform3D, p: Vec3): Vec3 {
  const scaled = t.scale ? { x: p.x * t.scale.x, y: p.y * t.scale.y, z: p.z * t.scale.z } : p;
  const rotated = quatRotateVector(t.rotation, scaled);
  return add3(t.position, rotated);
}

/** Transform a 3D direction vector: v' = R * v */
export function transformVector(t: RigidTransform3D, v: Vec3): Vec3 {
  return quatRotateVector(t.rotation, v);
}

/**
 * Transformation Composition: T_composite = T1 o T2
 * Evaluates T_composite(p) = T1(T2(p)) = R1 * (R2 * p + t2) + t1 = (R1 * R2) * p + (R1 * t2 + t1)
 */
export function composeTransforms(
  t1: RigidTransform3D,
  t2: RigidTransform3D,
): RigidTransform3D {
  const compositeRotation = quatMultiply(t1.rotation, t2.rotation);
  const rotatedT2Position = quatRotateVector(t1.rotation, t2.position);
  const compositePosition = add3(t1.position, rotatedT2Position);

  return {
    position: compositePosition,
    rotation: compositeRotation,
    scale: vec3(1, 1, 1),
  };
}

/**
 * Inverse Transformation: T^-1
 * T^-1(p) = R^-1 * (p - t) = R^-1 * p - R^-1 * t
 */
export function inverseTransform(t: RigidTransform3D): RigidTransform3D {
  const invRotation = quatConjugate(t.rotation);
  const invPosition = scale3(quatRotateVector(invRotation, t.position), -1);

  return {
    position: invPosition,
    rotation: invRotation,
    scale: vec3(1, 1, 1),
  };
}

/** Convert a piece-local 3D point to world space coordinates. */
export function localToWorld(pieceTransform: RigidTransform3D, localPoint: Vec3): Vec3 {
  return transformPoint(pieceTransform, localPoint);
}

/** Convert a world-space 3D point back into piece-local space coordinates. */
export function worldToLocal(pieceTransform: RigidTransform3D, worldPoint: Vec3): Vec3 {
  const inv = inverseTransform(pieceTransform);
  return transformPoint(inv, worldPoint);
}

/**
 * Mathematically aligns a target piece interface to a placed source interface
 * at an arbitrary 3D joining angle (joiningAngleDeg).
 */
export function alignInterfaces(
  sourceFrame: CoordinateFrame3D,
  sourceTransform: RigidTransform3D,
  targetFrame: CoordinateFrame3D,
  joiningAngleDeg: number,
  rollAngleDeg = 0.0,
): RigidTransform3D {
  // 1. Calculate source interface origin in world space
  const sourceWorldOrigin = localToWorld(sourceTransform, sourceFrame.origin);

  // 2. The interface hinge axis is the tangent along the joint edge in world space
  const tangentAxis = sourceFrame.tangent ? sourceFrame.tangent : vec3(1, 0, 0);
  const sourceWorldTangent = quatRotateVector(sourceTransform.rotation, tangentAxis);

  // 3. Fold angle around the interface tangent axis:
  // At 180° (coplanar / flat), fold angle is 0 (unfolded sheet).
  // At 90° (perpendicular), fold angle is 90° (folded upright box facet).
  // At 0° (fold-back), fold angle is 180° (folded completely back on top).
  const foldAngleRad = ((180.0 - joiningAngleDeg) * Math.PI) / 180.0;
  const rollRad = (rollAngleDeg * Math.PI) / 180.0;

  let qFold = quatFromAxisAngle(sourceWorldTangent, foldAngleRad);
  if (Math.abs(rollAngleDeg) > 1e-4) {
    const normalAxis = sourceFrame.normal ? sourceFrame.normal : vec3(0, 1, 0);
    const sourceWorldNormal = quatRotateVector(sourceTransform.rotation, normalAxis);
    const qRoll = quatFromAxisAngle(sourceWorldNormal, rollRad);
    qFold = quatMultiply(qRoll, qFold);
  }

  const targetRotation = quatMultiply(qFold, sourceTransform.rotation);

  // 4. Target piece world position: aligns target interface origin with source interface origin
  const rotatedTargetFrameOrigin = quatRotateVector(targetRotation, targetFrame.origin);
  const targetPosition = sub3(sourceWorldOrigin, rotatedTargetFrameOrigin);

  return {
    position: targetPosition,
    rotation: targetRotation,
    scale: vec3(1, 1, 1),
  };
}
