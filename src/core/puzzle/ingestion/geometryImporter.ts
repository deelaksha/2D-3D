/**
 * Geometry Importer.
 * Handles 2D vector CAD polylines (DXF, SVG), repairing gaps, normalizing scale, and extracting piece contours.
 */
import type { ImportDiagnostics } from "./diagnostics";
import type { DetectedFileType, NormalizedRepresentation, RawFilePayload } from "./types";
import { RealFileLoader } from "./realFileLoader";
import { DrawingNormalizer } from "./drawingNormalizer";
import { GeometryExtractor2D } from "./geometryExtractor2D";
import { PieceSegmenter } from "./pieceSegmenter";

export class GeometryImporter {
  /**
   * Imports 2D geometry vector files (DXF, SVG).
   */
  static importGeometry(
    payload: RawFilePayload,
    fileType: DetectedFileType,
    diagnostics: ImportDiagnostics
  ): NormalizedRepresentation {
    diagnostics.info("GEOM_IMPORT_START", `Parsing 2D vector CAD geometry '${payload.filename}' [${fileType}].`);

    try {
      const ingested = RealFileLoader.loadFile({
        filename: payload.filename,
        format: fileType === "dxf" ? "dxf" : "svg",
        content: payload.content,
      });

      diagnostics.info("GEOM_LOADED", `Loaded ${ingested.paths.length} raw polyline path(s).`);

      const normalized = DrawingNormalizer.normalize(ingested);

      // Check if open polylines require gap closing repair
      let closedCount = 0;
      for (const p of normalized.paths) {
        if (!p.closed && p.points.length >= 3) {
          const first = p.points[0];
          const last = p.points[p.points.length - 1];
          const dist = Math.hypot(first.x - last.x, first.y - last.y);
          if (dist > 0 && dist <= 0.5) {
            p.closed = true;
            closedCount++;
          }
        }
      }

      if (closedCount > 0) {
        diagnostics.warning("GAPS_REPAIRED", `Automatically closed ${closedCount} polyline gap(s) within 0.5mm tolerance.`);
      }

      const contours = GeometryExtractor2D.extractContours(normalized);
      const segmentedPieces = PieceSegmenter.segmentPieces(contours, 3.0);

      diagnostics.info("GEOM_SEGMENTED", `Extracted ${contours.length} contour(s) into ${segmentedPieces.length} piece(s).`);

      return {
        sourceFilename: payload.filename,
        detectedFileType: fileType,
        units: "mm",
        scaleToMmFactor: ingested.scaleToMmFactor,
        yAxisOrientation: fileType === "svg" ? "y_down" : "y_up",
        contours,
        segmentedPieces,
        estimatedMaterialThicknessMm: 3.0,
        metadata: { pathCount: normalized.paths.length },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.error("GEOM_PARSE_ERROR", `Failed to parse 2D vector CAD geometry: ${msg}`);
      throw err;
    }
  }
}
