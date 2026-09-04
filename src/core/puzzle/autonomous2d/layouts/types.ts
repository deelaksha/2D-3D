/**
 * Layout Partition Intermediate Types.
 */

import type { Vec2 } from "@/core/model/types";
import type { BoundarySegment2D, GeneratedPiece, PuzzleBoundary2D } from "../types";

export interface RawPieceLayout {
  pieceId: string;
  name: string;
  vertices: Vec2[];
  layoutMetadata: GeneratedPiece["layoutMetadata"];
}

export interface SharedEdge {
  id: string;
  pieceAId: string;
  pieceBId: string;
  /** Index of this edge in Piece A's vertices list. */
  edgeIndexA: number;
  /** Index of this edge in Piece B's vertices list. */
  edgeIndexB: number;
  /** Start point of the edge segment. */
  start: Vec2;
  /** End point of the edge segment. */
  end: Vec2;
}

export interface PartitionLayoutResult {
  puzzleBoundary: PuzzleBoundary2D;
  pieces: RawPieceLayout[];
  sharedEdges: SharedEdge[];
  outerSegments: BoundarySegment2D[];
}
