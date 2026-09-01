import { describe, expect, it } from "vitest";
import { FeatureExtractor } from "../core/puzzle/ingestion/features/featureExtractor";
import { DrawingImporter } from "../core/puzzle/ingestion/drawingImporter";
import { FeatureDiagnostics } from "../core/puzzle/ingestion/features/diagnostics";
import type { Detected2DInterface } from "../core/puzzle/ingestion/interfaces/types";

describe("Parametric Feature Extraction Subsystem", () => {
  const tabSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><path d="M 0 0 L 30 0 L 30 -10 L 50 -10 L 50 0 L 100 0 L 100 100 L 0 100 Z" /></svg>`;

  const mockTabIface: Detected2DInterface = {
    id: "if_tab_1",
    owningPieceId: "piece_1",
    name: "Tab Feature",
    featureKind: "tab",
    canonicalType: "tab",
    local2DFrame: { origin: { x: 40, y: 0 }, normal: { x: 0, y: -1 }, tangent: { x: 1, y: 0 } },
    edgeGeometry: { edgeIndex: 0, parametricStart: 0, parametricEnd: 1, length: 20.0 },
    profile: { kind: "tab_profile", width: 20.0, depth: 3.0, height: 3.0, clearance: 0.1 },
    genderRole: "insert",
    toleranceMm: 0.1,
    clearanceMm: 0.1,
    confidence: 0.95,
    uncertain: false,
  };

  const mockSlotIface: Detected2DInterface = {
    id: "if_slot_1",
    owningPieceId: "piece_1",
    name: "Slot Feature",
    featureKind: "slot",
    canonicalType: "slot",
    local2DFrame: { origin: { x: 40, y: 100 }, normal: { x: 0, y: 1 }, tangent: { x: 1, y: 0 } },
    edgeGeometry: { edgeIndex: 2, parametricStart: 0, parametricEnd: 1, length: 20.0 },
    profile: { kind: "slot_profile", width: 20.0, depth: 3.0, height: 3.0, clearance: 0.1 },
    genderRole: "receiver",
    toleranceMm: 0.1,
    clearanceMm: 0.1,
    confidence: 0.95,
    uncertain: false,
  };

  const mockCustomIface: Detected2DInterface = {
    ...mockTabIface,
    id: "if_custom_1",
    featureKind: "custom",
    uncertain: true,
  };

  it("1. extracts piece footprint parameters (width, height, thickness)", () => {
    const diag = new FeatureDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "tab.svg", content: tabSvg }, diag as any);
    const segPiece = normalized.segmentedPieces[0];

    const result = FeatureExtractor.extractFeatures(segPiece, [], diag);

    expect(result.success).toBe(true);
    expect(result.parameters.some((p) => p.name === "width" && p.value > 0)).toBe(true);
    expect(result.parameters.some((p) => p.name === "height" && p.value > 0)).toBe(true);
    expect(result.parameters.some((p) => p.name === "thickness" && p.value === 3.0)).toBe(true);
  });

  it("2. extracts tab parameters (tab_width, tab_depth, tab_position, tab_radius)", () => {
    const diag = new FeatureDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "tab.svg", content: tabSvg }, diag as any);
    const segPiece = normalized.segmentedPieces[0];

    const result = FeatureExtractor.extractFeatures(segPiece, [mockTabIface], diag);

    expect(result.parameters.some((p) => p.name === "tab_width" && p.value === 20.0)).toBe(true);
    expect(result.parameters.some((p) => p.name === "tab_depth" && p.value === 3.0)).toBe(true);
    expect(result.parameters.some((p) => p.name === "tab_position")).toBe(true);
    expect(result.parameters.some((p) => p.name === "tab_radius")).toBe(true);
  });

  it("3. extracts slot parameters (slot_width, slot_depth, slot_position, corner_radius)", () => {
    const diag = new FeatureDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "tab.svg", content: tabSvg }, diag as any);
    const segPiece = normalized.segmentedPieces[0];

    const result = FeatureExtractor.extractFeatures(segPiece, [mockSlotIface], diag);

    expect(result.parameters.some((p) => p.name === "slot_width" && p.value === 20.0)).toBe(true);
    expect(result.parameters.some((p) => p.name === "slot_depth" && p.value === 3.0)).toBe(true);
    expect(result.parameters.some((p) => p.name === "corner_radius")).toBe(true);
  });

  it("4. preserves raw geometry for unrecognized custom/complex features without forcing bad templates", () => {
    const diag = new FeatureDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "tab.svg", content: tabSvg }, diag as any);
    const segPiece = normalized.segmentedPieces[0];

    const result = FeatureExtractor.extractFeatures(segPiece, [mockCustomIface], diag);

    expect(result.preservedRawGeometries.includes("if_custom_1")).toBe(true);
  });

  it("5. verifies complete parameter provenance (name, value, unit, sourceGeometry, confidence, extractionMethod)", () => {
    const diag = new FeatureDiagnostics();
    const normalized = DrawingImporter.importDrawing({ filename: "tab.svg", content: tabSvg }, diag as any);
    const segPiece = normalized.segmentedPieces[0];

    const result = FeatureExtractor.extractFeatures(segPiece, [mockTabIface], diag);

    for (const p of result.parameters) {
      expect(p.name).toBeDefined();
      expect(typeof p.value).toBe("number");
      expect(p.unit).toBe("mm");
      expect(p.sourceGeometry).toBeDefined();
      expect(p.confidence).toBeGreaterThan(0.0);
      expect(p.extractionMethod).toBeDefined();
    }
  });
});
