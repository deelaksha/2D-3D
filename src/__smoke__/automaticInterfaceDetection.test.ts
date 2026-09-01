import { describe, expect, it } from "vitest";
import { InterfaceDetector2D } from "../core/puzzle/ingestion/interfaces/interfaceDetector2D";
import { FeatureAnalyzer } from "../core/puzzle/ingestion/interfaces/featureAnalyzer";
import { ConfidenceEngine } from "../core/puzzle/ingestion/interfaces/confidenceEngine";
import { DrawingImporter } from "../core/puzzle/ingestion/drawingImporter";
import { PieceSegmenter } from "../core/puzzle/ingestion/segmentation/pieceSegmenter";
import { ImportDiagnostics } from "../core/puzzle/ingestion/diagnostics";

describe("Automatic 2D Geometry Interface Detection Subsystem", () => {
  const tabSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><path d="M 0 0 L 30 0 L 30 -10 L 50 -10 L 50 0 L 100 0 L 100 100 L 0 100 Z" /></svg>`;
  const flatSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><path d="M 0 0 L 200 0 L 200 200 L 0 200 Z" /></svg>`;

  it("1. detects tabs, slots, and flat contact interfaces from 2D geometry", () => {
    const diag = new ImportDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "tab.svg", content: tabSvg }, diag);
    const segResult = PieceSegmenter.segmentDrawing(normalized);

    const piece = segResult.candidates[0];
    const segPiece = normalized.segmentedPieces[0];

    const interfaces = FeatureAnalyzer.analyzePiece(segPiece);

    expect(interfaces.length).toBeGreaterThan(0);
    expect(interfaces.some((iface) => iface.featureKind === "tab" || iface.featureKind === "slot" || iface.featureKind === "flat_contact")).toBe(true);
  });

  it("2. constructs local 2D frame (origin, normal, tangent) and profile parameters", () => {
    const diag = new ImportDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "flat.svg", content: flatSvg }, diag);
    const segPiece = normalized.segmentedPieces[0];

    const result = InterfaceDetector2D.detectForPiece(segPiece);

    expect(result.interfaces.length).toBeGreaterThan(0);
    const iface = result.interfaces[0];
    expect(iface.local2DFrame.origin).toBeDefined();
    expect(iface.local2DFrame.normal).toBeDefined();
    expect(iface.local2DFrame.tangent).toBeDefined();
    expect(iface.profile.width).toBeGreaterThan(0);
    expect(iface.profile.depth).toBeGreaterThan(0);
  });

  it("3. evaluates confidence scores and flags uncertain features", () => {
    const tabConf = ConfidenceEngine.evaluateConfidence("tab", 15.0, 3.0, 3.0);
    expect(tabConf.confidence).toBeGreaterThanOrEqual(0.9);
    expect(tabConf.uncertain).toBe(false);

    const narrowConf = ConfidenceEngine.evaluateConfidence("slot", 1.0, 3.0, 3.0);
    expect(narrowConf.confidence).toBeLessThan(0.6);
    expect(narrowConf.uncertain).toBe(true);
    expect(narrowConf.diagnosticReason).toBeDefined();
  });

  it("4. maps detected interfaces directly into standard CanonicalInterface IR objects", () => {
    const diag = new ImportDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "flat.svg", content: flatSvg }, diag);
    const segPiece = normalized.segmentedPieces[0];
    const cPiece = PieceSegmenter.segmentDrawing(normalized).pieces[0];

    const result = InterfaceDetector2D.detectForPiece(segPiece, cPiece);

    expect(result.canonicalInterfaces.length).toBeGreaterThan(0);
    expect(cPiece.interfaceIds.length).toBe(result.canonicalInterfaces.length);
    expect(result.canonicalInterfaces[0].owningPieceId).toBe(cPiece.id);
  });
});
