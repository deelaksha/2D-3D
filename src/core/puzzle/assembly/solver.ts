/**
 * Kinematic 3D Assembly Solver.
 *
 * Deterministically computes the target piece's 3D placement transform when connected
 * to a source piece via an interface pair at an arbitrary 3D joining angle.
 */
import type { ConnectionInterface } from "../interface/types";
import type { PuzzleConnection } from "../connection/types";
import type { PuzzlePiece } from "../piece/types";
import type { PuzzlePlacement3D } from "./types";
import type { Transform3D } from "../geometry/types";
import {
  buildInterfaceFrame3DInPieceLocal,
  computeMatingQuaternion,
  transformFrame3D,
} from "../frame/frameTransform";
import {
  add3,
  quatIdentity,
  quatMultiply,
  quatRotateVector,
  scale3,
  sub3,
  vec3,
} from "../geometry/math3d";

export function solveTargetPlacement3D(
  sourcePiece: PuzzlePiece,
  sourceInterface: ConnectionInterface,
  sourcePlacement: PuzzlePlacement3D,
  targetPiece: PuzzlePiece,
  targetInterface: ConnectionInterface,
  connection: PuzzleConnection,
): PuzzlePlacement3D {
  const sourceTransform: Transform3D = {
    position: sourcePlacement.position,
    rotation: sourcePlacement.rotation,
    scale: sourcePlacement.scale,
  };

  // 1. Build source interface 3D frame in world space
  const sourceLocalFrame = buildInterfaceFrame3DInPieceLocal(sourceInterface);
  const sourceWorldFrame = transformFrame3D(sourceLocalFrame, sourceTransform);

  // 2. Compute mating quaternion for target piece
  const qMate = computeMatingQuaternion(
    connection.joiningAngleDeg,
    connection.rollAngleDeg ?? 0,
  );
  const targetRotation = quatMultiply(sourcePlacement.rotation, qMate);

  // 3. Compute target interface 3D frame in target piece local space
  const targetLocalFrame = buildInterfaceFrame3DInPieceLocal(targetInterface);

  // 4. Target interface position in target local space, offset by clearance along normal
  const clearanceOffset = scale3(targetLocalFrame.normal, connection.clearance);
  const targetInterfaceLocalPos = add3(targetLocalFrame.origin, clearanceOffset);

  // 5. Rotate target interface local position into world space
  const rotatedTargetOffset = quatRotateVector(targetRotation, targetInterfaceLocalPos);

  // 6. Target piece origin = source interface world position - rotated target interface offset
  const targetPosition = sub3(sourceWorldFrame.origin, rotatedTargetOffset);

  return {
    pieceId: targetPiece.id,
    position: targetPosition,
    rotation: targetRotation,
    scale: vec3(1, 1, 1),
    placed: true,
  };
}
