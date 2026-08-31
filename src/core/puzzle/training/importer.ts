/**
 * Puzzle Dataset Importer Implementation.
 *
 * Imports CompleteDatasetItem JSON records, validates schema versioning (1.0.0),
 * and reconstructs canonical puzzle models, placements, and assembly graphs.
 */
import type { CompleteDatasetItem, DatasetImporter } from "./types";
import { validateDatasetItem } from "./validator";
import { createEmptyCanonicalPuzzle } from "../canonical/defaults";
import { PuzzleAssemblyGraph } from "../graph/graph";

export class PuzzleDatasetImporter implements DatasetImporter {
  async importDatasetItem(jsonInput: string): Promise<CompleteDatasetItem> {
    let item: any;
    try {
      item = typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
    } catch (err: any) {
      throw new Error(`Failed to parse dataset item JSON: ${err.message}`);
    }

    const report = validateDatasetItem(item);
    if (!report.isValid) {
      throw new Error(`Dataset Item Schema Validation Failed: ${report.errors.join("; ")}`);
    }

    return item as CompleteDatasetItem;
  }

  async reconstructCanonicalPuzzle(item: CompleteDatasetItem): Promise<{
    puzzle: any;
    placements: Record<string, any>;
    graph: PuzzleAssemblyGraph;
  }> {
    const puzzle = createEmptyCanonicalPuzzle(item.puzzle.name);
    puzzle.metadata.id = item.puzzle.puzzleId;

    const graph = new PuzzleAssemblyGraph();

    // Reconstruct Canonical Pieces from DESIGN PARAMETERS
    for (const pEx of item.pieces) {
      puzzle.pieces.push({
        id: pEx.pieceId,
        name: pEx.name,
        geometryRef: {
          contour: {
            kind: "rect",
            x: 0,
            y: 0,
            width: pEx.designParameters.widthMm,
            height: pEx.designParameters.heightMm,
            rotation: 0,
          },
        },
        dimensions: {
          width: pEx.designParameters.widthMm,
          height: pEx.designParameters.heightMm,
          depth: pEx.designParameters.thicknessMm,
        },
        thickness: pEx.designParameters.thicknessMm,
        materialId: item.puzzle.materialSpecification.materialId,
        interfaceIds: [],
        localFrame: {
          origin: { x: 0, y: 0, z: 0 },
          tangent: { x: 1, y: 0, z: 0 },
          normal: { x: 0, y: -1, z: 0 },
          binormal: { x: 0, y: 0, z: -1 },
        },
        manufacturingParameters: { kerf: 0.1, grainAngleDeg: 0 },
      });

      graph.addPieceNode(pEx.pieceId);
    }

    // Reconstruct Canonical Interfaces
    for (const ifEx of item.interfaces) {
      puzzle.interfaces.push({
        id: ifEx.interfaceId,
        owningPieceId: ifEx.owningPieceId,
        name: `Interface ${ifEx.interfaceId}`,
        edgeGeometry: { edgeIndex: 0, parametricStart: 0.4, parametricEnd: 0.6, length: ifEx.profileWidthMm },
        interfaceType: ifEx.interfaceType === "tab" ? "tab" : "slot",
        profile: { profileKind: ifEx.interfaceType, width: ifEx.profileWidthMm, depth: ifEx.profileDepthMm, clearance: 0.1 },
        compatibility: { allowedTypes: ["tab", "slot"], genderRole: ifEx.genderRole, complementaryPatterns: [] },
        localFrame: ifEx.localFrame,
        tolerance: 0.1,
        allowedDOF: { translation: { x: false, y: false, z: false }, rotation: { rx: false, ry: false, rz: false } },
      });
    }

    // Reconstruct Connections & ASSEMBLY PARAMETER Joining Angles
    for (const cEx of item.connections) {
      puzzle.connections.push({
        id: cEx.connectionId,
        interfaceAId: cEx.interfaceAId,
        interfaceBId: cEx.interfaceBId,
        connectionType: (cEx.connectionType || "tab_slot") as any,
        compatibilityRules: { requireMatchingProfileWidth: true, maxToleranceDiff: 0.2 },
        allowedRelativeTransform: { positionOffset: { x: 0, y: 0, z: 0 }, rotationQuaternion: { x: 0, y: 0, z: 0, w: 1 } },
        allowedAngleRange: { minAngleDeg: cEx.joiningAngleDeg, maxAngleDeg: cEx.joiningAngleDeg, targetAngleDeg: cEx.joiningAngleDeg },
        clearance: 0.0,
        constraintIds: [],
      });
    }

    // Reconstruct ASSEMBLY PARAMETERS: Piece 3D Placement Transforms
    const placements: Record<string, any> = {};
    if (item.assembly?.pieceTransforms) {
      for (const [pieceId, xform] of Object.entries(item.assembly.pieceTransforms)) {
        placements[pieceId] = {
          pieceId,
          transform: {
            translation: xform.position,
            rotation: xform.rotationQuaternion,
          },
        };
      }
    }

    return {
      puzzle,
      placements,
      graph,
    };
  }
}
