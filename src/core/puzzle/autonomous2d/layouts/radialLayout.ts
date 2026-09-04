/**
 * Radial Layout Strategy for Autonomous 2D Puzzle Generation.
 *
 * Deterministically partitions a circular boundary into angular sectors (and optional concentric rings)
 * with shared radial boundary interfaces.
 */

import type { Vec2 } from "@/core/model/types";
import type { BoundarySegment2D, PuzzleBoundary2D } from "../types";
import type { PartitionLayoutResult, RawPieceLayout, SharedEdge } from "./types";
import { distance2D, polygonArea, polygonPerimeter } from "../geometry2D";

export class RadialLayoutGenerator {
  public static partition(
    widthMm: number,
    heightMm: number,
    targetPieceCount: number
  ): PartitionLayoutResult {
    const N = Math.max(3, Math.round(targetPieceCount));
    const radius = Math.min(widthMm, heightMm) / 2;
    const center: Vec2 = { x: widthMm / 2, y: heightMm / 2 };

    // Discretize circular boundary
    const boundaryPointsCount = Math.max(36, N * 8);
    const boundaryVertices: Vec2[] = [];
    for (let i = 0; i < boundaryPointsCount; i++) {
      const angle = (i / boundaryPointsCount) * Math.PI * 2;
      boundaryVertices.push({
        x: Number((center.x + Math.cos(angle) * radius).toFixed(4)),
        y: Number((center.y + Math.sin(angle) * radius).toFixed(4)),
      });
    }

    const puzzleBoundary: PuzzleBoundary2D = {
      kind: "circle",
      widthMm: radius * 2,
      heightMm: radius * 2,
      vertices: boundaryVertices,
      areaMm2: Number((Math.PI * radius * radius).toFixed(2)),
      perimeterMm: Number((2 * Math.PI * radius).toFixed(2)),
      bounds: {
        minX: center.x - radius,
        minY: center.y - radius,
        maxX: center.x + radius,
        maxY: center.y + radius,
      },
    };

    const pieces: RawPieceLayout[] = [];
    const sharedEdges: SharedEdge[] = [];
    const outerSegments: BoundarySegment2D[] = [];

    // Simple radial wedges: N sectors from angle 0 to 2*PI
    const arcSamplesPerSector = 8;
    const deltaAngle = (Math.PI * 2) / N;

    for (let i = 0; i < N; i++) {
      const pieceId = `p_rad_${i + 1}`;
      const angleStart = i * deltaAngle;
      const angleEnd = (i + 1) * deltaAngle;

      // Vertices: Center -> arc points from angleStart to angleEnd -> back to Center
      const pieceVertices: Vec2[] = [
        { x: Number(center.x.toFixed(4)), y: Number(center.y.toFixed(4)) }, // v0: Center
      ];

      for (let s = 0; s <= arcSamplesPerSector; s++) {
        const theta = angleStart + (s / arcSamplesPerSector) * deltaAngle;
        pieceVertices.push({
          x: Number((center.x + Math.cos(theta) * radius).toFixed(4)),
          y: Number((center.y + Math.sin(theta) * radius).toFixed(4)),
        });
      }

      pieces.push({
        pieceId,
        name: `Radial Sector ${i + 1}`,
        vertices: pieceVertices,
        layoutMetadata: {
          layoutType: "radial",
          index: i + 1,
          radialPosition: {
            sector: i + 1,
            ring: 1,
            angleStartDeg: Number(((angleStart * 180) / Math.PI).toFixed(1)),
            angleEndDeg: Number(((angleEnd * 180) / Math.PI).toFixed(1)),
          },
        },
      });

      // Outer boundary segment along the circular arc
      const arcStart = pieceVertices[1];
      const arcEnd = pieceVertices[pieceVertices.length - 1];
      outerSegments.push({
        id: `outer_${pieceId}_arc`,
        pieceId,
        start: arcStart,
        end: arcEnd,
        lengthMm: radius * deltaAngle,
        isOuter: true,
        edgeIndex: 1,
      });
    }

    // Connect adjacent sectors along shared radial rays
    for (let i = 0; i < N; i++) {
      const pieceAId = pieces[i].pieceId;
      const nextIdx = (i + 1) % N;
      const pieceBId = pieces[nextIdx].pieceId;

      // Ray from Center to angleEnd of pieceA == angleStart of pieceB
      const angleRay = (i + 1) * deltaAngle;
      const rayStart: Vec2 = { x: Number(center.x.toFixed(4)), y: Number(center.y.toFixed(4)) };
      const rayEnd: Vec2 = {
        x: Number((center.x + Math.cos(angleRay) * radius).toFixed(4)),
        y: Number((center.y + Math.sin(angleRay) * radius).toFixed(4)),
      };

      sharedEdges.push({
        id: `shared_${pieceAId}_${pieceBId}`,
        pieceAId,
        pieceBId,
        edgeIndexA: pieces[i].vertices.length - 1, // last edge returning to center
        edgeIndexB: 0, // first edge leaving center
        start: rayStart,
        end: rayEnd,
      });
    }

    return {
      puzzleBoundary,
      pieces,
      sharedEdges,
      outerSegments,
    };
  }
}
