import { describe, expect, it } from "vitest";
import { RealDataIngestionPipeline } from "../core/puzzle/realdata/realDataIngestionPipeline";
import { FileIntegrityValidator } from "../core/puzzle/realdata/fileValidator";
import type { RawFilePayload } from "../core/puzzle/ingestion/types";

// Fixture payloads
const sampleSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" units="mm">
    <!-- Base Piece with tab -->
    <path d="M 0 0 L 30 0 L 30 -10 L 50 -10 L 50 0 L 100 0 L 100 80 L 0 80 Z" />
    <!-- Wall Piece with slot -->
    <path d="M 120 0 L 220 0 L 220 80 L 120 80 Z" />
    <rect x="150" y="30" width="20" height="3" />
  </svg>
`;

const sampleDxf = `0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n10\n0.0\n20\n0.0\n10\n100.0\n20\n0.0\n10\n100.0\n20\n60.0\n10\n0.0\n20\n60.0\n0\nENDSEC\n0\nEOF`;

const sampleObj = `# Wavefront OBJ
v 0 0 0
v 100 0 0
v 100 80 0
v 0 80 0
f 1 2 3 4
`;

const sampleStl = `solid box
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 100 0 0
      vertex 100 80 0
    endloop
  endfacet
endsolid box`;

const sampleStep = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('STEP Model'),'2;1');
FILE_NAME('test.step','2026-09-05',('Author'),('Org'),'Preprocessor','OriginatingSystem','Authorization');
FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));
ENDSEC;
DATA;
#1 = CARTESIAN_POINT('',(0.,0.,0.));
ENDSEC;
END-ISO-10303-21;`;

const sampleProjectJson = JSON.stringify({
  schemaVersion: 1,
  meta: { id: "p1", name: "Valid Project", displayUnit: "mm" },
  parts: [
    {
      id: "part_1",
      name: "Base Plate",
      width: 100,
      height: 100,
      thickness: 3.0,
      connectors: [
        {
          id: "conn_1",
          partId: "part_1",
          name: "Tab",
          type: "tab",
          position: { x: 50, y: 0 },
          orientation: 0,
          width: 20,
          height: 5,
          depth: 5,
          tolerance: 0.1,
          compatibleWith: ["slot"],
        },
      ],
    },
    {
      id: "part_2",
      name: "Side Wall",
      width: 100,
      height: 80,
      thickness: 3.0,
      connectors: [
        {
          id: "conn_2",
          partId: "part_2",
          name: "Slot",
          type: "slot",
          position: { x: 50, y: 0 },
          orientation: 0,
          width: 20,
          height: 5,
          depth: 5,
          tolerance: 0.1,
          compatibleWith: ["tab"],
        },
      ],
    },
  ],
  materials: [{ id: "m1", name: "Cardboard", thickness: 3.0 }],
  groups: [],
  dimensions: [],
  assembly: {
    placements: [
      { partId: "part_1", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      { partId: "part_2", position: { x: 0, y: 0, z: 50 }, rotation: { x: 90, y: 0, z: 0 } },
    ],
    connections: [
      {
        id: "c1",
        fromPartId: "part_1",
        fromConnectorId: "conn_1",
        toPartId: "part_2",
        toConnectorId: "conn_2",
        status: "valid",
      },
    ],
  },
});

// Binary 1x1 PNG header bytes
const samplePngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

// Binary JPG SOI marker bytes
const sampleJpgBytes = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);

