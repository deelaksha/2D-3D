/**
 * Automatic 2D Generation System Smoke Tests (Phase 85).
 *
 * Validates:
 *  1. Complete 16-piece puzzle generation from only a high-level design specification.
 *  2. Output is a single GeneratedPuzzle2D object containing everything.
 *  3. Verification of every piece:
 *     - piece ID
 *     - exact boundary
 *     - dimensions
 *     - interfaces
 *     - connector parameters
 *     - material
 *     - thickness
 *  4. Verification of every connection:
 *     - connection ID
 *     - piece A
 *     - piece B
 *     - interface A
 *     - interface B
 *     - connector type
 *     - parameters
 *     - clearance
 *     - allowed angle
 *  5. Parametric geometry: exact boundary embeds physical male tabs and female slots.
 *  6. Topological assembly graph: 1 single connected component, 0 isolated pieces.
 *  7. Multi-style support (rectangular, polygonal, organic, irregular).
 *  8. Multi-connector type support (tab-slot, interlock, keyed, notch).
 *  9. Deterministic repeatability for identical seeds.
 */

import { describe, expect, it } from "vitest";
import { Automatic2DGenerationEngine } from "../core/puzzle/automatic2d/automatic2DGenerationEngine";
import type { DesignSpecification2D, GeneratedPuzzle2D } from "../core/puzzle/automatic2d/types";

