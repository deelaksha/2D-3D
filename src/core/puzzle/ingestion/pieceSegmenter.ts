/**
 * Piece Segmenter (Step 29).
 * Segments individual puzzle piece contours from a multi-piece layout sheet and centers local origins.
 */
import type { Vec2 } from "@/core/model/types";
import type { ExtractedContour2D, SegmentedPiece2D } from "./types";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class PieceSegmenter {
  /**
   * Segments a list of extracted contours into individual SegmentedPiece2D items.
   */
  static segmentPieces(contours: ExtractedContour2D[], defaultThicknessMm: number = 3.0): SegmentedPiece2D[] {
    const pieces: SegmentedPiece2D[] = [];

    for (let i = 0; i < contours.length; i++) {
      const c = contours[i];
      const pieceId = `piece_seg_${i + 1}`;
      const pieceName = `Segmented Piece ${i + 1}`;

      const centerX = (c.bounds.min.x + c.bounds.max.x) / 2.0;
      const centerY = (c.bounds.min.y + c.bounds.max.y) / 2.0;
      const localOrigin = vec2(centerX, centerY);

      const localOuterLoop = c.outerLoop.map((pt) => vec2(pt.x - centerX, pt.y - centerY));
      const localHoles = c.holes.map((hole) =>
        hole.map((pt) => vec2(pt.x - centerX, pt.y - centerY))
      );

      pieces.push({
        pieceId,
        pieceName,
        contour: c,
        localOrigin,
        localOuterLoop,
        localHoles,
        materialThicknessMm: defaultThicknessMm,
      });
    }

    return pieces;
  }
}
