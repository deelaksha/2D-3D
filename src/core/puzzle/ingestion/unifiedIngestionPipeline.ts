/**
 * Unified Ingestion Pipeline Master Orchestrator.
 * Connects FileTypeDetector, DrawingImporter, GeometryImporter, CADImporter, and PuzzleImporter
 * into a single normalized pipeline producing CanonicalPuzzle IR outputs.
 */
import type { ImportResult, NormalizedRepresentation, RawFilePayload } from "./types";
import { ImportDiagnostics } from "./diagnostics";
import { FileTypeDetector } from "./fileTypeDetector";
import { DrawingImporter } from "./drawingImporter";
import { GeometryImporter } from "./geometryImporter";
import { CADImporter } from "./cadImporter";
import { PuzzleImporter } from "./puzzleImporter";
import { InterfaceDetector } from "../reconstruction/interfaceDetector";
import { ConnectionInferencer } from "../reconstruction/connectionInferencer";
import { ParametricExtractor } from "../reconstruction/parametricExtractor";
import { CanonicalConverter2D } from "../reconstruction/canonicalConverter2D";
import type { DetectedInterfacePort } from "../reconstruction/types";

export class UnifiedIngestionPipeline {
  /**
   * Main entrypoint: Ingests an input file and produces a CanonicalPuzzle IR result.
   */
  static importFile(payload: RawFilePayload): ImportResult {
    const startTime = Date.now();
    const diagnostics = new ImportDiagnostics();

    diagnostics.info("INGEST_START", `Starting ingestion for file '${payload.filename}'.`);

    // 1. File Type Detection
    const detectedType = FileTypeDetector.detect(payload);
    diagnostics.info("TYPE_DETECTED", `Detected file type '${detectedType}' for '${payload.filename}'.`);

    if (detectedType === "unknown") {
      diagnostics.error("UNSUPPORTED_FORMAT", `File format of '${payload.filename}' is unsupported or corrupted.`);
      return {
        success: false,
        sourceFilename: payload.filename,
        detectedFileType: "unknown",
        diagnostics,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      let normalized: NormalizedRepresentation;
      let canonicalPuzzle: any = null;

      // 2. Parser Selection & Execution
      switch (detectedType) {
        case "png":
        case "jpg":
          normalized = DrawingImporter.importDrawing(payload, diagnostics);
          break;
        case "svg":
        case "dxf":
          normalized = GeometryImporter.importGeometry(payload, detectedType, diagnostics);
          break;
        case "step":
        case "stl":
        case "obj":
          normalized = CADImporter.importCAD(payload, detectedType, diagnostics);
          break;
        case "json":
        case "project_json":
        case "canonical_json":
          const imported = PuzzleImporter.importPuzzle(payload, detectedType, diagnostics);
          normalized = imported.normalized;
          canonicalPuzzle = imported.puzzle;
          break;
        default:
          diagnostics.error("UNSUPPORTED_FORMAT", `No importer handler for format '${detectedType}'.`);
          return {
            success: false,
            sourceFilename: payload.filename,
            detectedFileType: detectedType,
            diagnostics,
            durationMs: Date.now() - startTime,
          };
      }

      // 3. Map NormalizedRepresentation to CanonicalPuzzle IR if not already produced directly by PuzzleImporter
      if (!canonicalPuzzle) {
        diagnostics.info("CANONICAL_MAPPING_START", `Mapping NormalizedRepresentation to CanonicalPuzzle IR.`);
        canonicalPuzzle = this.mapNormalizedToCanonicalIR(payload.filename, normalized);
        diagnostics.info("CANONICAL_MAPPING_COMPLETE", `Produced CanonicalPuzzle with ${canonicalPuzzle.pieces.length} piece(s).`);
      }

      const durationMs = Date.now() - startTime;
      const success = !diagnostics.hasErrors();

      return {
        success,
        sourceFilename: payload.filename,
        detectedFileType: detectedType,
        puzzle: canonicalPuzzle,
        normalized,
        diagnostics,
        durationMs,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.error("INGESTION_FAILED", `Ingestion pipeline failed for '${payload.filename}': ${msg}`);
      return {
        success: false,
        sourceFilename: payload.filename,
        detectedFileType: detectedType,
        diagnostics,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Converts a NormalizedRepresentation into a standard CanonicalPuzzle IR.
   */
  private static mapNormalizedToCanonicalIR(filename: string, normalized: NormalizedRepresentation) {
    const puzzleId = `puz_${normalized.sourceFilename.replace(/[^a-zA-Z0-9]/g, "_")}`;

    const portsByPiece = new Map<string, DetectedInterfacePort[]>();
    for (const p of normalized.segmentedPieces) {
      portsByPiece.set(p.pieceId, InterfaceDetector.detectInterfaces(p));
    }

    const connections = ConnectionInferencer.inferConnections(portsByPiece, 45.0);
    const features = ParametricExtractor.extractFeatures(normalized.segmentedPieces, portsByPiece, connections);

    return CanonicalConverter2D.convertToCanonicalIR(
      puzzleId,
      normalized.segmentedPieces,
      portsByPiece,
      connections,
      features
    );
  }
}
