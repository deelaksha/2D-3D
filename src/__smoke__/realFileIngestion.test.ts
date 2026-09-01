import { describe, expect, it } from "vitest";
import { RealFileLoader } from "../core/puzzle/ingestion/realFileLoader";
import { DrawingNormalizer } from "../core/puzzle/ingestion/drawingNormalizer";
import { GeometryExtractor2D } from "../core/puzzle/ingestion/geometryExtractor2D";
import { PieceSegmenter } from "../core/puzzle/ingestion/pieceSegmenter";

describe("Steps 26–29: Real-File Ingestion & Normalization", () => {
  it("Step 26: loads SVG vector payload into IngestedDrawing", () => {
    const svgText = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <path d="M 0 0 L 50 0 L 50 50 L 0 50 Z" />
      </svg>
    `;
    const ingested = RealFileLoader.loadFile({
      filename: "test_piece.svg",
      format: "svg",
      content: svgText,
    });

    expect(ingested.detectedFormat).toBe("svg");
    expect(ingested.paths.length).toBeGreaterThan(0);
    expect(ingested.paths[0].points.length).toBe(4);
  });

  it("Step 27: normalizes drawing scale and aligns origin frame", () => {
    const svgText = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <path d="M 10 10 L 60 10 L 60 60 L 10 60 Z" />
      </svg>
    `;
    const ingested = RealFileLoader.loadFile({
      filename: "test_piece.svg",
      format: "svg",
      content: svgText,
    });

    const normalized = DrawingNormalizer.normalize(ingested);
    expect(normalized.units).toBe("mm");
    expect(normalized.bounds.width).toBe(50);
    expect(normalized.bounds.height).toBe(50);
  });

  it("Step 28: extracts closed loops and classifies outer contours", () => {
    const svgText = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <path d="M 0 0 L 100 0 L 100 100 L 0 100 Z" />
      </svg>
    `;
    const ingested = RealFileLoader.loadFile({
      filename: "test_piece.svg",
      format: "svg",
      content: svgText,
    });

    const normalized = DrawingNormalizer.normalize(ingested);
    const contours = GeometryExtractor2D.extractContours(normalized);

    expect(contours.length).toBe(1);
    expect(contours[0].outerLoop.length).toBe(4);
    expect(contours[0].area).toBe(10000);
  });

  it("Step 29: segments piece outlines into individual local coordinate frames", () => {
    const svgText = `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
        <path d="M 0 0 L 100 0 L 100 100 L 0 100 Z" />
        <path d="M 150 0 L 250 0 L 250 100 L 150 100 Z" />
      </svg>
    `;
    const ingested = RealFileLoader.loadFile({
      filename: "multi_piece.svg",
      format: "svg",
      content: svgText,
    });

    const normalized = DrawingNormalizer.normalize(ingested);
    const contours = GeometryExtractor2D.extractContours(normalized);
    const pieces = PieceSegmenter.segmentPieces(contours);

    expect(pieces.length).toBe(2);
    expect(pieces[0].localOuterLoop.length).toBe(4);
    expect(pieces[1].localOuterLoop.length).toBe(4);
  });
});
