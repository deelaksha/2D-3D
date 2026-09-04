/**
 * Dataset Example Builder with Provenance Anchor (Phase 61).
 *
 * Implements Stage 9: DATASET EXAMPLE.
 * Converts validated Canonical IR into a standard CompleteDatasetItem
 * retaining complete end-to-end provenance and immutable raw-data references.
 */
import type { Vec2, Vec3 } from "@/core/model/types";
import { shapeOutline } from "@/core/geometry";
import type { CanonicalPuzzle, CanonicalPiece, CanonicalInterface, CanonicalConnection } from "../canonical/types";
import type {
  PieceExample,
  InterfaceExample,
  ConnectionExample,
  AssemblyExample,
  ConstraintExample,
  ValidationExample,
} from "../training/types";
import type {
  IngestionProvenance,
  IngestionQualityStatus,
  RawDataReference,
  RealDatasetExample,
  TriStageValidationResult,
} from "./types";

export const PIPELINE_SCHEMA_VERSION = "1.0.0";
export const PIPELINE_GEOMETRY_VERSION = "1.0.0";
export const PIPELINE_PROCESSING_VERSION = "61.0.0";

export class DatasetExampleBuilder {
  /**
   * Builds a production-grade RealDatasetExample with full provenance.
   */
  static buildExample(
    puzzle: CanonicalPuzzle,
    rawRef: RawDataReference,
    triStageResult: TriStageValidationResult,
    qualityStatus: IngestionQualityStatus,
    options?: {
      userPrompt?: string;
      targetDifficulty?: "easy" | "medium" | "hard" | "expert";
    }
  ): RealDatasetExample {
    const importTimestamp = new Date().toISOString();
    const sourceId = `src_${rawRef.detectedFormat.toLowerCase()}_${rawRef.sha256.slice(0, 10)}`;

    const provenance: IngestionProvenance = {
      source_file: rawRef.sourceFile,
      source_id: sourceId,
      source_version: rawRef.sha256,
      import_timestamp: importTimestamp,
      schema_version: PIPELINE_SCHEMA_VERSION,
      geometry_version: PIPELINE_GEOMETRY_VERSION,
      processing_version: PIPELINE_PROCESSING_VERSION,
      raw_ref: rawRef,
    };

    // 1. Segmentation contours & Pieces
    const segmentationContours: Record<string, Vec2[]> = {};
    const pieceSolids3D: Record<string, { min: Vec3; max: Vec3 }> = {};
    const pieces: PieceExample[] = [];

    const rawPieces = puzzle.pieces || [];
    for (const p of rawPieces) {
      const width = p.dimensions?.width || (p as any).designParameters?.widthMm || 100;
      const height = p.dimensions?.height || (p as any).designParameters?.heightMm || 100;
      const thickness = p.thickness || p.dimensions?.depth || (p as any).designParameters?.thicknessMm || 3.0;

      let loop: Vec2[] = [];
      if ((p as any).localPolygon2D && Array.isArray((p as any).localPolygon2D)) {
        loop = (p as any).localPolygon2D;
      } else if ((p as any).localOutline && Array.isArray((p as any).localOutline)) {
        loop = (p as any).localOutline;
      } else if (p.geometryRef?.contour) {
        try {
          const loops = shapeOutline(p.geometryRef.contour);
          if (loops && loops.length > 0 && loops[0].length > 0) {
            loop = loops[0];
          }
        } catch {
          // ignore
        }
      }

      if (loop.length < 3) {
        loop = [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: height },
          { x: 0, y: height },
        ];
      }

      segmentationContours[p.id] = loop;

      pieceSolids3D[p.id] = {
        min: { x: -width / 2, y: -height / 2, z: -thickness / 2 },
        max: { x: width / 2, y: height / 2, z: thickness / 2 },
      };

      pieces.push({
        pieceId: p.id,
        name: p.name || `Piece ${p.id}`,
        designParameters: {
          widthMm: width,
          heightMm: height,
          thicknessMm: thickness,
          tabWidthMm: (p as any).designParameters?.tabWidthMm,
          tabDepthMm: (p as any).designParameters?.tabDepthMm,
        },
        localPolygon2D: loop,
        localSolid3DBounds: pieceSolids3D[p.id],
      });
    }

    // 2. Interfaces
    const interfaces: InterfaceExample[] = [];
    const rawInterfaces = puzzle.interfaces || [];
    const ifList: CanonicalInterface[] = Array.isArray(rawInterfaces)
      ? rawInterfaces
      : Object.values(rawInterfaces);

    for (const iface of ifList) {
      interfaces.push({
        interfaceId: iface.id,
        owningPieceId: iface.owningPieceId,
        interfaceType: (iface.interfaceType as any) || "tab",
        genderRole: (iface.genderRole as any) || "insert",
        profileWidthMm: iface.profile?.width || 20,
        profileDepthMm: iface.profile?.depth || 5,
        localFrame: {
          origin: { x: iface.frame?.origin?.x ?? 0, y: iface.frame?.origin?.y ?? 0, z: iface.frame?.origin?.z ?? 0 },
          tangent: { x: 1, y: 0, z: 0 },
          normal: { x: iface.frame?.normal?.x ?? 0, y: iface.frame?.normal?.y ?? -1, z: 0 },
          binormal: { x: 0, y: 0, z: -1 },
        },
      });
    }

