import { describe, expect, it } from "vitest";
import {
  convert2DTo3DSolid,
  createDefaultParametricPiece2D,
  identityTransform,
  PuzzleAssemblyGraph,
  translationTransform,
  validate3DAssemblyGeometry,
  vec3,
} from "@/core/puzzle";

describe("Phase 12: 3D Geometric Validation Engine", () => {
  it("recognizes EXPECTED CONTACT between connected pieces at registered interfaces (isValid = true)", () => {
    const pieceA = createDefaultParametricPiece2D(100, 100, 2.0);
    const pieceB = createDefaultParametricPiece2D(100, 100, 2.0);

    const solidA = convert2DTo3DSolid(pieceA).solid;
    const solidB = convert2DTo3DSolid(pieceB).solid;

    const placements = {
      p_a: { pieceId: "p_a", transform: identityTransform() },
      p_b: { pieceId: "p_b", transform: translationTransform(vec3(50, 0, 0)) }, // 50mm overlap
    };

    // Topology: Registered connection edge between p_a and p_b
    const graph = new PuzzleAssemblyGraph();
    graph.addConnectionEdge({
      connectionId: "c_ab",
      sourcePieceId: "p_a",
      sourceInterfaceId: "if_a",
      targetPieceId: "p_b",
      targetInterfaceId: "if_b",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    const report = validate3DAssemblyGeometry(placements, graph, { p_a: solidA, p_b: solidB });

    expect(report.isValid).toBe(true);
    expect(report.expectedContacts).toHaveLength(1);
    expect(report.expectedContacts[0].collisionType).toBe("expected_contact");
    expect(report.expectedContacts[0].severity).toBe("info");
  });

  it("detects UNEXPECTED COLLISION between non-connected pieces (isValid = false)", () => {
    const pieceA = createDefaultParametricPiece2D(100, 100, 2.0);
    const pieceB = createDefaultParametricPiece2D(100, 100, 2.0);

    const solidA = convert2DTo3DSolid(pieceA).solid;
    const solidB = convert2DTo3DSolid(pieceB).solid;

    // Overlapping placements WITHOUT connection edge in graph
    const placements = {
      p_a: { pieceId: "p_a", transform: identityTransform() },
      p_b: { pieceId: "p_b", transform: translationTransform(vec3(50, 0, 0)) },
    };

    const graph = new PuzzleAssemblyGraph();
    graph.addPieceNode("p_a");
    graph.addPieceNode("p_b");

    const report = validate3DAssemblyGeometry(placements, graph, { p_a: solidA, p_b: solidB });

    expect(report.isValid).toBe(false);
    expect(report.unexpectedCollisions).toHaveLength(1);
    expect(report.unexpectedCollisions[0].collisionType).toBe("unexpected_collision");
    expect(report.unexpectedCollisions[0].severity).toBe("error");
    expect(report.unexpectedCollisions[0].pieceIdA).toBe("p_a");
    expect(report.unexpectedCollisions[0].pieceIdB).toBe("p_b");
  });

  it("detects disconnected interfaces when interface frames are separated beyond tolerance", () => {
    const placements = {
      p_a: { pieceId: "p_a", transform: identityTransform() },
      p_b: { pieceId: "p_b", transform: translationTransform(vec3(500, 0, 0)) }, // Separated by 500mm
    };

    const graph = new PuzzleAssemblyGraph();
    graph.addConnectionEdge({
      connectionId: "c_disc",
      sourcePieceId: "p_a",
      sourceInterfaceId: "if_a",
      targetPieceId: "p_b",
      targetInterfaceId: "if_b",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    const interfaces = {
      if_a: {
        id: "if_a",
        pieceId: "p_a",
        edgeIndex: 0,
        interfaceType: "tab_slot" as const,
        localFrame: {
          origin: { x: 0, y: 0, z: 0 },
          tangent: { x: 0, y: 1, z: 0 },
          normal: { x: 1, y: 0, z: 0 },
          binormal: { x: 0, y: 0, z: 1 },
        },
      },
      if_b: {
        id: "if_b",
        pieceId: "p_b",
        edgeIndex: 0,
        interfaceType: "tab_slot" as const,
        localFrame: {
          origin: { x: 0, y: 0, z: 0 },
          tangent: { x: 0, y: 1, z: 0 },
          normal: { x: 1, y: 0, z: 0 },
          binormal: { x: 0, y: 0, z: 1 },
        },
      },
    };

    const report = validate3DAssemblyGeometry(placements, graph, {}, interfaces as any);

    expect(report.isValid).toBe(false);
    expect(report.misalignments).toHaveLength(1);
    expect(report.misalignments[0].collisionType).toBe("disconnected_interface");
    expect(report.misalignments[0].measuredClearance).toBeGreaterThan(100);
  });
});
