/**
 * Autonomous 2D Puzzle Generator Engine.
 *
 * Core Orchestrator for the Autonomous 2D Puzzle Generation Subsystem.
 * Automatically generates complete, geometrically exact, deterministic 2D puzzles
 * from validated ParametricDesignSpecifications across diverse layout topologies.
 */

import type { ParametricDesignSpecification } from "../ailayer/types";
import type {
  Autonomous2DDiagnostic,
  Autonomous2DGenerationOptions,
  Autonomous2DGenerationResult,
  GeneratedConnectionCandidate,
  GeneratedInterface,
  GeneratedPiece,
  GeneratedPuzzle2D,
  PuzzleLayoutType,
} from "./types";
import { GridLayoutGenerator } from "./layouts/gridLayout";
import { RadialLayoutGenerator } from "./layouts/radialLayout";
import { PolygonalLayoutGenerator } from "./layouts/polygonalLayout";
import { OrganicLayoutGenerator } from "./layouts/organicLayout";
import { AutonomousConnectorGenerator } from "./connectorGenerator";
import { Autonomous2DValidator } from "./validator2D";
import type { CanonicalInterface, CanonicalPiece, CanonicalPuzzle } from "../canonical/types";
import { createEmptyCanonicalPuzzle } from "../canonical/defaults";
import { vec3 } from "../geometry/math3d";