describe("Phase 61: Production-Quality Real-Data Ingestion Pipeline", () => {
  describe("1. Multi-Format File Validation & Format Support", () => {
    it("validates and detects SVG vector format", () => {
      const res = FileIntegrityValidator.validate({ filename: "part.svg", content: sampleSvg });
      expect(res.isValid).toBe(true);
      expect(res.detectedFormat).toBe("SVG");
      expect(res.rawReference.sha256).toBeDefined();
    });

    it("validates and detects DXF CAD format", () => {
      const res = FileIntegrityValidator.validate({ filename: "part.dxf", content: sampleDxf });
      expect(res.isValid).toBe(true);
      expect(res.detectedFormat).toBe("DXF");
    });

    it("validates and detects OBJ mesh format", () => {
      const res = FileIntegrityValidator.validate({ filename: "model.obj", content: sampleObj });
      expect(res.isValid).toBe(true);
      expect(res.detectedFormat).toBe("OBJ");
    });

    it("validates and detects STL solid format", () => {
      const res = FileIntegrityValidator.validate({ filename: "plate.stl", content: sampleStl });
      expect(res.isValid).toBe(true);
      expect(res.detectedFormat).toBe("STL");
    });

    it("validates and detects STEP standard format", () => {
      const res = FileIntegrityValidator.validate({ filename: "assembly.step", content: sampleStep });
      expect(res.isValid).toBe(true);
      expect(res.detectedFormat).toBe("STEP");
    });

    it("validates and detects JSON format", () => {
      const res = FileIntegrityValidator.validate({ filename: "kit.json", content: sampleProjectJson });
      expect(res.isValid).toBe(true);
      expect(res.detectedFormat).toBe("JSON");
    });

    it("validates binary PNG magic header bytes", () => {
      const res = FileIntegrityValidator.validate({ filename: "drawing.png", content: samplePngBytes });
      expect(res.isValid).toBe(true);
      expect(res.detectedFormat).toBe("PNG");
    });

    it("validates binary JPG SOI marker bytes", () => {
      const res = FileIntegrityValidator.validate({ filename: "photo.jpg", content: sampleJpgBytes });
      expect(res.isValid).toBe(true);
      expect(res.detectedFormat).toBe("JPG");
    });
  });

  describe("2. Full 10-Stage Pipeline Execution", () => {
    it("executes all 10 stages sequentially for SVG input", () => {
      const result = RealDataIngestionPipeline.ingestFile({
        filename: "house_puzzle.svg",
        content: sampleSvg,
      });

      expect(result.success).toBe(true);
      expect(result.detectedFormat).toBe("SVG");

      // Verify all 10 stages in trace
      const stageNames = result.stageTraces.map((t) => t.stage);
      expect(stageNames).toContain("RAW_SOURCE");
      expect(stageNames).toContain("FILE_VALIDATION");
      expect(stageNames).toContain("IMPORT");
      expect(stageNames).toContain("NORMALIZATION");
      expect(stageNames).toContain("CANONICAL_IR");
      expect(stageNames).toContain("GEOMETRY_VALIDATION");
      expect(stageNames).toContain("CONNECTION_VALIDATION");
      expect(stageNames).toContain("ASSEMBLY_VALIDATION");
      expect(stageNames).toContain("DATASET_EXAMPLE");
      expect(stageNames).toContain("QUALITY_STATUS");
    });

    it("executes all 10 stages sequentially for WoodKit Project JSON", () => {
      const result = RealDataIngestionPipeline.ingestFile({
        filename: "wooden_box.json",
        content: sampleProjectJson,
      });

      expect(result.success).toBe(true);
      expect(result.qualityStatus).toBe("PASS");
      expect(result.canonicalPuzzle).toBeDefined();
      expect(result.canonicalPuzzle!.pieces.length).toBe(2);
      expect(result.canonicalPuzzle!.connections.length).toBe(1);
    });
  });

  describe("3. Provenance Retention & Immutable Raw-Data References", () => {
    it("captures full 7-point provenance with immutable raw reference", () => {
      const result = RealDataIngestionPipeline.ingestFile({
        filename: "bracket.dxf",
        content: sampleDxf,
      });

      expect(result.provenance).toBeDefined();
      const prov = result.provenance!;

      expect(prov.source_file).toBe("bracket.dxf");
      expect(prov.source_id).toContain("src_dxf_");
      expect(prov.source_version).toBe(result.rawReference.sha256);
      expect(prov.import_timestamp).toBeDefined();
      expect(prov.schema_version).toBe("1.0.0");
      expect(prov.geometry_version).toBe("1.0.0");
      expect(prov.processing_version).toBe("61.0.0");

      // Immutable reference checks
      expect(prov.raw_ref.rawId).toBeDefined();
      expect(prov.raw_ref.sizeBytes).toBeGreaterThan(0);
      expect(prov.raw_ref.mimeType).toBe("application/dxf");
    });

    it("does not modify original payload object or content", () => {
      const originalPayload: RawFilePayload = {
        filename: "frozen_test.obj",
        content: sampleObj,
      };
      const originalContentSnapshot = originalPayload.content;

      RealDataIngestionPipeline.ingestFile(originalPayload);

      expect(originalPayload.content).toBe(originalContentSnapshot);
      expect(originalPayload.filename).toBe("frozen_test.obj");
    });
  });

  describe("4. Quality Status Gating (PASS, FAIL, REVIEW_REQUIRED)", () => {
    it("assigns PASS to fully connected, geometrically sound design", () => {
      const result = RealDataIngestionPipeline.ingestFile({
        filename: "box_kit.json",
        content: sampleProjectJson,
      });

      expect(result.qualityStatus).toBe("PASS");
      expect(result.datasetExample?.qualitySummary.geometryValid).toBe(true);
      expect(result.datasetExample?.qualitySummary.connectionValid).toBe(true);
      expect(result.datasetExample?.qualitySummary.assemblyValid).toBe(true);
    });

    it("assigns FAIL on corrupted DXF input", () => {
      const result = RealDataIngestionPipeline.ingestFile({
        filename: "corrupt.dxf",
        content: "BAD DXF CORRUPTED HEADER NO VALID TOKENS",
      });

      expect(result.success).toBe(false);
      expect(result.qualityStatus).toBe("FAIL");
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("DXF_CORRUPTED_STRUCTURE");
    });

    it("assigns FAIL on broken JSON syntax", () => {
      const result = RealDataIngestionPipeline.ingestFile({
        filename: "broken.json",
        content: "{ invalid: json, unclosed",
      });

      expect(result.success).toBe(false);
      expect(result.qualityStatus).toBe("FAIL");
      expect(result.errors[0]).toContain("JSON_SYNTAX_ERROR");
    });

    it("assigns REVIEW_REQUIRED for unscaled raster images", () => {
      const result = RealDataIngestionPipeline.ingestFile({
        filename: "drawing.png",
        content: samplePngBytes,
      });

      // Pipeline should not reject, but flag as REVIEW_REQUIRED
      expect(result.qualityStatus).toBe("REVIEW_REQUIRED");
      expect(result.warnings.some((w) => w.includes("RASTER") || w.includes("SCALE"))).toBe(true);
    });
  });

  describe("5. Safety & Execution Controls (Dry-Run & Batch Guard)", () => {
    it("executes in dryRun mode without errors", () => {
      const result = RealDataIngestionPipeline.ingestFile(
        { filename: "dry_run.svg", content: sampleSvg },
        { dryRun: true }
      );

      expect(result.dryRun).toBe(true);
      expect(result.success).toBe(true);
      expect(result.datasetExample).toBeDefined();
    });

    it("enforces maxItems safety batch limit to prevent runaway execution", () => {
      const payloads: RawFilePayload[] = [
        { filename: "f1.svg", content: sampleSvg },
        { filename: "f2.dxf", content: sampleDxf },
        { filename: "f3.obj", content: sampleObj },
        { filename: "f4.json", content: sampleProjectJson },
      ];

      // Limit batch to 2 items
      const results = RealDataIngestionPipeline.ingestBatch(payloads, { maxItems: 2 });
      expect(results.length).toBe(2);
      expect(results[0].sourceFile).toBe("f1.svg");
      expect(results[1].sourceFile).toBe("f2.dxf");
    });
  });

  describe("6. Real Disk Fixture Dataset Verification", () => {
    it("ingests physical disk fixture files without modifying source files", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const fixtureDir = path.resolve(__dirname, "../__fixtures__/realdata");

      const fixtures = [
        { file: "box.svg", expectedQuality: "REVIEW_REQUIRED" },
        { file: "bracket.dxf", expectedQuality: "PASS" },
        { file: "cube.obj", expectedQuality: "PASS" },
        { file: "plate.stl", expectedQuality: "PASS" },
        { file: "component.step", expectedQuality: "PASS" },
        { file: "project.json", expectedQuality: "PASS" },
        { file: "corrupt.dxf", expectedQuality: "FAIL" },
        { file: "broken.json", expectedQuality: "FAIL" },
      ];

      for (const f of fixtures) {
        const filePath = path.join(fixtureDir, f.file);
        expect(fs.existsSync(filePath)).toBe(true);

        const beforeStat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, "utf-8");

        const result = RealDataIngestionPipeline.ingestFile({
          filename: f.file,
          content,
        });

        expect(result.qualityStatus).toBe(f.expectedQuality);

        // Verify source file on disk is completely untouched
        const afterStat = fs.statSync(filePath);
        const afterContent = fs.readFileSync(filePath, "utf-8");

        expect(afterContent).toBe(content);
        expect(afterStat.size).toBe(beforeStat.size);
      }
    });
  });
});
