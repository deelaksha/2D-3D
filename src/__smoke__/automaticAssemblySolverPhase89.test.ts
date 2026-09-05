import { describe, expect, it } from "vitest";
import {
  BacktrackingAssemblySolver,
  solveAutomaticAssembly,
  AssemblyCollisionDetector,
  TransformEvaluator,
} from "../core/puzzle/assemblysolver";
import type {
  AssemblySolverInput,
  SuccessfulAssembly,
  AssemblyFailureReport,
} from "../core/puzzle/assemblysolver";
import { Automatic2DGenerationEngine } from "../core/puzzle/automatic2d";
import { Piece3DConversionEngine } from "../core/puzzle/piece3d";
import { evaluatePuzzleJoiningAngles } from "../core/puzzle/anglegeneration";
import type { ConvertedPuzzle3D, GeneratedPiece3D, RetainedConnection3D } from "../core/puzzle/piece3d/types";
import { quatIdentity, vec3 } from "../core/puzzle/geometry/math3d";
import type { CoordinateFrame3D, RigidTransform3D } from "../core/puzzle/framesystem/types";

describe("Phase 89: Complete Automatic Assembly Solver", () => {
  // Helper to generate a standardized 3D converted puzzle
  function createTestPuzzle3D(pieceCount = 4): ConvertedPuzzle3D {
    const puzzle2d = Automatic2DGenerationEngine.generatePuzzle({
      targetPieceCount: pieceCount,
      overallSize: { widthMm: 120, heightMm: 120 },
      boundaryShape: "rectangle",
      partitionStyle: "rectangular",
      material: {
        id: "plywood",
        name: "Birch Plywood",
        stockThicknessMm: 3.0,
      },
    });
    return Piece3DConversionEngine.convertPuzzle(puzzle2d);
  }

  describe("Simple Assemblies", () => {
    it("successfully finds a complete valid 3D configuration for a 4-piece puzzle", () => {
      const puzzle3d = createTestPuzzle3D(4);
      const angleResult = evaluatePuzzleJoiningAngles(puzzle3d, { angleStepDeg: 30 });

      const input: AssemblySolverInput = {
        puzzle: puzzle3d,
        validAngleCandidates: angleResult.connectionAngles,
        options: {
          maxBacktracks: 200,
          maxStatesExplored: 1000,
        },
      };

      const result = solveAutomaticAssembly(input);
      expect(result.success).toBe(true);
      if (!result.success) return;

      const success = result as SuccessfulAssembly;
      expect(success.puzzleId).toBe(puzzle3d.puzzleId);
      expect(success.rootPieceId).toBeDefined();
      expect(success.placementOrder).toHaveLength(4);
      expect(Object.keys(success.pieceTransforms)).toHaveLength(4);
      expect(Object.keys(success.connectionStates).length).toBeGreaterThan(0);
      expect(success.placements).toHaveLength(4);
      expect(success.metrics.placedCount).toBe(4);
      expect(success.metrics.solveDurationMs).toBeGreaterThanOrEqual(0);

      // Verify root is placed at world origin
      const rootTransform = success.pieceTransforms[success.rootPieceId];
      expect(rootTransform.position.x).toBe(0);
      expect(rootTransform.position.y).toBe(0);
      expect(rootTransform.position.z).toBe(0);
    });
  });

  describe("Non-Planar Assemblies (90° Box / Orthogonal)", () => {
    it("assembles pieces with 90° non-planar folding angles", () => {
      const puzzle3d = createTestPuzzle3D(4);

      // Construct angle candidates that include 90° orthogonal angles
      const validAnglesMap: Record<string, any> = {};
      for (const conn of puzzle3d.connections) {
        validAnglesMap[conn.connectionId] = {
          connectionId: conn.connectionId,
          connectorType: conn.connectorType,
          validAngles: [90.0, 180.0],
          recommendedAngle: 90.0,
        };
      }

      const result = solveAutomaticAssembly({
        puzzle: puzzle3d,
        validAngleCandidates: validAnglesMap,
        options: {
          searchStrategy: "most_connected",
        },
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const success = result as SuccessfulAssembly;
      expect(success.placementOrder).toHaveLength(puzzle3d.pieces.length);

      // Check that at least one placed piece has non-planar rotation
      const nonPlanar = Object.values(success.pieceTransforms).some(
        (t) => Math.abs(t.rotation.x) > 0.1 || Math.abs(t.rotation.y) > 0.1 || Math.abs(t.position.z) > 0.1
      );
      expect(nonPlanar).toBe(true);
    });
  });

  describe("Multi-Angle Assemblies (30°, 45°, 60°, 90°)", () => {
    it("solves assemblies with mixed candidate angles", () => {
      const puzzle3d = createTestPuzzle3D(4);

      // Provide multi-angle candidates [30°, 45°, 60°, 90°, 180°]
      const validAnglesMap: Record<string, any> = {};
      let angleIdx = 0;
      const testAngles = [30, 45, 60, 90, 180];

      for (const conn of puzzle3d.connections) {
        validAnglesMap[conn.connectionId] = {
          connectionId: conn.connectionId,
          connectorType: conn.connectorType,
          validAngles: testAngles,
          recommendedAngle: testAngles[angleIdx % testAngles.length],
        };
        angleIdx++;
      }

      const result = solveAutomaticAssembly({
        puzzle: puzzle3d,
        validAngleCandidates: validAnglesMap,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const success = result as SuccessfulAssembly;
      expect(success.placementOrder).toHaveLength(4);
      expect(Object.keys(success.appliedAngles).length).toBeGreaterThan(0);
    });
  });

  describe("Multi-Layer Assemblies (Vertical Stacking)", () => {
    it("solves multi-layer piece structures with vertical offsets", () => {
      // Multi-layer puzzle: Piece 1 (layer 1), Piece 2 (layer 2), Piece 3 (layer 3)
      const frameEdge1: CoordinateFrame3D = {
        origin: vec3(25, 0, 0),
        xAxis: vec3(1, 0, 0),
        yAxis: vec3(0, 1, 0),
        zAxis: vec3(0, 0, 1),
      };

      const frameEdge2A: CoordinateFrame3D = {
        origin: vec3(-25, 0, 0),
        xAxis: vec3(-1, 0, 0),
        yAxis: vec3(0, 1, 0),
        zAxis: vec3(0, 0, 1),
      };

      const frameEdge2B: CoordinateFrame3D = {
        origin: vec3(25, 0, 3),
        xAxis: vec3(1, 0, 0),
        yAxis: vec3(0, 1, 0),
        zAxis: vec3(0, 0, 1),
      };

      const frameEdge3: CoordinateFrame3D = {
        origin: vec3(-25, 0, 0),
        xAxis: vec3(-1, 0, 0),
        yAxis: vec3(0, 1, 0),
        zAxis: vec3(0, 0, 1),
      };

      const piece1: GeneratedPiece3D = {
        pieceId: "P_LAYER_1",
        name: "Layer 1 Base",
        interfaceIds: ["I1"],
        connectorIds: ["C1"],
        material: { id: "plywood", name: "Plywood", stockThicknessMm: 3, kerfMm: 0.1 },
        thickness: 3,
        localCoordinateFrame: frameEdge1,
        profile: {
          globalVertices: [],
          localVertices: [],
          centroid: { x: 0, y: 0 },
          isClosed: true,
          areaMm2: 2000,
          perimeterMm: 180,
          localBounds: { minX: -25, minY: -20, maxX: 25, maxY: 20 },
        },
        solid: {} as any,
        interfaces: [{ id: "I1", localFrame: frameEdge1 } as any],
        connectorParameters: [],
        sheetCentroid: { x: 0, y: 0 },
        neighborPieceIds: ["P_LAYER_2"],
        isBorderPiece: true,
      };

      const piece2: GeneratedPiece3D = {
        pieceId: "P_LAYER_2",
        name: "Layer 2 Stack",
        interfaceIds: ["I2", "I3"],
        connectorIds: ["C1", "C2"],
        material: { id: "plywood", name: "Plywood", stockThicknessMm: 3, kerfMm: 0.1 },
        thickness: 3,
        localCoordinateFrame: frameEdge2A,
        profile: {
          globalVertices: [],
          localVertices: [],
          centroid: { x: 0, y: 0 },
          isClosed: true,
          areaMm2: 2000,
          perimeterMm: 180,
          localBounds: { minX: -25, minY: -20, maxX: 25, maxY: 20 },
        },
        solid: {} as any,
        interfaces: [
          { id: "I2", localFrame: frameEdge2A } as any,
          { id: "I3", localFrame: frameEdge2B } as any,
        ],
        connectorParameters: [],
        sheetCentroid: { x: 0, y: 0 },
        neighborPieceIds: ["P_LAYER_1", "P_LAYER_3"],
        isBorderPiece: false,
      };

      const piece3: GeneratedPiece3D = {
        pieceId: "P_LAYER_3",
        name: "Layer 3 Top",
        interfaceIds: ["I4"],
        connectorIds: ["C2"],
        material: { id: "plywood", name: "Plywood", stockThicknessMm: 3, kerfMm: 0.1 },
        thickness: 3,
        localCoordinateFrame: frameEdge3,
        profile: {
          globalVertices: [],
          localVertices: [],
          centroid: { x: 0, y: 0 },
          isClosed: true,
          areaMm2: 2000,
          perimeterMm: 180,
          localBounds: { minX: -25, minY: -20, maxX: 25, maxY: 20 },
        },
        solid: {} as any,
        interfaces: [{ id: "I4", localFrame: frameEdge3 } as any],
        connectorParameters: [],
        sheetCentroid: { x: 0, y: 0 },
        neighborPieceIds: ["P_LAYER_2"],
        isBorderPiece: true,
      };

      const layeredPuzzle: ConvertedPuzzle3D = {
        puzzleId: "puzzle_multi_layer",
        name: "Multi-Layer Stack",
        pieces: [piece1, piece2, piece3],
        connections: [
          {
            connectionId: "C1",
            pieceAId: "P_LAYER_1",
            pieceBId: "P_LAYER_2",
            interfaceAId: "I1",
            interfaceBId: "I2",
            connectorType: "tab_slot",
            clearanceMm: 0.15,
            allowedAngleDeg: 180,
          },
          {
            connectionId: "C2",
            pieceAId: "P_LAYER_2",
            pieceBId: "P_LAYER_3",
            interfaceAId: "I3",
            interfaceBId: "I4",
            connectorType: "tab_slot",
            clearanceMm: 0.15,
            allowedAngleDeg: 180,
          },
        ],
        thickness: 3,
        material: piece1.material,
        bounds: { minX: 0, minY: 0, maxX: 150, maxY: 40 },
        metadata: {
          convertedAt: Date.now(),
          pieceCount: 3,
          connectionCount: 2,
          conversionDurationMs: 1.0,
          isWatertightSolid: true,
        },
      };

      const validAnglesMap = {
        C1: { connectionId: "C1", connectorType: "tab_slot", validAngles: [180], recommendedAngle: 180 },
        C2: { connectionId: "C2", connectorType: "tab_slot", validAngles: [180], recommendedAngle: 180 },
      };

      const result = solveAutomaticAssembly({
        puzzle: layeredPuzzle,
        validAngleCandidates: validAnglesMap as any,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const success = result as SuccessfulAssembly;
      expect(success.placementOrder).toEqual(["P_LAYER_2", "P_LAYER_1", "P_LAYER_3"]);
      expect(success.metrics.placedCount).toBe(3);
    });
  });

  describe("Backtracking & Alternative Branch Selection", () => {
    it("backtracks when an initial candidate angle causes collision downstream and finds the valid branch", () => {
      const puzzle3d = createTestPuzzle3D(4);
      const angleResult = evaluatePuzzleJoiningAngles(puzzle3d, { angleStepDeg: 30 });

      // Clone candidate angles
      const validAnglesMap: Record<string, any> = {};
      for (const [k, v] of Object.entries(angleResult.connectionAngles)) {
        validAnglesMap[k] = { ...v };
      }

      // Prepend an invalid 0° candidate (direct fold-back collision) to the first connection
      // and set it as the recommended angle to force the solver to evaluate it first
      const firstConn = puzzle3d.connections[0];
      const origValid = validAnglesMap[firstConn.connectionId].validAngles;

      validAnglesMap[firstConn.connectionId] = {
        ...validAnglesMap[firstConn.connectionId],
        validAngles: [0.0, ...origValid], // 0° collides, remaining angles pass
        recommendedAngle: 0.0, // Force solver to try 0° first
      };

      const result = solveAutomaticAssembly({
        puzzle: puzzle3d,
        validAngleCandidates: validAnglesMap,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const success = result as SuccessfulAssembly;
      expect(success.metrics.placedCount).toBe(4);
      // Confirmed that the solver did NOT end up with 0° on the first connection
      expect(success.appliedAngles[firstConn.connectionId]).not.toBe(0.0);
      // Confirmed that backtrack count is positive (proves backtracking occurred)
      expect(success.metrics.backtrackCount).toBeGreaterThan(0);
    });
  });

  describe("Failure Handling & Partial Assembly Rejection", () => {
    it("never accepts a partial assembly as success and returns AssemblyFailureReport", () => {
      const puzzle3d = createTestPuzzle3D(4);

      // Artificially restrict all angles to only 0° (which causes collision on every connection)
      const impossibleAnglesMap: Record<string, any> = {};
      for (const conn of puzzle3d.connections) {
        impossibleAnglesMap[conn.connectionId] = {
          connectionId: conn.connectionId,
          connectorType: conn.connectorType,
          validAngles: [0.0], // 0° causes collision
          recommendedAngle: 0.0,
        };
      }

      const result = solveAutomaticAssembly({
        puzzle: puzzle3d,
        validAngleCandidates: impossibleAnglesMap,
      });

      // MUST NOT return success
      expect(result.success).toBe(false);

      const failure = result as AssemblyFailureReport;
      expect(failure.failureReason).toBeDefined();
      expect(failure.unplacedPieceIds.length).toBeGreaterThan(0);
      expect(failure.diagnostics.length).toBeGreaterThan(0);
      expect(failure.diagnostics.some((d) => d.rejectionCode === "collision")).toBe(true);
    });

    it("respects search limits and aborts with failure report when maxStatesExplored is exceeded", () => {
      const puzzle3d = createTestPuzzle3D(4);
      const angleResult = evaluatePuzzleJoiningAngles(puzzle3d, { angleStepDeg: 30 });

      const result = solveAutomaticAssembly({
        puzzle: puzzle3d,
        validAngleCandidates: angleResult.connectionAngles,
        options: {
          maxStatesExplored: 2, // Far too small for 4 pieces
        },
      });

      expect(result.success).toBe(false);
      const failure = result as AssemblyFailureReport;
      expect(failure.failureReason).toContain("Exceeded maximum search states");
      expect(failure.metrics.statesExplored).toBeGreaterThanOrEqual(2);
    });
  });
});