    // 3. Connections
    const connections: ConnectionExample[] = [];
    const rawConns = puzzle.connections || [];
    for (const c of rawConns) {
      connections.push({
        connectionId: c.id,
        interfaceAId: c.interfaceAId,
        interfaceBId: c.interfaceBId,
        connectionType: c.connectionType || "tab_slot",
        joiningAngleDeg:
          c.allowedAngleRange?.targetAngleDeg ??
          (c as any).assemblyParameters?.joiningAngleDeg ??
          90.0,
      });
    }

    // 4. Assembly & Transforms
    const pieceTransforms: Record<string, { position: Vec3; rotationQuaternion: { x: number; y: number; z: number; w: number } }> = {};
    const rawPlacements = (puzzle as any).placements || (puzzle as any).assembly?.pieceTransforms || {};

    for (const p of rawPieces) {
      const plc = rawPlacements[p.id];
      if (plc && plc.position) {
        pieceTransforms[p.id] = {
          position: { x: plc.position.x || 0, y: plc.position.y || 0, z: plc.position.z || 0 },
          rotationQuaternion: plc.rotationQuaternion || { x: 0, y: 0, z: 0, w: 1 },
        };
      } else {
        pieceTransforms[p.id] = {
          position: { x: 0, y: 0, z: 0 },
          rotationQuaternion: { x: 0, y: 0, z: 0, w: 1 },
        };
      }
    }

    const assemblySequence = rawPieces.map((p, idx) => ({
      stepNumber: idx + 1,
      addedPieceId: p.id,
      subAssemblyStateLabel: rawPieces.slice(0, idx + 1).map((x) => x.id).join(" + "),
    }));

    const assembly: AssemblyExample = {
      pieceTransforms,
      assemblySequence,
    };

    // 5. Constraints
    const constraints: ConstraintExample[] = [];
    for (const c of connections) {
      constraints.push({
        constraintId: `const_${c.connectionId}`,
        constraintType: "angle",
        severity: "HARD",
        parameters: { joiningAngleDeg: c.joiningAngleDeg },
      });
    }

    // 6. Validation Summary
    const validation: ValidationExample = {
      isValid: triStageResult.isValid,
      overallScore: triStageResult.overallScore,
      domainSummaries: {
        structural: {
          isValid: triStageResult.geometry.isValid,
          errorCount: triStageResult.geometry.errors.length,
          warningCount: triStageResult.geometry.warnings.length,
        },
        geometric: {
          isValid: triStageResult.geometry.isValid,
          errorCount: triStageResult.geometry.errors.length,
          warningCount: triStageResult.geometry.warnings.length,
        },
        connection: {
          isValid: triStageResult.connection.isValid,
          errorCount: triStageResult.connection.errors.length,
          warningCount: triStageResult.connection.warnings.length,
        },
        manufacturing: {
          isValid: true,
          errorCount: 0,
          warningCount: 0,
        },
        assembly: {
          isValid: triStageResult.assembly.isValid,
          errorCount: triStageResult.assembly.errors.length,
          warningCount: triStageResult.assembly.warnings.length,
        },
      },
    };

    const itemId = `ds_item_${rawRef.detectedFormat.toLowerCase()}_${rawRef.sha256.slice(0, 8)}`;

    return {
      itemId,
      version: "1.0.0",
      metadata: {
        createdAt: importTimestamp,
        license: "Proprietary / Synthetic Test",
      },
      userRequirement: {
        prompt: options?.userPrompt || `Ingested design from real file: ${rawRef.sourceFile}`,
        targetDifficulty: options?.targetDifficulty || "easy",
      },
      source2DDrawingPath: rawRef.sourceFile,
      segmentationContours,
      pieces,
      interfaces,
      connections,
      puzzle: {
        puzzleId: puzzle.metadata?.id || `puz_${rawRef.sha256.slice(0, 8)}`,
        name: puzzle.metadata?.name || `Ingested Puzzle (${rawRef.sourceFile})`,
        materialSpecification: {
          stockWidthMm: 600,
          stockHeightMm: 400,
          thicknessMm: pieces[0]?.designParameters.thicknessMm || 3.0,
          materialId: "cardboard-stock",
        },
      },
      pieceSolids3D,
      assembly,
      constraints,
      validation,
      failureReasons: triStageResult.failureReasons,
      repairedDirectives: [],
      provenance,
      qualityStatus,
      qualitySummary: {
        status: qualityStatus,
        score: triStageResult.overallScore,
        failureReasons: triStageResult.failureReasons,
        reviewReasons: triStageResult.reviewReasons,
        geometryValid: triStageResult.geometry.isValid,
        connectionValid: triStageResult.connection.isValid,
        assemblyValid: triStageResult.assembly.isValid,
      },
    };
  }
}
