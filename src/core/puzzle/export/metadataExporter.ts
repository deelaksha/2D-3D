/**
 * Metadata Package Exporter (Phase 99).
 *
 * Generates standardized JSON metadata artifacts:
 *  - puzzle.json: High-level design specification, overall metrics, and version.
 *  - pieces.json: Formal piece definitions with 2D bounds, dimensions, materials, and interfaces.
 *  - connections.json: Connector parameter specifications, participating pieces, clearances, and applied angles.
 *  - assembly_configuration.json: 3D spatial transforms per piece, root piece ID, and bounding dimensions.
 *  - assembly_sequence.json: Step-by-step physical assembly progression.
 *  - validation_report.json: Complete Phase 90 validation report.
 */

import type { PuzzleGenerationResult } from "../highlevelapi/types";
import type { ExportMetadataOptions, PuzzleMetadataPackage } from "./types";

export class MetadataExporter {
  /**
   * Compiles the complete metadata package for an automatically generated puzzle.
   */
  public static exportMetadata(
    result: PuzzleGenerationResult,
    options: ExportMetadataOptions = {}
  ): PuzzleMetadataPackage {
    const indent = options.jsonIndent ?? 2;
    const spec = result.designSpecification;
    const assembly = result.assembly as any;

    // 1. puzzle.json
    const puzzleSummary = {
      puzzleId: spec.id || "puzzle_design",
      name: spec.name || "Autonomous Puzzle",
      generatorVersion: "WoodKit Designer Phase 99",
      exportedAt: new Date().toISOString(),
      overallDimensionsMm: {
        width: spec.overallSize?.widthMm ?? 100,
        height: spec.overallSize?.heightMm ?? 100,
        thickness: spec.thicknessMm ?? spec.material?.stockThicknessMm ?? 3.0,
      },
      material: {
        id: spec.material?.id || "material_cardboard",
        name: spec.material?.name || "Cardboard",
        stockThicknessMm: spec.thicknessMm ?? spec.material?.stockThicknessMm ?? 3.0,
        kerfMm: spec.material?.kerfMm ?? 0.15,
      },
      targetPieceCount: spec.targetPieceCount,
      actualPieceCount: result.pieces2D.length,
      connectionCount: result.connectors.length,
      isNonPlanar: result.generationStatistics?.nonPlanar ?? false,
      validationPassed: result.validationReport?.isValid ?? false,
    };
    const puzzleJson = JSON.stringify(puzzleSummary, null, indent);

    // 2. pieces.json
    const piecesDefinitions = result.pieces2D.map((p) => {
      const pId = p.pieceId || p.id;
      const p3D = result.pieces3D.find((item) => (item.pieceId || item.id) === pId);

      return {
        pieceId: pId,
        name: p.name || `Piece ${pId}`,
        dimensionsMm: {
          width: p.dimensions?.widthMm ?? 0,
          height: p.dimensions?.heightMm ?? 0,
          thickness: p.thicknessMm ?? spec.thicknessMm ?? 3.0,
          areaMm2: p.dimensions?.areaMm2 ?? 0,
          perimeterMm: p.dimensions?.perimeterMm ?? 0,
        },
        bounds: p.dimensions?.bounds || { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        centroid: p.centroid || { x: 0, y: 0 },
        material: p.material || spec.material,
        interfaces: (p.interfaces || []).map((iface) => ({
          interfaceId: iface.id,
          lengthMm: iface.length,
          type: iface.type,
          isConvex: iface.isConvex,
        })),
        connectorIds: p3D?.connectorIds || [],
        solid3D: {
          volumeMm3: p3D?.solid?.volumeMm3 ?? 0,
          surfaceAreaMm2: p3D?.solid?.surfaceAreaMm2 ?? 0,
          massGrams: p3D?.solid?.massGrams ?? 0,
        },
      };
    });
    const piecesJson = JSON.stringify(piecesDefinitions, null, indent);

    // 3. connections.json
    const appliedAngles = assembly?.appliedAngles || {};
    const connectionsDefinitions = result.connectors.map((c) => ({
      connectionId: c.id,
      pieceAId: c.pieceA,
      pieceBId: c.pieceB,
      interfaceAId: c.interfaceA?.id,
      interfaceBId: c.interfaceB?.id,
      connectorType: c.connectorType,
      parameters: c.parameters,
      clearanceMm: c.clearance,
      allowedAngleDeg: c.allowedAngle,
      appliedAngleDeg: appliedAngles[c.id] ?? c.allowedAngle ?? 180,
    }));
    const connectionsJson = JSON.stringify(connectionsDefinitions, null, indent);

    // 4. assembly_configuration.json
    const assemblyConfig = {
      puzzleId: spec.id || "puzzle_design",
      rootPieceId: assembly?.rootPieceId || result.pieces2D[0]?.pieceId || "piece_0",
      placementOrder: assembly?.placementOrder || result.pieces2D.map((p) => p.pieceId || p.id),
      pieceTransforms: assembly?.pieceTransforms || {},
      appliedAngles: appliedAngles,
    };
    const assemblyConfigurationJson = JSON.stringify(assemblyConfig, null, indent);

    // 5. assembly_sequence.json
    const sequenceObj = assembly?.sequence || {
      puzzleId: spec.id || "puzzle_design",
      totalSteps: result.pieces2D.length,
      isPhysicallyAssemblable: true,
      steps: result.pieces2D.map((p, idx) => ({
        stepNumber: idx + 1,
        addedPieceId: p.pieceId || p.id,
        activeConnectionIds: result.connectors
          .filter((c) => c.pieceA === (p.pieceId || p.id) || c.pieceB === (p.pieceId || p.id))
          .map((c) => c.id),
        subAssemblyStateLabel: `Step ${idx + 1}`,
        stepDescription: idx === 0 ? `Anchor root piece ${p.pieceId || p.id}.` : `Assemble piece ${p.pieceId || p.id}.`,
      })),
    };
    const assemblySequenceJson = JSON.stringify(sequenceObj, null, indent);

    // 6. validation_report.json
    const validationReportJson = JSON.stringify(result.validationReport, null, indent);

    return {
      puzzleJson,
      piecesJson,
      connectionsJson,
      assemblyConfigurationJson,
      assemblySequenceJson,
      validationReportJson,
    };
  }
}
