/**
 * Exact 3D Piece Conversion Engine (Phase 86).
 *
 * Converts every generated 2D piece from GeneratedPuzzle2D into an exact 3D piece.
 *
 * Pipeline:
 *   GeneratedPuzzle2D
 *         ↓
 *   Piece Profiles (ProfileExtractor)
 *         ↓
 *   Extrusion (SolidExtruder)
 *         ↓
 *   3D Solids (SolidMeshBuffer3D)
 *         ↓
 *   Local Coordinate Frames (CoordinateFrameAssigner)
 *         ↓
 *   3D Validation (Validator3D)
 *
 * Guarantees that every piece retains:
 *   - piece ID
 *   - interface IDs
 *   - connector IDs
 *   - material
 *   - thickness
 *   - local coordinate frame
 *
 * Does NOT assign final assembly positions yet; each piece exists
 * independently in its local coordinate system.
 */

import type { GeneratedPuzzle2D } from "../automatic2d/types";
import { ProfileExtractor } from "./profileExtractor";
import { SolidExtruder } from "./solidExtruder";
import { CoordinateFrameAssigner } from "./coordinateFrameAssigner";
import { Validator3D } from "./validator3D";
import type { ConvertedPuzzle3D, GeneratedPiece3D, RetainedConnection3D } from "./types";

export class Piece3DConversionEngine {
  /**
   * Converts a GeneratedPuzzle2D into an exact 3D puzzle with independent pieces in local coordinates.
   */
  public static convertPuzzle(puzzle2D: GeneratedPuzzle2D): ConvertedPuzzle3D {
    const startTime = performance.now();

    if (!puzzle2D || !puzzle2D.pieces || puzzle2D.pieces.length === 0) {
      throw new Error("Cannot convert empty or null GeneratedPuzzle2D to 3D pieces.");
    }

    const pieces3D: GeneratedPiece3D[] = [];

    // Process every 2D piece through the 3D conversion pipeline
    for (const piece2D of puzzle2D.pieces) {
      // Stage 1: Piece Profiles
      const profile = ProfileExtractor.extractProfile(piece2D);

      // Stage 2 & 3: Extrusion into 3D Solid
      const solid = SolidExtruder.extrudeToSolid(
        piece2D.id,
        profile,
        piece2D.thickness,
        piece2D.material?.id ?? "cardboard_stock",
        0.68 // Standard density g/cm^3
      );

      // Stage 4: Local Coordinate Frames & Retained Properties
      const piece3D = CoordinateFrameAssigner.assignPiece3D(
        piece2D,
        profile,
        solid,
        puzzle2D.connections
      );

      pieces3D.push(piece3D);
    }

    // Retain connections
    const connections: RetainedConnection3D[] = puzzle2D.connections.map((conn) => ({
      connectionId: conn.id,
      pieceAId: conn.pieceA,
      pieceBId: conn.pieceB,
      interfaceAId: conn.interfaceA.id,
      interfaceBId: conn.interfaceB.id,
      connectorType: conn.connectorType,
      parameters: { ...conn.parameters },
      clearanceMm: conn.clearance,
      allowedAngleDeg: conn.allowedAngle,
    }));

    // Stage 5: 3D Validation
    const validation = Validator3D.validatePieces(pieces3D);

    const executionDurationMs = Number((performance.now() - startTime).toFixed(2));

    return {
      puzzleId: puzzle2D.id,
      specification: puzzle2D.specification,
      pieces: pieces3D,
      connections,
      validation,
      metadata: {
        convertedAt: new Date().toISOString(),
        executionDurationMs,
        generatorVersion: "Phase 86 (v1.0)",
      },
    };
  }
}
