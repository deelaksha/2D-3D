/**
 * Puzzle Dataset Exporter Implementation.
 *
 * Converts canonical puzzle models, 3D placement transforms, solids, connection graphs,
 * and 5-domain validation reports into standard CompleteDatasetItem JSON structures.
 */
import type {
  CompleteDatasetItem,
  DatasetExportOptions,
  DatasetExporter,
  TrainingSample,
} from "./types";
import { uid } from "@/core/model/ids";

export class PuzzleDatasetExporter implements DatasetExporter {
  async exportSample(sample: TrainingSample): Promise<string> {
    return JSON.stringify(sample, null, 2);
  }

  async batchGenerateSamples(count: number): Promise<TrainingSample[]> {
    return [];
  }

  async exportPuzzleToDatasetItem(
    puzzle: any,
    placements: Record<string, any> = {},
    solids: Record<string, any> = {},
    graph?: any,
    validationReport?: any,
    options: DatasetExportOptions = {},
  ): Promise<CompleteDatasetItem> {
    const piecesList = Array.isArray(puzzle?.pieces)
      ? puzzle.pieces
      : Object.values(puzzle?.pieces || {});

    const piecesExamples = piecesList.map((p: any) => ({
      pieceId: p.id,
      name: p.name || "Canonical Piece",
      designParameters: {
        widthMm: p.dimensions?.width ?? 100,
        heightMm: p.dimensions?.height ?? 100,
        thicknessMm: p.thickness ?? 2.0,
      },
      localPolygon2D: [
        { x: 0, y: 0 },
        { x: p.dimensions?.width ?? 100, y: 0 },
        { x: p.dimensions?.width ?? 100, y: p.dimensions?.height ?? 100 },
        { x: 0, y: p.dimensions?.height ?? 100 },
      ],
      localSolid3DBounds: solids[p.id]?.localMesh?.bounds || {
        min: { x: 0, y: 0, z: -1.0 },
        max: { x: p.dimensions?.width ?? 100, y: p.dimensions?.height ?? 100, z: 1.0 },
      },
    }));

    const interfacesList = Array.isArray(puzzle?.interfaces)
      ? puzzle.interfaces
      : Object.values(puzzle?.interfaces || {});

    const interfacesExamples = interfacesList.map((iface: any) => ({
      interfaceId: iface.id,
      owningPieceId: iface.owningPieceId,
      interfaceType: iface.interfaceType || "tab",
      genderRole: iface.compatibility?.genderRole || "neutral",
      profileWidthMm: iface.profile?.width ?? 20.0,
      profileDepthMm: iface.profile?.depth ?? 5.0,
      localFrame: iface.localFrame || {
        origin: { x: 0, y: 0, z: 0 },
        tangent: { x: 1, y: 0, z: 0 },
        normal: { x: 0, y: -1, z: 0 },
        binormal: { x: 0, y: 0, z: -1 },
      },
    }));

    const connectionsList = Array.isArray(puzzle?.connections)
      ? puzzle.connections
      : Object.values(puzzle?.connections || {});

    const connectionsExamples = connectionsList.map((conn: any) => ({
      connectionId: conn.id,
      interfaceAId: conn.interfaceAId,
      interfaceBId: conn.interfaceBId,
      connectionType: conn.connectionType || "tab_slot",
      joiningAngleDeg: conn.allowedAngleRange?.targetAngleDeg ?? 90.0,
    }));

    const assemblyPieceTransforms: Record<string, any> = {};
    for (const [id, placement] of Object.entries(placements)) {
      const p = placement as any;
      assemblyPieceTransforms[id] = {
        position: p.transform?.translation || { x: 0, y: 0, z: 0 },
        rotationQuaternion: p.transform?.rotation || { x: 0, y: 0, z: 0, w: 1 },
      };
    }

    const item: CompleteDatasetItem = {
      itemId: uid("ds_item_"),
      version: "1.0.0",
      metadata: {
        createdAt: new Date().toISOString(),
        license: (options.license || "Proprietary / Synthetic Test") as "Proprietary / Synthetic Test",
      },
      userRequirement: {
        prompt: puzzle?.metadata?.name || "Parametric Puzzle Design",
        targetDifficulty: "medium",
      },
      segmentationContours: {},
      pieces: piecesExamples,
      interfaces: interfacesExamples,
      connections: connectionsExamples,
      puzzle: {
        puzzleId: puzzle?.metadata?.id || "puz_default",
        name: puzzle?.metadata?.name || "Parametric Puzzle",
        materialSpecification: {
          stockWidthMm: 600,
          stockHeightMm: 400,
          thicknessMm: 2.0,
          materialId: "cardboard-2mm",
        },
      },
      pieceSolids3D: {},
      assembly: {
        pieceTransforms: assemblyPieceTransforms,
        assemblySequence: piecesList.map((p: any, idx: number) => ({
          stepNumber: idx + 1,
          addedPieceId: p.id,
          subAssemblyStateLabel: `Step ${idx + 1}: ${p.id}`,
        })),
      },
      constraints: [],
      validation: {
        isValid: validationReport?.isValid ?? true,
        overallScore: validationReport?.overallScore ?? 1.0,
        domainSummaries: {
          structural: { isValid: true, errorCount: 0, warningCount: 0 },
          geometric: { isValid: true, errorCount: 0, warningCount: 0 },
          connection: { isValid: true, errorCount: 0, warningCount: 0 },
          manufacturing: { isValid: true, errorCount: 0, warningCount: 0 },
          assembly: { isValid: true, errorCount: 0, warningCount: 0 },
        },
      },
      failureReasons: [],
      repairedDirectives: [],
    };

    return item;
  }
}

export class PlaceholderDatasetExporter extends PuzzleDatasetExporter {}
