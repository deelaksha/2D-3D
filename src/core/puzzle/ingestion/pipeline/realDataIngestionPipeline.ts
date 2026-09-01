/**
 * Real-Data Ingestion Pipeline Master Orchestrator.
 * Orchestrates the complete 8-stage real-data ingestion pipeline:
 *   [1] Ingest -> [2] Normalize -> [3] Extract Geometry -> [4] Segment Pieces ->
 *   [5] Detect Interfaces -> [6] Infer Connections -> [7] Extract Parameters -> [8] Canonical Puzzle IR
 *
 * Full provenance and traceability back to source drawing file. Zero AI/ML.
 */
import type { RawFilePayload } from "../types";
import type { RealPipelineResult } from "./types";
import { PipelineTraceDiagnostics } from "./diagnostics";
import { UnifiedIngestionPipeline } from "../unifiedIngestionPipeline";
import { GeometryExtractor } from "../geometry/geometryExtractor";
import { PieceSegmenter } from "../segmentation/pieceSegmenter";
import { InterfaceDetector2D } from "../interfaces/interfaceDetector2D";
import { ConnectionInferencer2D } from "../connections/connectionInferencer2D";
import { FeatureExtractor } from "../features/featureExtractor";
import { createCanonicalInterface, createEmptyCanonicalPuzzle } from "../../canonical/defaults";
import type { Detected2DInterface } from "../interfaces/types";
import type { ParametricFeature } from "../features/types";
import type { OrientationConstraint } from "../connections/types";
import type { CanonicalInterface } from "../../canonical/types";

