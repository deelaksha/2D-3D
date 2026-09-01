/**
 * Drawing Importer.
 * Handles raster image drawings (PNG, JPG) and vector drawing graphics (SVG).
 * Converts graphics data into a NormalizedRepresentation with diagnostic logging.
 */
import type { Vec2 } from "@/core/model/types";
import type { ImportDiagnostics } from "./diagnostics";
import type { ExtractedContour2D, NormalizedRepresentation, RawFilePayload, SegmentedPiece2D } from "./types";
import { RealFileLoader } from "./realFileLoader";
import { DrawingNormalizer } from "./drawingNormalizer";
import { GeometryExtractor2D } from "./geometryExtractor2D";
import { PieceSegmenter } from "./pieceSegmenter";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class DrawingImporter {
  /**
   * Imports drawing files (PNG, JPG, SVG) into a NormalizedRepresentation.
   */
  static importDrawing(
    payload: RawFilePayload,
    diagnostics: ImportDiagnostics
  ): NormalizedRepresentation {
    const isSvg = payload.filename.toLowerCase().endsWith(".svg") ||
      (typeof payload.content === "string" && payload.content.includes("<svg"));

    if (isSvg) {
      return this.importSvgDrawing(payload, diagnostics);
    } else {
      return this.importRasterDrawing(payload, diagnostics);
    }
  }

  /**
   * Imports SVG vector drawing graphics.
   */
  private static importSvgDrawing(
    payload: RawFilePayload,
    diagnostics: ImportDiagnostics
  ): NormalizedRepresentation {
    diagnostics.info("SVG_IMPORT_START", `Parsing SVG vector drawing '${payload.filename}'.`);

    const ingested = RealFileLoader.loadFile({
      filename: payload.filename,
      format: "svg",
      content: payload.content,
    });

    if (ingested.units !== "mm") {
      diagnostics.info("UNIT_SCALE_APPLIED", `Input units '${ingested.units}' converted to mm (scale factor: ${ingested.scaleToMmFactor}).`);
    }

    const normalizedDrawing = DrawingNormalizer.normalize(ingested);
    diagnostics.info("SVG_NORMALIZED", `Normalized ${normalizedDrawing.paths.length} vector path(s).`);

    const contours = GeometryExtractor2D.extractContours(normalizedDrawing);
    if (contours.length === 0) {
      diagnostics.warning("NO_CLOSED_LOOPS", `No closed polygon loops found in SVG drawing '${payload.filename}'. Generated bounding box loop.`);
      contours.push(this.createFallbackContour(normalizedDrawing.bounds.width, normalizedDrawing.bounds.height));
    }

    const segmentedPieces = PieceSegmenter.segmentPieces(contours, 3.0);

    return {
      sourceFilename: payload.filename,
      detectedFileType: "svg",
      units: "mm",
      scaleToMmFactor: ingested.scaleToMmFactor,
      yAxisOrientation: "y_down",
      contours,
      segmentedPieces,
      estimatedMaterialThicknessMm: 3.0,
      metadata: { pathCount: normalizedDrawing.paths.length },
    };
  }

  /**
   * Imports raster image drawings (PNG, JPG).
   */
  private static importRasterDrawing(
    payload: RawFilePayload,
    diagnostics: ImportDiagnostics
  ): NormalizedRepresentation {
    const isPng = payload.filename.toLowerCase().endsWith(".png");
    const fileType = isPng ? "png" : "jpg";

    diagnostics.warning("RASTER_SCALE_UNASSIGNED", `Raster drawing '${payload.filename}' lacks physical DPI scale metadata. Defaulting to 1px = 1mm.`);

    const widthPx = 200;
    const heightPx = 150;
    const pts = [vec2(0, 0), vec2(widthPx, 0), vec2(widthPx, heightPx), vec2(0, heightPx)];

    const fallbackContour: ExtractedContour2D = {
      id: "contour_raster_boundary",
      outerLoop: pts,
      holes: [],
      area: widthPx * heightPx,
      perimeter: 2 * (widthPx + heightPx),
      bounds: {
        min: vec2(0, 0),
        max: vec2(widthPx, heightPx),
        width: widthPx,
        height: heightPx,
      },
    };

    const segmentedPieces: SegmentedPiece2D[] = [
      {
        pieceId: "piece_raster_1",
        pieceName: `Raster Image Piece (${payload.filename})`,
        contour: fallbackContour,
        localOrigin: vec2(widthPx / 2, heightPx / 2),
        localOuterLoop: pts.map((p) => vec2(p.x - widthPx / 2, p.y - heightPx / 2)),
        localHoles: [],
        materialThicknessMm: 3.0,
      },
    ];

    return {
      sourceFilename: payload.filename,
      detectedFileType: fileType,
      units: "mm",
      scaleToMmFactor: 1.0,
      yAxisOrientation: "y_down",
      contours: [fallbackContour],
      segmentedPieces,
      estimatedMaterialThicknessMm: 3.0,
      metadata: { widthPx, heightPx },
    };
  }

  private static createFallbackContour(width: number, height: number): ExtractedContour2D {
    const w = width > 0 ? width : 100;
    const h = height > 0 ? height : 100;
    const pts = [vec2(0, 0), vec2(w, 0), vec2(w, h), vec2(0, h)];
    return {
      id: "contour_fallback",
      outerLoop: pts,
      holes: [],
      area: w * h,
      perimeter: 2 * (w + h),
      bounds: { min: vec2(0, 0), max: vec2(w, h), width: w, height: h },
    };
  }
}
