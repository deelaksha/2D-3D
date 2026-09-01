/**
 * Parametric Feature Extractor (Step 32).
 * Extracts canonical material thickness, tab dimensions, slot depth, and joining angles across pieces.
 */
import type { SegmentedPiece2D } from "../ingestion/types";
import type { DetectedInterfacePort, ExtractedParametricFeatures, InferredConnection } from "./types";

export class ParametricExtractor {
  /**
   * Extracts aggregated parametric feature statistics.
   */
  static extractFeatures(
    pieces: SegmentedPiece2D[],
    portsByPiece: Map<string, DetectedInterfacePort[]>,
    connections: InferredConnection[]
  ): ExtractedParametricFeatures {
    let totalThickness = 0;
    for (const p of pieces) {
      totalThickness += p.materialThicknessMm;
    }
    const avgThickness = pieces.length > 0 ? totalThickness / pieces.length : 3.0;

    const widths: number[] = [];
    const depths: number[] = [];

    for (const ports of portsByPiece.values()) {
      for (const p of ports) {
        if (p.type === "tab" || p.type === "slot") {
          widths.push(p.widthMm);
          depths.push(p.depthMm);
        }
      }
    }

    const avgTabWidth = widths.length > 0 ? widths.reduce((a, b) => a + b, 0) / widths.length : 12.0;
    const avgSlotDepth = depths.length > 0 ? depths.reduce((a, b) => a + b, 0) / depths.length : avgThickness;

    const angleSet = new Set<number>();
    for (const c of connections) {
      angleSet.add(c.joiningAngleDeg);
    }
    if (angleSet.size === 0) angleSet.add(45.0);

    let totalPortCount = 0;
    for (const ports of portsByPiece.values()) {
      totalPortCount += ports.length;
    }

    return {
      inferredThicknessMm: Math.round(avgThickness * 100) / 100,
      defaultTabWidthMm: Math.round(avgTabWidth * 100) / 100,
      defaultSlotDepthMm: Math.round(avgSlotDepth * 100) / 100,
      detectedJoiningAnglesDeg: Array.from(angleSet),
      overallPieceCount: pieces.length,
      overallInterfaceCount: totalPortCount,
      overallConnectionCount: connections.length,
    };
  }
}
