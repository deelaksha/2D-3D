/**
 * Comprehensive Puzzle Export Subsystem (Phase 99) - Public API.
 */

export { PuzzleExportEngine } from "./puzzleExportEngine";
export { SvgExporter } from "./svgExporter";
export { DxfExporter } from "./dxfExporter";
export { DimensionedDrawingExporter } from "./dimensionedDrawingExporter";
export { StlExporter } from "./stlExporter";
export { ObjExporter } from "./objExporter";
export { GltfExporter } from "./gltfExporter";
export { StepExporter } from "./stepExporter";
export { MetadataExporter } from "./metadataExporter";
export { PuzzleExportValidationError } from "./types";

export type {
  Export2DOptions,
  Export3DOptions,
  ExportMetadataOptions,
  PuzzleExportOptions,
  ExportedPiece2D,
  CombinedLayoutResult,
  ExportedPiece3D,
  Assembled3DExport,
  PuzzleMetadataPackage,
  PuzzleExportPackage,
} from "./types";
