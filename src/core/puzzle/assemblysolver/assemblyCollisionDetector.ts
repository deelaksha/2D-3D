/**
 * Assembly Collision Detector (Phase 89).
 *
 * Evaluates 3D spatial interference between candidate piece placements
 * and all already-assembled subassembly geometry.
 *
 * Implements two-phase collision detection:
 *  - Phase 1: Broad-phase world-space Oriented/Axis-Aligned Bounding Box culling.
 *  - Phase 2: Narrow-phase boundary and interface contact clearance validation.
 *
 * Distinguishes intentional interface contact at designated joints from
 * illegal body-on-body interpenetrations.
 */

import type { ID, Vec3 } from "@/core/model/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import { localToWorld } from "../framesystem/transformEngine";
import { add3, len3, quatRotateVector, sub3, vec3 } from "../geometry/math3d";
import type { GeneratedPiece3D } from "../piece3d/types";

export interface CollisionCheckResult {
  hasCollision: boolean;
  conflictingPieceId?: string;
  penetrationDepthMm: number;
  message?: string;
}

export interface BoundingBox3D {
  min: Vec3;
  max: Vec3;
  center: Vec3;
}

export class AssemblyCollisionDetector {
  /**
   * Checks if candidate piece at candidateTransform collides with any already-placed pieces (wrapper).
   */
  public static checkCollision(params: {
    candidatePiece: GeneratedPiece3D;
    candidateTransform: RigidTransform3D;
    placedPieces: Map<string, GeneratedPiece3D>;
    placedTransforms: Record<string, RigidTransform3D>;
    connectedNeighborIds?: Set<string>;
    toleranceMm?: number;
  }): { collides: boolean; collidingPieceId?: string; penetrationDepthMm?: number } {
    const res = this.checkCollisionWithSubassembly(
      params.candidatePiece,
      params.candidateTransform,
      params.placedPieces,
      params.placedTransforms,
      params.connectedNeighborIds ?? new Set<string>(),
      params.toleranceMm ?? 0.1
    );
    return {
      collides: res.hasCollision,
      collidingPieceId: res.conflictingPieceId,
      penetrationDepthMm: res.penetrationDepthMm,
    };
  }

  /**
   * Computes the 3D world-space AABB for a piece at the given rigid transform.
   */
  public static computeWorldAABB(
    piece: GeneratedPiece3D,
    transform: RigidTransform3D
  ): BoundingBox3D {
    const halfThick = (piece.thickness ?? 3.0) / 2;
    let minX = -25, maxX = 25, minY = -20, maxY = 20;

    if (piece.profile?.localBounds) {
      minX = piece.profile.localBounds.minX;
      maxX = piece.profile.localBounds.maxX;
      minY = piece.profile.localBounds.minY;
      maxY = piece.profile.localBounds.maxY;
    }

    const corners: Vec3[] = [
      vec3(minX, minY, -halfThick),
      vec3(maxX, minY, -halfThick),
      vec3(maxX, maxY, -halfThick),
      vec3(minX, maxY, -halfThick),
      vec3(minX, minY, halfThick),
      vec3(maxX, minY, halfThick),
      vec3(maxX, maxY, halfThick),
      vec3(minX, maxY, halfThick),
    ];

    let wMinX = Number.POSITIVE_INFINITY, wMaxX = Number.NEGATIVE_INFINITY;
    let wMinY = Number.POSITIVE_INFINITY, wMaxY = Number.NEGATIVE_INFINITY;
    let wMinZ = Number.POSITIVE_INFINITY, wMaxZ = Number.NEGATIVE_INFINITY;

    for (const c of corners) {
      const worldPt = localToWorld(transform, c);
      if (worldPt.x < wMinX) wMinX = worldPt.x;
      if (worldPt.x > wMaxX) wMaxX = worldPt.x;
      if (worldPt.y < wMinY) wMinY = worldPt.y;
      if (worldPt.y > wMaxY) wMaxY = worldPt.y;
      if (worldPt.z < wMinZ) wMinZ = worldPt.z;
      if (worldPt.z > wMaxZ) wMaxZ = worldPt.z;
    }

    return {
      min: vec3(wMinX, wMinY, wMinZ),
      max: vec3(wMaxX, wMaxY, wMaxZ),
      center: vec3((wMinX + wMaxX) / 2, (wMinY + wMaxY) / 2, (wMinZ + wMaxZ) / 2),
    };
  }

