/**
 * Root Piece Selector (Phase 87 - Step 1).
 *
 * Deterministically selects the optimal root piece to anchor the 3D assembly.
 */

import type { ID } from "@/core/model/types";
import type { GeneratedPiece3D } from "../piece3d/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";
import type { DesiredAssemblyConfiguration } from "./types";

export class RootSelector {
  /**
   * Selects the root piece for the 3D assembly.
   */
  public static selectRootPiece(
    pieces: GeneratedPiece3D[],
    graph: PuzzleAssemblyGraph,
    desiredConfig?: DesiredAssemblyConfiguration
  ): ID {
    if (pieces.length === 0) {
      throw new Error("Cannot select root piece from empty piece list.");
    }

    const pieceMap = new Map<ID, GeneratedPiece3D>();
    for (const p of pieces) {
      pieceMap.set(p.pieceId, p);
    }

    // 1. If explicit rootPieceId is specified and exists, honor it
    if (desiredConfig?.rootPieceId && pieceMap.has(desiredConfig.rootPieceId)) {
      return desiredConfig.rootPieceId;
    }

    // 2. Score pieces based on stability, connectivity degree, and central placement
    let bestPieceId = pieces[0].pieceId;
    let highestScore = -Infinity;

    for (const piece of pieces) {
      const degree = graph.getConnectionDegree(piece.pieceId);
      const isInterior = !piece.isBorderPiece;
      const area = piece.profile?.areaMm2 ?? 0;

      // Degree weight (primary factor): highly connected pieces make great hubs
      // Interior weight: interior pieces spread connections outward
      // Area weight: larger surface provides stable base
      const score = degree * 100.0 + (isInterior ? 50.0 : 0.0) + Math.log(Math.max(1, area)) * 10.0;

      if (score > highestScore) {
        highestScore = score;
        bestPieceId = piece.pieceId;
      } else if (score === highestScore) {
        // Deterministic tie-breaker: lexicographical ID
        if (piece.pieceId.localeCompare(bestPieceId) < 0) {
          bestPieceId = piece.pieceId;
        }
      }
    }

    return bestPieceId;
  }
}
