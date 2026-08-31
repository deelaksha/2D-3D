import { describe, expect, it } from "vitest";
import {
  buildExtrudedPieceMesh3D,
  buildInterfaceFrame3DInPieceLocal,
  checkCardboardJointFeasibility,
  computeMatingQuaternion,
  createConnectionInterface,
  createDefaultPuzzleDomain,
  createPuzzleConnection,
  createPuzzlePiece,
  evaluateJoiningAngleConstraint,
  PlaceholderDatasetExporter,
  PlaceholderPuzzleAI,
  solveTargetPlacement3D,
  transformPoint3D,
  validatePuzzleAssembly,
  vec3,
} from "@/core/puzzle";

describe("Parametric 2D-to-3D Puzzle Assembly System", () => {
  it("creates domain models and default cardboard specifications", () => {
    const domain = createDefaultPuzzleDomain("House Puzzle");
    expect(domain.meta.name).toBe("House Puzzle");
    expect(domain.defaultCardboard.thickness).toBe(2.0);
    expect(domain.defaultCardboard.slotTolerance).toBe(0.15);
  });

  it("creates fixed 2D cardboard piece templates with local connection interfaces", () => {
    const pieceA = createPuzzlePiece({ name: "Base Plate", width: 100, height: 100, thickness: 2.0 });
    expect(pieceA.width).toBe(100);
    expect(pieceA.thickness).toBe(2.0);

    const ifaceA = createConnectionInterface(pieceA.id, {
      name: "Top Edge Interface",
      position: { x: 50, y: 0 },
      normal: { x: 0, y: -1 },
      role: "receiver",
      pattern: "tab_slot",
    });
    pieceA.interfaces.push(ifaceA);

    expect(pieceA.interfaces).toHaveLength(1);
    expect(ifaceA.normal.y).toBe(-1);
  });

  it("builds 3D local coordinate frames for connection interfaces", () => {
    const piece = createPuzzlePiece({ width: 100, height: 100 });
    const iface = createConnectionInterface(piece.id, {
      position: { x: 50, y: 0 },
      normal: { x: 0, y: -1 },
      tangent: { x: 1, y: 0 },
    });

    const frame3D = buildInterfaceFrame3DInPieceLocal(iface);
    expect(frame3D.origin).toEqual({ x: 50, y: 0, z: 0 });
    expect(frame3D.normal.y).toBe(-1);
    expect(frame3D.binormal.z).toBe(-1);
  });

  it("solves 3D target placements for arbitrary joining angles (90deg, 45deg, 180deg)", () => {
    const pieceA = createPuzzlePiece({ name: "Floor", width: 100, height: 100 });
    const ifaceA = createConnectionInterface(pieceA.id, {
      position: { x: 50, y: 0 },
      normal: { x: 0, y: -1 },
      tangent: { x: 1, y: 0 },
    });

    const pieceB = createPuzzlePiece({ name: "Wall", width: 100, height: 80 });
    const ifaceB = createConnectionInterface(pieceB.id, {
      position: { x: 50, y: 80 },
      normal: { x: 0, y: 1 },
      tangent: { x: -1, y: 0 },
    });

    const placementA = {
      pieceId: pieceA.id,
      position: vec3(0, 0, 0),
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: vec3(1, 1, 1),
      placed: true,
    };

    // 1. Test 90-degree right angle connection
    const connection90 = createPuzzleConnection({
      sourcePieceId: pieceA.id,
      sourceInterfaceId: ifaceA.id,
      targetPieceId: pieceB.id,
      targetInterfaceId: ifaceB.id,
      joiningAngleDeg: 90.0,
    });

    const placementB90 = solveTargetPlacement3D(
      pieceA,
      ifaceA,
      placementA,
      pieceB,
      ifaceB,
      connection90,
    );

    expect(placementB90.placed).toBe(true);
    expect(placementB90.rotation).toBeDefined();

    // 2. Test 45-degree roof miter connection
    const connection45 = createPuzzleConnection({
      sourcePieceId: pieceA.id,
      sourceInterfaceId: ifaceA.id,
      targetPieceId: pieceB.id,
      targetInterfaceId: ifaceB.id,
      joiningAngleDeg: 45.0,
    });

    const placementB45 = solveTargetPlacement3D(
      pieceA,
      ifaceA,
      placementA,
      pieceB,
      ifaceB,
      connection45,
    );
    expect(placementB45.placed).toBe(true);

    // 3. Test 180-degree flat extension connection
    const connection180 = createPuzzleConnection({
      sourcePieceId: pieceA.id,
      sourceInterfaceId: ifaceA.id,
      targetPieceId: pieceB.id,
      targetInterfaceId: ifaceB.id,
      joiningAngleDeg: 180.0,
    });

    const placementB180 = solveTargetPlacement3D(
      pieceA,
      ifaceA,
      placementA,
      pieceB,
      ifaceB,
      connection180,
    );
    expect(placementB180.placed).toBe(true);
  });

  it("builds 3D extruded mesh buffers from 2D cardboard piece contours", () => {
    const piece = createPuzzlePiece({ width: 50, height: 50, thickness: 3.0 });
    const mesh = buildExtrudedPieceMesh3D(piece);

    expect(mesh.bounds.min.z).toBe(-1.5);
    expect(mesh.bounds.max.z).toBe(1.5);
    expect(mesh.positions.length).toBeGreaterThan(0);
  });

  it("evaluates deterministic assembly validation and constraints", () => {
    const pieceA = createPuzzlePiece({ name: "Piece A" });
    const assembly = {
      id: "asm_01",
      name: "Test Assembly",
      placements: [
        {
          pieceId: pieceA.id,
          position: vec3(0, 0, 0),
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: vec3(1, 1, 1),
          placed: true,
        },
      ],
      connections: [],
    };

    const report = validatePuzzleAssembly(assembly, [pieceA]);
    expect(report.level).toBe("ok");
    expect(report.issues).toHaveLength(0);
  });

  it("checks physical cardboard material joint feasibility", () => {
    const domain = createDefaultPuzzleDomain();
    const cardboard = domain.defaultCardboard; // 2.0mm thickness, 0.15mm tolerance

    // Ideal slot width = 2.15mm
    const resultGood = checkCardboardJointFeasibility(cardboard, 10, 2.15);
    expect(resultGood.feasible).toBe(true);

    // Tight slot width = 1.8mm (less than 2.0mm thickness)
    const resultTight = checkCardboardJointFeasibility(cardboard, 10, 1.8);
    expect(resultTight.feasible).toBe(false);
    expect(resultTight.recommendation).toContain("tighter than cardboard stock thickness");
  });

  it("provides placeholder AI and dataset exporter stubs with TODO markers", async () => {
    const ai = new PlaceholderPuzzleAI();
    const prediction = await ai.predictAssembly({ pieces: [] });
    expect(prediction.confidenceScore).toBe(0.0);

    const joiningAngle = await ai.predictJoiningAngle(null, "i1", null, "i2");
    expect(joiningAngle).toBe(90.0);

    const exporter = new PlaceholderDatasetExporter();
    const exported = await exporter.exportSample({
      sampleId: "s1",
      category: "house",
      pieces: [],
      edgeFeatures: [],
      groundTruthAssembly: { id: "a1", name: "A", placements: [], connections: [] },
      joiningAngleTargets: {},
    });
    expect(exported).toContain("sampleId");
  });
});