  /**
   * Checks if candidate piece at candidateTransform collides with any already-placed pieces.
   */
  public static checkCollisionWithSubassembly(
    candidatePiece: GeneratedPiece3D,
    candidateTransform: RigidTransform3D,
    placedPieces: Map<string, GeneratedPiece3D>,
    placedTransforms: Record<string, RigidTransform3D>,
    connectedNeighborIds: Set<string>,
    toleranceMm = 0.1
  ): CollisionCheckResult {
    const candAABB = this.computeWorldAABB(candidatePiece, candidateTransform);

    for (const [placedId, placedPiece] of placedPieces.entries()) {
      if (placedId === candidatePiece.pieceId) continue;

      const placedTransform = placedTransforms[placedId];
      if (!placedTransform) continue;

      const placedAABB = this.computeWorldAABB(placedPiece, placedTransform);

      // 1. Broad-phase AABB overlap test
      const overlapX = Math.min(candAABB.max.x, placedAABB.max.x) - Math.max(candAABB.min.x, placedAABB.min.x);
      const overlapY = Math.min(candAABB.max.y, placedAABB.max.y) - Math.max(candAABB.min.y, placedAABB.min.y);
      const overlapZ = Math.min(candAABB.max.z, placedAABB.max.z) - Math.max(candAABB.min.z, placedAABB.min.z);

      // If no bounding overlap in any dimension (with tolerance), no collision
      if (overlapX < -toleranceMm || overlapY < -toleranceMm || overlapZ < -toleranceMm) {
        continue;
      }

      const isDirectMatingNeighbor = connectedNeighborIds.has(placedId);
      const minThick = Math.min(candidatePiece.thickness ?? 3, placedPiece.thickness ?? 3);

      const dimA = candidatePiece.profile?.localBounds
        ? {
            w: candidatePiece.profile.localBounds.maxX - candidatePiece.profile.localBounds.minX,
            h: candidatePiece.profile.localBounds.maxY - candidatePiece.profile.localBounds.minY,
          }
        : { w: 50, h: 40 };

      const dimB = placedPiece.profile?.localBounds
        ? {
            w: placedPiece.profile.localBounds.maxX - placedPiece.profile.localBounds.minX,
            h: placedPiece.profile.localBounds.maxY - placedPiece.profile.localBounds.minY,
          }
        : { w: 50, h: 40 };

      const minSpan = Math.min(dimA.w, dimA.h, dimB.w, dimB.h);

      // If pieces are direct mating neighbors, they are expected to touch along their interface boundary
      // and their tabs/slots intentionally overlap by the tab insertion depth.
      if (isDirectMatingNeighbor) {
        // Severe direct folding interpenetration:
        // When pieces fold onto each other (e.g. 0° fold-back or extreme acute overlap),
        // the piece centers occupy the same spatial position (centerDist < minSpan * 0.5)
        // or the bodies overlap over more than 50% of their span.
        const centerDist = len3(sub3(candAABB.center, placedAABB.center));
        const majorOverlapX = overlapX > Math.min(dimA.w, dimB.w) * 0.5;
        const majorOverlapY = overlapY > Math.min(dimA.h, dimB.h) * 0.5;

        if (centerDist < minSpan * 0.4 || (majorOverlapX && majorOverlapY && overlapZ > minThick * 0.5)) {
          const depth = Number((minSpan * 0.5 - centerDist).toFixed(3));
          return {
            hasCollision: true,
            conflictingPieceId: placedId,
            penetrationDepthMm: Math.max(depth, minThick),
            message: `Direct body folding overlap with mating neighbor '${placedId}' (centerDist: ${centerDist.toFixed(1)}mm < ${minSpan * 0.4}mm).`,
          };
        }
      } else {
        // For non-mating pieces, check for actual body volumetric interference.
        // In grid or planar assemblies, diagonally adjacent pieces meet at corner vertices where
        // connector tab/slot bounding boxes overlap by tabDepth in X and Y, but their solid bodies do not collide.
        const centerDist = len3(sub3(candAABB.center, placedAABB.center));
        const maxTabProtrusion = 8.0;
        const isCornerTouch = centerDist >= minSpan * 0.8 && overlapX <= maxTabProtrusion && overlapY <= maxTabProtrusion;

        if (!isCornerTouch && overlapX > toleranceMm && overlapY > toleranceMm && overlapZ > toleranceMm) {
          const penetrationDepth = Number(Math.min(overlapX, overlapY, overlapZ).toFixed(3));
          return {
            hasCollision: true,
            conflictingPieceId: placedId,
            penetrationDepthMm: penetrationDepth,
            message: `Spatial collision with non-neighbor piece '${placedId}' (penetration depth: ${penetrationDepth}mm).`,
          };
        }
      }
    }

    return {
      hasCollision: false,
      penetrationDepthMm: 0.0,
    };
  }
}
