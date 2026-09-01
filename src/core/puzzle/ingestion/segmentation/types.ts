/**
 * Piece Segmentation Subsystem Types.
 */
import type { Vec2 } from "@/core/model/types";
import type { CanonicalPiece } from "../../canonical/types";
import type { SegmentationDiagnostics } from "./diagnostics";

export type PieceSourceHint = "label" | "closed_loop" | "layer" | "nesting" | "project_meta";

export interface PieceCandidate {
  candidateId: string;
  suggestedName: string;
  outerBoundary: Vec2[];
  holes: Vec2[][];
  sourceHint: PieceSourceHint;
  confidence: number;
  bounds: { min: Vec2; max: Vec2; width: number; height: number };
  layerName?: string;
  labels?: string[];
}

export interface SegmentationResult {
  success: boolean;
  pieces: CanonicalPiece[];
  candidates: PieceCandidate[];
  diagnostics: SegmentationDiagnostics;
  durationMs: number;
}
