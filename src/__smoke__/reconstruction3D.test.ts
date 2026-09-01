import { describe, expect, it } from "vitest";
import { RealFileLoader } from "../core/puzzle/ingestion/realFileLoader";
import { DrawingNormalizer } from "../core/puzzle/ingestion/drawingNormalizer";
import { GeometryExtractor2D } from "../core/puzzle/ingestion/geometryExtractor2D";
import { PieceSegmenter } from "../core/puzzle/ingestion/pieceSegmenter";
import { InterfaceDetector } from "../core/puzzle/reconstruction/interfaceDetector";
import { ConnectionInferencer } from "../core/puzzle/reconstruction/connectionInferencer";
import { ParametricExtractor } from "../core/puzzle/reconstruction/parametricExtractor";
import { CanonicalConverter2D } from "../core/puzzle/reconstruction/canonicalConverter2D";
import { Reconstructor3D } from "../core/puzzle/reconstruction/reconstructor3D";
import type { DetectedInterfacePort } from "../core/puzzle/reconstruction/types";

describe("Step 34: 3D Solid Reconstruction & Assembly Placement", () => {
  it("reconstructs 3D solid meshes and calculates relative 3D assembly placements", () => {
    const svgText = `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
        <path d="M 0 0 L 50 0 L 50 50 L 0 50 Z" />
        <path d="M 100 0 L 150 0 L 150 50 L 100 50 Z" />
      </svg>
    `;
    const ingested = RealFileLoader.loadFile({
      filename: "reconstruction_test.svg",
      format: "svg",
      content: svgText,
    });
    const normalized = DrawingNormalizer.normalize(ingested);
    const contours = GeometryExtractor2D.extractContours(normalized);
    const pieces = PieceSegmenter.segmentPieces(contours);

    const portsByPiece = new Map<string, DetectedInterfacePort[]>();
    for (const p of pieces) {
      portsByPiece.set(p.pieceId, InterfaceDetector.detectInterfaces(p));
    }
    const connections = ConnectionInferencer.inferConnections(portsByPiece, 45.0);
    const features = ParametricExtractor.extractFeatures(pieces, portsByPiece, connections);

    const canonicalPuzzle = CanonicalConverter2D.convertToCanonicalIR(
      "puz_recon_3d",
      pieces,
      portsByPiece,
      connections,
      features
    );

    const reconstruction = Reconstructor3D.reconstruct3D(canonicalPuzzle);

    expect(reconstruction.solids.size).toBe(2);
    expect(reconstruction.placements.size).toBe(2);
    expect(reconstruction.reconstructionSuccess).toBe(true);
  });
});
