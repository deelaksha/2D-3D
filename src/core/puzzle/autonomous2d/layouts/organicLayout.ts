/**
 * Organic Layout Strategy for Autonomous 2D Puzzle Generation.
 *
 * Deterministically generates organic jigsaw-style interlocking pieces by modulating
 * interior shared boundary edges with smooth continuous sinusoidal/harmonic curves
 * while keeping outer puzzle perimeter boundaries flush.
 */

import type { Vec2 } from "@/core/model/types";
import type { BoundarySegment2D, PuzzleBoundary2D } from "../types";
import type { PartitionLayoutResult, RawPieceLayout, SharedEdge } from "./types";
import { DeterministicRNG, distance2D, normalize2D } from "../geometry2D";
import { GridLayoutGenerator } from "./gridLayout";

export class OrganicLayoutGenerator {
  public static partition(
    widthMm: number,
    heightMm: number,
    targetPieceCount: number,
    seed: number = 77
  ): PartitionLayoutResult {
    // 1. Base grid partition
    const baseGrid = GridLayoutGenerator.partition(widthMm, heightMm, targetPieceCount);
    const rng = new DeterministicRNG(seed);

    // 2. Modulate each shared interior edge with a deterministic interlocking organic curve
    // Map from sharedEdge.id to modulated curve points
    const modulatedEdgeMap = new Map<string, { pointsA: Vec2[]; pointsB: Vec2[] }>();

    for (const edge of baseGrid.sharedEdges) {
      const len = distance2D(edge.start, edge.end);
      const tangent = normalize2D({ x: edge.end.x - edge.start.x, y: edge.end.y - edge.start.y });
      const normal = { x: -tangent.y, y: tangent.x }; // perpendicular

      // Sample 12 intermediate points with an organic sinusoidal lobe
      const numSamples = 12;
      const amplitude = Math.min(len * 0.15, 6.0); // mm
      // Alternate tab direction deterministically
      const sign = rng.nextFloat() > 0.5 ? 1 : -1;

      const pointsA: Vec2[] = [];
      const pointsB: Vec2[] = [];

      for (let s = 0; s <= numSamples; s++) {
        const t = s / numSamples;
        // Jigsaw bulb profile: sin(pi * t) * (1 + 0.3 * sin(3 * pi * t))
        const envelope = Math.sin(Math.PI * t);
        const wave = Math.sin(Math.PI * t) + 0.25 * Math.sin(3 * Math.PI * t);
        const disp = sign * amplitude * wave;

        const basePt: Vec2 = {
          x: edge.start.x + tangent.x * len * t,
          y: edge.start.y + tangent.y * len * t,
        };

        const curvedPt: Vec2 = {
          x: Number((basePt.x + normal.x * disp).toFixed(4)),
          y: Number((basePt.y + normal.y * disp).toFixed(4)),
        };

        pointsA.push(curvedPt);
      }

      // Piece B shares the exact same curved points in reverse order
      pointsB.push(...[...pointsA].reverse());

      modulatedEdgeMap.set(edge.id, { pointsA, pointsB });
    }

    // 3. Rebuild piece boundaries using the modulated internal edge curves
    const organicPieces: RawPieceLayout[] = [];

    for (const basePiece of baseGrid.pieces) {
      const newVertices: Vec2[] = [];
      const n = basePiece.vertices.length;

      for (let i = 0; i < n; i++) {
        const vStart = basePiece.vertices[i];
        const vEnd = basePiece.vertices[(i + 1) % n];

        // Check if this directed edge matches any shared edge
        let matched = false;
        for (const se of baseGrid.sharedEdges) {
          const mod = modulatedEdgeMap.get(se.id);
          if (!mod) continue;

          if (se.pieceAId === basePiece.pieceId && se.edgeIndexA === i) {
            // Take pointsA excluding last point (next edge begins with it)
            for (let p = 0; p < mod.pointsA.length - 1; p++) {
              newVertices.push(mod.pointsA[p]);
            }
            matched = true;
            break;
          } else if (se.pieceBId === basePiece.pieceId && se.edgeIndexB === i) {
            // Take pointsB excluding last point
            for (let p = 0; p < mod.pointsB.length - 1; p++) {
              newVertices.push(mod.pointsB[p]);
            }
            matched = true;
            break;
          }
        }

        if (!matched) {
          // Outer boundary edge: keep straight
          newVertices.push(vStart);
        }
      }

      organicPieces.push({
        pieceId: basePiece.pieceId,
        name: basePiece.name.replace("Grid", "Organic"),
        vertices: newVertices,
        layoutMetadata: {
          ...basePiece.layoutMetadata,
          layoutType: "organic",
        },
      });
    }

    return {
      puzzleBoundary: baseGrid.puzzleBoundary,
      pieces: organicPieces,
      sharedEdges: baseGrid.sharedEdges,
      outerSegments: baseGrid.outerSegments,
    };
  }
}
