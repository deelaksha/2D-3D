/**
 * Coordinate Frame Transformation utilities.
 *
 * Constructs deterministic 3D coordinate frames for connection interfaces and calculates
 * relative transformations for mating at arbitrary 3D joining angles.
 */
import type { Vec2, Vec3 } from "@/core/model/types";
import type { ConnectionInterface } from "../interface/types";
import type { PuzzlePiece } from "../piece/types";
import type { Frame2D, Frame3D } from "./types";
import type { Quaternion, Transform3D } from "../geometry/types";
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

/** Create a 2D local frame for an interface on a piece. */
export function buildInterfaceFrame2D(iface: ConnectionInterface): Frame2D {
  return {
    origin: iface.position,
    normal: iface.normal,
    tangent: iface.tangent,
  };
}

/** Construct a 3D coordinate frame for an interface in piece-local 3D space. */
export function buildInterfaceFrame3DInPieceLocal(iface: ConnectionInterface): Frame3D {
  const origin: Vec3 = vec3(iface.position.x, iface.position.y, 0);
  const tangent: Vec3 = normalize3(vec3(iface.tangent.x, iface.tangent.y, 0));
  const normal: Vec3 = normalize3(vec3(iface.normal.x, iface.normal.y, 0));
  const binormal: Vec3 = normalize3(cross3(tangent, normal));

  return { origin, tangent, normal, binormal };
}

/** Transform a 3D interface frame by a piece's world 3D transform. */
export function transformFrame3D(frame: Frame3D, pieceTransform: Transform3D): Frame3D {
  const origin = add3(
    pieceTransform.position,
    quatRotateVector(pieceTransform.rotation, frame.origin),
  );
  const tangent = normalize3(quatRotateVector(pieceTransform.rotation, frame.tangent));
  const normal = normalize3(quatRotateVector(pieceTransform.rotation, frame.normal));
  const binormal = normalize3(cross3(tangent, normal));

  return { origin, tangent, normal, binormal };
}

/**
 * Compute relative rotation quaternion for mating target interface to source interface at an
 * arbitrary joining angle (joiningAngleDeg) around the tangent axis.
 */
export function computeMatingQuaternion(
  joiningAngleDeg: number,
  rollAngleDeg = 0.0,
): Quaternion {
  // Oppose facing direction (180 deg around binormal/Z) + joining angle around tangent/X + roll around normal/Y
  const angleRad = (joiningAngleDeg * Math.PI) / 180;
  const rollRad = (rollAngleDeg * Math.PI) / 180;

  // 180 degree flip so normals oppose each other
  const qFlip = quatFromAxisAngle(vec3(0, 0, 1), Math.PI);
  // Rotation by joining angle along tangent X
  const qJoining = quatFromAxisAngle(vec3(1, 0, 0), angleRad);
  // Roll angle along normal Y
  const qRoll = quatFromAxisAngle(vec3(0, 1, 0), rollRad);

  return quatMultiply(qJoining, quatMultiply(qRoll, qFlip));
}
