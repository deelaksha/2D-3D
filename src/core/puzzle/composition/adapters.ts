/**
 * Real & Synthetic Data Adapters (Phase 64).
 *
 * Unifies Real and Synthetic data into CompositeDatasetExample objects while
 * strictly enforcing origin tracking and ground-truth boundary isolation.
 */
import type { SyntheticGeneratedExample } from "../generator/types";
import type { RealDatasetExample } from "../realdata/types";
import type { VersionedDatasetExample } from "../datasetversioning/types";
import type { CompositeDatasetExample } from "./types";
import { FeatureClassifier } from "./featureClassifier";

export class DataOriginAdapter {
  /**
   * Adapts a Real Dataset Example into a CompositeDatasetExample.
   * STRICT: origin = "REAL", isGroundTruth = true (for verified real data).
   */
  static fromRealExample(
    realExample: RealDatasetExample | VersionedDatasetExample,
    split: "train" | "validation" | "test" | "unassigned" = "unassigned"
  ): CompositeDatasetExample {
    const samplingDimensions = FeatureClassifier.classify(realExample);

    const versionMetadata = (realExample as VersionedDatasetExample).versionMetadata || {
      example_id: realExample.itemId,
      schema_version: "1.0.0",
      dataset_version: "v1.0.0",
      source_version: realExample.provenance?.source_version || "real_source_hash",
      annotation_version: realExample.qualityStatus === "PASS" ? "APPROVED" : "PENDING",
      geometry_version: "1.0.0",
      validation_version: "1.0.0",
    };

    return {
      ...realExample,
      split,
      versionMetadata,
      origin: "REAL",
      isGroundTruth: realExample.qualityStatus === "PASS",
      samplingDimensions,
    };
  }

