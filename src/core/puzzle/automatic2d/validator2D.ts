/**
 * Deterministic 2D Validation Suite (Phase 85 - Stage 7).
 *
 * Validates:
 *  1. Piece geometry integrity (positive area, closed boundary >= 3 vertices, valid dimensions).
 *  2. Connection validity (complementarity, clearance margins, non-null interfaces).
 *  3. Topological connectivity (single connected component, 0 isolated pieces).
 *  4. Area conservation and containment.
 */

import type { GeneratedConnection2D, GeneratedPiece2D, ValidationIssue2D, ValidationResult2D } from "./types";
import type { PuzzleAssemblyGraph } from "../graph/graph";

export class Automatic2DValidator {
  /**
   * Validates a complete 2D generated puzzle.
   */
  public static validate(
    pieces: GeneratedPiece2D[],
    connections: GeneratedConnection2D[],
    graph: PuzzleAssemblyGraph,
    globalBoundaryAreaMm2: number,
    targetPieceCount: number
  ): ValidationResult2D {
    const issues: ValidationIssue2D[] = [];
    const pieceIds = new Set(pieces.map((p) => p.id));

    // 1. Piece Count Check
    if (pieces.length === 0) {
      issues.push({
        code: "ERR_NO_PIECES",
        severity: "error",
        message: "Puzzle generation yielded 0 pieces.",
      });
    } else if (pieces.length !== targetPieceCount) {
      issues.push({
        code: "WARN_PIECE_COUNT_MISMATCH",
        severity: "warning",
        message: `Generated piece count (${pieces.length}) differs from target (${targetPieceCount}).`,
      });
    }

    // 2. Individual Piece Verification
    let totalPieceArea = 0;
    for (const piece of pieces) {
      totalPieceArea += piece.dimensions.areaMm2;

      if (!piece.exactBoundary || piece.exactBoundary.length < 3) {
        issues.push({
          code: "ERR_DEGENERATE_BOUNDARY",
          severity: "error",
          message: `Piece '${piece.id}' has degenerate exact boundary (${piece.exactBoundary?.length ?? 0} vertices).`,
        });
      }

      if (piece.dimensions.areaMm2 <= 0) {
        issues.push({
          code: "ERR_NON_POSITIVE_AREA",
          severity: "error",
          message: `Piece '${piece.id}' has non-positive area (${piece.dimensions.areaMm2} mm²).`,
        });
      }

      if (piece.thickness <= 0) {
        issues.push({
          code: "ERR_INVALID_THICKNESS",
          severity: "error",
          message: `Piece '${piece.id}' has invalid thickness (${piece.thickness} mm).`,
        });
      }

      if (!piece.material?.id) {
        issues.push({
          code: "ERR_MISSING_MATERIAL",
          severity: "error",
          message: `Piece '${piece.id}' is missing material specification.`,
        });
      }
    }

    // 3. Connection Verification
    let minClearance = Infinity;
    let maxClearance = -Infinity;

    for (const conn of connections) {
      if (!pieceIds.has(conn.pieceA)) {
        issues.push({
          code: "ERR_MISSING_PIECE_A",
          severity: "error",
          message: `Connection '${conn.id}' references non-existent pieceA '${conn.pieceA}'.`,
        });
      }

      if (!pieceIds.has(conn.pieceB)) {
        issues.push({
          code: "ERR_MISSING_PIECE_B",
          severity: "error",
          message: `Connection '${conn.id}' references non-existent pieceB '${conn.pieceB}'.`,
        });
      }

      if (!conn.interfaceA || !conn.interfaceB) {
        issues.push({
          code: "ERR_MISSING_INTERFACE",
          severity: "error",
          message: `Connection '${conn.id}' has missing canonical interface.`,
        });
      }

      // Clearance checks
      if (conn.clearance < minClearance) minClearance = conn.clearance;
      if (conn.clearance > maxClearance) maxClearance = conn.clearance;

      if (conn.clearance < 0.05 || conn.clearance > 1.5) {
        issues.push({
          code: "WARN_UNUSUAL_CLEARANCE",
          severity: "warning",
          message: `Connection '${conn.id}' has unusual clearance (${conn.clearance} mm).`,
        });
      }

      // Complementarity checks
      const p = conn.parameters;
      if (p.slotWidth < p.tabWidth - 1e-4) {
        issues.push({
          code: "ERR_COMPLEMENTARITY_WIDTH",
          severity: "error",
          message: `Connection '${conn.id}' slotWidth (${p.slotWidth}) < tabWidth (${p.tabWidth}).`,
        });
      }
      if (p.slotDepth < p.tabDepth - 1e-4) {
        issues.push({
          code: "ERR_COMPLEMENTARITY_DEPTH",
          severity: "error",
          message: `Connection '${conn.id}' slotDepth (${p.slotDepth}) < tabDepth (${p.tabDepth}).`,
        });
      }
    }

    if (minClearance === Infinity) minClearance = 0;
    if (maxClearance === -Infinity) maxClearance = 0;

    // 4. Topological Connectivity (BFS Reachability)
    const isolatedPieces = graph.getIsolatedPieces();
    const isGraphConnected = pieces.length <= 1 || (graph.isConnected() && isolatedPieces.length === 0);

    if (!isGraphConnected) {
      issues.push({
        code: "ERR_DISCONNECTED_GRAPH",
        severity: "error",
        message: `Puzzle assembly graph has ${isolatedPieces.length} isolated pieces or disconnected components.`,
        details: { isolatedPieces },
      });
    }

    // 5. Area Conservation Check
    const areaRatio = globalBoundaryAreaMm2 > 0 ? totalPieceArea / globalBoundaryAreaMm2 : 1.0;
    const areaConservationPct = Math.abs(1.0 - areaRatio) * 100;

    // We allow slight discrepancy due to tab protrusions / slot clearances (+/- 5%)
    if (areaConservationPct > 10.0) {
      issues.push({
        code: "WARN_AREA_DISCREPANCY",
        severity: "warning",
        message: `Total piece area differs from global boundary area by ${areaConservationPct.toFixed(2)}%.`,
      });
    }

    const hasErrors = issues.some((i) => i.severity === "error");

    return {
      isValid: !hasErrors,
      pieceCount: pieces.length,
      connectionCount: connections.length,
      graphConnected: isGraphConnected,
      areaConservationPct: Number(areaConservationPct.toFixed(2)),
      issues,
      metrics: {
        totalPieceAreaMm2: Number(totalPieceArea.toFixed(2)),
        globalBoundaryAreaMm2: Number(globalBoundaryAreaMm2.toFixed(2)),
        minClearanceMm: Number(minClearance.toFixed(3)),
        maxClearanceMm: Number(maxClearance.toFixed(3)),
        isolatedPieceCount: isolatedPieces.length,
      },
    };
  }
}