export class RealDataIngestionPipeline {
  /**
   * Executes the full 8-stage Real-Data Ingestion Pipeline over a raw file payload.
   */
  static processDrawing(payload: RawFilePayload): RealPipelineResult {
    const pipelineStartTime = Date.now();
    const trace = new PipelineTraceDiagnostics();

    // ── STAGE 1 & 2: INGEST & NORMALIZE ─────────────────────────
    const t1 = Date.now();
    const importResult = UnifiedIngestionPipeline.importFile(payload);

    trace.addTrace(
      "ingest",
      "FILE_INGESTED",
      `Ingested '${payload.filename}' [${importResult.detectedFileType}].`,
      importResult.success ? "success" : "warning",
      Date.now() - t1
    );

    const normalized = importResult.normalized || {
      sourceFilename: payload.filename,
      detectedFileType: importResult.detectedFileType,
      units: "mm",
      scaleToMmFactor: 1.0,
      yAxisOrientation: "y_up",
      contours: [],
      segmentedPieces: [],
      estimatedMaterialThicknessMm: 3.0,
    };

    trace.addTrace(
      "normalize",
      "DRAWING_NORMALIZED",
      `Normalized scale to mm with ${normalized.contours.length} contour(s).`,
      "success",
      0
    );

    // ── STAGE 3: EXTRACT GEOMETRY ───────────────────────────────
    const t3 = Date.now();
    const geometryResult = GeometryExtractor.extract(normalized);
    trace.addTrace(
      "extract_geometry",
      "GEOMETRY_EXTRACTED",
      `Extracted ${geometryResult.primitives.length} geometric primitive(s) (${geometryResult.validationIssues.length} validation issue(s)).`,
      geometryResult.isValid ? "success" : "warning",
      Date.now() - t3
    );

    // ── STAGE 4: SEGMENT PIECES ─────────────────────────────────
    const t4 = Date.now();
    const segmentationResult = PieceSegmenter.segmentDrawing(normalized);
    trace.addTrace(
      "segment_pieces",
      "PIECES_SEGMENTED",
      `Segmented drawing into ${segmentationResult.pieces.length} piece(s).`,
      "success",
      Date.now() - t4
    );

    // ── STAGE 5: DETECT INTERFACES ──────────────────────────────
    const t5 = Date.now();
    const interfacesByPiece = new Map<string, Detected2DInterface[]>();
    const allInterfaces: Detected2DInterface[] = [];

    for (let i = 0; i < normalized.segmentedPieces.length; i++) {
      const segPiece = normalized.segmentedPieces[i];
      const cPiece = segmentationResult.pieces[i];

      const ifResult = InterfaceDetector2D.detectForPiece(segPiece, cPiece);
      interfacesByPiece.set(segPiece.pieceId, ifResult.interfaces);
      allInterfaces.push(...ifResult.interfaces);
    }

    trace.addTrace(
      "detect_interfaces",
      "INTERFACES_DETECTED",
      `Detected ${allInterfaces.length} interface port(s) across ${segmentationResult.pieces.length} piece(s).`,
      "success",
      Date.now() - t5
    );

    // ── STAGE 6: INFER CONNECTIONS ──────────────────────────────
    const t6 = Date.now();
    const inferenceResult = ConnectionInferencer2D.inferConnections(interfacesByPiece);
    const constraints: OrientationConstraint[] = inferenceResult.candidates
      .filter((c) => c.compatible)
      .map((c) => c.orientationConstraint);

    trace.addTrace(
      "infer_connections",
      "CONNECTIONS_INFERRED",
      `Inferred ${inferenceResult.compatibleCount} compatible connection candidate(s) out of ${inferenceResult.candidates.length} evaluated pair(s).`,
      "success",
      Date.now() - t6
    );

    // ── STAGE 7: EXTRACT PARAMETERS ─────────────────────────────
    const t7 = Date.now();
    const allParameters: ParametricFeature[] = [];
    for (let i = 0; i < normalized.segmentedPieces.length; i++) {
      const segPiece = normalized.segmentedPieces[i];
      const pieceIfaces = interfacesByPiece.get(segPiece.pieceId) || [];

      const featResult = FeatureExtractor.extractFeatures(segPiece, pieceIfaces);
      allParameters.push(...featResult.parameters);
    }

    trace.addTrace(
      "extract_parameters",
      "PARAMETERS_EXTRACTED",
      `Extracted ${allParameters.length} parametric feature(s).`,
      "success",
      Date.now() - t7
    );

    // ── STAGE 8: CANONICAL PUZZLE IR MAPPING ────────────────────
    const t8 = Date.now();
    const puzzleId = `puz_${payload.filename.replace(/[^a-zA-Z0-9]/g, "_")}`;
    const canonicalPuzzle = createEmptyCanonicalPuzzle(`Ingested Puzzle (${payload.filename})`);
    canonicalPuzzle.metadata.id = puzzleId;
    canonicalPuzzle.pieces = segmentationResult.pieces;

    const canonicalInterfaces: CanonicalInterface[] = [];
    for (const c of inferenceResult.canonicalConnections) {
      const ports = allInterfaces.filter((iface) => iface.id === c.interfaceAId || iface.id === c.interfaceBId);
      for (const iface of ports) {
        const cIf = createCanonicalInterface(
          iface.owningPieceId,
          iface.name,
          { x: iface.local2DFrame.origin.x, y: iface.local2DFrame.origin.y },
          { x: iface.local2DFrame.normal.x, y: iface.local2DFrame.normal.y }
        );
        cIf.id = iface.id;
        cIf.interfaceType = iface.canonicalType;
        cIf.profile.width = iface.profile.width;
        cIf.profile.depth = iface.profile.depth;
        canonicalInterfaces.push(cIf);
      }
    }

    canonicalPuzzle.interfaces = canonicalInterfaces;
    canonicalPuzzle.connections = inferenceResult.canonicalConnections;

    trace.addTrace(
      "canonical_mapping",
      "CANONICAL_IR_CONSTRUCTED",
      `Constructed CanonicalPuzzle IR with ${canonicalPuzzle.pieces.length} piece(s), ${canonicalPuzzle.interfaces.length} interface(s), and ${canonicalPuzzle.connections.length} connection(s).`,
      "success",
      Date.now() - t8
    );

    const totalDurationMs = Date.now() - pipelineStartTime;
    const success = !trace.hasErrors();

    return {
      success,
      puzzle: canonicalPuzzle,
      material: {
        materialId: "cardboard_3mm",
        thicknessMm: normalized.estimatedMaterialThicknessMm || 3.0,
      },
      pieces: segmentationResult.pieces,
      geometry: geometryResult,
      interfaces: allInterfaces,
      connections: inferenceResult.candidates,
      parameters: allParameters,
      constraints,
      diagnostics: trace,
      totalDurationMs,
    };
  }
}
