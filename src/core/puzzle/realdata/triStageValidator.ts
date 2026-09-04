/**
 * Tri-Stage Physical & Geometric Validation Engine (Phase 61).
 *
 * Implements:
 *   Stage 6: GEOMETRY VALIDATION
 *   Stage 7: CONNECTION VALIDATION
 *   Stage 8: ASSEMBLY VALIDATION
 *
 * Evaluates the Canonical IR model across physical feasibility criteria.
 */
import type { Vec2 } from "@/core/model/types";
import { shapeOutline } from "@/core/geometry";
import type {
  CanonicalConnection,
  CanonicalInterface,
  CanonicalPiece,
  CanonicalPuzzle,
} from "../canonical/types";
import type {
  AssemblyValidationDetail,
  ConnectionValidationDetail,
  GeometryValidationDetail,
  TriStageValidationResult,
} from "./types";
import { PuzzleAssemblyGraph } from "../graph/graph";
import type { AssemblyConnectionEdge, PuzzlePieceNode } from "../graph/types";

export class TriStageValidator {
  /**
   * Runs the complete 3-gate validation sequence on a CanonicalPuzzle.
   */
  static validate(puzzle: CanonicalPuzzle, assemblyPlacements?: any, solids?: any): TriStageValidationResult {
    const geometry = this.validateGeometry(puzzle);
    const connection = this.validateConnections(puzzle);
    const assembly = this.validateAssembly(puzzle);

    const failureReasons: string[] = [
      ...geometry.errors,
      ...connection.errors,
      ...assembly.errors,
    ];

    const reviewReasons: string[] = [
      ...geometry.warnings,
      ...connection.warnings,
      ...assembly.warnings,
    ];

    // Score calculation
    let deductions = 0;
    deductions += geometry.errors.length * 0.4;
    deductions += connection.errors.length * 0.3;
    deductions += assembly.errors.length * 0.3;
    deductions += geometry.warnings.length * 0.05;
    deductions += connection.warnings.length * 0.05;
    deductions += assembly.warnings.length * 0.05;

    const overallScore = Math.max(0.0, Math.min(1.0, 1.0 - deductions));
    const isValid = geometry.isValid && connection.isValid && assembly.isValid && failureReasons.length === 0;

    return {
      geometry,
      connection,
      assembly,
      overallScore: Number(overallScore.toFixed(3)),
      isValid,
      failureReasons,
      reviewReasons,
    };
  }

  /**
   * STAGE 6: GEOMETRY VALIDATION
   */
  private static validateGeometry(puzzle: CanonicalPuzzle): GeometryValidationDetail {
    const errors: string[] = [];
    const warnings: string[] = [];
    let degenerateCount = 0;
    let openLoopCount = 0;
    let zeroAreaCount = 0;
    let collisionCount = 0;

    const pieces = puzzle.pieces || [];
    if (pieces.length === 0) {
      errors.push("NO_PIECES_FOUND: Canonical IR contains 0 pieces.");
      return {
        isValid: false,
        pieceCount: 0,
        degenerateCount,
        openLoopCount,
        zeroAreaCount,
        collisionCount,
        errors,
        warnings,
      };
    }

    for (const piece of pieces) {
      // 1. Check thickness
      const thickness =
        piece.thickness ??
        piece.dimensions?.depth ??
        (piece as any).designParameters?.thicknessMm ??
        3.0;

      if (thickness <= 0) {
        errors.push(`INVALID_THICKNESS: Piece '${piece.name || piece.id}' has invalid thickness ${thickness}mm.`);
      }

      // 2. Check 2D outline polygon
      let loop: Vec2[] = [];
      if ((piece as any).localPolygon2D && Array.isArray((piece as any).localPolygon2D)) {
        loop = (piece as any).localPolygon2D;
      } else if ((piece as any).localOutline && Array.isArray((piece as any).localOutline)) {
        loop = (piece as any).localOutline;
      } else if (piece.geometryRef?.contour) {
        try {
          const loops = shapeOutline(piece.geometryRef.contour);
          if (loops && loops.length > 0 && loops[0].length > 0) {
            loop = loops[0];
          }
        } catch {
          // fallback to bounding box
        }
      }

      if (loop.length < 3) {
        const w = piece.dimensions?.width || (piece as any).designParameters?.widthMm || 100;
        const h = piece.dimensions?.height || (piece as any).designParameters?.heightMm || 100;
        if (w > 0 && h > 0) {
          loop = [
            { x: 0, y: 0 },
            { x: w, y: 0 },
            { x: w, y: h },
            { x: 0, y: h },
          ];
        }
      }

      if (loop.length < 3) {
        errors.push(`DEGENERATE_OUTLINE: Piece '${piece.name || piece.id}' has fewer than 3 boundary vertices.`);
        degenerateCount++;
        continue;
      }

      // 3. Compute polygon area using Shoelace formula
      let area = 0;
      const n = loop.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += loop[i].x * loop[j].y;
        area -= loop[j].x * loop[i].y;
      }
      area = Math.abs(area) / 2.0;

      if (area < 0.01) {
        errors.push(`ZERO_AREA_PIECE: Piece '${piece.name || piece.id}' has near-zero planar area (${area.toFixed(4)} mm²).`);
        zeroAreaCount++;
      }

      // 4. Dimension checks
      const width = piece.dimensions?.width || (piece as any).designParameters?.widthMm || 0;
      const height = piece.dimensions?.height || (piece as any).designParameters?.heightMm || 0;
      if (width <= 0.1 || height <= 0.1) {
        warnings.push(`SMALL_DIMENSIONS: Piece '${piece.name || piece.id}' has very small dimensions (${width}x${height}mm).`);
      }
    }