export class Autonomous2DPuzzleGenerator {
  /**
   * Primary entry point: Generates a complete 2D puzzle from a design specification.
   */
  public static generate(
    spec: ParametricDesignSpecification,
    options?: Autonomous2DGenerationOptions
  ): Autonomous2DGenerationResult {
    const startTime = Date.now();
    const diagnostics: Autonomous2DDiagnostic[] = [];

    // 1. Validate Input Specification
    const specDiag = this.validateSpecification(spec);
    if (specDiag.length > 0) {
      diagnostics.push(...specDiag);
      return {
        success: false,
        validationReport: {
          isValid: false,
          checks: {
            boundaryValid: false,
            pieceCountMatches: false,
            allPiecesClosedAndPositiveArea: false,
            noSelfIntersections: false,
            topologyConnected: false,
            noOrphanPieces: false,
            allInterfacesPaired: false,
            normalsOpposed: false,
            outerBoundaryCoversPerimeter: false,
            physicalTolerancesValid: false,
          },
          errors: specDiag.map((d) => d.message),
          warnings: [],
          diagnostics: specDiag,
        },
        diagnostics,
        executionDurationMs: Date.now() - startTime,
      };
    }

    // 2. Resolve Layout Strategy
    const layoutType = this.resolveLayoutStrategy(spec, options);
    const targetPieceCount = spec.piece_count;
    const widthMm = spec.overall_size.widthMm;
    const heightMm = spec.overall_size.heightMm;
    const seed = options?.seed ?? 42;

    // 3. Partition Geometry according to layout strategy
    let partitionResult;
    try {
      switch (layoutType) {
        case "radial":
          partitionResult = RadialLayoutGenerator.partition(widthMm, heightMm, targetPieceCount);
          break;
        case "custom_polygonal":
          partitionResult = PolygonalLayoutGenerator.partition(widthMm, heightMm, targetPieceCount, seed);
          break;
        case "organic":
          partitionResult = OrganicLayoutGenerator.partition(widthMm, heightMm, targetPieceCount, seed);
          break;
        case "grid":
        default:
          partitionResult = GridLayoutGenerator.partition(widthMm, heightMm, targetPieceCount);
          break;
      }
    } catch (partitionErr: any) {
      const errDiag: Autonomous2DDiagnostic = {
        code: "ERR_PARTITION_FAILURE",
        stage: "piece_partitioning",
        severity: "error",
        message: `Layout partitioning failed: ${partitionErr.message || String(partitionErr)}`,
        remediation: "Check piece count and aspect ratio parameters.",
      };
      diagnostics.push(errDiag);

      return {
        success: false,
        validationReport: {
          isValid: false,
          checks: {
            boundaryValid: true,
            pieceCountMatches: false,
            allPiecesClosedAndPositiveArea: false,
            noSelfIntersections: false,
            topologyConnected: false,
            noOrphanPieces: false,
            allInterfacesPaired: false,
            normalsOpposed: false,
            outerBoundaryCoversPerimeter: false,
            physicalTolerancesValid: true,
          },
          errors: [errDiag.message],
          warnings: [],
          diagnostics: [errDiag],
        },
        diagnostics,
        executionDurationMs: Date.now() - startTime,
      };
    }

    // 4. Synthesize Interfaces, Connection Candidates, and Piece Objects
    const synthesized = AutonomousConnectorGenerator.generate(partitionResult, spec, options);

    // 5. Construct GeneratedPuzzle2D
    const puzzleId = `puz2d_${spec.specificationId}_${layoutType}`;
    const generatedPuzzle: GeneratedPuzzle2D = {
      puzzleId,
      specificationId: spec.specificationId,
      layoutType,
      boundary: partitionResult.puzzleBoundary,
      pieceCount: synthesized.pieces.length,
      pieces: synthesized.pieces,
      interfaces: synthesized.interfaces,
      connectionCandidates: synthesized.connectionCandidates,
      outerBoundarySegments: synthesized.outerBoundarySegments,
      internalInterfaceCount: synthesized.interfaces.length,
      dimensions: {
        widthMm,
        heightMm,
        thicknessMm: spec.material.stockThicknessMm,
      },
      metadata: {
        difficulty: spec.difficulty?.level || "medium",
        materialId: spec.material.materialId,
        generatedAt: new Date().toISOString(),
        deterministicSeed: seed,
        generatorVersion: "1.0.0-phase81",
      },
    };

    // 6. Run Strict 2D Validation
    const validationReport = Autonomous2DValidator.validate(generatedPuzzle);
    diagnostics.push(...validationReport.diagnostics);

    const success = validationReport.isValid;

    return {
      success,
      puzzle: success ? generatedPuzzle : undefined,
      validationReport,
      diagnostics,
      executionDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Resolves the layout topology from explicit options or infers from design specification.
   */
  public static resolveLayoutStrategy(
    spec: ParametricDesignSpecification,
    options?: Autonomous2DGenerationOptions
  ): PuzzleLayoutType {
    if (options?.layoutType) {
      return options.layoutType;
    }

    // Infer from symmetry
    if (spec.symmetry?.symmetryAxis === "radial") {
      return "radial";
    }

    // Infer from connection preferences or constraints
    const prefStr = (spec.connection_preferences?.defaultType || "").toLowerCase();
    if (prefStr.includes("organic") || prefStr.includes("jigsaw") || prefStr.includes("wave")) {
      return "organic";
    }
    if (prefStr.includes("poly") || prefStr.includes("triangle") || prefStr.includes("voronoi")) {
      return "custom_polygonal";
    }

    return "grid";
  }

  /**
   * Validates specification constraints prior to geometric partitioning.
   */
  private static validateSpecification(spec: ParametricDesignSpecification): Autonomous2DDiagnostic[] {
    const diags: Autonomous2DDiagnostic[] = [];

    if (!spec) {
      diags.push({
        code: "ERR_NULL_SPECIFICATION",
        stage: "specification_validation",
        severity: "error",
        message: "ParametricDesignSpecification is null or undefined.",
        remediation: "Provide a valid ParametricDesignSpecification.",
      });
      return diags;
    }

    if (spec.piece_count < 2) {
      diags.push({
        code: "ERR_INSUFFICIENT_PIECE_COUNT",
        stage: "specification_validation",
        severity: "error",
        message: `Piece count (${spec.piece_count}) is less than minimum allowed (2).`,
        remediation: "Set piece_count to at least 2.",
      });
    }

    if (!spec.overall_size || spec.overall_size.widthMm <= 0 || spec.overall_size.heightMm <= 0) {
      diags.push({
        code: "ERR_INVALID_SPEC_DIMENSIONS",
        stage: "specification_validation",
        severity: "error",
        message: `Overall dimensions are non-positive (${spec.overall_size?.widthMm}x${spec.overall_size?.heightMm} mm).`,
        remediation: "Ensure widthMm and heightMm are greater than 0.",
      });
    }

    if (!spec.material || spec.material.stockThicknessMm <= 0) {
      diags.push({
        code: "ERR_INVALID_MATERIAL_THICKNESS",
        stage: "specification_validation",
        severity: "error",
        message: "Material stock thickness is missing or non-positive.",
        remediation: "Specify positive stockThicknessMm in material specification.",
      });
    }

    if (spec.material && spec.overall_size) {
      if (
        spec.material.stockWidthMm > 0 &&
        spec.overall_size.widthMm > spec.material.stockWidthMm
      ) {
        diags.push({
          code: "ERR_EXCEEDS_STOCK_WIDTH",
          stage: "specification_validation",
          severity: "error",
          message: `Overall width (${spec.overall_size.widthMm}mm) exceeds material stock width (${spec.material.stockWidthMm}mm).`,
          remediation: "Reduce puzzle width or select larger sheet stock.",
        });
      }
      if (
        spec.material.stockHeightMm > 0 &&
        spec.overall_size.heightMm > spec.material.stockHeightMm
      ) {
        diags.push({
          code: "ERR_EXCEEDS_STOCK_HEIGHT",
          stage: "specification_validation",
          severity: "error",
          message: `Overall height (${spec.overall_size.heightMm}mm) exceeds material stock height (${spec.material.stockHeightMm}mm).`,
          remediation: "Reduce puzzle height or select larger sheet stock.",
        });
      }
    }

    return diags;
  }

  /**
   * Converts a GeneratedPuzzle2D into a CanonicalPuzzle for seamless downstream integration.
   */
  public static toCanonicalPuzzle(puzzle: GeneratedPuzzle2D): CanonicalPuzzle {
    const canonical = createEmptyCanonicalPuzzle(puzzle.puzzleId);
    canonical.metadata.id = puzzle.puzzleId;
    canonical.metadata.difficulty = puzzle.metadata.difficulty;
    canonical.metadata.description = `Autonomous 2D puzzle generated with ${puzzle.layoutType} layout (${puzzle.pieceCount} pieces).`;

    // 1. Convert pieces
    for (const p of puzzle.pieces) {
      const cPiece: CanonicalPiece = {
        id: p.id,
        name: p.name,
        geometryRef: {
          contour: p.contour,
        },
        dimensions: {
          width: p.dimensions.widthMm,
          height: p.dimensions.heightMm,
          depth: p.dimensions.thicknessMm,
        },
        thickness: p.thicknessMm,
        materialId: p.materialId,
        interfaceIds: p.interfaces.map((i) => i.id),
        localFrame: {
          origin: vec3(p.localOrigin.x, p.localOrigin.y, 0),
          tangent: vec3(1, 0, 0),
          normal: vec3(0, 1, 0),
          binormal: vec3(0, 0, 1),
        },
        manufacturingParameters: {
          kerf: 0.1,
          grainAngleDeg: 0,
        },
      };
      canonical.pieces.push(cPiece);
    }

    // 2. Convert interfaces
    for (const iface of puzzle.interfaces) {
      const cInterface: CanonicalInterface = {
        id: iface.id,
        owningPieceId: iface.pieceId,
        name: iface.name,
        edgeGeometry: {
          edgeIndex: iface.edgeIndex,
          parametricStart: 0.3,
          parametricEnd: 0.7,
          length: iface.widthMm,
        },
        interfaceType: iface.role === "insert" ? "tab" : "slot",
        profile: {
          profileKind: iface.role === "insert" ? "tab" : "slot",
          width: iface.widthMm,
          depth: iface.depthMm,
          clearance: iface.toleranceMm,
        },
        compatibility: {
          allowedTypes: [iface.role === "insert" ? "slot" : "tab"],
          genderRole: iface.role === "insert" ? "insert" : "receiver",
          complementaryPatterns: [iface.pattern],
        },
        localFrame: {
          origin: vec3(iface.position.x, iface.position.y, 0),
          tangent: vec3(iface.tangent.x, iface.tangent.y, 0),
          normal: vec3(iface.normal.x, iface.normal.y, 0),
          binormal: vec3(0, 0, 1),
        },
        tolerance: iface.toleranceMm,
        allowedDOF: {
          translation: { x: false, y: false, z: false },
          rotation: { rx: false, ry: false, rz: false },
        },
      };
      canonical.interfaces.push(cInterface);
    }

    // 3. Convert connection candidates to canonical connections
    for (const cand of puzzle.connectionCandidates) {
      canonical.connections.push({
        id: cand.candidateId,
        interfaceAId: cand.interfaceAId,
        interfaceBId: cand.interfaceBId,
        pieceAId: cand.pieceAId,
        pieceBId: cand.pieceBId,
        connectionType: cand.connectionType === "interlock" ? "interlocking_joint" : "slot_joint",
        relativeTransform: {
          position: vec3(0, 0, 0),
          rotation: vec3(0, 0, 0),
        },
        joiningAngleDeg: 180.0, // planar 2D mating
        tolerance: cand.requiredClearanceMm,
        dof: {
          translation: { x: false, y: false, z: false },
          rotation: { rx: false, ry: false, rz: false },
        },
      });
    }

    return canonical;
  }
}
