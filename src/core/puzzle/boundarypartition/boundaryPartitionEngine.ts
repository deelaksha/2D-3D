/**
 * Automatic Puzzle-Boundary Partitioning Engine (Phase 82).
 *
 * Core Orchestrator that deterministically partitions arbitrary 2D puzzle boundaries
 * into individual pieces according to user-selected styles and parameters.
 */

import type { Vec2 } from "@/core/model/types";
import type {
  BoundaryInput,
  PartitionDiagnostics,
  PartitionParameters,
  PartitionRequest,
  PartitionResult,
  PartitionedPiece,
  SharedBoundaryEdge,
} from "./types";
import {
  cleanPolygonVertices,
  computeBounds,
  distance,
  ensureCCW,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  polygonPerimeter,
} from "./polygonMath";
import { RectangularStrategy } from "./strategies/rectangularStrategy";
import { PolygonalStrategy } from "./strategies/polygonalStrategy";
import { IrregularStrategy } from "./strategies/irregularStrategy";
import { OrganicStrategy } from "./strategies/organicStrategy";
import { BoundaryPartitionValidator } from "./boundaryPartitionValidator";

export class BoundaryPartitionEngine {
  /**
   * Primary entry point: Partitions an overall boundary into individual pieces.
   */
  public static partition(request: PartitionRequest): PartitionResult {
    const startTime = Date.now();

    // 1. Normalize boundary vertices
    const rawVertices = Array.isArray(request.boundary)
      ? request.boundary
      : (request.boundary as BoundaryInput)?.vertices;

    if (!rawVertices || rawVertices.length < 3) {
      return this.createFailureResult(
        "ERR_INVALID_BOUNDARY",
        "Boundary must contain at least 3 vertices to form a 2D closed polygon.",
        rawVertices || [],
        startTime
      );
    }

    const cleanBoundary = ensureCCW(cleanPolygonVertices(rawVertices));
    const boundaryArea = polygonArea(cleanBoundary);
    const boundaryPerimeter = polygonPerimeter(cleanBoundary);

    if (boundaryArea <= 0.01) {
      return this.createFailureResult(
        "ERR_ZERO_BOUNDARY_AREA",
        `Boundary planar area (${boundaryArea.toFixed(2)} mm²) is non-positive.`,
        cleanBoundary,
        startTime
      );
    }

    const targetCount = Math.max(2, Math.round(request.targetPieceCount || 4));
    const style = request.style || "polygonal";
    const params: PartitionParameters = request.parameters || {};

    // 2. Execute selected partitioning strategy
    let rawPieces;
    try {
      switch (style) {
        case "rectangular":
          rawPieces = RectangularStrategy.partition(cleanBoundary, targetCount, params);
          break;
        case "irregular":
          rawPieces = IrregularStrategy.partition(cleanBoundary, targetCount, params);
          break;
        case "organic":
          rawPieces = OrganicStrategy.partition(cleanBoundary, targetCount, params);
          break;
        case "polygonal":
        default:
          rawPieces = PolygonalStrategy.partition(cleanBoundary, targetCount, params);
          break;
      }
    } catch (err: any) {
      return this.createFailureResult(
        "ERR_PARTITION_EXECUTION_FAILURE",
        `Partitioning strategy failed: ${err.message || String(err)}`,
        cleanBoundary,
        startTime
      );
    }

    // 3. Compile raw pieces into rich PartitionedPiece objects
    const partitionedPieces: PartitionedPiece[] = [];

    for (let idx = 0; idx < rawPieces.length; idx++) {
      const rp = rawPieces[idx];
      const area = Number(polygonArea(rp.vertices).toFixed(2));
      const perimeter = Number(polygonPerimeter(rp.vertices).toFixed(2));
      const centroid = polygonCentroid(rp.vertices);
      const bounds = computeBounds(rp.vertices);

      // Extract shared edges and neighbor IDs
      const neighborIds: string[] = [];
      const sharedEdges: SharedBoundaryEdge[] = [];

      for (const [nId, seg] of rp.neighbors.entries()) {
        neighborIds.push(nId);
        sharedEdges.push({
          neighborId: nId,
          start: seg.start,
          end: seg.end,
          lengthMm: Number(distance(seg.start, seg.end).toFixed(2)),
        });
      }

      // Check if this piece is on the outer boundary
      let isBorderPiece = false;
      const nVerts = rp.vertices.length;
      for (let i = 0; i < nVerts; i++) {
        const pMid: Vec2 = {
          x: (rp.vertices[i].x + rp.vertices[(i + 1) % nVerts].x) / 2,
          y: (rp.vertices[i].y + rp.vertices[(i + 1) % nVerts].y) / 2,
        };
        // If an edge midpoint lies on the boundary perimeter
        if (pointInPolygon(pMid, cleanBoundary, 0.05)) {
          // Check distance to boundary edges
          for (let b = 0; b < cleanBoundary.length; b++) {
            const b1 = cleanBoundary[b];
            const b2 = cleanBoundary[(b + 1) % cleanBoundary.length];
            const dSeg = distance(b1, b2);
            if (dSeg > 1e-4 && Math.abs(distance(b1, pMid) + distance(pMid, b2) - dSeg) < 0.1) {
              isBorderPiece = true;
              break;
            }
          }
        }
        if (isBorderPiece) break;
      }

      partitionedPieces.push({
        id: rp.id,
        name: `Piece ${idx + 1}`,
        vertices: rp.vertices,
        areaMm2: area,
        perimeterMm: perimeter,
        centroid,
        bounds,
        isBorderPiece,
        neighborIds,
        sharedEdges,
      });
    }

    // 4. Validate output
    const diagnostics = BoundaryPartitionValidator.validate(cleanBoundary, partitionedPieces, params);

    const totalPiecesArea = partitionedPieces.reduce((sum, p) => sum + p.areaMm2, 0);
    const areaCoverageRatio = Number((totalPiecesArea / Math.max(1, boundaryArea)).toFixed(4));
    const success = diagnostics.isValid;

    return {
      success,
      pieces: partitionedPieces,
      boundary: {
        vertices: cleanBoundary,
        areaMm2: Number(boundaryArea.toFixed(2)),
        perimeterMm: Number(boundaryPerimeter.toFixed(2)),
      },
      actualPieceCount: partitionedPieces.length,
      areaCoverageRatio,
      diagnostics,
      executionDurationMs: Date.now() - startTime,
    };
  }

  private static createFailureResult(
    code: string,
    message: string,
    vertices: Vec2[],
    startTime: number
  ): PartitionResult {
    const area = vertices.length >= 3 ? polygonArea(vertices) : 0;
    const perimeter = vertices.length >= 3 ? polygonPerimeter(vertices) : 0;

    const diagnostics: PartitionDiagnostics = {
      isValid: false,
      issues: [
        {
          code,
          severity: "error",
          message,
        },
      ],
      metrics: {
        areaConservationErrorPct: 100,
        containmentViolationsCount: 0,
        selfIntersectionCount: 0,
        minFeatureSizeFoundMm: 0,
        minFeatureSizeViolationsCount: 0,
        isolatedPieceCount: 0,
        overlapDetected: false,
        gapDetected: true,
      },
    };

    return {
      success: false,
      pieces: [],
      boundary: {
        vertices,
        areaMm2: Number(area.toFixed(2)),
        perimeterMm: Number(perimeter.toFixed(2)),
      },
      actualPieceCount: 0,
      areaCoverageRatio: 0,
      diagnostics,
      executionDurationMs: Date.now() - startTime,
    };
  }
}
