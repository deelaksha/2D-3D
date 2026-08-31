/**
 * Pure deterministic 3D geometry math library.
 * Reuses existing Vec3 primitives and provides vector, quaternion, matrix,
 * and spatial coordinate frame transformations.
 */
import type { Vec3 } from "@/core/model/types";
import type { Matrix4, Quaternion, Transform3D } from "./types";

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function add3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale3(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function len3(v: Vec3): number {
  return Math.sqrt(dot3(v, v));
}

export function normalize3(v: Vec3): Vec3 {
  const l = len3(v);
  if (l < 1e-9) return { x: 0, y: 0, z: 0 };
  return scale3(v, 1 / l);
}

export function quatIdentity(): Quaternion {
  return { x: 0, y: 0, z: 0, w: 1 };
}

export function quatFromAxisAngle(axis: Vec3, angleRad: number): Quaternion {
  const normAxis = normalize3(axis);
  const halfAngle = angleRad / 2;
  const s = Math.sin(halfAngle);
  return {
    x: normAxis.x * s,
    y: normAxis.y * s,
    z: normAxis.z * s,
    w: Math.cos(halfAngle),
  };
}

export function quatMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function quatRotateVector(q: Quaternion, v: Vec3): Vec3 {
  const qv: Vec3 = { x: q.x, y: q.y, z: q.z };
  const uv = cross3(qv, v);
  const uuv = cross3(qv, uv);
  return add3(v, add3(scale3(uv, 2 * q.w), scale3(uuv, 2)));
}

export function createTransform3D(
  position: Vec3 = vec3(),
  rotation: Quaternion = quatIdentity(),
  scale: Vec3 = vec3(1, 1, 1),
): Transform3D {
  return { position, rotation, scale };
}

export function transformPoint3D(t: Transform3D, p: Vec3): Vec3 {
  const scaled = { x: p.x * t.scale.x, y: p.y * t.scale.y, z: p.z * t.scale.z };
  const rotated = quatRotateVector(t.rotation, scaled);
  return add3(t.position, rotated);
}
