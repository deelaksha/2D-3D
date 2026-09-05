import { describe, expect, it } from "vitest";
import { generatePuzzle } from "@/core/puzzle/highlevelapi";
import {
  PuzzleExportEngine,
  PuzzleExportValidationError,
  SvgExporter,
  DxfExporter,
  DimensionedDrawingExporter,
  StlExporter,
  ObjExporter,
  GltfExporter,
  StepExporter,
  MetadataExporter,
} from "@/core/puzzle/export";

describe("Phase 99: Comprehensive Puzzle Export Subsystem", () => {
  describe("Mandatory Validation Gating", () => {
    it("strictly rejects export if mandatory validation failed", async () => {
      const validPuzzle = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );

      // Create an invalidated clone
      const invalidPuzzle = {
        ...validPuzzle,
        validationReport: {
          ...validPuzzle.validationReport,
          isValid: false,
          issues: [
            {
              severity: "error" as const,
              code: "CRITICAL_COLLISION",
              message: "Interpenetration detected between pieces P_001 and P_002.",
            },
          ],
        },
      };

      expect(() => {
        PuzzleExportEngine.exportPuzzle(invalidPuzzle as any);
      }).toThrow(PuzzleExportValidationError);

      try {
        PuzzleExportEngine.exportPuzzle(invalidPuzzle as any);
      } catch (err: any) {
        expect(err).toBeInstanceOf(PuzzleExportValidationError);
        expect(err.message).toContain("Mandatory assembly validation failed");
        expect(err.violationDetails.some((d: string) => d.includes("CRITICAL_COLLISION"))).toBe(true);
      }
    });

    it("strictly rejects export if pieces or transforms are missing", async () => {
      const validPuzzle = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );

      const missingTransformsPuzzle = {
        ...validPuzzle,
        assembly: {
          ...validPuzzle.assembly,
          pieceTransforms: {}, // Empty transforms
        },
      };

      expect(() => {
        PuzzleExportEngine.exportPuzzle(missingTransformsPuzzle as any);
      }).toThrow(PuzzleExportValidationError);
    });
  });

  describe("2D Multi-Format Export Verification", () => {
    it("exports standards-compliant SVGs, DXFs, dimensioned drawings, and combined sheet layouts preserving all piece IDs", async () => {
      const puzzleResult = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );

      const exportPackage = PuzzleExportEngine.exportPuzzle(puzzleResult);

      expect(exportPackage.isValidated).toBe(true);
      expect(exportPackage.pieceCount).toBe(16);

      // 1. Individual Piece 2D Files
      const pieceIds = Object.keys(exportPackage.exports2D.individualPieces);
      expect(pieceIds.length).toBe(16);

      for (const piece of puzzleResult.pieces2D) {
        const pId = piece.pieceId || piece.id;
        const exported2D = exportPackage.exports2D.individualPieces[pId];
        expect(exported2D).toBeDefined();
        expect(exported2D.pieceId).toBe(pId);

        // Verify SVG
        expect(exported2D.svg).toContain("<svg");
        expect(exported2D.svg).toContain(`data-piece-id="${pId}"`);
        expect(exported2D.svg).toContain('id="cut_layer"');
        expect(exported2D.svg).toContain('id="engrave_layer"');
        expect(exported2D.svg).toContain(pId); // Piece ID label in SVG
        expect(exported2D.svg).toContain("</svg>");

        // Verify DXF
        expect(exported2D.dxf).toContain("SECTION");
        expect(exported2D.dxf).toContain("AC1009");
        expect(exported2D.dxf).toContain("CUT");
        expect(exported2D.dxf).toContain("ENGRAVE");
        expect(exported2D.dxf).toContain("POLYLINE");
        expect(exported2D.dxf).toContain("TEXT");
        expect(exported2D.dxf).toContain(pId); // Piece ID label in DXF
        expect(exported2D.dxf).toContain("EOF");

        // Verify Dimensioned Technical Drawing
        expect(exported2D.dimensionedDrawingSvg).toContain("<svg");
        expect(exported2D.dimensionedDrawingSvg).toContain("title_block");
        expect(exported2D.dimensionedDrawingSvg).toContain(pId);
        expect(exported2D.dimensionedDrawingSvg).toContain("mm");
        expect(exported2D.dimensionedDrawingSvg).toContain("MATERIAL:");
        expect(exported2D.dimensionedDrawingSvg).toContain("THICKNESS:");
        expect(exported2D.dimensionedDrawingSvg).toContain("VALIDATED");
      }

      // 2. Combined Nested Cut Sheet Layout
      const combined = exportPackage.exports2D.combinedLayout;
      expect(combined.svg).toContain("<svg");
      expect(combined.svg).toContain('id="sheet_border"');
      expect(combined.svg).toContain('id="cut_layer"');
      expect(combined.svg).toContain('id="engrave_layer"');
      expect(combined.sheetDimensions.widthMm).toBeGreaterThan(100);
      expect(combined.sheetDimensions.heightMm).toBeGreaterThan(100);

      // Verify every piece ID is present in the combined SVG and DXF
      for (const piece of puzzleResult.pieces2D) {
        const pId = piece.pieceId || piece.id;
        expect(combined.svg).toContain(`piece_${pId}_cut`);
        expect(combined.svg).toContain(`piece_${pId}_text`);
        expect(combined.dxf).toContain(pId);
      }
    });
  });

  describe("3D Multi-Format Export Verification", () => {
    it("exports standards-compliant STL, OBJ, glTF 2.0, and ISO 10303-21 STEP models preserving piece IDs", async () => {
      const puzzleResult = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );

      const exportPackage = PuzzleExportEngine.exportPuzzle(puzzleResult);

      // 1. Individual Piece 3D Files
      const piece3DIds = Object.keys(exportPackage.exports3D.individualPieces);
      expect(piece3DIds.length).toBe(16);

      for (const piece of puzzleResult.pieces3D) {
        const pId = piece.pieceId || piece.id;
        const exported3D = exportPackage.exports3D.individualPieces[pId];
        expect(exported3D).toBeDefined();
        expect(exported3D.pieceId).toBe(pId);

        // STL
        expect(exported3D.stl).toContain(`solid Piece_${pId}`);
        expect(exported3D.stl).toContain("facet normal");
        expect(exported3D.stl).toContain("vertex");
        expect(exported3D.stl).toContain(`endsolid Piece_${pId}`);

        // OBJ
        expect(exported3D.obj).toContain(`o Piece_${pId}`);
        expect(exported3D.obj).toContain("v ");
        expect(exported3D.obj).toContain("f ");

        // STEP (ISO 10303-21)
        expect(exported3D.step).toContain("ISO-10303-21;");
        expect(exported3D.step).toContain(`PRODUCT('${pId}'`);
        expect(exported3D.step).toContain("MANIFOLD_SOLID_BREP");
        expect(exported3D.step).toContain("END-ISO-10303-21;");
      }

      // 2. Complete 3D Assembly Models
      const assembled = exportPackage.exports3D.assembled;
      expect(assembled.totalTriangles).toBeGreaterThan(50);

      // Assembly STL
      expect(assembled.stl).toContain("solid PuzzleAssembly");
      expect(assembled.stl).toContain("endsolid PuzzleAssembly");

      // Assembly OBJ with named objects for each piece
      expect(assembled.obj).toContain("o Piece_");
      for (const piece of puzzleResult.pieces3D) {
        const pId = piece.pieceId || piece.id;
        expect(assembled.obj).toContain(`o Piece_${pId}`);
      }

      // Assembly glTF 2.0 JSON
      const gltf = JSON.parse(assembled.gltf);
      expect(gltf.asset.version).toBe("2.0");
      expect(gltf.scene).toBe(0);
      expect(gltf.nodes.length).toBe(16);
      for (const node of gltf.nodes) {
        expect(node.name).toBeDefined();
        expect(node.translation).toBeDefined();
        expect(node.rotation).toBeDefined();
        expect(node.extras?.pieceId).toBe(node.name);
      }
      expect(gltf.buffers[0].uri).toContain("data:application/octet-stream;base64,");

      // Assembly STEP
      expect(assembled.step).toContain("ISO-10303-21;");
      expect(assembled.step).toContain("CONFIG_CONTROL_DESIGN");
      for (const piece of puzzleResult.pieces3D) {
        const pId = piece.pieceId || piece.id;
        expect(assembled.step).toContain(`PRODUCT('${pId}'`);
      }
      expect(assembled.step).toContain("END-ISO-10303-21;");
    });
  });

  describe("Metadata Package & Manifest Integrity", () => {
    it("generates comprehensive JSON metadata and complete self-contained file manifest", async () => {
      const puzzleResult = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );

      const exportPackage = PuzzleExportEngine.exportPuzzle(puzzleResult);

      // 1. puzzle.json
      const puzzleMeta = JSON.parse(exportPackage.metadata.puzzleJson);
      expect(puzzleMeta.generatorVersion).toContain("Phase 99");
      expect(puzzleMeta.actualPieceCount).toBe(16);
      expect(puzzleMeta.connectionCount).toBe(puzzleResult.connectors.length);
      expect(puzzleMeta.validationPassed).toBe(true);

      // 2. pieces.json
      const piecesMeta = JSON.parse(exportPackage.metadata.piecesJson);
      expect(piecesMeta.length).toBe(16);
      expect(piecesMeta[0].dimensionsMm.width).toBeGreaterThan(0);
      expect(piecesMeta[0].dimensionsMm.thickness).toBe(3.0);

      // 3. connections.json
      const connectionsMeta = JSON.parse(exportPackage.metadata.connectionsJson);
      expect(connectionsMeta.length).toBe(puzzleResult.connectors.length);
      for (const conn of connectionsMeta) {
        expect(conn.connectionId).toBeDefined();
        expect(conn.pieceAId).toBeDefined();
        expect(conn.pieceBId).toBeDefined();
        expect(conn.connectorType).toBeDefined();
        expect(conn.appliedAngleDeg).toBeDefined();
      }

      // 4. assembly_configuration.json
      const configMeta = JSON.parse(exportPackage.metadata.assemblyConfigurationJson);
      expect(configMeta.rootPieceId).toBeDefined();
      expect(Object.keys(configMeta.pieceTransforms).length).toBe(16);

      // 5. assembly_sequence.json
      const seqMeta = JSON.parse(exportPackage.metadata.assemblySequenceJson);
      expect(seqMeta.steps.length).toBe(16);

      // 6. validation_report.json
      const valReport = JSON.parse(exportPackage.metadata.validationReportJson);
      expect(valReport.isValid).toBe(true);

      // 7. Manifest Verification
      expect(exportPackage.manifest.length).toBeGreaterThan(50);
      const manifestFormats = new Set(exportPackage.manifest.map((m) => m.format));
      expect(manifestFormats.has("svg")).toBe(true);
      expect(manifestFormats.has("dxf")).toBe(true);
      expect(manifestFormats.has("stl")).toBe(true);
      expect(manifestFormats.has("obj")).toBe(true);
      expect(manifestFormats.has("gltf")).toBe(true);
      expect(manifestFormats.has("step")).toBe(true);
      expect(manifestFormats.has("json")).toBe(true);

      for (const entry of exportPackage.manifest) {
        expect(entry.path).toBeDefined();
        expect(entry.sizeBytes).toBeGreaterThan(0);
        expect(entry.description).toBeDefined();
      }
    });
  });

  describe("Direct Exporter Component Invocations & Options", () => {
    it("allows direct modular usage of individual format exporters with custom options", async () => {
      const puzzleResult = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );
      const piece2D = puzzleResult.pieces2D[0];
      const piece3D = puzzleResult.pieces3D[0];
      const pieceId = piece2D.pieceId || piece2D.id;

      // 1. SvgExporter with custom options
      const customSvg = SvgExporter.exportPieceSVG(piece2D, {
        cutColor: "#00ff00",
        engraveColor: "#ff00ff",
        strokeWidthMm: 0.2,
      });
      expect(customSvg).toContain('stroke="#00ff00"');
      expect(customSvg).toContain('fill="#ff00ff"');
      expect(customSvg).toContain(`data-piece-id="${pieceId}"`);

      // 2. DxfExporter standalone
      const customDxf = DxfExporter.exportPieceDXF(piece2D);
      expect(customDxf).toContain("SECTION");
      expect(customDxf).toContain("POLYLINE");
      expect(customDxf).toContain(pieceId);

      // 3. DimensionedDrawingExporter standalone
      const customDwg = DimensionedDrawingExporter.exportDrawingSVG(
        piece2D,
        puzzleResult.connectors
      );
      expect(customDwg).toContain("title_block");
      expect(customDwg).toContain("dim-text");
      expect(customDwg).toContain(pieceId);

      // 4. StlExporter standalone
      const customStl = StlExporter.exportPieceSTL(piece3D);
      expect(customStl).toContain(`solid Piece_${pieceId}`);
      expect(customStl).toContain("facet normal");

      // 5. ObjExporter standalone
      const customObj = ObjExporter.exportPieceOBJ(piece3D);
      expect(customObj).toContain(`o Piece_${pieceId}`);
      expect(customObj).toContain("v ");

      // 6. StepExporter standalone
      const customStep = StepExporter.exportPieceSTEP(piece3D);
      expect(customStep).toContain("ISO-10303-21;");
      expect(customStep).toContain(`PRODUCT('${pieceId}'`);

      // 7. MetadataExporter standalone
      const meta = MetadataExporter.exportMetadata(puzzleResult, { jsonIndent: 4 });
      expect(meta.puzzleJson).toContain("WoodKit Designer Phase 99");
      expect(meta.piecesJson).toContain(pieceId);
    });
  });
});

