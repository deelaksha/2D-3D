/**
 * Exact 3D Piece Conversion Subsystem Smoke Tests (Phase 86).
 *
 * Validates:
 *  1. Complete conversion from GeneratedPuzzle2D (16 pieces) into exact 3D pieces.
 *  2. Verification that every piece retains:
 *     - piece ID
 *     - interface IDs
 *     - connector IDs
 *     - material
 *     - thickness
 *     - local coordinate frame
 *  3. Verification that pieces exist independently in local coordinates:
 *     - z in [-thickness/2, +thickness/2]
 *     - origin at (0, 0, 0)
 *     - no final assembly positions assigned
 *  4. Verification of 3D validation report:
 *     - closed profile
 *     - valid solid (watertight mesh buffers, positive volume, surface area)
 *     - correct thickness
 *     - valid connector geometry
 *  5. Multi-style testing: polygonal and organic 3D piece conversions.
 */

import { describe, expect, it } from "vitest";
import { Automatic2DGenerationEngine } from "../core/puzzle/automatic2d/automatic2DGenerationEngine";
import type { DesignSpecification2D } from "../core/puzzle/automatic2d/types";
import { Piece3DConversionEngine } from "../core/puzzle/piece3d/piece3DConversionEngine";
import { ProfileExtractor } from "../core/puzzle/piece3d/profileExtractor";
import type { ConvertedPuzzle3D } from "../core/puzzle/piece3d/types";

