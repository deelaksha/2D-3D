import { describe, expect, it } from "vitest";
import {
  createDefaultParametricPiece2D,
  deserializeParametricPiece2D,
  evaluateParameterStore,
  regenerateParametricPieceGeometry,
  serializeParametricPiece2D,
  validateParametricPiece2D,
} from "@/core/puzzle";

describe("Phase 3: 2D Parametric Piece Representation", () => {
  it("creates a 2D parametric piece separating topology, geometry, and parameters", () => {
    const piece = createDefaultParametricPiece2D(120, 80, 2.0);
    expect(piece.width).toBe(120);
    expect(piece.height).toBe(80);
    expect(piece.thickness).toBe(2.0);

    // Topology checks
    expect(piece.topology.outerBoundary.isOuter).toBe(true);
    expect(piece.topology.outerBoundary.edgeSegments.length).toBeGreaterThan(0);
    expect(Object.keys(piece.topology.vertices).length).toBeGreaterThan(0);

    // Parameters checks
    expect(piece.parameters.tab_width.value).toBe(20);
    expect(piece.parameters.tab_depth.value).toBe(5);
  });

  it("regenerates geometry when tab_width, tab_depth, tab_radius, or edge_position change", () => {
    const piece = createDefaultParametricPiece2D(100, 100, 2.0);

    // 1. Initial tab width is 20, depth is 5, edge_position is 50
    const initialVertexCount = Object.keys(piece.topology.vertices).length;

    // 2. Change tab_width to 40 and tab_depth to 12
    const regenerated = regenerateParametricPieceGeometry(piece, {
      tab_width: 40,
      tab_depth: 12,
      edge_position: 50,
      tab_radius: 2.0,
    });

    expect(regenerated.parameters.tab_width.value).toBe(40);
    expect(regenerated.parameters.tab_depth.value).toBe(12);

    // Verify arc geometry is generated for tab riser when tab_radius > 0
    const arcSeg = regenerated.topology.outerBoundary.edgeSegments.find(
      (s) => s.geometry.kind === "arc",
    );
    expect(arcSeg).toBeDefined();
    if (arcSeg && arcSeg.geometry.kind === "arc") {
      expect(arcSeg.geometry.radius).toBe(2.0);
    }
  });

  it("evaluates mathematical parameter expressions", () => {
    const params = {
      width: { id: "p1", name: "width", value: 100, defaultValue: 100 },
      tab_width: { id: "p2", name: "tab_width", value: 20, defaultValue: 20 },
      edge_position: {
        id: "p3",
        name: "edge_position",
        value: 0,
        defaultValue: 0,
        expression: "width / 2",
      },
    };

    const resolved = evaluateParameterStore(params);
    expect(resolved.edge_position).toBe(50);
  });

  it("supports inner holes and circular arc segment primitives", () => {
    const piece = createDefaultParametricPiece2D(100, 100, 2.0);
    const pieceWithHole = regenerateParametricPieceGeometry(piece, { hole_radius: 8 });

    expect(pieceWithHole.topology.holes).toHaveLength(1);
    expect(pieceWithHole.sampledOutlines).toHaveLength(2); // outer loop + hole loop
  });

  it("serializes and deserializes 2D parametric pieces losslessly", () => {
    const piece = createDefaultParametricPiece2D(80, 60, 3.0);
    const json = serializeParametricPiece2D(piece);

    expect(json).toContain("Parametric Cardboard Piece");
    expect(json).toContain("tab_width");

    const restored = deserializeParametricPiece2D(json);
    expect(restored.width).toBe(80);
    expect(restored.height).toBe(60);
    expect(restored.thickness).toBe(3.0);
    expect(restored.topology.outerBoundary.edgeSegments.length).toBeGreaterThan(0);
  });

  it("validates parametric piece models and catches topology / vertex defects", () => {
    const piece = createDefaultParametricPiece2D(100, 100, 2.0);

    // Corrupt vertex reference
    piece.topology.outerBoundary.edgeSegments[0].startVertexId = "nonexistent_vertex";

    const report = validateParametricPiece2D(piece);
    expect(report.overallSeverity).toBe("error");

    const codes = report.issues.map((i) => i.code);
    expect(codes).toContain("DANGLING_START_VERTEX");
  });
});
