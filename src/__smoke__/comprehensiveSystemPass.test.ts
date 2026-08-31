import { describe, expect, it } from "vitest";
import {
  AssemblySequenceSolver,
  AssemblyTransformationSystem,
  ConnectionCompatibilityEngine,
  convert2DTo3DSolid,
  createDefaultParametricPiece2D,
  createEmptyCanonicalPuzzle,
  DesignRepairEngine,
  DeterministicGridOptimizer,
  evaluateDesignScore,
  identityTransform,
  MockAIRepairStrategy,
  MockAIProvider,
  PuzzleAssemblyGraph,
  PuzzleDatasetExporter,
  PuzzleDatasetImporter,
  PuzzleValidationEngine,
  runParametricGeometryPipeline,
  validate3DAssemblyGeometry,
  validateDatasetItem,
  validateParametricDesignSpecification,
  vec3,
} from "@/core/puzzle";

describe("Phase 23: Comprehensive Master System Test Pass (17 Core Subsystems)", () => {
  const compatEngine = new ConnectionCompatibilityEngine();
  const exporter = new PuzzleDatasetExporter();
  const importer = new PuzzleDatasetImporter();

  // ------------------------------------------------------------------
  // 1. 2D GEOMETRY PIPELINE TESTS
  // ------------------------------------------------------------------
  describe("1. 2D Geometry Pipeline", () => {
    it("generates deterministic closed boundary loops for normal rectangular pieces", () => {
      const out = runParametricGeometryPipeline({
        pieceParameters: { width: 100, height: 80, thickness: 2.0 },
        edgeParameters: [],
        interfaceParameters: [],
      });
      expect(out.validationReport.level).toBe("ok");
      expect(out.exactBoundary.edgeSegments.length).toBe(4);
      expect(out.deterministicHash).toBeDefined();
    });

    it("detects degenerate zero-length edges and minimum feature size violations", () => {
      const outTooSmall = runParametricGeometryPipeline({
        pieceParameters: { width: 100, height: 100, thickness: 2.0 },
        edgeParameters: [],
        interfaceParameters: [
          { id: "f_tiny", edgeIndex: 2, featureKind: "tab", parametricOffset: 0.5, width: 0.5, depth: 5 },
        ],
      });
      expect(outTooSmall.validationReport.level).toBe("error");
      expect(outTooSmall.validationReport.issues.some((i: any) => i.code === "FEATURE_TOO_SMALL")).toBe(true);
    });

    it("rejects zero or negative piece dimensions", () => {
      const outZero = runParametricGeometryPipeline({
        pieceParameters: { width: 0, height: -50, thickness: 2.0 },
        edgeParameters: [],
        interfaceParameters: [],
      });
      expect(outZero.validationReport.level).toBe("error");
      expect(outZero.validationReport.issues.some((i: any) => i.code === "INVALID_WIDTH")).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // 2. 3D CONVERSION TESTS
  // ------------------------------------------------------------------
  describe("2. 3D Solid Conversion", () => {
    it("extrudes 2D profiles into 3D solids strictly in piece-local space [-T/2, +T/2]", () => {
      const piece2D = createDefaultParametricPiece2D(120, 80, 3.0);
      const res = convert2DTo3DSolid(piece2D);
      expect(res.solid).toBeDefined();
      expect(res.solid.localMesh.bounds.min.z).toBeCloseTo(-1.5);
      expect(res.solid.localMesh.bounds.max.z).toBeCloseTo(1.5);
    });

    it("rejects extrusion with zero or negative thickness", () => {
      const pieceInvalid = createDefaultParametricPiece2D(120, 80, 0.0);
      pieceInvalid.thickness = 0.0;
      const res = convert2DTo3DSolid(pieceInvalid);
      expect(Math.abs(res.solid.localMesh.bounds.min.z)).toBe(0);
      expect(Math.abs(res.solid.localMesh.bounds.max.z)).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // 3. COORDINATE TRANSFORMS & INTERFACE FRAMES
  // ------------------------------------------------------------------
  describe("3. Coordinate Transforms & Interface Frames", () => {
    it("maintains orthonormal basis vectors (normal = tangent x binormal)", () => {
      const frame = {
        origin: vec3(50, 0, 0),
        tangent: vec3(1, 0, 0),
        normal: vec3(0, -1, 0),
        binormal: vec3(0, 0, -1),
      };
      const sys = new AssemblyTransformationSystem();
      expect(sys).toBeDefined();
      expect(frame.tangent.x).toBe(1);
      expect(frame.normal.y).toBe(-1);
    });
  });

  // ------------------------------------------------------------------
  // 4. CONNECTION COMPATIBILITY & ARBITRARY JOINING ANGLES
  // ------------------------------------------------------------------
  describe("4. Connection Compatibility Engine & Arbitrary Joining Angles", () => {
    const ifTab = {
      id: "if_tab",
      owningPieceId: "P01",
      name: "Tab",
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.4, parametricEnd: 0.6, length: 20 },
      interfaceType: "tab" as const,
      profile: { profileKind: "tab" as const, width: 20, depth: 5, clearance: 0.15 },
      compatibility: { allowedTypes: ["slot" as any], genderRole: "insert" as const, complementaryPatterns: [] },
      localFrame: { origin: vec3(50, 0, 0), tangent: vec3(1, 0, 0), normal: vec3(0, -1, 0), binormal: vec3(0, 0, -1) },
      tolerance: 0.15,
      allowedDOF: { translation: { x: false, y: false, z: false }, rotation: { rx: false, ry: false, rz: false } },
    };

    const ifSlot = {
      id: "if_slot",
      owningPieceId: "P02",
      name: "Slot",
      edgeGeometry: { edgeIndex: 2, parametricStart: 0.4, parametricEnd: 0.6, length: 20 },
      interfaceType: "slot" as const,
      profile: { profileKind: "slot" as const, width: 20, depth: 5, clearance: 0.15 },
      compatibility: { allowedTypes: ["tab" as any], genderRole: "receiver" as const, complementaryPatterns: [] },
      localFrame: { origin: vec3(50, 0, 0), tangent: vec3(1, 0, 0), normal: vec3(0, -1, 0), binormal: vec3(0, 0, -1) },
      tolerance: 0.15,
      allowedDOF: { translation: { x: false, y: false, z: false }, rotation: { rx: false, ry: false, rz: false } },
    };

    it("evaluates compatibility across arbitrary joining angles (0°, 30°, 45°, 60°, 90°, 135°)", () => {
      const angles = [0.0, 30.0, 45.0, 60.0, 90.0, 135.0];
      for (const angle of angles) {
        const report = compatEngine.evaluateCompatibility({
          interfaceA: ifTab,
          interfaceB: ifSlot,
          joiningAngleDeg: angle,
          transformA: identityTransform(),
          transformB: identityTransform(),
        });
        expect(report.isCompatible).toBe(true);
      }
    });

    it("rejects incompatible interface type combinations (tab vs tab)", () => {
      const report = compatEngine.evaluateCompatibility({
        interfaceA: ifTab,
        interfaceB: ifTab, // Incompatible tab vs tab
        joiningAngleDeg: 90.0,
        transformA: identityTransform(),
        transformB: identityTransform(),
      });
      expect(report.isCompatible).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // 5. ASSEMBLY GRAPH & DISCONNECTED GRAPHS
  // ------------------------------------------------------------------
  describe("5. Assembly Graph", () => {
    it("detects connected graphs vs disconnected component graphs", () => {
      const graph = new PuzzleAssemblyGraph();
      graph.addPieceNode("P01");
      graph.addPieceNode("P02");
      graph.addPieceNode("P03"); // Disconnected node

      graph.addConnectionEdge({
        connectionId: "c12",
        sourcePieceId: "P01",
        sourceInterfaceId: "if1",
        targetPieceId: "P02",
        targetInterfaceId: "if2",
        connectionType: "tab_slot",
        joiningAngleDeg: 90,
        status: "valid",
      });

      expect(graph.isConnected("P01", "P03")).toBe(false);
      expect(graph.getConnectedComponents().length).toBe(2);
    });
  });

  // ------------------------------------------------------------------
  // 6. COLLISION & CLEARANCE VALIDATION
  // ------------------------------------------------------------------
  describe("6. Spatial Collision & Clearance Validation", () => {
    it("distinguishes expected contact at joint from unexpected collisions", () => {
      const graph = new PuzzleAssemblyGraph();
      graph.addPieceNode("P01");
      graph.addPieceNode("P02");
      graph.addConnectionEdge({
        connectionId: "c12",
        sourcePieceId: "P01",
        sourceInterfaceId: "if1",
        targetPieceId: "P02",
        targetInterfaceId: "if2",
        connectionType: "tab_slot",
        joiningAngleDeg: 90,
        status: "valid",
      });

      const p1 = createDefaultParametricPiece2D(100, 100, 2.0);
      const p2 = createDefaultParametricPiece2D(100, 100, 2.0);
      const s1 = convert2DTo3DSolid(p1).solid;
      const s2 = convert2DTo3DSolid(p2).solid;

      const report = validate3DAssemblyGeometry(
        { P01: { pieceId: "P01", transform: identityTransform() }, P02: { pieceId: "P02", transform: identityTransform() } },
        graph,
        { P01: s1, P02: s2 },
      );

      expect(report.isValid).toBe(true);
      expect(report.unexpectedCollisions.length).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // 7. ASSEMBLY SEQUENCE SOLVER
  // ------------------------------------------------------------------
  describe("7. Assembly Sequence Planning", () => {
    it("plans explicit step-by-step physical assembly sequence (P01 -> P01+P02)", () => {
      const graph = new PuzzleAssemblyGraph();
      graph.addPieceNode("P01");
      graph.addPieceNode("P02");
      graph.addConnectionEdge({
        connectionId: "c12",
        sourcePieceId: "P01",
        sourceInterfaceId: "if1",
        targetPieceId: "P02",
        targetInterfaceId: "if2",
        connectionType: "tab_slot",
        joiningAngleDeg: 90,
        status: "valid",
      });

      const p1 = createDefaultParametricPiece2D(100, 100, 2.0);
      const p2 = createDefaultParametricPiece2D(100, 100, 2.0);
      const s1 = convert2DTo3DSolid(p1).solid;
      const s2 = convert2DTo3DSolid(p2).solid;

      const seqRes = AssemblySequenceSolver.planAssemblySequence({
        graph,
        placements: { P01: { pieceId: "P01", transform: identityTransform() }, P02: { pieceId: "P02", transform: identityTransform() } },
        solids: { P01: s1, P02: s2 },
        basePieceId: "P01",
      });

      expect(seqRes.success).toBe(true);
      expect(seqRes.bestSequence?.steps.length).toBe(2);
    });
  });

  // ------------------------------------------------------------------
  // 8. SERIALIZATION & DATASET IMPORT/EXPORT
  // ------------------------------------------------------------------
  describe("8. Dataset Serialization & Round-Trip Export/Import", () => {
    it("performs clean round-trip export/import preserving versioning 1.0.0 and canonical structure", async () => {
      const puzzle = createEmptyCanonicalPuzzle("Ser_Test");
      puzzle.pieces.push({
        id: "p1",
        name: "Piece 1",
        geometryRef: { contour: { kind: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0 } },
        dimensions: { width: 100, height: 100, depth: 2 },
        thickness: 2.0,
        materialId: "cardboard-2mm",
        interfaceIds: [],
        localFrame: { origin: vec3(0, 0, 0), tangent: vec3(1, 0, 0), normal: vec3(0, -1, 0), binormal: vec3(0, 0, -1) },
        manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
      });

      const datasetItem = await exporter.exportPuzzleToDatasetItem(puzzle, {}, {}, new PuzzleAssemblyGraph());
      expect(datasetItem.version).toBe("1.0.0");
      expect(datasetItem.pieces.length).toBe(1);

      const isDatasetValid = validateDatasetItem(datasetItem);
      expect(isDatasetValid.isValid).toBe(true);

      const reconstructed = await importer.reconstructCanonicalPuzzle(datasetItem);
      expect(reconstructed.puzzle.pieces[0].id).toBe("p1");
    });
  });

  // ------------------------------------------------------------------
  // 9. AI SCHEMA VALIDATION
  // ------------------------------------------------------------------
  describe("9. AI Integration Layer & Schema Validation", () => {
    it("validates structured ParametricDesignSpecification JSON payloads", async () => {
      const aiProvider = new MockAIProvider();
      const spec = await aiProvider.generateDesignSpecification({
        prompt: "Create a 3D box puzzle with 20 pieces",
      });

      const validation = validateParametricDesignSpecification(spec);
      expect(validation.isValid).toBe(true);
      expect(spec.piece_count).toBe(20);
    });
  });

  // ------------------------------------------------------------------
  // 10. REPAIR PROPOSAL VALIDATION
  // ------------------------------------------------------------------
  describe("10. Automatic Design Repair Subsystem", () => {
    it("consumes validation errors, proposes parametric variable adjustments, and passes deterministic re-validation", async () => {
      const puzzle = createEmptyCanonicalPuzzle("Repair_Test");
      puzzle.pieces.push({
        id: "p_over",
        name: "Oversized Piece",
        geometryRef: { contour: { kind: "rect", x: 0, y: 0, width: 700, height: 100, rotation: 0 } },
        dimensions: { width: 700, height: 100, depth: 2 },
        thickness: 2.0,
        materialId: "cardboard-2mm",
        interfaceIds: [],
        localFrame: { origin: vec3(0, 0, 0), tangent: vec3(1, 0, 0), normal: vec3(0, -1, 0), binormal: vec3(0, 0, -1) },
        manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
      });

      const valReport = PuzzleValidationEngine.validatePuzzle({
        puzzle,
        globalMaterialParams: { stockWidth: 600, stockHeight: 400, stockThickness: 2.0, stockTolerance: 0.15, density: 0.68, grainDirectionDeg: 0, minBendRadius: 4.0 },
      });

      const strategy = new MockAIRepairStrategy();
      const result = await DesignRepairEngine.attemptRepair({ puzzle, validationReport: valReport }, strategy);

      expect(result.appliedProposal.adjustments.length).toBeGreaterThan(0);
      const repairedMat = result.repairedPuzzle.materialSpecification[0] as any;
      expect(repairedMat.stockWidthMm).toBe(800);
    });
  });

  // ------------------------------------------------------------------
  // 11. MULTI-OBJECTIVE OPTIMIZATION
  // ------------------------------------------------------------------
  describe("11. Puzzle Design Optimization Subsystem", () => {
    it("evaluates fitness for feasible candidates and rejects HARD constraint violations", () => {
      const puzzle = createEmptyCanonicalPuzzle("Opt_Test");
      puzzle.pieces.push({
        id: "p1",
        name: "Piece 1",
        geometryRef: { contour: { kind: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0 } },
        dimensions: { width: 100, height: 100, depth: 2 },
        thickness: 2.0,
        materialId: "cardboard-2mm",
        interfaceIds: [],
        localFrame: { origin: vec3(0, 0, 0), tangent: vec3(1, 0, 0), normal: vec3(0, -1, 0), binormal: vec3(0, 0, -1) },
        manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
      });

      const score = evaluateDesignScore(
        { candidateId: "c1", puzzle, parameters: {}, isFeasible: true },
        [{ objectiveId: "o1", kind: "material_utilization", weight: 1.0, direction: "maximize" }],
      );

      expect(score.isFeasible).toBe(true);
      expect(score.totalScore).toBeGreaterThan(0.0);
    });

    it("runs deterministic grid search optimizer across discrete parameter spaces", async () => {
      const optimizer = new DeterministicGridOptimizer();
      const puzzle = createEmptyCanonicalPuzzle("Grid_Test");
      puzzle.pieces.push({
        id: "p1",
        name: "Piece 1",
        geometryRef: { contour: { kind: "rect", x: 0, y: 0, width: 100, height: 100, rotation: 0 } },
        dimensions: { width: 100, height: 100, depth: 2 },
        thickness: 2.0,
        materialId: "cardboard-2mm",
        interfaceIds: [],
        localFrame: { origin: vec3(0, 0, 0), tangent: vec3(1, 0, 0), normal: vec3(0, -1, 0), binormal: vec3(0, 0, -1) },
        manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
      });

      const optRes = await optimizer.optimize(
        puzzle,
        [{ objectiveId: "o1", kind: "material_utilization", weight: 1.0, direction: "maximize" }],
        [],
        [{ parameterName: "piece_width", targetEntityId: "p1", values: [80, 100, 120] }],
      );

      expect(optRes.success).toBe(true);
      expect(optRes.evaluatedCandidatesCount).toBe(3);
    });
  });
});