describe("Exact 3D Piece Conversion Subsystem (Phase 86)", () => {
  describe("16-Piece 2D Puzzle to Exact 3D Pieces Conversion", () => {
    it("converts a complete 16-piece 2D puzzle into exact 3D solid pieces", () => {
      // 1. Generate 16-piece 2D puzzle via Phase 85 engine
      const spec: DesignSpecification2D = {
        id: "spec_16_convert_3d",
        name: "16-Piece 3D Panel",
        overallSize: { widthMm: 400, heightMm: 400 },
        targetPieceCount: 16,
        partitionStyle: "rectangular",
        material: {
          id: "cardboard_3mm",
          name: "Standard Cardboard",
          stockThicknessMm: 3.0,
          kerfMm: 0.1,
        },
        preferredConnectorType: "tab_slot",
        seed: 42,
      };

      const puzzle2D = Automatic2DGenerationEngine.generatePuzzle(spec);
      expect(puzzle2D.pieces.length).toBe(16);

      // 2. Convert to exact 3D pieces via Phase 86 engine
      const puzzle3D: ConvertedPuzzle3D = Piece3DConversionEngine.convertPuzzle(puzzle2D);

      expect(puzzle3D).toBeDefined();
      expect(puzzle3D.puzzleId).toBe(puzzle2D.id);
      expect(puzzle3D.pieces.length).toBe(16);

      // 3. Verify EVERY PIECE retains all required properties:
      // piece ID, interface IDs, connector IDs, material, thickness, local coordinate frame
      for (const piece of puzzle3D.pieces) {
        // piece ID
        expect(piece.pieceId).toBeDefined();
        expect(typeof piece.pieceId).toBe("string");
        expect(piece.pieceId.length).toBeGreaterThan(0);

        // interface IDs
        expect(piece.interfaceIds).toBeDefined();
        expect(Array.isArray(piece.interfaceIds)).toBe(true);
        expect(piece.interfaceIds.length).toBeGreaterThan(0);
        for (const ifId of piece.interfaceIds) {
          expect(typeof ifId).toBe("string");
        }

        // connector IDs
        expect(piece.connectorIds).toBeDefined();
        expect(Array.isArray(piece.connectorIds)).toBe(true);
        expect(piece.connectorIds.length).toBeGreaterThan(0);
        for (const connId of piece.connectorIds) {
          expect(typeof connId).toBe("string");
        }

        // material
        expect(piece.material).toBeDefined();
        expect(piece.material.id).toBe("cardboard_3mm");
        expect(piece.material.stockThicknessMm).toBe(3.0);

        // thickness
        expect(piece.thickness).toBe(3.0);

        // local coordinate frame
        expect(piece.localCoordinateFrame).toBeDefined();
        expect(piece.localCoordinateFrame.origin).toEqual({ x: 0, y: 0, z: 0 });
        expect(piece.localCoordinateFrame.tangent).toEqual({ x: 1, y: 0, z: 0 });
        expect(piece.localCoordinateFrame.normal).toEqual({ x: 0, y: 1, z: 0 });
        expect(piece.localCoordinateFrame.binormal).toEqual({ x: 0, y: 0, z: 1 });

        // 4. Verify piece exists independently in local coordinates
        // z must span [-thickness/2, +thickness/2]
        const mesh = piece.solid.localMesh;
        expect(mesh.bounds.min.z).toBeCloseTo(-1.5, 3);
        expect(mesh.bounds.max.z).toBeCloseTo(1.5, 3);
        const zExtent = mesh.bounds.max.z - mesh.bounds.min.z;
        expect(zExtent).toBeCloseTo(3.0, 3);

        // 5. Verify watertight 3D solid properties
        expect(piece.solid.volumeMm3).toBeGreaterThan(0);
        expect(piece.solid.surfaceAreaMm2).toBeGreaterThan(0);
        expect(piece.solid.massGrams).toBeGreaterThan(0);
        expect(mesh.positions.length).toBeGreaterThan(0);
        expect(mesh.normals.length).toBe(mesh.positions.length);
        expect(mesh.indices.length).toBeGreaterThan(0);
        expect(mesh.indices.length % 3).toBe(0); // Valid triangle faces
      }

      // 6. Verify 3D validation report
      expect(puzzle3D.validation).toBeDefined();
      expect(puzzle3D.validation.isValid).toBe(true);
      expect(puzzle3D.validation.totalPieces).toBe(16);
      expect(puzzle3D.validation.validPieces).toBe(16);
      expect(puzzle3D.validation.closedProfilesCount).toBe(16);
      expect(puzzle3D.validation.validSolidsCount).toBe(16);
      expect(puzzle3D.validation.correctThicknessCount).toBe(16);
      expect(puzzle3D.validation.validConnectorGeometriesCount).toBe(16);
      expect(puzzle3D.validation.metrics.totalSolidVolumeMm3).toBeGreaterThan(0);
    });

    it("converts polygonal pieces with interlock dovetails into valid 3D solids", () => {
      const spec: DesignSpecification2D = {
        overallSize: { widthMm: 300, heightMm: 300 },
        targetPieceCount: 8,
        partitionStyle: "polygonal",
        preferredConnectorType: "interlock",
        material: {
          id: "mdf_4mm",
          name: "MDF Sheet",
          stockThicknessMm: 4.0,
          kerfMm: 0.12,
        },
        seed: 789,
      };

      const puzzle2D = Automatic2DGenerationEngine.generatePuzzle(spec);
      const puzzle3D = Piece3DConversionEngine.convertPuzzle(puzzle2D);

      expect(puzzle3D.pieces.length).toBe(8);
      expect(puzzle3D.validation.isValid).toBe(true);

      for (const piece of puzzle3D.pieces) {
        expect(piece.thickness).toBe(4.0);
        expect(piece.solid.localMesh.bounds.max.z - piece.solid.localMesh.bounds.min.z).toBeCloseTo(4.0, 3);
        expect(piece.connectorParameters.length).toBeGreaterThan(0);
      }
    });

    it("converts organic wave pieces with keyed connectors into valid 3D solids", () => {
      const spec: DesignSpecification2D = {
        overallSize: { widthMm: 240, heightMm: 240 },
        targetPieceCount: 6,
        partitionStyle: "organic",
        curvature: 3.5,
        preferredConnectorType: "keyed",
        material: {
          id: "plywood_5mm",
          name: "Plywood 5mm",
          stockThicknessMm: 5.0,
          kerfMm: 0.15,
        },
        seed: 101112,
      };

      const puzzle2D = Automatic2DGenerationEngine.generatePuzzle(spec);
      const puzzle3D = Piece3DConversionEngine.convertPuzzle(puzzle2D);

      expect(puzzle3D.pieces.length).toBe(6);
      expect(puzzle3D.validation.isValid).toBe(true);

      for (const piece of puzzle3D.pieces) {
        expect(piece.thickness).toBe(5.0);
        expect(piece.profile.isClosed).toBe(true);
        expect(piece.solid.volumeMm3).toBeGreaterThan(0);
      }
    });

    it("validates that pieces exist independently in local coordinates with no assembly positions", () => {
      const spec: DesignSpecification2D = {
        overallSize: { widthMm: 200, heightMm: 200 },
        targetPieceCount: 4,
        partitionStyle: "rectangular",
        seed: 123,
      };

      const puzzle2D = Automatic2DGenerationEngine.generatePuzzle(spec);
      const puzzle3D = Piece3DConversionEngine.convertPuzzle(puzzle2D);

      // Verify each piece's local frame is the identity origin (0, 0, 0), NOT placed in final 3D assembly
      for (const piece of puzzle3D.pieces) {
        expect(piece.localCoordinateFrame.origin).toEqual({ x: 0, y: 0, z: 0 });
        expect(piece.localCoordinateFrame.tangent).toEqual({ x: 1, y: 0, z: 0 });
        expect(piece.localCoordinateFrame.normal).toEqual({ x: 0, y: 1, z: 0 });
        expect(piece.localCoordinateFrame.binormal).toEqual({ x: 0, y: 0, z: 1 });

        // Local vertices true geometric centroid is centered at (0, 0)
        const localCentroid = ProfileExtractor.calculateCentroid(piece.profile.localVertices);
        expect(Math.abs(localCentroid.x)).toBeLessThan(0.01);
        expect(Math.abs(localCentroid.y)).toBeLessThan(0.01);
      }
    });
  });
});
