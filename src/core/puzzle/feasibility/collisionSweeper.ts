/**
 * 3D Collision Sweeper (Phase 68 Baseline).
 *
 * Evaluates spatial interference between a moving piece along its trajectory
 * and all already-assembled subassembly geometry.
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { FeasibilityPieceGeometry } from "./types";
import { add3, len3, quatRotateVector, sub3, vec3 } from "../geometry/math3d";

export interface CollisionSweepResult {
  hasCollision: boolean;
  conflictingPieceId?: ID;
  penetrationDepthMm: number;
  location?: Vec3;
  reason?: string;
}

export class CollisionSweeper {
  /**
   * Computes the world-space bounding box of a piece at a given 3D transform.
   */
  static computeWorldAABB(
    dims: FeasibilityPieceGeometry["dimensions"],
    transform: RigidTransform3D
  ): { min: Vec3; max: Vec3; center: Vec3 } {
    const corners: Vec3[] = [
      vec3(0, 0, 0),
      vec3(dims.width, 0, 0),
      vec3(0, dims.height, 0),
      vec3(dims.width, dims.height, 0),
      vec3(0, 0, dims.thickness),
      vec3(dims.width, 0, dims.thickness),
      vec3(0, dims.height, dims.thickness),
      vec3(dims.width, dims.height, dims.thickness),
    ];

    let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY, maxZ = Number.NEGATIVE_INFINITY;

    for (const c of corners) {
      const worldPt = add3(transform.position, quatRotateVector(transform.rotation, c));
      if (worldPt.x < minX) minX = worldPt.x;
      if (worldPt.x > maxX) maxX = worldPt.x;
      if (worldPt.y < minY) minY = worldPt.y;
      if (worldPt.y > maxY) maxY = worldPt.y;
      if (worldPt.z < minZ) minZ = worldPt.z;
      if (worldPt.z > maxZ) maxZ = worldPt.z;
    }

    return {
      min: vec3(minX, minY, minZ),
      max: vec3(maxX, maxY, maxZ),
      center: vec3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2),
    };
  }

  /**
   * Evaluates pairwise bounding collision between two pieces.
   *
   * @param isTargetMated Whether these two pieces are currently in their final intentional joint state.
   */
  static checkPairCollision(
    pieceA: FeasibilityPieceGeometry,
    transformA: RigidTransform3D,
    pieceB: FeasibilityPieceGeometry,
    transformB: RigidTransform3D,
    isTargetMated = false,
    toleranceMm = 0.1
  ): CollisionSweepResult {
    const boxA = this.computeWorldAABB(pieceA.dimensions, transformA);
    const boxB = this.computeWorldAABB(pieceB.dimensions, transformB);

    const overlapX = Math.max(0, Math.min(boxA.max.x, boxB.max.x) - Math.max(boxA.min.x, boxB.min.x));
    const overlapY = Math.max(0, Math.min(boxA.max.y, boxB.max.y) - Math.max(boxA.min.y, boxB.min.y));
    const overlapZ = Math.max(0, Math.min(boxA.max.z, boxB.max.z) - Math.max(boxA.min.z, boxB.min.z));

    const overlapVol = overlapX * overlapY * overlapZ;
    // Maximum allowable volume overlap for an intentional mating joint interface
    const maxJointVol = isTargetMated
      ? Math.max(pieceA.dimensions.thickness, pieceB.dimensions.thickness) * 35.0 * 5.0
      : toleranceMm * toleranceMm * toleranceMm;

    // Detect true body collision
    if (overlapVol > maxJointVol) {
      // In intentional joints, one dimension is thickness (small); if two dimensions are both large, it's body clash
      if (!isTargetMated || (overlapX > 15 && overlapY > 15)) {
        const penetrationDepth = Math.min(overlapX, overlapY, overlapZ);
        const collisionCenter = vec3(
          (Math.max(boxA.min.x, boxB.min.x) + Math.min(boxA.max.x, boxB.max.x)) / 2,
          (Math.max(boxA.min.y, boxB.min.y) + Math.min(boxA.max.y, boxB.max.y)) / 2,
          (Math.max(boxA.min.z, boxB.min.z) + Math.min(boxA.max.z, boxB.max.z)) / 2
        );

        return {
          hasCollision: true,
          conflictingPieceId: pieceB.pieceId,
          penetrationDepthMm: penetrationDepth,
          location: collisionCenter,
          reason: `Spatial body penetration (${penetrationDepth.toFixed(2)}mm, vol=${overlapVol.toFixed(1)}mm³).`,
        };
      }
    }

    return {
      hasCollision: false,
      penetrationDepthMm: 0.0,
    };
  }

  /**
   * Checks a moving piece at a specific waypoint transform against all already assembled pieces.
   */
  static checkWaypointAgainstSubassembly(
    movingPiece: FeasibilityPieceGeometry,
    waypointTransform: RigidTransform3D,
    assembledPieces: FeasibilityPieceGeometry[],
    assembledTransforms: Record<ID, RigidTransform3D>,
    isFinalRestingPose = false
  ): CollisionSweepResult {
    for (const assembledPiece of assembledPieces) {
      const fixedTransform = assembledTransforms[assembledPiece.pieceId];
      if (!fixedTransform) continue;

      const res = this.checkPairCollision(
        movingPiece,
        waypointTransform,
        assembledPiece,
        fixedTransform,
        isFinalRestingPose
      );

      if (res.hasCollision) {
        return {
          hasCollision: true,
          conflictingPieceId: assembledPiece.pieceId,
          penetrationDepthMm: res.penetrationDepthMm,
          location: res.location,
          reason: res.reason,
        };
      }
    }

    return {
      hasCollision: false,
      penetrationDepthMm: 0.0,
    };
  }
}
