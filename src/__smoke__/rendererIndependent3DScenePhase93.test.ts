/**
 * Renderer-Independent 3D Scene Representation Smoke Tests (Phase 93).
 *
 * Validates:
 *  1. Scene root hierarchy:
 *     Scene
 *      ├── Pieces
 *      ├── Connectors
 *      ├── Assembly transforms
 *      ├── Materials
 *      ├── Connection visualization
 *      ├── Coordinate axes
 *      └── Metadata
 *  2. Renderable object contract:
 *     - unique ID
 *     - geometry reference (positions, normals, indices, bounds)
 *     - transform & worldTransform
 *     - material/display properties
 *     - piece ID
 *     - connection IDs
 *  3. Strict CAD separation & immutability guarantee:
 *     - Mutating scene rendering geometry does NOT mutate authoritative CAD solids.
 *  4. Connection visualizations (pairing lines, midpoints, status markers).
 *  5. Coordinate axes (world RGB axes, optional piece-local axes).
 *  6. Scene builder options & color scheme variations.
 */

import { describe, expect, it } from "vitest";
import { generatePuzzle } from "../core/puzzle/highlevelapi";
import {
  SceneBuilder,
  RenderGeometryFactory,
  type Scene,
  type SceneObject,
} from "../core/puzzle/scene";

