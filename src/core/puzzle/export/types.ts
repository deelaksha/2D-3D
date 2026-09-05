/**
 * Comprehensive Puzzle Export Subsystem Domain Types (Phase 99).
 *
 * Requirements:
 *  - 2D: SVG, DXF, Dimensioned Drawing, Individual Piece Files, Combined Layout Sheet.
 *  - 3D: STEP (ISO 10303-21), STL (ASCII/Binary), OBJ (+ MTL), glTF 2.0.
 *  - Metadata: puzzle JSON, piece definitions, connection definitions, assembly configuration,
 *    assembly sequence, validation report.
 *  - Mandatory Validation Gate: Only allow export after mandatory validation passes.
 *  - ID Preservation: Every exported piece and connection must preserve its ID across all formats.
 *  - Geometric Fidelity: Exported geometry must correspond exactly to the validated design version.
 */

import type { ID, Vec2, Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { GeneratedPiece2D, GeneratedConnection2D, PieceDimensions2D } from "../automatic2d/types";
import type { GeneratedPiece3D } from "../piece3d/types";
import type { AssemblyValidationReport } from "../assemblyvalidation/types";
import type { SuccessfulAssembly, GeneratedAssembly3D } from "../assemblysolver/types";
import type { ExplicitAssemblySequence } from "../sequencesolver/types";

/**
 * Custom error thrown when an unvalidated or invalid puzzle is requested for export.
 */
export class PuzzleExportValidationError extends Error {
  public readonly validationReport?: AssemblyValidationReport;
  public readonly violationDetails: string[];

  constructor(message: string, violationDetails: string[] = [], report?: AssemblyValidationReport) {
    super(message);
    this.name = "PuzzleExportValidationError";
    this.violationDetails = violationDetails;
    this.validationReport = report;
  }
}

/**
 * Options for 2D exports.
 */
export interface Export2DOptions {
  /** Include individual piece SVG and DXF files. Default: true. */
  includeIndividualFiles?: boolean;
  /** Include combined sheet layout. Default: true. */
  includeCombinedLayout?: boolean;
  /** Include dimensioned engineering drawings. Default: true. */
  includeDimensionedDrawings?: boolean;
  /** Sheet width for combined layout in mm (default: calculated or 600mm). */
  sheetWidthMm?: number;
  /** Sheet height for combined layout in mm (default: calculated or 400mm). */
  sheetHeightMm?: number;
  /** Spacing / margin between nested pieces in mm (default: 6.0mm). */
  pieceSpacingMm?: number;
  /** Stroke color for laser cut lines (default: "#ff0000"). */
  cutColor?: string;
  /** Stroke color for engraving / piece ID text (default: "#0000ff"). */
  engraveColor?: string;
  /** Line weight in mm (default: 0.1mm). */
  strokeWidthMm?: number;
}

/**
 * Options for 3D exports.
 */
export interface Export3DOptions {
  /** Include STL export. Default: true. */
  includeSTL?: boolean;
  /** Format for STL: ASCII or Binary. Default: "ascii". */
  stlFormat?: "ascii" | "binary";
  /** Include Wavefront OBJ export. Default: true. */
  includeOBJ?: boolean;
  /** Include glTF 2.0 JSON export. Default: true. */
  includeGLTF?: boolean;
  /** Include STEP (ISO 10303-21) export. Default: true. */
  includeSTEP?: boolean;
  /** Include per-piece 3D files (local coordinate space). Default: true. */
  includePerPiece3D?: boolean;
  /** Include full assembled 3D files (world assembled pose). Default: true. */
  includeAssembled3D?: boolean;
}

/**
 * Options for metadata package exports.
 */
export interface ExportMetadataOptions {
  /** Indentation spaces for formatted JSON (default: 2). */
  jsonIndent?: number;
  /** Include full validation report in metadata. Default: true. */
  includeValidationReport?: boolean;
  /** Include assembly sequence in metadata. Default: true. */
  includeAssemblySequence?: boolean;
}

/**
 * Comprehensive puzzle export options.
 */
export interface PuzzleExportOptions {
  /** 2D export configuration. */
  export2D?: Export2DOptions;
  /** 3D export configuration. */
  export3D?: Export3DOptions;
  /** Metadata export configuration. */
  exportMetadata?: ExportMetadataOptions;
  /** Enforce strict validation check. If true, throws if validationReport.isValid is false. Default: true. */
  strictValidation?: boolean;
}

/**
 * Exported 2D file set for an individual piece.
 */
export interface ExportedPiece2D {
  pieceId: string;
  name: string;
  /** Vector SVG markup for this piece with cut boundary and engraved piece ID. */
  svg: string;
  /** AutoCAD R12 ASCII DXF string with CUT and ENGRAVE layers. */
  dxf: string;
  /** Dimensioned engineering drawing SVG with extension lines, dimensions, and title block. */
  dimensionedDrawingSvg: string;
  /** 2D dimensions in mm. */
  dimensions: PieceDimensions2D;
}

/**
 * Exported combined multi-piece cut-sheet layout.
 */
export interface CombinedLayoutResult {
  /** Combined sheet SVG containing all pieces arranged with piece ID labels. */
  svg: string;
  /** Combined sheet DXF containing all piece polylines and text labels. */
  dxf: string;
  /** Dimensions of the combined cut sheet. */
  sheetDimensions: {
    widthMm: number;
    heightMm: number;
  };
  /** Placement offsets per piece on the sheet. */
  piecePlacements: Record<string, { x: number; y: number; widthMm: number; heightMm: number }>;
}

/**
 * Exported 3D file set for an individual piece (local coordinates).
 */
export interface ExportedPiece3D {
  pieceId: string;
  name: string;
  /** STL mesh string (ASCII) or base64 (Binary). */
  stl: string;
  /** Wavefront OBJ string with named object (o Piece_<pieceId>). */
  obj: string;
  /** ISO 10303-21 STEP CAD exchange string with PRODUCT definition. */
  step: string;
  /** Triangle facet count. */
  triangleCount: number;
  /** Volume in mm^3. */
  volumeMm3: number;
}

/**
 * Exported 3D representation for the complete assembly (world coordinates).
 */
export interface Assembled3DExport {
  /** Complete assembly STL (ASCII). */
  stl: string;
  /** Complete assembly OBJ with separate named objects per piece. */
  obj: string;
  /** Complete assembly glTF 2.0 JSON string. */
  gltf: string;
  /** Complete assembly ISO 10303-21 STEP string. */
  step: string;
  /** Total assembled triangle count across all pieces. */
  totalTriangles: number;
  /** Assembled 3D bounding box. */
  bounds: {
    min: Vec3;
    max: Vec3;
  };
}

/**
 * Metadata package container.
 */
export interface PuzzleMetadataPackage {
  /** puzzle.json: high-level design specification, overall metrics, and generator version. */
  puzzleJson: string;
  /** pieces.json: array of all piece definitions, boundaries, and materials. */
  piecesJson: string;
  /** connections.json: array of all physical connectors with joining parameters and angles. */
  connectionsJson: string;
  /** assembly_configuration.json: 3D spatial transforms per piece and root piece ID. */
  assemblyConfigurationJson: string;
  /** assembly_sequence.json: step-by-step physical assembly progression. */
  assemblySequenceJson: string;
  /** validation_report.json: Phase 90 validation report. */
  validationReportJson: string;
}

/**
 * Unified, comprehensive export package output for Phase 99.
 */
export interface PuzzleExportPackage {
  /** Puzzle identifier. */
  puzzleId: string;
  /** Timestamp when export package was compiled. */
  exportedAt: string;
  /** Design version / generator tag. */
  generatorVersion: string;
  /** Total piece count. */
  pieceCount: number;
  /** Total physical connection count. */
  connectionCount: number;
  /** Confirms mandatory validation passed prior to export. */
  isValidated: boolean;

  /** 2D Export Artifacts. */
  exports2D: {
    /** Map of individual piece 2D files keyed by pieceId. */
    individualPieces: Record<string, ExportedPiece2D>;
    /** Combined nested sheet layout (SVG + DXF). */
    combinedLayout: CombinedLayoutResult;
  };

  /** 3D Export Artifacts. */
  exports3D: {
    /** Map of individual piece 3D files (local coordinates) keyed by pieceId. */
    individualPieces: Record<string, ExportedPiece3D>;
    /** Complete 3D assembled model (STL, OBJ, glTF, STEP). */
    assembled: Assembled3DExport;
  };

  /** Metadata JSON files. */
  metadata: PuzzleMetadataPackage;

  /** File manifest listing all generated files, formats, and sizes in bytes. */
  manifest: Array<{
    path: string;
    format: "svg" | "dxf" | "stl" | "obj" | "gltf" | "step" | "json";
    category: "2d" | "3d" | "metadata";
    pieceId?: string;
    sizeBytes: number;
    description: string;
  }>;
}