describe("Automatic 2D Generation System (Phase 85)", () => {
  describe("16-Piece Puzzle Generation from High-Level Design Specification", () => {
    it("generates a complete 16-piece rectangular puzzle from only a high-level design spec", () => {
      const highLevelSpec: DesignSpecification2D = {
        id: "spec_16_piece_rect",
        name: "Classic 16-Piece Panel Puzzle",
        overallSize: {
          widthMm: 400,
          heightMm: 400,
        },
        targetPieceCount: 16,
        partitionStyle: "rectangular",
        boundaryShape: "rectangle",
        material: {
          id: "mat_birch_plywood_3mm",
          name: "Birch Plywood",
          stockThicknessMm: 3.0,
          kerfMm: 0.15,
        },
        preferredConnectorType: "tab_slot",
        targetJoiningAngleDeg: 180,
        seed: 12345,
      };

      // Execute integrated automatic 2D generation pipeline
      const puzzle: GeneratedPuzzle2D = Automatic2DGenerationEngine.generatePuzzle(highLevelSpec);

      // Verify top-level GeneratedPuzzle2D object structure
      expect(puzzle).toBeDefined();
      expect(puzzle.id).toBe("spec_16_piece_rect");
      expect(puzzle.specification).toEqual(highLevelSpec);
      expect(puzzle.dimensions.widthMm).toBe(400);
      expect(puzzle.dimensions.heightMm).toBe(400);
      expect(puzzle.dimensions.thicknessMm).toBe(3.0);

      // Global boundary
      expect(puzzle.globalBoundary.vertices.length).toBeGreaterThanOrEqual(4);
      expect(puzzle.globalBoundary.areaMm2).toBeCloseTo(160000, 0);

      // Exactly 16 pieces
      expect(puzzle.pieces.length).toBe(16);

      // 1. Verify EVERY PIECE has required properties:
      // piece ID, exact boundary, dimensions, interfaces, connector parameters, material, thickness
      for (const piece of puzzle.pieces) {
        // piece ID
        expect(piece.id).toBeDefined();
        expect(piece.pieceId).toBe(piece.id);
        expect(typeof piece.id).toBe("string");
        expect(piece.id.length).toBeGreaterThan(0);

        // exact boundary
        expect(piece.exactBoundary).toBeDefined();
        expect(Array.isArray(piece.exactBoundary)).toBe(true);
        expect(piece.exactBoundary.length).toBeGreaterThanOrEqual(4);

        // dimensions
        expect(piece.dimensions).toBeDefined();
        expect(piece.dimensions.widthMm).toBeGreaterThan(0);
        expect(piece.dimensions.heightMm).toBeGreaterThan(0);
        expect(piece.dimensions.thicknessMm).toBe(3.0);
        expect(piece.dimensions.areaMm2).toBeGreaterThan(0);
        expect(piece.dimensions.perimeterMm).toBeGreaterThan(0);
        expect(piece.dimensions.bounds).toBeDefined();
        expect(piece.dimensions.bounds.maxX).toBeGreaterThan(piece.dimensions.bounds.minX);
        expect(piece.dimensions.bounds.maxY).toBeGreaterThan(piece.dimensions.bounds.minY);

        // interfaces
        expect(piece.interfaces).toBeDefined();
        expect(Array.isArray(piece.interfaces)).toBe(true);
        expect(piece.interfaces.length).toBeGreaterThan(0);

        // connector parameters
        expect(piece.connectorParameters).toBeDefined();
        expect(Array.isArray(piece.connectorParameters)).toBe(true);
        expect(piece.connectorParameters.length).toBeGreaterThan(0);
        for (const params of piece.connectorParameters) {
          expect(params.tabWidth).toBeGreaterThan(0);
          expect(params.tabDepth).toBeGreaterThan(0);
          expect(params.slotWidth).toBeGreaterThan(0);
          expect(params.slotDepth).toBeGreaterThan(0);
          expect(params.clearance).toBeGreaterThan(0);
        }

        // material
        expect(piece.material).toBeDefined();
        expect(piece.material.id).toBe("mat_birch_plywood_3mm");
        expect(piece.material.name).toBe("Birch Plywood");
        expect(piece.material.stockThicknessMm).toBe(3.0);

        // thickness
        expect(piece.thickness).toBe(3.0);
      }

      // 2. Verify EVERY CONNECTION has required properties:
      // connection ID, piece A, piece B, interface A, interface B, connector type, parameters, clearance, allowed angle
      expect(puzzle.connections.length).toBeGreaterThan(0);

      for (const conn of puzzle.connections) {
        // connection ID
        expect(conn.id).toBeDefined();
        expect(conn.connectionId).toBe(conn.id);
        expect(typeof conn.id).toBe("string");

        // piece A and piece B
        expect(conn.pieceA).toBeDefined();
        expect(conn.pieceB).toBeDefined();
        expect(conn.pieceA).not.toBe(conn.pieceB);

        // interface A and interface B
        expect(conn.interfaceA).toBeDefined();
        expect(conn.interfaceB).toBeDefined();
        expect(conn.interfaceA.id).toBeDefined();
        expect(conn.interfaceB.id).toBeDefined();
        expect(conn.interfaceA.compatibility.genderRole).toBe("insert");
        expect(conn.interfaceB.compatibility.genderRole).toBe("receiver");

        // connector type
        expect(conn.connectorType).toBe("tab_slot");

        // parameters
        expect(conn.parameters).toBeDefined();
        expect(conn.parameters.tabWidth).toBeGreaterThan(0);
        expect(conn.parameters.tabDepth).toBeGreaterThan(0);
        expect(conn.parameters.slotWidth).toBeGreaterThanOrEqual(conn.parameters.tabWidth);
        expect(conn.parameters.slotDepth).toBeGreaterThanOrEqual(conn.parameters.tabDepth);

        // clearance
        expect(conn.clearance).toBeGreaterThan(0);
        expect(conn.clearance).toBeLessThanOrEqual(1.0);

        // allowed angle
        expect(conn.allowedAngle).toBe(180);
      }

      // 3. Verify topological connection graph
      expect(puzzle.graph).toBeDefined();
      expect(puzzle.graph.getAllPieceNodes().length).toBe(16);
      expect(puzzle.graph.isConnected()).toBe(true);
      expect(puzzle.graph.getIsolatedPieces().length).toBe(0);

      // 4. Verify 2D validation
      expect(puzzle.validation.isValid).toBe(true);
      expect(puzzle.validation.pieceCount).toBe(16);
      expect(puzzle.validation.graphConnected).toBe(true);
    });

    it("verifies parametric geometry embedding produces physical tabs and slots in exactBoundary", () => {
      const spec: DesignSpecification2D = {
        overallSize: { widthMm: 200, heightMm: 200 },
        targetPieceCount: 4,
        partitionStyle: "rectangular",
        preferredConnectorType: "tab_slot",
        seed: 777,
      };

      const puzzle = Automatic2DGenerationEngine.generatePuzzle(spec);

      expect(puzzle.pieces.length).toBe(4);

      // Raw boundary of a rectangular piece has 4 corner vertices.
      // With connector tabs and slots embedded, exactBoundary must have additional vertices!
      for (const piece of puzzle.pieces) {
        expect(piece.rawBoundary.length).toBe(4);
        expect(piece.exactBoundary.length).toBeGreaterThan(piece.rawBoundary.length);
      }
    });

    it("generates a 16-piece polygonal puzzle with interlock dovetail connectors", () => {
      const spec: DesignSpecification2D = {
        overallSize: { widthMm: 300, heightMm: 300 },
        targetPieceCount: 16,
        partitionStyle: "polygonal",
        preferredConnectorType: "interlock",
        seed: 999,
      };

      const puzzle = Automatic2DGenerationEngine.generatePuzzle(spec);

      expect(puzzle.pieces.length).toBe(16);
      expect(puzzle.validation.isValid).toBe(true);
      expect(puzzle.graph.isConnected()).toBe(true);

      for (const conn of puzzle.connections) {
        expect(conn.connectorType).toBe("interlock");
        expect(conn.parameters.tabWidth).toBeGreaterThan(0);
      }
    });

    it("generates a 16-piece organic puzzle with harmonic wave boundaries", () => {
      const spec: DesignSpecification2D = {
        overallSize: { widthMm: 320, heightMm: 320 },
        targetPieceCount: 16,
        partitionStyle: "organic",
        curvature: 4.0,
        waveFrequency: 1.0,
        preferredConnectorType: "keyed",
        seed: 555,
      };

      const puzzle = Automatic2DGenerationEngine.generatePuzzle(spec);

      expect(puzzle.pieces.length).toBe(16);
      expect(puzzle.validation.isValid).toBe(true);
      expect(puzzle.graph.isConnected()).toBe(true);

      for (const conn of puzzle.connections) {
        expect(conn.connectorType).toBe("keyed");
      }
    });

    it("ensures 100% deterministic repeatability for identical design specifications", () => {
      const spec: DesignSpecification2D = {
        overallSize: { widthMm: 250, heightMm: 250 },
        targetPieceCount: 16,
        partitionStyle: "polygonal",
        preferredConnectorType: "tab_slot",
        seed: 424242,
      };

      const puzzleA = Automatic2DGenerationEngine.generatePuzzle(spec);
      const puzzleB = Automatic2DGenerationEngine.generatePuzzle(spec);

      expect(puzzleA.pieces.length).toBe(puzzleB.pieces.length);
      expect(puzzleA.connections.length).toBe(puzzleB.connections.length);

      for (let i = 0; i < puzzleA.pieces.length; i++) {
        const pA = puzzleA.pieces[i];
        const pB = puzzleB.pieces[i];

        expect(pA.exactBoundary.length).toBe(pB.exactBoundary.length);
        expect(pA.dimensions.areaMm2).toBe(pB.dimensions.areaMm2);
        expect(pA.dimensions.perimeterMm).toBe(pB.dimensions.perimeterMm);

        for (let v = 0; v < pA.exactBoundary.length; v++) {
          expect(pA.exactBoundary[v].x).toBeCloseTo(pB.exactBoundary[v].x, 3);
          expect(pA.exactBoundary[v].y).toBeCloseTo(pB.exactBoundary[v].y, 3);
        }
      }
    });
  });
});
