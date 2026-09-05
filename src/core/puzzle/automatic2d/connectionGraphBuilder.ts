/**
 * Connection Graph Builder (Phase 85 - Stage 3).
 *
 * Constructs the topological PuzzleAssemblyGraph G = (V, E) and extracts canonical
 * interface edge pairs between adjacent pieces.
 */

import type { Vec2 } from "@/core/model/types";
import { PuzzleAssemblyGraph } from "../graph/graph";
import type { PartitionedPiece } from "../boundarypartition/types";

export interface CanonicalInterfaceEdge {
  edgeId: string;
  pieceAId: string;
  pieceBId: string;
  start: Vec2;
  end: Vec2;
  midpoint: Vec2;
  lengthMm: number;
  tangent: Vec2;
  normal: Vec2; // Outward from Piece A toward Piece B
}

export class ConnectionGraphBuilder {
  /**
   * Builds the topological assembly graph and extracts unique interface edges between pieces.
   */
  public static buildGraph(pieces: PartitionedPiece[]): {
    graph: PuzzleAssemblyGraph;
    interfaceEdges: CanonicalInterfaceEdge[];
    isConnected: boolean;
    isolatedPieceIds: string[];
  } {
    const graph = new PuzzleAssemblyGraph();

    // 1. Add all pieces as nodes in the graph
    for (const piece of pieces) {
      graph.addPieceNode(piece.id, [], {
        name: piece.name,
        areaMm2: piece.areaMm2,
        isBorderPiece: piece.isBorderPiece,
      });
    }

    // 2. Map of pieces by ID for quick centroid lookup
    const pieceMap = new Map<string, PartitionedPiece>();
    for (const p of pieces) {
      pieceMap.set(p.id, p);
    }

    // 3. Extract unique canonical interface edges between piece pairs
    const seenEdgeKeys = new Set<string>();
    const interfaceEdges: CanonicalInterfaceEdge[] = [];

    for (const piece of pieces) {
      for (const shared of piece.sharedEdges) {
        const neighbor = pieceMap.get(shared.neighborId);
        if (!neighbor) continue;

        // Ensure canonical ordering (A < B) to deduplicate shared edges
        const isPieceA = piece.id.localeCompare(shared.neighborId) < 0;
        const pieceAId = isPieceA ? piece.id : shared.neighborId;
        const pieceBId = isPieceA ? shared.neighborId : piece.id;

        const pieceA = pieceMap.get(pieceAId)!;
        const pieceB = pieceMap.get(pieceBId)!;

        // Spatial midpoint key for matching identical edges
        const midX = (shared.start.x + shared.end.x) / 2;
        const midY = (shared.start.y + shared.end.y) / 2;
        const spatialKey = `${pieceAId}_${pieceBId}_${midX.toFixed(1)}_${midY.toFixed(1)}`;

        if (seenEdgeKeys.has(spatialKey)) continue;
        seenEdgeKeys.add(spatialKey);

        const edgeLen = Math.hypot(shared.end.x - shared.start.x, shared.end.y - shared.start.y);
        if (edgeLen < 1.0) continue; // Skip degenerate sliver edges

        // Edge vector
        let start = isPieceA ? shared.start : shared.end;
        let end = isPieceA ? shared.end : shared.start;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const tangent: Vec2 = {
          x: Number((dx / edgeLen).toFixed(5)),
          y: Number((dy / edgeLen).toFixed(5)),
        };

        const midpoint: Vec2 = {
          x: Number(((start.x + end.x) / 2).toFixed(4)),
          y: Number(((start.y + end.y) / 2).toFixed(4)),
        };

        // Two candidate normals: (-tangent.y, tangent.x) and (tangent.y, -tangent.x)
        const norm1: Vec2 = { x: -tangent.y, y: tangent.x };
        const toCentroidB = {
          x: pieceB.centroid.x - midpoint.x,
          y: pieceB.centroid.y - midpoint.y,
        };

        // Pick normal that points toward Piece B
        const dot = norm1.x * toCentroidB.x + norm1.y * toCentroidB.y;
        const normal: Vec2 = dot >= 0 ? norm1 : { x: tangent.y, y: -tangent.x };

        const edgeId = `edge_${pieceAId}_${pieceBId}_${interfaceEdges.length + 1}`;

        interfaceEdges.push({
          edgeId,
          pieceAId,
          pieceBId,
          start,
          end,
          midpoint,
          lengthMm: Number(edgeLen.toFixed(3)),
          tangent,
          normal,
        });
      }
    }

    // 4. Verify graph reachability
    const isConnected = pieces.length <= 1 || graph.isConnected();
    const isolatedPieceIds = graph.getIsolatedPieces();

    return {
      graph,
      interfaceEdges,
      isConnected,
      isolatedPieceIds,
    };
  }
}
