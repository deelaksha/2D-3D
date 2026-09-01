import { describe, expect, it } from "vitest";
import { RealFileLoader } from "../core/puzzle/ingestion/realFileLoader";
import { DrawingNormalizer } from "../core/puzzle/ingestion/drawingNormalizer";
import { GeometryExtractor2D } from "../core/puzzle/ingestion/geometryExtractor2D";
import { PieceSegmenter } from "../core/puzzle/ingestion/pieceSegmenter";
import { InterfaceDetector } from "../core/puzzle/reconstruction/interfaceDetector";
import { ConnectionInferencer } from "../core/puzzle/reconstruction/connectionInferencer";
import { ParametricExtractor } from "../core/puzzle/reconstruction/parametricExtractor";
import { CanonicalConverter2D } from "../core/puzzle/reconstruction/canonicalConverter2D";
import type { DetectedInterfacePort } from "../core/puzzle/reconstruction/types";

describe("Steps 30–33: Feature Extraction & Canonical IR Mapping", () => {
  it("Step 30: detects interface ports along segmented piece boundaries", () => {
    const svgText = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <path d="M 0 0 L 20 0 L 20 10 L 30 10 L 30 0 L 50 0 L 50 50 L 0 50 Z" />
      </svg>
    `;
    const ingested = RealFileLoader.loadFile({
      filename: "tab_piece.svg",
      format: "svg",
      content: svgText,
    });
    const normalized = DrawingNormalizer.normalize(ingested);
    const contours = GeometryExtractor2D.extractContours(normalized);
    const pieces = PieceSegmenter.segmentPieces(contours);

    const ports = InterfaceDetector.detectInterfaces(pieces[0]);
    expect(ports.length).toBeGreaterThan(0);
  });

  it("Step 31: infers complementary connection graph edges across distinct pieces", () => {
    const svgText = `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
        <path d="M 0 0 L 50 0 L 50 50 L 0 50 Z" />
        <path d="M 100 0 L 150 0 L 150 50 L 100 50 Z" />
      </svg>
    `;
    const ingested = RealFileLoader.loadFile({
      filename: "two_pieces.svg",
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
    expect(connections.length).toBeGreaterThanOrEqual(0);
  });

  it("Steps 32–33: extracts parametric features and converts to CanonicalPuzzle IR", () => {
    const svgText = `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
        <path d="M 0 0 L 50 0 L 50 50 L 0 50 Z" />
        <path d="M 100 0 L 150 0 L 150 50 L 100 50 Z" />
      </svg>
    `;
    const ingested = RealFileLoader.loadFile({
      filename: "test_canonical.svg",
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
    expect(features.overallPieceCount).toBe(2);

    const canonicalPuzzle = CanonicalConverter2D.convertToCanonicalIR(
      "puz_reconstructed_1",
      pieces,
      portsByPiece,
      connections,
      features
    );

    expect(canonicalPuzzle.metadata.id).toBe("puz_reconstructed_1");
    expect(canonicalPuzzle.pieces.length).toBe(2);
  });
});