describe("Phase 93: Renderer-Independent 3D Scene Representation", () => {
  describe("Scene Hierarchy & Structure", () => {
    it("builds a complete 3D scene from high-level puzzle generation result", async () => {
      // 1. Generate 16-piece puzzle
      const puzzleResult = await generatePuzzle(
        "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections."
      );

      // 2. Build 3D Scene
      const scene: Scene = SceneBuilder.buildFromPuzzle(puzzleResult, {
        sceneName: "16-Piece Cardboard 3D Scene",
        includeCoordinateAxes: true,
        includeConnectionVisualizations: true,
        colorScheme: "distinct_pieces",
      });

      // 3. Scene root container assertions
      expect(scene).toBeDefined();
      expect(scene.id).toBeDefined();
      expect(scene.name).toBe("16-Piece Cardboard 3D Scene");
      expect(scene.pieces).toBeDefined();
      expect(scene.connectors).toBeDefined();
      expect(scene.assemblyTransforms).toBeDefined();
      expect(scene.materials).toBeDefined();
      expect(scene.connections).toBeDefined();
      expect(scene.coordinateAxes).toBeDefined();
      expect(scene.metadata).toBeDefined();

      // 4. Pieces verification
      expect(scene.pieces.length).toBe(16);
      for (const pieceObj of scene.pieces) {
        // Unique ID
        expect(pieceObj.id).toBeDefined();
        expect(typeof pieceObj.id).toBe("string");
        expect(pieceObj.kind).toBe("piece");

        // Geometry Reference
        expect(pieceObj.geometry).toBeDefined();
        expect(pieceObj.geometry.positions.length).toBeGreaterThan(0);
        expect(pieceObj.geometry.normals.length).toBe(pieceObj.geometry.positions.length);
        expect(pieceObj.geometry.indices.length).toBeGreaterThan(0);
        expect(pieceObj.geometry.bounds).toBeDefined();

        // Transform
        expect(pieceObj.transform).toBeDefined();
        expect(pieceObj.worldTransform).toBeDefined();

        // Material / Display Properties
        expect(pieceObj.materialId).toBeDefined();
        expect(pieceObj.displayProperties).toBeDefined();
        expect(pieceObj.displayProperties.color).toBeDefined();
        expect(pieceObj.displayProperties.opacity).toBeGreaterThanOrEqual(0);
        expect(pieceObj.displayProperties.visible).toBe(true);

        // Piece ID & Connection IDs
        expect(pieceObj.pieceId).toBeDefined();
        expect(pieceObj.connectionIds).toBeDefined();
        expect(Array.isArray(pieceObj.connectionIds)).toBe(true);

        // CAD immutability flag
        expect(pieceObj.isImmutableCadCopy).toBe(true);
      }

      // 5. Connectors verification
      expect(scene.connectors.length).toBeGreaterThan(0);
      for (const connObj of scene.connectors) {
        expect(connObj.id).toBeDefined();
        expect(connObj.geometry).toBeDefined();
        expect(connObj.pieceId).toBeDefined();
        expect(connObj.connectionIds).toBeDefined();
        expect(connObj.connectionIds!.length).toBeGreaterThan(0);
      }

      // 6. Assembly Transforms verification
      expect(Object.keys(scene.assemblyTransforms).length).toBe(16);

      // 7. Materials Library verification
      expect(Object.keys(scene.materials).length).toBeGreaterThan(0);
      expect(scene.materials["default_material"]).toBeDefined();

      // 8. Connection Visualizations verification
      expect(scene.connections.length).toBeGreaterThan(0);
      for (const sceneConn of scene.connections) {
        expect(sceneConn.connectionId).toBeDefined();
        expect(sceneConn.pieceAId).toBeDefined();
        expect(sceneConn.pieceBId).toBeDefined();
        expect(sceneConn.state).toMatch(/^(MATED|ENGAGED|DISENGAGED|FAILED)$/);

        // Visualizations
        const viz = sceneConn.visualization;
        expect(viz).toBeDefined();
        expect(viz.startPoint).toBeDefined();
        expect(viz.endPoint).toBeDefined();
        expect(viz.midPoint).toBeDefined();
        expect(viz.normal).toBeDefined();
        expect(viz.color).toBeDefined();
        expect(viz.pairingLine).toBeDefined();
        expect(viz.pairingLine.kind).toBe("connection_marker");
        expect(viz.statusMarker).toBeDefined();
        expect(viz.statusMarker.kind).toBe("connector");
      }

      // 9. Coordinate Axes verification
      expect(scene.coordinateAxes.worldAxes.length).toBe(3); // X, Y, Z
      const [xAxis, yAxis, zAxis] = scene.coordinateAxes.worldAxes;
      expect(xAxis.displayProperties.color).toBe("#E74C3C"); // Red
      expect(yAxis.displayProperties.color).toBe("#2ECC71"); // Green
      expect(zAxis.displayProperties.color).toBe("#3498DB"); // Blue

      // 10. Metadata verification
      expect(scene.metadata.puzzleId).toBeDefined();
      expect(scene.metadata.pieceCount).toBe(16);
      expect(scene.metadata.connectionCount).toBe(scene.connections.length);
      expect(scene.metadata.boundingBox).toBeDefined();
      expect(scene.metadata.boundingBox.min.x).toBeLessThan(scene.metadata.boundingBox.max.x);
      expect(scene.metadata.cadSourceFingerprint).toContain("cad_");
    });
  });

  describe("CAD Geometry Separation & Immutability Guarantee", () => {
    it("guarantees that mutating scene render geometry does not modify the authoritative CAD model", async () => {
      const puzzleResult = await generatePuzzle("4-piece 3mm plywood planar puzzle");

      const scene = SceneBuilder.buildFromPuzzle(puzzleResult);

      const firstCadPiece = puzzleResult.pieces3D[0];
      const firstScenePiece = scene.pieces.find((p) => p.pieceId === firstCadPiece.pieceId)!;

      expect(firstScenePiece).toBeDefined();

      // Record original CAD vertex coordinates
      const originalCadX0 = firstCadPiece.solid.localMesh.positions[0];
      const originalCadY0 = firstCadPiece.solid.localMesh.positions[1];
      const originalCadZ0 = firstCadPiece.solid.localMesh.positions[2];

      // Mutate the scene rendering geometry directly (simulating a viewer/shader edit)
      firstScenePiece.geometry.positions[0] = 9999.99;
      firstScenePiece.geometry.positions[1] = -8888.88;
      firstScenePiece.geometry.positions[2] = 7777.77;

      // Verify that the authoritative CAD solid mesh positions were NOT mutated
      expect(firstCadPiece.solid.localMesh.positions[0]).toBe(originalCadX0);
      expect(firstCadPiece.solid.localMesh.positions[1]).toBe(originalCadY0);
      expect(firstCadPiece.solid.localMesh.positions[2]).toBe(originalCadZ0);
    });
  });

  describe("Scene Options & Variants", () => {
    it("supports piece-local coordinate axes and custom color schemes", async () => {
      const puzzleResult = await generatePuzzle("4-piece 3mm plywood planar puzzle");

      const scene = SceneBuilder.buildFromPuzzle(puzzleResult, {
        colorScheme: "material",
        includePieceLocalAxes: true,
        axisSizeMm: 15.0,
      });

      // Piece local axes should exist for all 4 pieces
      expect(scene.coordinateAxes.pieceLocalAxes).toBeDefined();
      expect(Object.keys(scene.coordinateAxes.pieceLocalAxes!).length).toBe(4);

      for (const pieceAxes of Object.values(scene.coordinateAxes.pieceLocalAxes!)) {
        expect(pieceAxes.length).toBe(3); // X, Y, Z
      }

      // Material color scheme check
      for (const piece of scene.pieces) {
        expect(piece.materialId).toBe("default_material");
      }
    });
  });

  describe("RenderGeometryFactory Primitives", () => {
    it("procedurally creates lines, markers, and axis segments", () => {
      const p0 = { x: 0, y: 0, z: 0 };
      const p1 = { x: 10, y: 20, z: 30 };
      const line = RenderGeometryFactory.createLineSegment(p0, p1);

      expect(line.primitiveType).toBe("lines");
      expect(line.positions.length).toBe(6);
      expect(line.indices.length).toBe(2);
      expect(line.bounds.max.x).toBe(10);
      expect(line.bounds.max.y).toBe(20);
      expect(line.bounds.max.z).toBe(30);

      const marker = RenderGeometryFactory.createMarker({ x: 5, y: 5, z: 5 }, 2.0);
      expect(marker.primitiveType).toBe("triangles");
      expect(marker.positions.length).toBe(18); // 6 vertices * 3
      expect(marker.indices.length).toBe(24);   // 8 faces * 3
      expect(marker.bounds.min.x).toBe(4);
      expect(marker.bounds.max.x).toBe(6);
    });
  });
});
