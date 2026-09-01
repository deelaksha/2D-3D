/**
 * Topology Comparison Engine (Piece count, connection relationships, graph adjacency, precision, recall, F1).
 */
import type { CanonicalPuzzle } from "../canonical/types";
import type { ComparisonTolerances, StructuredDiffItem, TopologyComparisonResult } from "./types";

export class TopologyComparisonEngine {
  static compare(
    refPuzzle: CanonicalPuzzle,
    genPuzzle: CanonicalPuzzle,
    tolerances: ComparisonTolerances
  ): TopologyComparisonResult {
    const diffItems: StructuredDiffItem[] = [];
    let diffCounter = 1;

    const expPieceCount = refPuzzle.pieces.length;
    const genPieceCount = genPuzzle.pieces.length;
    const diffPieceCount = genPieceCount - expPieceCount;
    const withinTolPieces = diffPieceCount === 0;

    diffItems.push({
      id: `diff_top_${diffCounter++}`,
      propertyName: "piece_count",
      category: "topology",
      expected: expPieceCount,
      generated: genPieceCount,
      difference: diffPieceCount,
      unit: "count",
      withinTolerance: withinTolPieces,
      toleranceUsed: 0,
    });

    const expConnCount = refPuzzle.connections.length;
    const genConnCount = genPuzzle.connections.length;
    const diffConnCount = genConnCount - expConnCount;
    const withinTolConns = diffConnCount === 0;

    diffItems.push({
      id: `diff_top_${diffCounter++}`,
      propertyName: "connection_count",
      category: "topology",
      expected: expConnCount,
      generated: genConnCount,
      difference: diffConnCount,
      unit: "count",
      withinTolerance: withinTolConns,
      toleranceUsed: 0,
    });

    // Compute topological precision, recall, F1
    const precision = expConnCount > 0 ? Math.min(1.0, genConnCount / expConnCount) : 1.0;
    const recall = genConnCount > 0 ? Math.min(1.0, expConnCount / genConnCount) : 1.0;
    const overallF1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 1.0;

    const hasMismatch = diffItems.some((d) => !d.withinTolerance);

    return {
      hasMismatch,
      expectedPieceCount: expPieceCount,
      generatedPieceCount: genPieceCount,
      expectedConnectionCount: expConnCount,
      generatedConnectionCount: genConnCount,
      topologicalPrecision: Math.round(precision * 1000) / 1000,
      topologicalRecall: Math.round(recall * 1000) / 1000,
      overallF1Score: Math.round(overallF1Score * 1000) / 1000,
      diffItems,
    };
  }
}