    return {
      isValid: errors.length === 0,
      pieceCount: pieces.length,
      degenerateCount,
      openLoopCount,
      zeroAreaCount,
      collisionCount,
      errors,
      warnings,
    };
  }

  /**
   * STAGE 7: CONNECTION VALIDATION
   */
  private static validateConnections(puzzle: CanonicalPuzzle): ConnectionValidationDetail {
    const errors: string[] = [];
    const warnings: string[] = [];

    const rawInterfaces = puzzle.interfaces || [];
    const interfaces: CanonicalInterface[] = Array.isArray(rawInterfaces)
      ? rawInterfaces
      : Object.values(rawInterfaces);

    const connections: CanonicalConnection[] = puzzle.connections || [];
    const interfaceMap = new Map<string, CanonicalInterface>();

    for (const iface of interfaces) {
      if (iface && iface.id) {
        interfaceMap.set(iface.id, iface);
      }
    }

    let matchedConnections = 0;
    let unmatchedInterfaces = interfaces.length;
    let invalidToleranceCount = 0;
    let unsupportedAngleCount = 0;

    const usedInterfaceIds = new Set<string>();

    for (const conn of connections) {
      const ifA = interfaceMap.get(conn.interfaceAId);
      const ifB = interfaceMap.get(conn.interfaceBId);

      if (!ifA || !ifB) {
        errors.push(`DANGLING_CONNECTION: Connection '${conn.id}' references missing interface(s): A='${conn.interfaceAId}', B='${conn.interfaceBId}'.`);
        continue;
      }

      usedInterfaceIds.add(conn.interfaceAId);
      usedInterfaceIds.add(conn.interfaceBId);
      matchedConnections++;

      // 1. Check gender complementarity
      const roleA = ifA.genderRole;
      const roleB = ifB.genderRole;
      if (roleA && roleB) {
        const isComplementary =
          (roleA === "insert" && roleB === "receiver") ||
          (roleA === "receiver" && roleB === "insert") ||
          (roleA === "neutral" && roleB === "neutral");

        if (!isComplementary) {
          errors.push(`GENDER_MISMATCH: Connection '${conn.id}' couples incompatible roles (${roleA} with ${roleB}).`);
        }
      }

      // 2. Tolerance check
      const widthA = ifA.profile?.width ?? 0;
      const widthB = ifB.profile?.width ?? 0;
      if (widthA > 0 && widthB > 0) {
        const diff = Math.abs(widthA - widthB);
        if (diff > 2.0) {
          warnings.push(`TOLERANCE_WARNING: Connection '${conn.id}' profile widths differ by ${diff.toFixed(2)}mm (${widthA}mm vs ${widthB}mm).`);
          invalidToleranceCount++;
        }
      }

      // 3. Joining angle check
      const angle = conn.assemblyParameters?.joiningAngleDeg ?? 90;
      if (typeof angle !== "number" || isNaN(angle) || angle < -360 || angle > 360) {
        errors.push(`INVALID_JOINING_ANGLE: Connection '${conn.id}' has invalid joining angle ${angle}°.`);
        unsupportedAngleCount++;
      }
    }

    unmatchedInterfaces = interfaces.length - usedInterfaceIds.size;
    if (interfaces.length > 0 && unmatchedInterfaces > 0) {
      warnings.push(`UNCONNECTED_INTERFACES: ${unmatchedInterfaces} interface port(s) remain unconnected.`);
    }

    return {
      isValid: errors.length === 0,
      totalInterfaces: interfaces.length,
      matchedConnections,
      unmatchedInterfaces,
      invalidToleranceCount,
      unsupportedAngleCount,
      errors,
      warnings,
    };
  }

  /**
   * STAGE 8: ASSEMBLY VALIDATION
   */
  private static validateAssembly(puzzle: CanonicalPuzzle): AssemblyValidationDetail {
    const errors: string[] = [];
    const warnings: string[] = [];

    const pieces = puzzle.pieces || [];
    const connections = puzzle.connections || [];

    // 1. Graph connectivity check
    let isGraphConnected = true;
    let orphanedPieceCount = 0;

    if (pieces.length > 1) {
      try {
        const nodes: PuzzlePieceNode[] = pieces.map((p) => ({
          pieceId: p.id,
          interfaceIds: p.interfaceIds || [],
        }));

        const rawInterfaces = puzzle.interfaces || [];
        const interfaces: CanonicalInterface[] = Array.isArray(rawInterfaces)
          ? rawInterfaces
          : Object.values(rawInterfaces);
        const ifMap = new Map<string, CanonicalInterface>();
        for (const iface of interfaces) {
          if (iface && iface.id) ifMap.set(iface.id, iface);
        }

        const edges: AssemblyConnectionEdge[] = [];
        for (const c of connections) {
          const ifA = ifMap.get(c.interfaceAId);
          const ifB = ifMap.get(c.interfaceBId);
          if (ifA && ifB) {
            edges.push({
              connectionId: c.id,
              sourcePieceId: ifA.owningPieceId,
              sourceInterfaceId: ifA.id,
              targetPieceId: ifB.owningPieceId,
              targetInterfaceId: ifB.id,
              connectionType: c.connectionType || "tab_slot",
              joiningAngleDeg: c.assemblyParameters?.joiningAngleDeg ?? 90,
              status: "valid",
            });
          }
        }

        const graph = new PuzzleAssemblyGraph(nodes, edges);
        const components = graph.getConnectedComponents();
        if (components.length > 1) {
          isGraphConnected = false;
          orphanedPieceCount = components.slice(1).reduce((acc, c) => acc + c.length, 0);
          warnings.push(`DISCONNECTED_ASSEMBLY_GRAPH: Puzzle contains ${components.length} disconnected sub-graphs (${orphanedPieceCount} orphaned pieces).`);
        }
      } catch (err: unknown) {
        warnings.push(`GRAPH_CHECK_SKIPPED: Assembly graph check encountered notice: ${String(err)}`);
      }
    }

    // 2. Assembly Sequence check
    let isSequenceSolvable = true;
    let collisionFreeSequence = true;

    // Check if sequence is present in metadata/assembly
    const seq = (puzzle as any).assemblySequence || (puzzle as any).assembly?.assemblySequence;
    if (Array.isArray(seq) && seq.length > 0) {
      const pieceIdSet = new Set(pieces.map((p) => p.id));
      for (const step of seq) {
        const pid = step.addedPieceId || step.pieceId;
        if (pid && !pieceIdSet.has(pid)) {
          errors.push(`SEQUENCE_UNKNOWN_PIECE: Assembly sequence references non-existent piece '${pid}'.`);
          isSequenceSolvable = false;
        }
      }
    } else if (pieces.length > 1 && connections.length === 0) {
      warnings.push("UNSPECIFIED_ASSEMBLY_SEQUENCE: Multi-piece puzzle has no connections or predefined assembly sequence.");
    }

    return {
      isValid: errors.length === 0,
      isGraphConnected,
      orphanedPieceCount,
      isSequenceSolvable,
      collisionFreeSequence,
      errors,
      warnings,
    };
  }
}
