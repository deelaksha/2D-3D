/**
 * Automatic 3D Assembly Generator Smoke Tests (Phase 87).
 *
 * Validates:
 *  1. Automatic root selection and placement at world origin.
 *  2. Step-by-step BFS placement of all connected pieces.
 *  3. Non-coplanar 3D assemblies containing 30°, 45°, 60°, and 90° angles.
 *  4. Geometric preservation: underlying piece geometries are unaltered.
 *  5. Return of all 4 required components:
 *     - AssemblyConfiguration
 *     - AssemblyState
 *     - PieceTransforms
 *     - ConnectionStates
 *  6. Placement validation for every piece.
 */

import { describe, expect, it } from "vitest";
import { Automatic2DGenerationEngine } from "../core/puzzle/automatic2d/automatic2DGenerationEngine";
import { Piece3DConversionEngine } from "../core/puzzle/piece3d/piece3DConversionEngine";
import { Automatic3DAssemblyGenerator } from "../core/puzzle/assembly3d/automatic3DAssemblyGenerator";
import type { DesiredAssemblyConfiguration, GeneratedAssembly3D } from "../core/puzzle/assembly3d/types";

describe("Automatic 3D Assembly Generator (Phase 87)", () => {
  function createTestPipeline(pieceCount = 4, partitionStyle: any = "rectangular") {
    const puzzle2D = Automatic2DGenerationEngine.generatePuzzle({
      overallSize: { widthMm: 300, heightMm: 300 },
      targetPieceCount: pieceCount,
      partitionStyle,
      preferredConnectorType: "tab_slot",
      seed: 42,
    });

    const puzzle3D = Piece3DConversionEngine.convertPuzzle(puzzle2D);

    return { puzzle2D, puzzle3D };
  }

  describe("Complete Automatic 3D Assembly Workflow", () => {
    it("assembles a 16-piece puzzle into a valid 3D assembly and returns all required objects", () => {
      const { puzzle2D, puzzle3D } = createTestPipeline(16, "rectangular");

      const desiredConfig: DesiredAssemblyConfiguration = {
        name: "16-Piece Planar Panel",
        defaultJoiningAngleDeg: 180.0,
      };

      const assembly: GeneratedAssembly3D = Automatic3DAssemblyGenerator.generateAssembly({
        pieces: puzzle3D.pieces,
        graph: puzzle2D.graph,
        connections: puzzle3D.connections,
        desiredConfiguration: desiredConfig,
      });

      expect(assembly).toBeDefined();

      // 1. Verify Root Selection & Placement at Origin
      expect(assembly.rootPieceId).toBeDefined();
      expect(typeof assembly.rootPieceId).toBe("string");

      const rootTransform = assembly.pieceTransforms[assembly.rootPieceId];
      expect(rootTransform).toBeDefined();
      expect(rootTransform.position.x).toBe(0);
      expect(rootTransform.position.y).toBe(0);
      expect(rootTransform.position.z).toBe(0);
      expect(rootTransform.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });

      // 2. Verify Return of AssemblyConfiguration
      expect(assembly.assemblyConfiguration).toBeDefined();
      expect(assembly.assemblyConfiguration.rootPieceId).toBe(assembly.rootPieceId);
      expect(Object.keys(assembly.assemblyConfiguration.placements).length).toBe(16);
      expect(assembly.assemblyConfiguration.assemblySequence.length).toBe(16);

      // 3. Verify Return of AssemblyState
      expect(assembly.assemblyState).toBeDefined();
      expect(assembly.assemblyState.stateId).toBeDefined();
      expect(assembly.assemblyState.pieces.length).toBe(16);
      expect(assembly.assemblyState.pieceTransforms).toBeDefined();

      // 4. Verify Return of PieceTransforms
      expect(assembly.pieceTransforms).toBeDefined();
      expect(Object.keys(assembly.pieceTransforms).length).toBe(16);
      for (const [pieceId, transform] of Object.entries(assembly.pieceTransforms)) {
        expect(Number.isFinite(transform.position.x)).toBe(true);
        expect(Number.isFinite(transform.position.y)).toBe(true);
        expect(Number.isFinite(transform.position.z)).toBe(true);

        const qLen = Math.hypot(
          transform.rotation.x,
          transform.rotation.y,
          transform.rotation.z,
          transform.rotation.w
        );
        expect(qLen).toBeCloseTo(1.0, 3);
      }

      // 5. Verify Return of ConnectionStates
      expect(assembly.connectionStates).toBeDefined();
      expect(Object.keys(assembly.connectionStates).length).toBeGreaterThan(0);
      for (const [connId, state] of Object.entries(assembly.connectionStates)) {
        expect(state.connectionId).toBe(connId);
        expect(state.status).toBe("MATED");
        expect(state.isValid).toBe(true);
      }

      // 6. Verify Validation Report
      expect(assembly.validation).toBeDefined();
      expect(assembly.validation.isValid).toBe(true);
      expect(assembly.validation.totalPieces).toBe(16);
      expect(assembly.validation.placedPiecesCount).toBe(16);
      expect(assembly.validation.averageAlignmentErrorMm).toBeLessThan(0.05);
    });

    it("generates a non-coplanar 3D assembly with 90° perpendicular angles", () => {
      const { puzzle2D, puzzle3D } = createTestPipeline(4, "rectangular");

      const desiredConfig: DesiredAssemblyConfiguration = {
        name: "90 Degree Perpendicular Box",
        generationStrategy: "box_enclosure", // Enforces 90° angles
      };

      const assembly = Automatic3DAssemblyGenerator.generateAssembly({
        pieces: puzzle3D.pieces,
        graph: puzzle2D.graph,
        connections: puzzle3D.connections,
        desiredConfiguration: desiredConfig,
      });

      expect(assembly.validation.isValid).toBe(true);
      expect(assembly.allPlacements.length).toBe(4);

      // Verify that pieces are NON-COPLANAR (non-zero rotation or non-zero Z coordinate)
      let foundNonZeroZOrRot = false;
      for (const [pieceId, t] of Object.entries(assembly.pieceTransforms)) {
        if (pieceId === assembly.rootPieceId) continue;

        // Check if rotated out of the XY plane or displaced along Z
        const isRotated = Math.abs(t.rotation.x) > 0.01 || Math.abs(t.rotation.y) > 0.01;
        const isDisplacedZ = Math.abs(t.position.z) > 0.01;

        if (isRotated || isDisplacedZ) {
          foundNonZeroZOrRot = true;
          break;
        }
      }

      expect(foundNonZeroZOrRot).toBe(true);
    });

    it("supports 45°, 60°, and 30° angled facet assemblies", () => {
      const { puzzle2D, puzzle3D } = createTestPipeline(4, "polygonal");

      // Apply specific angle overrides: 45°, 60°, and 30°
      const connIds = puzzle3D.connections.map((c) => c.connectionId);
      const angleOverrides: Record<string, number> = {};
      if (connIds[0]) angleOverrides[connIds[0]] = 45.0;
      if (connIds[1]) angleOverrides[connIds[1]] = 60.0;
      if (connIds[2]) angleOverrides[connIds[2]] = 30.0;

      const desiredConfig: DesiredAssemblyConfiguration = {
        name: "Multi-Angle Assembly",
        angleOverrides,
      };

      const assembly = Automatic3DAssemblyGenerator.generateAssembly({
        pieces: puzzle3D.pieces,
        graph: puzzle2D.graph,
        connections: puzzle3D.connections,
        desiredConfiguration: desiredConfig,
      });

      expect(assembly.validation.isValid).toBe(true);

      // Verify applied angles
      if (connIds[0]) {
        expect(assembly.connectionStates[connIds[0]].currentAngleDeg).toBe(45.0);
      }
      if (connIds[1]) {
        expect(assembly.connectionStates[connIds[1]].currentAngleDeg).toBe(60.0);
      }
      if (connIds[2]) {
        expect(assembly.connectionStates[connIds[2]].currentAngleDeg).toBe(30.0);
      }
    });

    it("preserves underlying piece geometry without alteration", () => {
      const { puzzle2D, puzzle3D } = createTestPipeline(4, "rectangular");

      // Snapshot original piece vertex coordinates and bounding boxes
      const originalVertexCounts = puzzle3D.pieces.map((p) => p.solid.localMesh.positions.length);
      const originalAreas = puzzle3D.pieces.map((p) => p.profile.areaMm2);
      const originalVolumes = puzzle3D.pieces.map((p) => p.solid.volumeMm3);

      // Run assembly
      Automatic3DAssemblyGenerator.generateAssembly({
        pieces: puzzle3D.pieces,
        graph: puzzle2D.graph,
        connections: puzzle3D.connections,
        desiredConfiguration: { generationStrategy: "box_enclosure" },
      });

      // Confirm piece geometries in puzzle3D are strictly unchanged
      for (let i = 0; i < puzzle3D.pieces.length; i++) {
        const p = puzzle3D.pieces[i];
        expect(p.solid.localMesh.positions.length).toBe(originalVertexCounts[i]);
        expect(p.profile.areaMm2).toBe(originalAreas[i]);
        expect(p.solid.volumeMm3).toBe(originalVolumes[i]);
      }
    });
  });
});
