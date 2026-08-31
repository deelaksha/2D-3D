/**
 * Coordinate Frame domain definitions.
 *
 * Each connection interface defines a local 3D coordinate frame:
 *  - origin: 3D point in space (mm)
 *  - tangent (X_axis): along-edge direction
 *  - normal (Y_axis): outward-facing normal
 *  - binormal (Z_axis): perpendicular / thickness direction (cross product of tangent & normal)
 */
import type { Vec2, Vec3 } from "@/core/model/types";
import type { Quaternion } from "../geometry/types";

export interface Frame2D {
  origin: Vec2;
  normal: Vec2;
  tangent: Vec2;
}

export interface Frame3D {
  origin: Vec3;
  tangent: Vec3;
  normal: Vec3;
  binormal: Vec3;
}

export interface InterfaceLocalFrame {
  interfaceId: string;
  pieceId: string;
  frame: Frame3D;
}
