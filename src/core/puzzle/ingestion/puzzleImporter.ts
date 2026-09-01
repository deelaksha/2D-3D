/**
 * Puzzle Importer.
 * Handles structured JSON payloads (WoodKit Project JSON, CanonicalPuzzle JSON, and JSON manifests).
 */
import type { Vec2 } from "@/core/model/types";
import type { ImportDiagnostics } from "./diagnostics";
import type { CanonicalPiece, CanonicalPuzzle } from "../canonical/types";
import type { DetectedFileType, ExtractedContour2D, NormalizedRepresentation, RawFilePayload, SegmentedPiece2D } from "./types";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../canonical/defaults";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class PuzzleImporter {
  /**
   * Imports JSON puzzle payloads into NormalizedRepresentation and CanonicalPuzzle.
   */
  static importPuzzle(
    payload: RawFilePayload,
    fileType: DetectedFileType,
    diagnostics: ImportDiagnostics
  ): { normalized: NormalizedRepresentation; puzzle: CanonicalPuzzle } {
    diagnostics.info("PUZZLE_IMPORT_START", `Parsing structured JSON payload '${payload.filename}' [${fileType}].`);

    const textContent = typeof payload.content === "string"
      ? payload.content
      : new TextDecoder().decode(payload.content);

    let parsed: any;
    try {
      parsed = JSON.parse(textContent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.error("JSON_PARSE_ERROR", `Invalid JSON syntax in '${payload.filename}': ${msg}`);
      throw new Error(`Invalid JSON syntax in '${payload.filename}': ${msg}`);
    }

    if (fileType === "canonical_json") {
      return this.importCanonicalJson(payload.filename, parsed, diagnostics);
    } else if (fileType === "project_json") {
      return this.importProjectJson(payload.filename, parsed, diagnostics);
    } else {
      return this.importGenericJsonManifest(payload.filename, parsed, diagnostics);
    }
  }

  /**
   * Imports native CanonicalPuzzle JSON.
   */
  private static importCanonicalJson(
    filename: string,
    canonicalData: CanonicalPuzzle,
    diagnostics: ImportDiagnostics
  ): { normalized: NormalizedRepresentation; puzzle: CanonicalPuzzle } {
    diagnostics.info("CANONICAL_JSON_LOADED", `Successfully loaded CanonicalPuzzle '${canonicalData.metadata.id}' with ${canonicalData.pieces.length} piece(s).`);

    const contours: ExtractedContour2D[] = [];
    const segmentedPieces: SegmentedPiece2D[] = [];

    for (const p of canonicalData.pieces) {
      const w = p.dimensions?.width || 100;
      const h = p.dimensions?.height || 100;
      const t = p.thickness || 3.0;

      const pts = [vec2(0, 0), vec2(w, 0), vec2(w, h), vec2(0, h)];
      const contour: ExtractedContour2D = {
        id: `contour_${p.id}`,
        outerLoop: pts,
        holes: [],
        area: w * h,
        perimeter: 2 * (w + h),
        bounds: { min: vec2(0, 0), max: vec2(w, h), width: w, height: h },
      };

      contours.push(contour);
      segmentedPieces.push({
        pieceId: p.id,
        pieceName: p.name,
        contour,
        localOrigin: vec2(w / 2, h / 2),
        localOuterLoop: pts.map((pt) => vec2(pt.x - w / 2, pt.y - h / 2)),
        localHoles: [],
        materialThicknessMm: t,
      });
    }

    const normalized: NormalizedRepresentation = {
      sourceFilename: filename,
      detectedFileType: "canonical_json",
      units: "mm",
      scaleToMmFactor: 1.0,
      yAxisOrientation: "y_up",
      contours,
      segmentedPieces,
      estimatedMaterialThicknessMm: canonicalData.pieces[0]?.thickness || 3.0,
    };

    return { normalized, puzzle: canonicalData };
  }

  /**
   * Imports WoodKit Project JSON schema.
   */
  private static importProjectJson(
    filename: string,
    projectData: any,
    diagnostics: ImportDiagnostics
  ): { normalized: NormalizedRepresentation; puzzle: CanonicalPuzzle } {
    const puzzle = createEmptyCanonicalPuzzle(projectData.meta?.name || "Project Puzzle");
    puzzle.metadata.id = projectData.meta?.id || "puz_project_1";

    const pieces: CanonicalPiece[] = [];
    const contours: ExtractedContour2D[] = [];
    const segmentedPieces: SegmentedPiece2D[] = [];

    for (const part of projectData.parts || []) {
      const w = part.width || 100;
      const h = part.height || 100;
      const t = part.thickness || 3.0;

      const cPiece = createCanonicalPiece(part.name || "Part", { width: w, height: h, depth: t }, t);
      cPiece.id = part.id;
      pieces.push(cPiece);

      const pts = [vec2(0, 0), vec2(w, 0), vec2(w, h), vec2(0, h)];
      const contour: ExtractedContour2D = {
        id: `contour_${part.id}`,
        outerLoop: pts,
        holes: [],
        area: w * h,
        perimeter: 2 * (w + h),
        bounds: { min: vec2(0, 0), max: vec2(w, h), width: w, height: h },
      };

      contours.push(contour);
      segmentedPieces.push({
        pieceId: part.id,
        pieceName: part.name || "Part",
        contour,
        localOrigin: vec2(w / 2, h / 2),
        localOuterLoop: pts.map((pt) => vec2(pt.x - w / 2, pt.y - h / 2)),
        localHoles: [],
        materialThicknessMm: t,
      });
    }

    puzzle.pieces = pieces;
    diagnostics.info("PROJECT_JSON_CONVERTED", `Converted WoodKit Project with ${pieces.length} part(s) to CanonicalPuzzle.`);

    const normalized: NormalizedRepresentation = {
      sourceFilename: filename,
      detectedFileType: "project_json",
      units: "mm",
      scaleToMmFactor: 1.0,
      yAxisOrientation: "y_up",
      contours,
      segmentedPieces,
      estimatedMaterialThicknessMm: pieces[0]?.thickness || 3.0,
    };

    return { normalized, puzzle };
  }

  /**
   * Imports generic manifest JSON.
   */
  private static importGenericJsonManifest(
    filename: string,
    manifest: any,
    diagnostics: ImportDiagnostics
  ): { normalized: NormalizedRepresentation; puzzle: CanonicalPuzzle } {
    const puzzle = createEmptyCanonicalPuzzle(manifest.name || "Manifest Puzzle");
    puzzle.metadata.id = manifest.id || "puz_manifest_1";

    diagnostics.info("MANIFEST_JSON_LOADED", `Loaded generic JSON puzzle manifest '${puzzle.metadata.id}'.`);

    const normalized: NormalizedRepresentation = {
      sourceFilename: filename,
      detectedFileType: "json",
      units: "mm",
      scaleToMmFactor: 1.0,
      yAxisOrientation: "y_up",
      contours: [],
      segmentedPieces: [],
      estimatedMaterialThicknessMm: 3.0,
    };

    return { normalized, puzzle };
  }
}
