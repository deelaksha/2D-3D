/**
 * Piece Partitioning Adapter (Phase 85 - Stage 2).
 *
 * Integrates the Phase 82 Boundary Partition Engine to deterministically
 * partition the global boundary into individual piece cells.
 */

import type { Vec2 } from "@/core/model/types";
import { BoundaryPartitionEngine } from "../boundarypartition/boundaryPartitionEngine";
import type { PartitionResult, PartitionedPiece, PartitionStyle } from "../boundarypartition/types";
import type { DesignSpecification2D } from "./types";

export class PiecePartitioningAdapter {
  /**
   * Partitions the given boundary into pieces matching the design specification.
   */
  public static partition(
    boundaryVertices: Vec2[],
    spec: DesignSpecification2D
  ): {
    success: boolean;
    pieces: PartitionedPiece[];
    rawResult: PartitionResult;
  } {
    const style: PartitionStyle = spec.partitionStyle ?? "polygonal";
    const targetPieceCount = Math.max(2, spec.targetPieceCount ?? 16);

    const partitionRequest = {
      boundary: boundaryVertices,
      targetPieceCount,
      style,
      parameters: {
        seed: spec.seed ?? 42,
        minFeatureSizeMm: spec.minFeatureSizeMm ?? 5.0,
        jitter: spec.jitter ?? 0.2,
        curvature: spec.curvature ?? 3.0,
        waveFrequency: spec.waveFrequency ?? 1.0,
        complexity: spec.difficulty === "hard" ? "high" : spec.difficulty === "easy" ? "low" : "medium",
      },
    };

    const rawResult = BoundaryPartitionEngine.partition(partitionRequest);

    return {
      success: rawResult.success,
      pieces: rawResult.pieces,
      rawResult,
    };
  }
}
