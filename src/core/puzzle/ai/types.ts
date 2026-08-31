/**
 * AI Interface definitions for future ML-assisted 2D-to-3D puzzle assembly models.
 *
 * TODO(ML_FUTURE): Integrate deep learning model inference (e.g. GNN / Transformer)
 * for predicting 3D assembly configurations and joining angles directly from 2D piece geometries.
 */
import type { PuzzleAssembly } from "../assembly/types";
import type { PuzzlePiece } from "../piece/types";

export interface AIPredictionRequest {
  pieces: PuzzlePiece[];
  userPrompt?: string;
  targetCategory?: string;
}

export interface AIPredictionResponse {
  predictedAssembly: PuzzleAssembly;
  confidenceScore: number;
  explanation?: string;
}

export interface PuzzleAssemblyAI {
  /**
   * TODO(ML_FUTURE): Implement ML model forward pass for 2D piece contour to 3D assembly prediction.
   */
  predictAssembly(request: AIPredictionRequest): Promise<AIPredictionResponse>;

  /**
   * TODO(ML_FUTURE): Predict joining angle between two connection interfaces.
   */
  predictJoiningAngle(
    sourcePiece: PuzzlePiece,
    sourceInterfaceId: string,
    targetPiece: PuzzlePiece,
    targetInterfaceId: string,
  ): Promise<number>;
}
