import { describe, expect, it } from "vitest";
import { PieceSegmenter } from "../core/puzzle/ingestion/segmentation/pieceSegmenter";
import { DrawingImporter } from "../core/puzzle/ingestion/drawingImporter";
import { GeometryImporter } from "../core/puzzle/ingestion/geometryImporter";
import { SegmentationDiagnostics } from "../core/puzzle/ingestion/segmentation/diagnostics";

describe("Piece Segmentation Subsystem", () => {
  const simpleSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">
      <path d="M 0 0 L 100 0 L 100 80 L 0 80 Z" />
      <path d="M 150 0 L 250 0 L 250 80 L 150 80 Z" />
    </svg>
  `;

  const nestedSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
      <path d="M 0 0 L 200 0 L 200 200 L 0 200 Z M 50 50 L 150 50 L 150 150 L 50 150 Z" />
      <path d="M 70 70 L 130 70 L 130 130 L 70 130 Z" />
    </svg>
  `;

  const touchingDxf = `0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n10\n0.0\n20\n0.0\n10\n50.0\n20\n0.0\n10\n50.0\n20\n50.0\n10\n0.0\n20\n50.0\n0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n10\n50.0\n20\n0.0\n10\n100.0\n20\n0.0\n10\n100.0\n20\n50.0\n10\n50.0\n20\n50.0\n0\nENDSEC\n0\nEOF`;

  it("1. segments simple standalone pieces", () => {
    const diag = new SegmentationDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "simple.svg", content: simpleSvg }, diag as any);

    const result = PieceSegmenter.segmentDrawing(normalized, diag);

    expect(result.success).toBe(true);
    expect(result.candidates.length).toBe(2);
    expect(result.pieces.length).toBe(2);
    expect(result.pieces[0].id).toBeDefined();
    expect(result.pieces[0].dimensions.width).toBeGreaterThan(0);
  });

  it("2. segments nested pieces and resolves cutout holes", () => {
    const diag = new SegmentationDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "nested.svg", content: nestedSvg }, diag as any);

    const result = PieceSegmenter.segmentDrawing(normalized, diag);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.pieces.length).toBeGreaterThan(0);
  });

  it("3. segments touching pieces sharing edge vertices and issues diagnostic info", () => {
    const diag = new SegmentationDiagnostics();
    const normalized = GeometryImporter.importGeometry({ filename: "touching.dxf", content: touchingDxf }, "dxf", diag as any);

    const result = PieceSegmenter.segmentDrawing(normalized, diag);

    expect(result.candidates.length).toBe(2);
    expect(result.diagnostics.items.some((i) => i.code === "TOUCHING_PIECES")).toBe(true);
  });

  it("4. returns ambiguity diagnostics for drawings with conflicting labels", () => {
    const diag = new SegmentationDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "ambiguous.svg", content: simpleSvg }, diag as any);
    normalized.metadata = { labels: ["Label A", "Label B", "Label C", "Label D", "Label E"] };

    const result = PieceSegmenter.segmentDrawing(normalized, diag);

    expect(result.diagnostics.getWarnings().some((w) => w.code === "CONFLICTING_PIECE_LABELS")).toBe(true);
  });

  it("5. maps each candidate directly into a valid CanonicalPiece IR object", () => {
    const diag = new SegmentationDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "simple.svg", content: simpleSvg }, diag as any);

    const result = PieceSegmenter.segmentDrawing(normalized, diag);

    for (const piece of result.pieces) {
      expect(piece.id).toMatch(/^piece_seg_\d+/);
      expect(piece.dimensions.width).toBeGreaterThan(0);
      expect(piece.dimensions.height).toBeGreaterThan(0);
      expect(piece.thickness).toBeGreaterThan(0);
    }
  });
});
