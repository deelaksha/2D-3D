/**
 * Automatic Connector Placement Engine (Phase 84).
 *
 * Core Orchestrator for automatically determining optimized physical connector locations
 * along piece interfaces with strict corner margins, collision avoidance, and detailed reports.
 */

import type {
  ConnectorPlacementRequest,
  ConnectorPlacementResult,
  EdgeConnectorPlacement,
  PlacedConnectorLocation,
  PlacementQualityMetrics,
  PlacementRejection,
  PlacementReport,
} from "./types";
import { PlacementOptimizer } from "./placementOptimizer";
import { PlacementValidator } from "./placementValidator";

export class ConnectorPlacementEngine {
  /**
   * Automatically calculates optimized connector placements across all interface edges.
   */
  public static optimizePlacements(request: ConnectorPlacementRequest): ConnectorPlacementResult {
    const startTime = Date.now();

    const pieceMap = new Map(request.pieces.map((p) => [p.id, p]));
    const placements: EdgeConnectorPlacement[] = [];
    const allPlacedConnectors: PlacedConnectorLocation[] = [];
    const rejections: PlacementRejection[] = [];
    const warnings: string[] = [];

    let singleCount = 0;
    let multiCount = 0;
    let asymmetricCount = 0;

    let sumBalance = 0;
    let sumMfg = 0;
    let sumAccess = 0;
    let validEdgeCount = 0;

    for (const edge of request.edges) {
      const pieceA = pieceMap.get(edge.pieceAId);
      const pieceB = pieceMap.get(edge.pieceBId);

      if (!pieceA || !pieceB) {
        rejections.push({
          edgeId: edge.id,
          reasonCode: "REJECTED_MANUFACTURING_LIMIT",
          message: `Missing piece definition for piece '${edge.pieceAId}' or '${edge.pieceBId}'.`,
        });
        continue;
      }

      const opt = PlacementOptimizer.optimizeEdge(
        edge,
        pieceA,
        pieceB,
        request.materialConstraints,
        request.difficulty || "medium",
        request.forceAsymmetric || false
      );

      placements.push({
        edgeId: edge.id,
        pieceAId: edge.pieceAId,
        pieceBId: edge.pieceBId,
        edgeLengthMm: edge.lengthMm,
        connectors: opt.placedConnectors,
        status: opt.status,
      });

      rejections.push(...opt.rejections);
      warnings.push(...opt.warnings);

      if (opt.placedConnectors.length > 0) {
        allPlacedConnectors.push(...opt.placedConnectors);
        validEdgeCount++;
        sumBalance += opt.metrics.structuralBalanceScore;
        sumMfg += opt.metrics.manufacturabilityScore;
        sumAccess += opt.metrics.assemblyAccessibilityScore;

        if (opt.placedConnectors.length === 1) {
          if (opt.placedConnectors[0].placementMode === "asymmetric") {
            asymmetricCount++;
          } else {
            singleCount++;
          }
        } else {
          if (opt.placedConnectors[0].placementMode === "asymmetric") {
            asymmetricCount++;
          } else {
            multiCount++;
          }
        }
      }
    }

    // Run deterministic validation across all placements
    const validation = PlacementValidator.validateAll(allPlacedConnectors, request.materialConstraints);
    warnings.push(...validation.warnings);

    // Compute aggregate metrics
    const avgBalance = validEdgeCount > 0 ? Number((sumBalance / validEdgeCount).toFixed(2)) : 0.0;
    const avgMfg = validEdgeCount > 0 ? Number((sumMfg / validEdgeCount).toFixed(2)) : 0.0;
    const avgAccess = validEdgeCount > 0 ? Number((sumAccess / validEdgeCount).toFixed(2)) : 0.0;
    const avgOverall = validEdgeCount > 0 ? Number(((avgBalance * 0.4 + avgMfg * 0.4 + avgAccess * 0.2)).toFixed(2)) : 0.0;

    const qualityMetrics: PlacementQualityMetrics = {
      structuralBalanceScore: avgBalance,
      manufacturabilityScore: avgMfg,
      assemblyAccessibilityScore: avgAccess,
      overallQualityScore: avgOverall,
    };

    const report: PlacementReport = {
      totalEdgesEvaluated: request.edges.length,
      totalConnectorsPlaced: allPlacedConnectors.length,
      singleConnectorEdgesCount: singleCount,
      multiConnectorEdgesCount: multiCount,
      asymmetricEdgesCount: asymmetricCount,
      qualityMetrics,
      rejections,
      warnings,
    };

    const success = validation.isValid && (allPlacedConnectors.length > 0 || request.edges.length === 0);

    return {
      success,
      placements,
      allPlacedConnectors,
      report,
      executionDurationMs: Date.now() - startTime,
    };
  }
}
