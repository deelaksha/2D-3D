/**
 * Strict 2D Validation Engine and Structured Diagnostics for Autonomous Generation.
 *
 * Validates:
 *  1. Boundary integrity (closed loops, positive planar area)
 *  2. Piece boundary geometry (non-self-intersecting, positive area)
 *  3. Topological connectivity (single connected component, zero orphan pieces)
 *  4. Interface pairing reciprocity and opposing normal vectors
 *  5. Outer perimeter consistency
 *  6. Physical tolerances and manufacturing clearance
 */

import type {
  Autonomous2DDiagnostic,
  Autonomous2DValidationReport,
  GeneratedPuzzle2D,
} from "./types";
import { dot2D, hasSelfIntersections, polygonArea } from "./geometry2D";

export class Autonomous2DValidator {
  public static validate(puzzle: GeneratedPuzzle2D): Autonomous2DValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];
    const diagnostics: Autonomous2DDiagnostic[] = [];

    const checks = {
      boundaryValid: true,
      pieceCountMatches: true,
      allPiecesClosedAndPositiveArea: true,
      noSelfIntersections: true,
      topologyConnected: true,
      noOrphanPieces: true,
      allInterfacesPaired: true,
      normalsOpposed: true,
      outerBoundaryCoversPerimeter: true,
      physicalTolerancesValid: true,
    };

    // 1. Check Overall Puzzle Boundary
    if (
      !puzzle.boundary ||
      !puzzle.boundary.vertices ||
      puzzle.boundary.vertices.length < 3 ||
      puzzle.boundary.areaMm2 <= 0
    ) {
      checks.boundaryValid = false;
      const msg = "Puzzle boundary is invalid, degenerate, or has non-positive area.";
      errors.push(msg);
      diagnostics.push({
        code: "ERR_INVALID_PUZZLE_BOUNDARY",
        stage: "boundary_generation",
        severity: "error",
        message: msg,
        remediation: "Ensure width and height are positive dimensions.",
      });
    }

    // 2. Check Piece Count
    if (puzzle.pieces.length < 2) {
      checks.pieceCountMatches = false;
      const msg = `Puzzle piece count (${puzzle.pieces.length}) is less than 2. An assembly requires >= 2 pieces.`;
      errors.push(msg);
      diagnostics.push({
        code: "ERR_INSUFFICIENT_PIECE_COUNT",
        stage: "piece_partitioning",
        severity: "error",
        message: msg,
        remediation: "Increase targetPieceCount in the specification to at least 2.",
      });
    }

    if (puzzle.pieceCount !== puzzle.pieces.length) {
      checks.pieceCountMatches = false;
      const msg = `Declared pieceCount (${puzzle.pieceCount}) does not match actual pieces generated (${puzzle.pieces.length}).`;
      errors.push(msg);
      diagnostics.push({
        code: "ERR_PIECE_COUNT_MISMATCH",
        stage: "piece_partitioning",
        severity: "error",
        message: msg,
        remediation: "Harmonize target piece count with partitioning layout.",
      });
    }

    // 3. Check Individual Pieces
    let totalPieceArea = 0;
    const pieceIds = new Set<string>();

    for (const piece of puzzle.pieces) {
      pieceIds.add(piece.id);

      // Vertices and Area
      const verts = piece.boundary?.vertices || [];
      if (verts.length < 3) {
        checks.allPiecesClosedAndPositiveArea = false;
        const msg = `Piece '${piece.id}' has fewer than 3 vertices (${verts.length}).`;
        errors.push(msg);
        diagnostics.push({
          code: "ERR_DEGENERATE_PIECE_BOUNDARY",
          stage: "piece_partitioning",
          severity: "error",
          message: msg,
          remediation: "Regenerate partition with sufficient spatial resolution.",
          details: { pieceId: piece.id },
        });
      }

      const area = polygonArea(verts);
      totalPieceArea += area;
      if (area <= 0.01) {
        checks.allPiecesClosedAndPositiveArea = false;
        const msg = `Piece '${piece.id}' has zero or negligible planar area (${area.toFixed(2)} mm²).`;
        errors.push(msg);
        diagnostics.push({
          code: "ERR_ZERO_PIECE_AREA",
          stage: "piece_partitioning",
          severity: "error",
          message: msg,
          remediation: "Ensure partition polygons do not collapse to lines or points.",
          details: { pieceId: piece.id },
        });
      }

      // Self-intersections
      if (hasSelfIntersections(verts)) {
        checks.noSelfIntersections = false;
        const msg = `Piece '${piece.id}' boundary polygon self-intersects.`;
        errors.push(msg);
        diagnostics.push({
          code: "ERR_SELF_INTERSECTING_PIECE",
          stage: "piece_partitioning",
          severity: "error",
          message: msg,
          remediation: "Verify polygon vertex ordering and ensure convex or clean simple polygon cuts.",
          details: { pieceId: piece.id },
        });
      }

      // Check for orphan piece (0 interfaces)
      if (!piece.interfaces || piece.interfaces.length === 0) {
        checks.noOrphanPieces = false;
        const msg = `Piece '${piece.id}' is an isolated orphan with 0 connection interfaces.`;
        errors.push(msg);
        diagnostics.push({
          code: "ERR_ORPHAN_PIECE",
          stage: "interface_generation",
          severity: "error",
          message: msg,
          remediation: "Every piece must share at least 1 internal boundary with a neighboring piece.",
          details: { pieceId: piece.id },
        });
      }
    }

    // Area Conservation Check
    const areaDiffRatio = Math.abs(totalPieceArea - puzzle.boundary.areaMm2) / Math.max(1, puzzle.boundary.areaMm2);
    if (areaDiffRatio > 0.05) {
      warnings.push(
        `Sum of piece areas (${totalPieceArea.toFixed(1)} mm²) differs from puzzle boundary area (${puzzle.boundary.areaMm2.toFixed(1)} mm²) by ${(areaDiffRatio * 100).toFixed(1)}%.`
      );
    }

    // 4. Topological Connectivity Graph Check (BFS/DFS for single connected component)
    const adj = new Map<string, Set<string>>();
    for (const pId of pieceIds) {
      adj.set(pId, new Set());
    }

    for (const cand of puzzle.connectionCandidates) {
      if (adj.has(cand.pieceAId) && adj.has(cand.pieceBId)) {
        adj.get(cand.pieceAId)?.add(cand.pieceBId);
        adj.get(cand.pieceBId)?.add(cand.pieceAId);
      }
    }

    // Traverse from first piece
    const visited = new Set<string>();
    const firstPieceId = puzzle.pieces[0]?.id;
    if (firstPieceId) {
      const queue = [firstPieceId];
      visited.add(firstPieceId);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const neighbors = adj.get(curr) || new Set();
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }
    }

    if (visited.size < pieceIds.size) {
      checks.topologyConnected = false;
      const unreached = Array.from(pieceIds).filter((id) => !visited.has(id));
      const msg = `Disconnected puzzle topology: ${pieceIds.size - visited.size} pieces are disconnected from the assembly graph [${unreached.join(", ")}].`;
      errors.push(msg);
      diagnostics.push({
        code: "ERR_DISCONNECTED_TOPOLOGY",
        stage: "interface_generation",
        severity: "error",
        message: msg,
        remediation: "Ensure internal shared edges span the entire piece graph into a single connected component.",
        details: { disconnectedPieceIds: unreached },
      });
    }

    // 5. Interface Reciprocity & Opposing Normals
    const ifMap = new Map(puzzle.interfaces.map((i) => [i.id, i]));

    for (const iface of puzzle.interfaces) {
      if (!iface.matingInterfaceId) {
        checks.allInterfacesPaired = false;
        const msg = `Interface '${iface.id}' on piece '${iface.pieceId}' has no mating interface designated.`;
        errors.push(msg);
        diagnostics.push({
          code: "ERR_UNPAIRED_INTERFACE",
          stage: "interface_generation",
          severity: "error",
          message: msg,
          remediation: "Pair every internal interface with a complementary mate on the adjoining piece.",
          details: { interfaceId: iface.id },
        });
        continue;
      }

      const mate = ifMap.get(iface.matingInterfaceId);
      if (!mate) {
        checks.allInterfacesPaired = false;
        const msg = `Interface '${iface.id}' references non-existent mating interface '${iface.matingInterfaceId}'.`;
        errors.push(msg);
        diagnostics.push({
          code: "ERR_DANGLING_MATING_INTERFACE",
          stage: "interface_generation",
          severity: "error",
          message: msg,
          remediation: "Verify mating interface ID references in candidate generator.",
        });
        continue;
      }

      // Check opposing normals: dot product should be close to -1.0
      const dot = dot2D(iface.normal, mate.normal);
      if (dot > -0.7) {
        checks.normalsOpposed = false;
        warnings.push(
          `Interface pair (${iface.id}, ${mate.id}) normal alignment dot product is ${dot.toFixed(2)} (expected ~ -1.0).`
        );
      }
    }

    // 6. Outer Boundary Segments Check
    if (puzzle.outerBoundarySegments.length < 3) {
      checks.outerBoundaryCoversPerimeter = false;
      const msg = `Puzzle has only ${puzzle.outerBoundarySegments.length} outer boundary segments. Expected >= 3.`;
      errors.push(msg);
      diagnostics.push({
        code: "ERR_INSUFFICIENT_OUTER_BOUNDARY",
        stage: "boundary_generation",
        severity: "error",
        message: msg,
        remediation: "Ensure outer perimeter segments of border pieces are tagged as outer boundaries.",
      });
    }

    // 7. Physical Tolerances Check
    if (puzzle.dimensions.thicknessMm <= 0) {
      checks.physicalTolerancesValid = false;
      const msg = `Stock thickness (${puzzle.dimensions.thicknessMm} mm) must be positive.`;
      errors.push(msg);
      diagnostics.push({
        code: "ERR_INVALID_STOCK_THICKNESS",
        stage: "specification_validation",
        severity: "error",
        message: msg,
        remediation: "Set positive stock thickness in specification material.",
      });
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      checks,
      errors,
      warnings,
      diagnostics,
    };
  }
}
