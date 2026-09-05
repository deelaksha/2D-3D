/**
 * Automatic 2D Generation Engine (Phase 85).
 *
 * Master orchestrator executing the complete 8-stage automatic 2D pipeline:
 *
 *   Design Specification
 *           ↓
 *   Global Boundary Generator
 *           ↓
 *   Piece Partitioning (Phase 82)
 *           ↓
 *   Connection Graph (Topology G = (V, E))
 *           ↓
 *   Connector Generation (Phase 83)
 *           ↓
 *   Connector Placement (Phase 84)
 *           ↓
 *   Parametric Geometry (Exact Boundary with Embedded Connectors)
 *           ↓
 *   2D Validation
 *
 * Produces a single GeneratedPuzzle2D object containing everything.
 */

import { uid } from "@/core/model/ids";
import type { DesignSpecification2D, GeneratedPuzzle2D } from "./types";
import { GlobalBoundaryGenerator } from "./globalBoundaryGenerator";
import { PiecePartitioningAdapter } from "./piecePartitioningAdapter";
import { ConnectionGraphBuilder } from "./connectionGraphBuilder";
import { ConnectorSynthesisEngine } from "./connectorSynthesisEngine";
import { ParametricGeometryEngine } from "./parametricGeometryEngine";
import { Automatic2DValidator } from "./validator2D";

export class Automatic2DGenerationEngine {
  /**
   * Generates a complete physically connected 2D puzzle from a high-level design specification.
   */
  public static generatePuzzle(spec: DesignSpecification2D): GeneratedPuzzle2D {
    const startTime = performance.now();
    const puzzleId = spec.id ?? uid("puzzle_2d_");
    const name = spec.name ?? `Generated 2D Puzzle (${spec.targetPieceCount} pieces)`;
    const thicknessMm = spec.material?.stockThicknessMm ?? spec.thicknessMm ?? 3.0;

    // Stage 1: Global Boundary Generator
    const globalBoundary = GlobalBoundaryGenerator.generate(spec);

    // Stage 2: Piece Partitioning (Phase 82)
    const partitionResult = PiecePartitioningAdapter.partition(globalBoundary.vertices, spec);
    if (!partitionResult.success || partitionResult.pieces.length === 0) {
      throw new Error("Failed to partition global boundary into pieces.");
    }

    // Stage 3: Connection Graph (Topological G = (V, E))
    const { graph, interfaceEdges } = ConnectionGraphBuilder.buildGraph(partitionResult.pieces);

    // Stage 4 & 5: Connector Placement (Phase 84) & Connector Generation (Phase 83)
    const {
      connections,
      pieceInterfacesMap,
      pieceConnectorParamsMap,
    } = ConnectorSynthesisEngine.synthesize(
      partitionResult.pieces,
      interfaceEdges,
      graph,
      spec
    );

    // Stage 6: Parametric Geometry (Embeds physical tabs & slots into exactBoundary)
    const pieces = ParametricGeometryEngine.generatePieces(
      partitionResult.pieces,
      connections,
      pieceInterfacesMap,
      pieceConnectorParamsMap,
      spec
    );

    // Stage 7: 2D Validation
    const validation = Automatic2DValidator.validate(
      pieces,
      connections,
      graph,
      globalBoundary.areaMm2,
      spec.targetPieceCount
    );

    const executionDurationMs = Number((performance.now() - startTime).toFixed(2));

    // Return single GeneratedPuzzle2D object containing everything
    const puzzle: GeneratedPuzzle2D = {
      id: puzzleId,
      name,
      specification: { ...spec },
      globalBoundary,
      pieces,
      connections,
      graph,
      validation,
      dimensions: {
        widthMm: globalBoundary.bounds.maxX - globalBoundary.bounds.minX,
        heightMm: globalBoundary.bounds.maxY - globalBoundary.bounds.minY,
        thicknessMm,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        executionDurationMs,
        generatorVersion: "Phase 85 (v1.0)",
        seed: spec.seed ?? 42,
      },
    };

    return puzzle;
  }
}
