import { describe, expect, it } from "vitest";
import { GeometryExtractor } from "../core/puzzle/ingestion/geometry/geometryExtractor";
import { PrimitiveExtractor } from "../core/puzzle/ingestion/geometry/primitiveExtractor";
import { BoundaryExtractor } from "../core/puzzle/ingestion/geometry/boundaryExtractor";
import { DimensionExtractor } from "../core/puzzle/ingestion/geometry/dimensionExtractor";
import { LabelExtractor } from "../core/puzzle/ingestion/geometry/labelExtractor";
import { GeometryValidator } from "../core/puzzle/ingestion/geometry/geometryValidator";
import { DrawingImporter } from "../core/puzzle/ingestion/drawingImporter";
import { ImportDiagnostics } from "../core/puzzle/ingestion/diagnostics";
import type { GeometricValidationIssue } from "../core/puzzle/ingestion/geometry/types";

describe("Real 2D Geometry Extraction Layer", () => {
  const sampleSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <path d="M 0 0 L 100 0 L 100 80 L 0 80 Z" />
    </svg>
  `;

  describe("1. PrimitiveExtractor", () => {
    it("extracts exact line primitives from vector paths", () => {
      const diag = new ImportDiagnostics();
      const normalized = DrawingImporter.importDrawing({ filename: "box.svg", content: sampleSvg }, diag);

      const primitives = PrimitiveExtractor.extractPrimitives(
        normalized.contours.map((c) => ({ id: c.id, points: c.outerLoop, closed: true }))
      );

      expect(primitives.length).toBeGreaterThan(0);
      expect(primitives[0].kind).toBe("line");
    });

    it("extracts circle primitives from 360-degree closed circular paths", () => {
      const circlePts = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        circlePts.push({ x: 50 + Math.cos(a) * 20, y: 50 + Math.sin(a) * 20 });
      }

      const primitives = PrimitiveExtractor.extractPrimitives([{ id: "circ_1", points: circlePts, closed: true }]);
      expect(primitives.length).toBe(1);
      expect(primitives[0].kind).toBe("circle");
      if (primitives[0].kind === "circle") {
        expect(primitives[0].radius).toBeCloseTo(20, 1);
      }
    });

    it("extracts spline primitives", () => {
      const spline = PrimitiveExtractor.createSpline("spline_1", [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 30, y: 0 }]);
      expect(spline.kind).toBe("spline");
      expect(spline.controlPoints.length).toBe(3);
    });
  });

  describe("2. BoundaryExtractor & Topology Mapping", () => {
    it("reconstructs outer boundary and hole loops into PieceTopology", () => {
      const outerPts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
      const holePts = [[{ x: 40, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 60 }, { x: 40, y: 60 }]];

      const topo = BoundaryExtractor.extractTopology([], outerPts, holePts);
      expect(topo.outerBoundary.edgeSegments.length).toBe(4);
      expect(topo.holes.length).toBe(1);
      expect(topo.holes[0].edgeSegments.length).toBe(4);
    });
  });

  describe("3. DimensionExtractor & LabelExtractor", () => {
    it("extracts linear and radial dimensions from vector text annotations", () => {
      const dims = DimensionExtractor.extractDimensions([], ["100mm", "T=3.0", "R=15.5"]);
      expect(dims.length).toBe(3);
      expect(dims.some((d) => d.type === "radial" && d.valueMm === 15.5)).toBe(true);
      expect(dims.some((d) => d.valueMm === 3.0)).toBe(true);
    });

    it("extracts piece labels and CAD layer tags", () => {
      const labels = LabelExtractor.extractLabels([{ id: "p1", points: [], closed: true, layerName: "CUT_LAYER" }], ["Piece P01"]);
      expect(labels.some((l) => l.text === "Piece P01")).toBe(true);
      expect(labels.some((l) => l.layerName === "CUT_LAYER")).toBe(true);
    });
  });

  describe("4. GeometryValidator Engine", () => {
    it("detects zero-length edges", () => {
      const issues = GeometryValidator.validateGeometry(
        [{ kind: "line", id: "l_zero", start: { x: 10, y: 10 }, end: { x: 10, y: 10 }, length: 0 }],
        { vertices: {}, outerBoundary: { id: "o", isOuter: true, edgeSegments: [] }, holes: [] }
      );
      expect(issues.some((i: GeometricValidationIssue) => i.code === "GEOM_ZERO_LENGTH_EDGE")).toBe(true);
    });

    it("detects open boundaries", () => {
      const openTopo = {
        vertices: {
          v1: { id: "v1", x: 0, y: 0 },
          v2: { id: "v2", x: 10, y: 0 },
          v3: { id: "v3", x: 10, y: 10 },
          v4: { id: "v4", x: 0.5, y: 10 }, // 0.5mm gap to v1
        },
        outerBoundary: {
          id: "open_loop",
          isOuter: true,
          edgeSegments: [
            { id: "e1", startVertexId: "v1", endVertexId: "v2", edgeIndex: 0, geometry: { kind: "line" as const } },
            { id: "e2", startVertexId: "v2", endVertexId: "v3", edgeIndex: 1, geometry: { kind: "line" as const } },
            { id: "e3", startVertexId: "v3", endVertexId: "v4", edgeIndex: 2, geometry: { kind: "line" as const } },
          ],
        },
        holes: [],
      };

      const issues = GeometryValidator.validateGeometry([], openTopo);
      expect(issues.some((i: GeometricValidationIssue) => i.code === "GEOM_OPEN_BOUNDARY_GAP")).toBe(true);
    });

    it("detects duplicate coincident edges", () => {
      const lineA = { kind: "line" as const, id: "l1", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, length: 10 };
      const lineB = { kind: "line" as const, id: "l2", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, length: 10 };

      const issues = GeometryValidator.validateGeometry(
        [lineA, lineB],
        { vertices: {}, outerBoundary: { id: "o", isOuter: true, edgeSegments: [] }, holes: [] }
      );

      expect(issues.some((i: GeometricValidationIssue) => i.code === "GEOM_DUPLICATE_EDGE")).toBe(true);
    });
  });

  describe("5. GeometryExtractor Master Coordinator", () => {
    it("end-to-end extracts 2D primitives and maps directly into CanonicalPiece", () => {
      const diag = new ImportDiagnostics();
      const normalized = DrawingImporter.importDrawing({ filename: "square.svg", content: sampleSvg }, diag);

      const result = GeometryExtractor.extract(normalized, diag);

      expect(result.isValid).toBe(true);
      expect(result.primitives.length).toBeGreaterThan(0);
      expect(result.canonicalPieces.length).toBe(1);
      expect(result.canonicalPieces[0].geometryRef).toBeDefined();
    });
  });
});
