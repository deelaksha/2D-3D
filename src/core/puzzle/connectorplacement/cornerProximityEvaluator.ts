/**
 * Corner Proximity & Edge Margin Evaluator (Phase 84).
 *
 * Ensures connectors maintain safe physical distances from vertices/corners
 * to prevent material chipping, fracture, and structural failure.
 */

import type { MaterialPlacementConstraints } from "./types";

export class CornerProximityEvaluator {
  /**
   * Computes the safe corner buffer margin (mm) based on material thickness.
   */
  public static computeCornerMargin(
    thicknessMm: number,
    constraints?: Partial<MaterialPlacementConstraints>
  ): number {
    const baseMargin = constraints?.minCornerMarginMm ?? 5.0;
    return Math.max(baseMargin, thicknessMm * 1.5);
  }

  /**
   * Evaluates the safe parametric range [tMin, tMax] on an edge of given length.
   */
  public static evaluateSafeRange(
    edgeLengthMm: number,
    thicknessMm: number,
    featureWidthMm: number,
    constraints?: Partial<MaterialPlacementConstraints>
  ): {
    isFeasible: boolean;
    cornerMarginMm: number;
    tMin: number;
    tMax: number;
    availableSpanMm: number;
    rejectionReason?: string;
  } {
    const cornerMarginMm = this.computeCornerMargin(thicknessMm, constraints);
    const halfWidth = featureWidthMm / 2;
    const requiredMargin = cornerMarginMm + halfWidth;

    const availableSpanMm = edgeLengthMm - 2 * requiredMargin;

    if (availableSpanMm <= 0) {
      return {
        isFeasible: false,
        cornerMarginMm,
        tMin: 0.5,
        tMax: 0.5,
        availableSpanMm: 0,
        rejectionReason: `Edge length (${edgeLengthMm.toFixed(1)} mm) is too short for corner margin (${cornerMarginMm.toFixed(1)} mm) and feature width (${featureWidthMm.toFixed(1)} mm). Required minimum: ${(2 * requiredMargin).toFixed(1)} mm.`,
      };
    }

    const tMin = requiredMargin / edgeLengthMm;
    const tMax = 1.0 - requiredMargin / edgeLengthMm;

    return {
      isFeasible: true,
      cornerMarginMm,
      tMin,
      tMax,
      availableSpanMm,
    };
  }
}