  /**
   * Adapts a Synthetic Generator Example into a CompositeDatasetExample.
   * CRITICAL SECURITY RULE:
   * origin = "SYNTHETIC", isGroundTruth = false.
   * Synthetic data is NEVER marked as ground truth.
   */
  static fromSyntheticExample(
    synth: SyntheticGeneratedExample,
    split: "train" | "validation" | "test" | "unassigned" = "unassigned",
    datasetVersion = "v1.0.0-synthetic"
  ): CompositeDatasetExample {
    const puzzle = synth.canonicalPuzzle;
    const pieces = (puzzle.pieces || []).map((p) => {
      const w = p.dimensions?.width || 100;
      const h = p.dimensions?.height || 100;
      const t = p.thickness || 3.0;
      return {
        pieceId: p.id,
        name: p.name,
        designParameters: {
          widthMm: w,
          heightMm: h,
          thicknessMm: t,
          tabWidthMm: 20,
          tabDepthMm: 5,
        },
        localPolygon2D: (p as any).localPolygon2D || [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ],
        localSolid3DBounds: {
          min: { x: -w / 2, y: -h / 2, z: -t / 2 },
          max: { x: w / 2, y: h / 2, z: t / 2 },
        },
      };
    });

    const interfaces = (puzzle.interfaces || []).map((iface) => ({
      interfaceId: iface.id,
      owningPieceId: iface.owningPieceId,
      interfaceType: (iface.interfaceType as any) || "tab",
      genderRole: (iface.genderRole as any) || "insert",
      profileWidthMm: iface.profile?.width || 20,
      profileDepthMm: iface.profile?.depth || 5,
      localFrame: {
        origin: { x: 0, y: 0, z: 0 },
        tangent: { x: 1, y: 0, z: 0 },
        normal: { x: 0, y: -1, z: 0 },
        binormal: { x: 0, y: 0, z: -1 },
      },
    }));

    const connections = (puzzle.connections || []).map((c) => ({
      connectionId: c.id,
      interfaceAId: c.interfaceAId,
      interfaceBId: c.interfaceBId,
      connectionType: c.connectionType || "tab_slot",
      joiningAngleDeg: c.assemblyParameters?.joiningAngleDeg ?? 90.0,
    }));

    const failureType = synth.isValid ? "none" : synth.invalidityReason || "synthetic_invalid";

    const baseExample: RealDatasetExample = {
      itemId: synth.exampleId,
      version: "1.0.0",
      metadata: {
        createdAt: new Date().toISOString(),
        license: "Proprietary / Synthetic Test",
      },
      userRequirement: {
        prompt: `Synthetic puzzle (seed=${synth.seed}) with ${pieces.length} pieces.`,
        targetDifficulty: pieces.length > 3 ? "hard" : "easy",
      },
      source2DDrawingPath: `synthetic://seed_${synth.seed}`,
      segmentationContours: {},
      pieces,
      interfaces,
      connections,
      puzzle: {
        puzzleId: puzzle.metadata.id,
        name: puzzle.metadata.name,
        materialSpecification: {
          stockWidthMm: 600,
          stockHeightMm: 400,
          thicknessMm: pieces[0]?.designParameters.thicknessMm || 3.0,
          materialId: "cardboard-stock",
        },
      },
      pieceSolids3D: {},
      assembly: {
        pieceTransforms: {},
        assemblySequence: pieces.map((p, idx) => ({
          stepNumber: idx + 1,
          addedPieceId: p.pieceId,
          subAssemblyStateLabel: `Step ${idx + 1}`,
        })),
      },
      constraints: [],
      validation: {
        isValid: synth.isValid,
        overallScore: synth.isValid ? 1.0 : 0.0,
        domainSummaries: {
          structural: { isValid: synth.isValid, errorCount: synth.isValid ? 0 : 1, warningCount: 0 },
          geometric: { isValid: synth.isValid, errorCount: synth.isValid ? 0 : 1, warningCount: 0 },
          connection: { isValid: synth.isValid, errorCount: synth.isValid ? 0 : 1, warningCount: 0 },
          manufacturing: { isValid: true, errorCount: 0, warningCount: 0 },
          assembly: { isValid: synth.isValid, errorCount: synth.isValid ? 0 : 1, warningCount: 0 },
        },
      },
      failureReasons: synth.isValid ? [] : [failureType],
      repairedDirectives: [],
      provenance: {
        source_file: `synthetic://seed_${synth.seed}`,
        source_id: `src_synth_${synth.seed}`,
        source_version: `seed_${synth.seed}`,
        import_timestamp: new Date().toISOString(),
        schema_version: "1.0.0",
        geometry_version: "1.0.0",
        processing_version: "64.0.0",
        raw_ref: {
          rawId: `raw_synth_${synth.seed}`,
          sourceFile: `synthetic_seed_${synth.seed}`,
          sha256: `synthetic_seed_sha256_${synth.seed}`,
          sizeBytes: 1024,
          detectedFormat: "JSON",
          createdAt: new Date().toISOString(),
          mimeType: "application/json",
        },
      },
      qualityStatus: synth.isValid ? "PASS" : "FAIL",
      qualitySummary: {
        status: synth.isValid ? "PASS" : "FAIL",
        score: synth.isValid ? 1.0 : 0.0,
        failureReasons: synth.isValid ? [] : [failureType],
        reviewReasons: [],
        geometryValid: synth.isValid,
        connectionValid: synth.isValid,
        assemblyValid: synth.isValid,
      },
    };

    const samplingDimensions = FeatureClassifier.classify(baseExample);

    return {
      ...baseExample,
      split,
      versionMetadata: {
        example_id: synth.exampleId,
        schema_version: "1.0.0",
        dataset_version: datasetVersion,
        source_version: `synthetic_seed_${synth.seed}`,
        annotation_version: "SYNTHETIC_GENERATED",
        geometry_version: "1.0.0",
        validation_version: "1.0.0",
      },
      origin: "SYNTHETIC",
      isGroundTruth: false, // MANDATORY: NEVER ground truth!
      syntheticSeed: synth.seed,
      samplingDimensions,
    };
  }
}
