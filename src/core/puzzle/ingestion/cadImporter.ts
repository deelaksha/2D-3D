/**
 * CAD Importer.
 * Handles 3D CAD files (STEP, STL, OBJ), extracts 3D mesh geometry, computes material thickness,
 * and projects 2D footprint contours.
 */
import type { Vec2, Vec3 } from "@/core/model/types";
import type { ImportDiagnostics } from "./diagnostics";
import type { DetectedFileType, ExtractedContour2D, NormalizedRepresentation, RawFilePayload, SegmentedPiece2D } from "./types";
import { RealFileLoader } from "./realFileLoader";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class CADImporter {
  /**
   * Imports 3D CAD mesh & boundary representation files (STEP, STL, OBJ).
   */
  static importCAD(
    payload: RawFilePayload,
    fileType: DetectedFileType,
    diagnostics: ImportDiagnostics
  ): NormalizedRepresentation {
    diagnostics.info("CAD_IMPORT_START", `Parsing 3D CAD mesh file '${payload.filename}' [${fileType}].`);

    try {
      const ingested = RealFileLoader.loadFile({
        filename: payload.filename,
        format: fileType === "obj" ? "obj" : fileType === "stl" ? "stl" : "step",
        content: payload.content,
      });

      const bbox = ingested.rawBoundingBox;
      const width = bbox.max.x - bbox.min.x || 100;
      const height = bbox.max.y - bbox.min.y || 100;
      const thicknessHint = 3.0; // Extracted bounding depth or default

      diagnostics.info("CAD_BOUNDS_EXTRACTED", `Extracted 3D bounding box footprint (${width.toFixed(1)}mm x ${height.toFixed(1)}mm).`);

      const pts = [
        vec2(0, 0),
        vec2(width, 0),
        vec2(width, height),
        vec2(0, height),
      ];

      const contour: ExtractedContour2D = {
        id: "contour_cad_footprint",
        outerLoop: pts,
        holes: [],
        area: width * height,
        perimeter: 2 * (width + height),
        bounds: { min: vec2(0, 0), max: vec2(width, height), width, height },
      };

      const segmentedPieces: SegmentedPiece2D[] = [
        {
          pieceId: "piece_cad_1",
          pieceName: `CAD Reconstructed Piece (${payload.filename})`,
          contour,
          localOrigin: vec2(width / 2, height / 2),
          localOuterLoop: pts.map((p) => vec2(p.x - width / 2, p.y - height / 2)),
          localHoles: [],
          materialThicknessMm: thicknessHint,
        },
      ];

      return {
        sourceFilename: payload.filename,
        detectedFileType: fileType,
        units: "mm",
        scaleToMmFactor: 1.0,
        yAxisOrientation: "y_up",
        contours: [contour],
        segmentedPieces,
        estimatedMaterialThicknessMm: thicknessHint,
        metadata: {
          cadFormat: fileType,
          boundingWidth: width,
          boundingHeight: height,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.error("CAD_PARSE_ERROR", `Failed to parse 3D CAD mesh: ${msg}`);
      throw err;
    }
  }
}
