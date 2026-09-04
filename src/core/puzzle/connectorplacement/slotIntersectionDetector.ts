/**
 * Slot Intersection & Thin Material Detector (Phase 84).
 *
 * Detects and prevents internal cutout collisions and thin bridge slivers
 * between connectors on adjacent or intersecting edges of the same piece.
 */

import type { Vec2 } from "@/core/model/types";
import type { PlacedConnectorLocation } from "./types";

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export class SlotIntersectionDetector {
  /**
   * Checks whether two connectors placed on the same piece have intersecting cutouts
   * or violate minimum bridge width between their internal cavities.
   */
  public static checkCollision(
    connA: PlacedConnectorLocation,
    connB: PlacedConnectorLocation,
    minBridgeWidthMm = 4.0
  ): {
    hasIntersection: boolean;
    clearanceDistanceMm: number;
    message?: string;
  } {
    // If on the same edge
    if (connA.edgeId === connB.edgeId) {
      const centerDist = distance(connA.worldPosition, connB.worldPosition);
      const spanA = connA.widthMm / 2;
      const spanB = connB.widthMm / 2;
      const interGap = centerDist - (spanA + spanB);

      if (interGap < minBridgeWidthMm) {
        return {
          hasIntersection: true,
          clearanceDistanceMm: interGap,
          message: `Connectors on the same edge have insufficient gap (${interGap.toFixed(1)} mm < ${minBridgeWidthMm} mm).`,
        };
      }
      return {
        hasIntersection: false,
        clearanceDistanceMm: interGap,
      };
    }

    // On different edges of the same piece: calculate internal cutout cavity centers
    // Inward penetration vector = -normal * depth
    const internalCavityCenterA: Vec2 = {
      x: connA.worldPosition.x - connA.normal.x * (connA.depthMm / 2),
      y: connA.worldPosition.y - connA.normal.y * (connA.depthMm / 2),
    };

    const internalCavityCenterB: Vec2 = {
      x: connB.worldPosition.x - connB.normal.x * (connB.depthMm / 2),
      y: connB.worldPosition.y - connB.normal.y * (connB.depthMm / 2),
    };

    const cavityDist = distance(internalCavityCenterA, internalCavityCenterB);
    const minSafeDist = (connA.widthMm + connB.widthMm) / 4 + minBridgeWidthMm;

    if (cavityDist < minSafeDist) {
      return {
        hasIntersection: true,
        clearanceDistanceMm: cavityDist,
        message: `Internal cutouts on adjacent edges are too close (${cavityDist.toFixed(1)} mm < ${minSafeDist.toFixed(1)} mm). Material wall would be dangerously thin.`,
      };
    }

    return {
      hasIntersection: false,
      clearanceDistanceMm: cavityDist,
    };
  }
}
