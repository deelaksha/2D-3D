/**
 * Reviewer-Independent Validator (Phase 62).
 *
 * Automatically re-validates human edits across geometry, connection,
 * and assembly domains to protect training data from accidental human typos
 * or physically defective manual overrides.
 */
import type { Vec2 } from "@/core/model/types";
import type { RealDatasetExample, TriStageValidationResult } from "../realdata/types";
import { TriStageValidator } from "../realdata/triStageValidator";
import { createCanonicalPiece, createEmptyCanonicalPuzzle, createCanonicalInterface, createCanonicalConnection } from "../canonical/defaults";
import type { CanonicalPuzzle } from "../canonical/types";

export interface IndependentValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  triStageResult: TriStageValidationResult;
}

export class ReviewerIndependentValidator {
  /**
   * Executes independent validation on an edited RealDatasetExample.
   */
  static validate(example: RealDatasetExample): IndependentValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Piece ID uniqueness & geometry sanity
    const pieceIdSet = new Set<string>();
    for (const p of example.pieces || []) {
      if (!p.pieceId || typeof p.pieceId !== "string") {
        errors.push("INVALID_PIECE_ID: A piece is missing a valid string ID.");
        continue;
      }
      if (pieceIdSet.has(p.pieceId)) {
        errors.push(`DUPLICATE_PIECE_ID: Duplicate piece ID '${p.pieceId}' detected.`);
      }
      pieceIdSet.add(p.pieceId);

      // Boundary loop check
      const loop = p.localPolygon2D || [];
      if (!Array.isArray(loop) || loop.length < 3) {
        errors.push(`DEGENERATE_BOUNDARY: Piece '${p.pieceId}' has fewer than 3 boundary vertices (${loop.length}).`);
      } else {
        const area = this.calculateArea(loop);
        if (area < 0.01) {
          errors.push(`ZERO_AREA_BOUNDARY: Piece '${p.pieceId}' has near-zero planar area (${area.toFixed(4)} mm²).`);
        }
      }

      // Dimensions check
      if (p.designParameters.widthMm <= 0.1 || p.designParameters.heightMm <= 0.1) {
        errors.push(`INVALID_DIMENSIONS: Piece '${p.pieceId}' has non-positive width/height (${p.designParameters.widthMm}x${p.designParameters.heightMm}mm).`);
      }
      if (p.designParameters.thicknessMm <= 0) {
        errors.push(`INVALID_THICKNESS: Piece '${p.pieceId}' has non-positive thickness (${p.designParameters.thicknessMm}mm).`);
      }
    }

    // 2. Interface ID uniqueness & referential integrity
    const ifaceIdSet = new Set<string>();
    const ifaceMap = new Map<string, (typeof example.interfaces)[0]>();

    for (const iface of example.interfaces || []) {
      if (!iface.interfaceId || typeof iface.interfaceId !== "string") {
        errors.push("INVALID_INTERFACE_ID: An interface is missing a valid string ID.");
        continue;
      }
      if (ifaceIdSet.has(iface.interfaceId)) {
        errors.push(`DUPLICATE_INTERFACE_ID: Duplicate interface ID '${iface.interfaceId}' detected.`);
      }
      ifaceIdSet.add(iface.interfaceId);
      ifaceMap.set(iface.interfaceId, iface);

      if (!pieceIdSet.has(iface.owningPieceId)) {
        errors.push(`DANGLING_OWNING_PIECE: Interface '${iface.interfaceId}' references non-existent piece '${iface.owningPieceId}'.`);
      }
    }

    // 3. Connection referential integrity & allowed angles
    for (const c of example.connections || []) {
      const ifA = ifaceMap.get(c.interfaceAId);
      const ifB = ifaceMap.get(c.interfaceBId);

      if (!ifA || !ifB) {
        errors.push(`DANGLING_CONNECTION_REF: Connection '${c.connectionId}' references non-existent interface(s): A='${c.interfaceAId}', B='${c.interfaceBId}'.`);
        continue;
      }

      if (ifA.owningPieceId === ifB.owningPieceId) {
        warnings.push(`SELF_CONNECTION: Connection '${c.connectionId}' connects two interfaces on the same piece '${ifA.owningPieceId}'.`);
      }

      // Angle check
      const angle = c.joiningAngleDeg;
      if (typeof angle !== "number" || isNaN(angle) || angle < -360 || angle > 360) {
        errors.push(`INVALID_JOINING_ANGLE: Connection '${c.connectionId}' has invalid joining angle ${angle}°.`);
      }
    }

    // 4. Assembly transforms & sequence integrity
    const transforms = example.assembly?.pieceTransforms || {};
    for (const pid of Object.keys(transforms)) {
      if (!pieceIdSet.has(pid)) {
        warnings.push(`ORPHANED_TRANSFORM: Assembly transform exists for non-existent piece '${pid}'.`);
      }
    }

    for (const step of example.assembly?.assemblySequence || []) {
      if (!pieceIdSet.has(step.addedPieceId)) {
        errors.push(`SEQUENCE_UNKNOWN_PIECE: Assembly sequence references unknown piece '${step.addedPieceId}'.`);
      }
    }

    // 5. Map to CanonicalPuzzle and run TriStageValidator
    const canonicalPuzzle = this.mapExampleToCanonicalPuzzle(example);
    const triStageResult = TriStageValidator.validate(canonicalPuzzle);

    errors.push(...triStageResult.failureReasons);
    warnings.push(...triStageResult.reviewReasons);

    const isValid = errors.length === 0 && triStageResult.isValid;

    return {
      isValid,
      errors: Array.from(new Set(errors)),
      warnings: Array.from(new Set(warnings)),
      triStageResult,
    };
  }

  private static calculateArea(pts: Vec2[]): number {
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area) / 2.0;
  }

  private static mapExampleToCanonicalPuzzle(example: RealDatasetExample): CanonicalPuzzle {
    const puzzle = createEmptyCanonicalPuzzle(example.puzzle.name);
    puzzle.metadata.id = example.puzzle.puzzleId;

    puzzle.pieces = (example.pieces || []).map((p) => {
      const c = createCanonicalPiece(
        p.name,
        {
          width: p.designParameters.widthMm,
          height: p.designParameters.heightMm,
          depth: p.designParameters.thicknessMm,
        },
        p.designParameters.thicknessMm
      );
      c.id = p.pieceId;
      (c as any).localPolygon2D = p.localPolygon2D;
      c.interfaceIds = (example.interfaces || [])
        .filter((i) => i.owningPieceId === p.pieceId)
        .map((i) => i.interfaceId);
      return c;
    });

    puzzle.interfaces = (example.interfaces || []).map((i) => {
      const iface = createCanonicalInterface(
        i.owningPieceId,
        `Port ${i.interfaceId}`,
        { x: i.localFrame.origin.x, y: i.localFrame.origin.y },
        { x: i.localFrame.normal.x, y: i.localFrame.normal.y }
      );
      iface.id = i.interfaceId;
      iface.interfaceType = (i.interfaceType as any) || "tab";
      iface.genderRole = (i.genderRole as any) || "insert";
      iface.profile.width = i.profileWidthMm;
      iface.profile.depth = i.profileDepthMm;
      return iface;
    });

    puzzle.connections = (example.connections || []).map((c) => {
      const conn = createCanonicalConnection(c.interfaceAId, c.interfaceBId, c.joiningAngleDeg);
      conn.id = c.connectionId;
      return conn;
    });

    (puzzle as any).assembly = example.assembly;

    return puzzle;
  }
}
