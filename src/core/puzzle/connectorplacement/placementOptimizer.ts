/**
 * Parametric Connector Placement Optimizer (Phase 84).
 *
 * Deterministically optimizes connector quantities and locations (single, multiple, asymmetric)
 * along piece interface edges considering physical margins, structural balance, and manufacturability.
 */

import type { Vec2 } from "@/core/model/types";
import type {
  InterfaceEdgeInput,
  MaterialPlacementConstraints,
  PlacedConnectorLocation,
  PlacementPieceInput,
  PlacementQualityMetrics,
  PlacementRejection,
} from "./types";
import { CornerProximityEvaluator } from "./cornerProximityEvaluator";
import { uid } from "@/core/model/ids";

export class PlacementOptimizer {
  /**
   * Optimizes connector placements along a single shared interface edge.
   */
  public static optimizeEdge(
    edge: InterfaceEdgeInput,
    pieceA: PlacementPieceInput,
    pieceB: PlacementPieceInput,
    constraints?: Partial<MaterialPlacementConstraints>,
    difficulty: "easy" | "medium" | "hard" | "expert" = "medium",
    forceAsymmetric = false
  ): {
    placedConnectors: PlacedConnectorLocation[];
    rejections: PlacementRejection[];
    warnings: string[];
    metrics: PlacementQualityMetrics;
    status: "PLACED" | "SKIPPED" | "DEGRADED";
  } {
    const rejections: PlacementRejection[] = [];
    const warnings: string[] = [];

    const thickness = Math.max(pieceA.thicknessMm, pieceB.thicknessMm);
    const edgeLen = edge.lengthMm;

    // Feature sizing
    const featureWidth = Number(Math.max(6.0, Math.min(edgeLen * 0.35, 20.0)).toFixed(2));
    const featureDepth = Number(Math.max(3.0, Math.min(thickness * 1.5, 9.0)).toFixed(2));
    const clearance = thickness <= 3.0 ? 0.15 : 0.20;

    // Evaluate safe range avoiding corners
    const safeRange = CornerProximityEvaluator.evaluateSafeRange(
      edgeLen,
      thickness,
      featureWidth,
      constraints
    );

    if (!safeRange.isFeasible) {
      rejections.push({
        edgeId: edge.id,
        reasonCode: "REJECTED_EDGE_TOO_SHORT",
        message: safeRange.rejectionReason || "Edge too short to host connector safely.",
      });

      return {
        placedConnectors: [],
        rejections,
        warnings,
        metrics: {
          structuralBalanceScore: 0.0,
          manufacturabilityScore: 0.0,
          assemblyAccessibilityScore: 0.0,
          overallQualityScore: 0.0,
        },
        status: "SKIPPED",
      };
    }

    // Determine placement mode
    let mode = edge.preferredPlacementMode || "auto";
    if (forceAsymmetric || (difficulty === "hard" && mode === "auto" && edgeLen >= 60.0)) {
      mode = "asymmetric";
    }

    const minGap = constraints?.minInterConnectorGapMm ?? 8.0;
    let targetOffsets: { t: number; mode: "single" | "multiple" | "asymmetric" }[] = [];
    let status: "PLACED" | "SKIPPED" | "DEGRADED" = "PLACED";

    if (mode === "single") {
      targetOffsets = [{ t: 0.5, mode: "single" }];
    } else if (mode === "asymmetric") {
      // 2 connectors placed asymmetrically to prevent 180° inversion
      const requiredSpan = 2 * featureWidth + minGap + 2 * safeRange.cornerMarginMm;
      if (edgeLen >= requiredSpan) {
        targetOffsets = [
          { t: 0.28, mode: "asymmetric" },
          { t: 0.74, mode: "asymmetric" },
        ];
      } else {
        // Degrade to single off-center connector
        targetOffsets = [{ t: 0.42, mode: "asymmetric" }];
        warnings.push(`Edge too short for 2 asymmetric connectors; degraded to 1 off-center connector.`);
        status = "DEGRADED";
      }
    } else if (mode === "multiple" || (mode === "auto" && edgeLen >= 75.0)) {
      // Multiple connectors
      const requiredSpanFor2 = 2 * featureWidth + minGap + 2 * safeRange.cornerMarginMm;
      const requiredSpanFor3 = 3 * featureWidth + 2 * minGap + 2 * safeRange.cornerMarginMm;

      if (edgeLen >= requiredSpanFor3 && difficulty === "expert") {
        targetOffsets = [
          { t: 0.25, mode: "multiple" },
          { t: 0.50, mode: "multiple" },
          { t: 0.75, mode: "multiple" },
        ];
      } else if (edgeLen >= requiredSpanFor2) {
        targetOffsets = [
          { t: 0.32, mode: "multiple" },
          { t: 0.68, mode: "multiple" },
        ];
      } else {
        targetOffsets = [{ t: 0.5, mode: "single" }];
        if (mode === "multiple") {
          warnings.push(`Edge length (${edgeLen.toFixed(1)} mm) insufficient for multiple connectors; degraded to single centered connector.`);
          status = "DEGRADED";
        }
      }
    } else {
      // Default: single centered connector
      targetOffsets = [{ t: 0.5, mode: "single" }];
    }

    // Build PlacedConnectorLocation instances
    const placedConnectors: PlacedConnectorLocation[] = [];

    for (const item of targetOffsets) {
      const t = item.t;
      const worldPos: Vec2 = {
        x: Number((edge.start.x + (edge.end.x - edge.start.x) * t).toFixed(3)),
        y: Number((edge.start.y + (edge.end.y - edge.start.y) * t).toFixed(3)),
      };

      const distFromStart = t * edgeLen - featureWidth / 2;
      const distFromEnd = (1.0 - t) * edgeLen - featureWidth / 2;

      placedConnectors.push({
        connectorId: uid("conn_loc_"),
        edgeId: edge.id,
        pieceAId: pieceA.id,
        pieceBId: pieceB.id,
        parametricOffsetT: t,
        worldPosition: worldPos,
        normal: edge.normal,
        tangent: edge.tangent,
        widthMm: featureWidth,
        depthMm: featureDepth,
        clearanceMm: clearance,
        cornerMarginStartMm: Number(distFromStart.toFixed(2)),
        cornerMarginEndMm: Number(distFromEnd.toFixed(2)),
        placementMode: item.mode,
      });
    }

    // Calculate quality metrics
    const balanceScore =
      placedConnectors.length === 1
        ? 1.0 - Math.abs(placedConnectors[0].parametricOffsetT - 0.5) * 2
        : 0.95;

    const manufacturabilityScore = Number(
      Math.min(1.0, (safeRange.availableSpanMm / edgeLen) * 1.2).toFixed(2)
    );
    const accessibilityScore = 0.95; // Unobstructed 2D edge

    const overallScore = Number(
      (balanceScore * 0.4 + manufacturabilityScore * 0.4 + accessibilityScore * 0.2).toFixed(2)
    );

    return {
      placedConnectors,
      rejections,
      warnings,
      metrics: {
        structuralBalanceScore: Number(balanceScore.toFixed(2)),
        manufacturabilityScore,
        assemblyAccessibilityScore: accessibilityScore,
        overallQualityScore: overallScore,
      },
      status,
    };
  }
}
