/**
 * Helper functions for creating and inspecting PuzzlePiece instances.
 */
import type { ID, Vec2 } from "@/core/model/types";
import type { PuzzlePiece } from "./types";
import { uid } from "@/core/model/ids";
import { boundsOfPoints, shapeOutline } from "@/core/geometry/outline";

export interface CreatePieceOptions {
  name?: string;
  width?: number;
  height?: number;
  thickness?: number;
  materialId?: ID;
  color?: string;
}

export function createPuzzlePiece(options: CreatePieceOptions = {}): PuzzlePiece {
  const width = options.width ?? 100;
  const height = options.height ?? 100;
  const thickness = options.thickness ?? 2.0;

  return {
    id: uid("piece_"),
    name: options.name ?? "Puzzle Piece",
    width,
    height,
    thickness,
    materialId: options.materialId ?? "cardboard-2mm",
    contour: {
      kind: "rect",
      x: 0,
      y: 0,
      width,
      height,
      rotation: 0,
    },
    interfaces: [],
    color: options.color ?? "#D2B48C",
  };
}

export function calculateLocalPieceBounds(piece: PuzzlePiece) {
  return boundsOfPoints(shapeOutline(piece.contour).flat());
}
