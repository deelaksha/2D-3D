/**
 * 3D Coordinate-Frame & Rigid Transformation System Types.
 */
import type { Vec3 } from "@/core/model/types";
import type { Quaternion } from "../geometry/types";

export interface CoordinateFrame3D {
  /** 3D origin point (mm). */
  origin: Vec3;
  /** Tangent unit vector (+X axis). */
  tangent: Vec3;
  /** Normal unit vector (+Y axis). */
  normal: Vec3;
  /** Binormal unit vector (+Z axis = tangent x normal). */
  binormal: Vec3;
}

export interface RigidTransform3D {
  /** 3D translation vector (mm). */
  position: Vec3;
  /** 3D rotation unit quaternion [x, y, z, w]. */
  rotation: Quaternion;
  /** Optional uniform or non-uniform scale (defaults to {x:1, y:1, z:1}). */
  scale?: Vec3;
}

export interface TransformCompositionResult {
  position: Vec3;
  rotation: Quaternion;
}
