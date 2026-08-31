/**
 * Placeholder AI Provider implementation.
 *
 * TODO(ML_FUTURE): Replace this stub provider with a real ML model client (e.g. PyTorch backend / ONNX Runtime).
 */
import type { AIPredictionRequest, AIPredictionResponse, PuzzleAssemblyAI } from "./types";
import type { PuzzleAssembly } from "../assembly/types";
import { uid } from "@/core/model/ids";

export class PlaceholderPuzzleAI implements PuzzleAssemblyAI {
  async predictAssembly(request: AIPredictionRequest): Promise<AIPredictionResponse> {
    // TODO(ML_FUTURE): Load trained weights and execute neural network inference.
    const emptyAssembly: PuzzleAssembly = {
      id: uid("asm_predicted_"),
      name: "Placeholder AI Predicted Assembly",
      placements: request.pieces.map((p, idx) => ({
        pieceId: p.id,
        position: { x: idx * 50, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
        placed: true,
      })),
      connections: [],
    };

    return {
      predictedAssembly: emptyAssembly,
      confidenceScore: 0.0,
      explanation: "Placeholder AI model response. Model training pending in future phases.",
    };
  }

  async predictJoiningAngle(
    sourcePiece: any,
    sourceInterfaceId: string,
    targetPiece: any,
    targetInterfaceId: string,
  ): Promise<number> {
    // TODO(ML_FUTURE): Predict optimal 3D joining angle using geometric feature embeddings.
    return 90.0; // Default 90 degree joining angle fallback
  }
}
