/**
 * Boundary Partition Validator (Phase 82).
 *
 * Validates:
 *  1. Area conservation (sum of piece areas vs boundary area)
 *  2. Boundary containment (all piece vertices lie within global boundary)
 *  3. Piece connectivity (connected topology graph, 0 orphan pieces)
 *  4. Self-intersection prevention
 *  5. Minimum feature size compliance
 *  6. Gap and overlap diagnostics
 */

import type { Vec2 } from "@/core/model/types";
import type {
  PartitionDiagnostics,
  PartitionIssue,
  PartitionMetrics,
  PartitionParameters,
  PartitionedPiece,
} from "./types";
import {
  distance,
  findShortestEdgeLength,
  hasSelfIntersections,
  pointInPolygon,
  polygonArea,
} from "./polygonMath";

export class BoundaryPartitionValidator {
  public static validate(
    boundaryVertices: Vec2[],
    pieces: PartitionedPiece[],
    params?: PartitionParameters
  ): PartitionDiagnostics {
    const issues: PartitionIssue[] = [];
    const boundaryArea = polygonArea(boundaryVertices);
    const minFeatureReq = params?.minFeatureSizeMm ?? 5.0;

    // 1. Area Conservation
    let totalPiecesArea = 0;
    for (const p of pieces) {
      totalPiecesArea += p.areaMm2;
    }

    const areaDelta = Math.abs(totalPiecesArea - boundaryArea);
    const areaConservationErrorPct = Number(((areaDelta / Math.max(1, boundaryArea)) * 100).toFixed(3));

    let overlapDetected = false;
    let gapDetected = false;

    if (areaConservationErrorPct > 2.0) {
      if (totalPiecesArea > boundaryArea) {
        overlapDetected = true;
        issues.push({
          code: "ERR_UNINTENDED_OVERLAP",
          severity: "error",
          message: `Total piece area (${totalPiecesArea.toFixed(1)} mm²) exceeds boundary area (${boundaryArea.toFixed(1)} mm²) by ${areaConservationErrorPct}%. Unintended overlap detected.`,
          remediation: "Verify polygon clipping and cutting boundaries.",
        });
      } else {
        gapDetected = true;
        issues.push({
          code: "ERR_UNINTENDED_GAP",
          severity: "error",
          message: `Total piece area (${totalPiecesArea.toFixed(1)} mm²) is less than boundary area (${boundaryArea.toFixed(1)} mm²) by ${areaConservationErrorPct}%. Unintended gap detected.`,
          remediation: "Ensure partitioning cuts completely tile the input boundary.",
        });
      }
    } else if (areaConservationErrorPct > 0.5) {
      issues.push({
        code: "WARN_AREA_DISCREPANCY",
        severity: "warning",
        message: `Slight area discrepancy of ${areaConservationErrorPct}% due to curved arc/polygon discretization.`,
      });
    }

    // 2. Boundary Containment
    let containmentViolationsCount = 0;
    for (const p of pieces) {
      for (const v of p.vertices) {
        if (!pointInPolygon(v, boundaryVertices, 0.1)) {
          containmentViolationsCount++;
        }
      }
    }

    if (containmentViolationsCount > 0) {
      issues.push({
        code: "ERR_BOUNDARY_CONTAINMENT_VIOLATION",
        severity: "error",
        message: `${containmentViolationsCount} piece vertices lie outside the global puzzle boundary.`,
        remediation: "Clip all piece boundary segments strictly against the global boundary polygon.",
      });
    }

    // 3. Piece Connectivity & Orphan Detection
    const pieceIds = new Set(pieces.map((p) => p.id));
    const adj = new Map<string, Set<string>>();
    for (const id of pieceIds) adj.set(id, new Set());

    for (const p of pieces) {
      for (const nId of p.neighborIds) {
        if (pieceIds.has(nId)) {
          adj.get(p.id)?.add(nId);
          adj.get(nId)?.add(p.id);
        }
      }
    }

    let isolatedPieceCount = 0;
    for (const p of pieces) {
      if ((adj.get(p.id)?.size ?? 0) === 0 && pieces.length > 1) {
        isolatedPieceCount++;
        issues.push({
          code: "ERR_ISOLATED_PIECE",
          severity: "error",
          message: `Piece '${p.id}' is disconnected from all other pieces in the assembly topology.`,
          remediation: "Ensure every piece shares at least one internal cut segment with an adjacent piece.",
          details: { pieceId: p.id },
        });
      }
    }

    // BFS connectivity
    let connectedComponentCount = 0;
    const visited = new Set<string>();

    for (const id of pieceIds) {
      if (!visited.has(id)) {
        connectedComponentCount++;
        const q = [id];
        visited.add(id);
        while (q.length > 0) {
          const curr = q.shift()!;
          for (const neighbor of adj.get(curr) || []) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              q.push(neighbor);
            }
          }
        }
      }
    }

    if (connectedComponentCount > 1) {
      issues.push({
        code: "ERR_DISCONNECTED_TOPOLOGY",
        severity: "error",
        message: `Partition graph contains ${connectedComponentCount} disconnected topological components.`,
        remediation: "Ensure cutting planes connect all pieces transitively.",
      });
    }

    // 4. Self-Intersection Check
    let selfIntersectionCount = 0;
    for (const p of pieces) {
      if (hasSelfIntersections(p.vertices)) {
        selfIntersectionCount++;
        issues.push({
          code: "ERR_SELF_INTERSECTING_PIECE",
          severity: "error",
          message: `Piece '${p.id}' boundary polygon self-intersects.`,
          remediation: "Verify vertex ordering and eliminate convoluted cutting paths.",
          details: { pieceId: p.id },
        });
      }
    }

    // 5. Minimum Feature Size Check
    let minFeatureSizeFoundMm = Infinity;
    let minFeatureSizeViolationsCount = 0;

    for (const p of pieces) {
      const shortestEdge = findShortestEdgeLength(p.vertices);
      if (shortestEdge < minFeatureSizeFoundMm && shortestEdge > 1e-4) {
        minFeatureSizeFoundMm = shortestEdge;
      }
      if (shortestEdge < minFeatureReq) {
        minFeatureSizeViolationsCount++;
      }
    }

    if (minFeatureSizeFoundMm === Infinity) {
      minFeatureSizeFoundMm = 0;
    }

    if (minFeatureSizeViolationsCount > 0) {
      issues.push({
        code: "WARN_MIN_FEATURE_SIZE_VIOLATION",
        severity: "warning",
        message: `${minFeatureSizeViolationsCount} piece edges are smaller than the requested minimum feature size (${minFeatureReq} mm). Smallest edge: ${minFeatureSizeFoundMm.toFixed(2)} mm.`,
        remediation: "Lower piece count or reduce jitter to prevent narrow corner shards.",
      });
    }

    const metrics: PartitionMetrics = {
      areaConservationErrorPct,
      containmentViolationsCount,
      selfIntersectionCount,
      minFeatureSizeFoundMm: Number(minFeatureSizeFoundMm.toFixed(2)),
      minFeatureSizeViolationsCount,
      isolatedPieceCount,
      overlapDetected,
      gapDetected,
    };

    const hasError = issues.some((i) => i.severity === "error");

    return {
      isValid: !hasError,
      issues,
      metrics,
    };
  }
}
