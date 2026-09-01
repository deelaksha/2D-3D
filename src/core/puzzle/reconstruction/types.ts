/**
 * Feature Extraction and Reconstruction Types (Steps 30–34).
 */
import type { Vec2, Vec3 } from "@/core/model/types";
import type { CanonicalInterfaceType } from "../canonical/types";

export interface DetectedInterfacePort {
  id: string;
  pieceId: string;
  type: CanonicalInterfaceType;
  localCenter2D: Vec2;
  localNormal2D: Vec2;
  widthMm: number;
  depthMm: number;
  bevelAngleDeg?: number;
}

export interface InferredConnection {
  connectionId: string;
  sourcePieceId: string;
  sourcePortId: string;
  targetPieceId: string;
  targetPortId: string;
  joiningAngleDeg: number;
  confidenceScore: number;
  reason: string;
}

export interface ExtractedParametricFeatures {
  inferredThicknessMm: number;
  defaultTabWidthMm: number;
  defaultSlotDepthMm: number;
  detectedJoiningAnglesDeg: number[];
  overallPieceCount: number;
  overallInterfaceCount: number;
  overallConnectionCount: number;
}
