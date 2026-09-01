import { describe, expect, it } from "vitest";
import { FileTypeDetector } from "../core/puzzle/ingestion/fileTypeDetector";
import { DrawingImporter } from "../core/puzzle/ingestion/drawingImporter";
import { GeometryImporter } from "../core/puzzle/ingestion/geometryImporter";
import { CADImporter } from "../core/puzzle/ingestion/cadImporter";
import { PuzzleImporter } from "../core/puzzle/ingestion/puzzleImporter";
import { UnifiedIngestionPipeline } from "../core/puzzle/ingestion/unifiedIngestionPipeline";
import { ImportDiagnostics } from "../core/puzzle/ingestion/diagnostics";

describe("Unified Real-Data Ingestion Framework", () => {
  const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M 0 0 L 100 0 L 100 100 L 0 100 Z" /></svg>`;
  const sampleDxf = `0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n10\n0.0\n20\n0.0\n10\n80.0\n20\n0.0\n10\n80.0\n20\n60.0\n10\n0.0\n20\n60.0\n0\nENDSEC\n0\nEOF`;
  const sampleObj = `v 0 0 0\nv 100 0 0\nv 100 100 0\nf 1 2 3`;
  const sampleProjectJson = JSON.stringify({
    schemaVersion: 1,
    meta: { id: "p1", name: "Test Project", displayUnit: "mm" },
    parts: [{ id: "part_1", name: "Base", width: 100, height: 100, thickness: 3.0 }],
    materials: [],
    groups: [],
    dimensions: [],
    assembly: { placements: [], connections: [] },
  });

  describe("1. FileTypeDetector", () => {
    it("detects SVG format from content and filename", () => {
      expect(FileTypeDetector.detect({ filename: "drawing.svg", content: sampleSvg })).toBe("svg");
    });

    it("detects DXF format from section headers", () => {
      expect(FileTypeDetector.detect({ filename: "part.dxf", content: sampleDxf })).toBe("dxf");
    });

    it("detects OBJ format from vertex tokens", () => {
      expect(FileTypeDetector.detect({ filename: "mesh.obj", content: sampleObj })).toBe("obj");
    });

    it("detects WoodKit Project JSON format", () => {
      expect(FileTypeDetector.detect({ filename: "project.json", content: sampleProjectJson })).toBe("project_json");
    });

    it("identifies unknown/unsupported formats", () => {
      expect(FileTypeDetector.detect({ filename: "unknown.xyz", content: "some random data" })).toBe("unknown");
    });
  });

  describe("2. Dedicated Importers", () => {
    it("DrawingImporter processes SVG vector drawing graphics", () => {
      const diag = new ImportDiagnostics();
      const normalized = DrawingImporter.importDrawing({ filename: "box.svg", content: sampleSvg }, diag);
      expect(normalized.detectedFileType).toBe("svg");
      expect(normalized.units).toBe("mm");
      expect(normalized.segmentedPieces.length).toBeGreaterThan(0);
    });

    it("DrawingImporter issues diagnostic warning for unscaled raster images", () => {
      const diag = new ImportDiagnostics();
      const normalized = DrawingImporter.importDrawing({ filename: "photo.png", content: "fake_png_data" }, diag);
      expect(normalized.detectedFileType).toBe("png");
      expect(diag.hasWarnings()).toBe(true);
      expect(diag.getWarnings()[0].code).toBe("RASTER_SCALE_UNASSIGNED");
    });

    it("GeometryImporter parses 2D DXF polylines", () => {
      const diag = new ImportDiagnostics();
      const normalized = GeometryImporter.importGeometry({ filename: "cad.dxf", content: sampleDxf }, "dxf", diag);
      expect(normalized.detectedFileType).toBe("dxf");
      expect(normalized.contours.length).toBeGreaterThan(0);
    });

    it("CADImporter processes 3D OBJ mesh and computes footprint", () => {
      const diag = new ImportDiagnostics();
      const normalized = CADImporter.importCAD({ filename: "model.obj", content: sampleObj }, "obj", diag);
      expect(normalized.detectedFileType).toBe("obj");
      expect(normalized.segmentedPieces.length).toBe(1);
    });

    it("PuzzleImporter converts WoodKit Project JSON to CanonicalPuzzle", () => {
      const diag = new ImportDiagnostics();
      const imported = PuzzleImporter.importPuzzle({ filename: "proj.json", content: sampleProjectJson }, "project_json", diag);
      expect(imported.puzzle.metadata.name).toBe("Test Project");
      expect(imported.puzzle.pieces.length).toBe(1);
    });
  });

  describe("3. UnifiedIngestionPipeline End-to-End Orchestrator", () => {
    it("end-to-end ingests SVG and produces CanonicalPuzzle IR", () => {
      const result = UnifiedIngestionPipeline.importFile({ filename: "house.svg", content: sampleSvg });
      expect(result.success).toBe(true);
      expect(result.detectedFileType).toBe("svg");
      expect(result.puzzle).toBeDefined();
      expect(result.puzzle!.pieces.length).toBeGreaterThan(0);
    });

    it("end-to-end ingests WoodKit Project JSON and produces CanonicalPuzzle IR", () => {
      const result = UnifiedIngestionPipeline.importFile({ filename: "project.json", content: sampleProjectJson });
      expect(result.success).toBe(true);
      expect(result.detectedFileType).toBe("project_json");
      expect(result.puzzle!.metadata.name).toBe("Test Project");
    });

    it("handles unsupported file formats gracefully without crashing", () => {
      const result = UnifiedIngestionPipeline.importFile({ filename: "corrupted.xyz", content: "invalid data" });
      expect(result.success).toBe(false);
      expect(result.detectedFileType).toBe("unknown");
      expect(result.diagnostics.hasErrors()).toBe(true);
      expect(result.diagnostics.getErrors()[0].code).toBe("UNSUPPORTED_FORMAT");
    });

    it("handles corrupted JSON syntax cleanly", () => {
      const result = UnifiedIngestionPipeline.importFile({ filename: "broken.json", content: "{ bad json syntax" });
      expect(result.success).toBe(false);
      expect(result.diagnostics.hasErrors()).toBe(true);
    });
  });
});
