/**
 * 3D Geometry primitives and transformation structures.
 */
import type { Vec3 } from "@/core/model/types";

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export type Matrix4 = number[]; // 16-element array in column-major order

export interface Transform3D {
  position: Vec3;
  rotation: Quaternion;
  scale: Vec3;
}

export interface Box3D {
  min: Vec3;
  max: Vec3;
}
