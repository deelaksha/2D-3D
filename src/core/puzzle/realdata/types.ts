/**
 * Production-Quality Real-Data Ingestion Pipeline Types (Phase 61).
 *
 * Defines the complete data structures for ingesting real-world CAD, vector,
 * and drawing files into the ML pipeline with strict provenance, multi-format
 * validation, 3-gate physical validation, and quality triage.
 */
import type { ID, Vec2, Vec3 } from "@/core/model/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { CompleteDatasetItem } from "../training/types";
import type { DetectedFileType, NormalizedRepresentation, RawFilePayload } from "../ingestion/types";

/**
 * The 8 supported input design file formats.
 */
export type SupportedRealDataFormat =
  | "PNG"
  | "JPG"
  | "SVG"
  | "DXF"
  | "STEP"
  | "STL"
  | "OBJ"
  | "JSON";

/**
 * Three-tier quality status assigned to each ingested dataset example.
 */
export type IngestionQualityStatus = "PASS" | "FAIL" | "REVIEW_REQUIRED";

/**
 * Immutable reference to the raw source data.
 * Original files are never modified or overwritten.
 */
export interface RawDataReference {
  rawId: string;
  sourceFile: string;
  sha256: string;
  sizeBytes: number;
  detectedFormat: SupportedRealDataFormat | "UNKNOWN";
  createdAt: string;
  mimeType: string;
  contentSnippet?: string;
}

/**
 * Provenance metadata strictly recorded on every dataset item.
 */
export interface IngestionProvenance {
  source_file: string;
  source_id: string;
  source_version: string;
  import_timestamp: string;
  schema_version: string;
  geometry_version: string;
  processing_version: string;
  raw_ref: RawDataReference;
}

/**
 * Result of Stage 2: File Validation.
 */
export interface FileValidationResult {
  isValid: boolean;
  detectedFormat: SupportedRealDataFormat | "UNKNOWN";
  rawReference: RawDataReference;
  syntaxErrors: string[];
  warnings: string[];
}

/**
 * Stage 6: Geometry Validation Details.
 */
export interface GeometryValidationDetail {
  isValid: boolean;
  pieceCount: number;
  degenerateCount: number;
  openLoopCount: number;
  zeroAreaCount: number;
  collisionCount: number;
  errors: string[];
  warnings: string[];
}

/**
 * Stage 7: Connection Validation Details.
 */
export interface ConnectionValidationDetail {
  isValid: boolean;
  totalInterfaces: number;
  matchedConnections: number;
  unmatchedInterfaces: number;
  invalidToleranceCount: number;
  unsupportedAngleCount: number;
  errors: string[];
  warnings: string[];
}

/**
 * Stage 8: Assembly Validation Details.
 */
export interface AssemblyValidationDetail {
  isValid: boolean;
  isGraphConnected: boolean;
  orphanedPieceCount: number;
  isSequenceSolvable: boolean;
  collisionFreeSequence: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Consolidated 3-gate validation result.
 */
export interface TriStageValidationResult {
  geometry: GeometryValidationDetail;
  connection: ConnectionValidationDetail;
  assembly: AssemblyValidationDetail;
  overallScore: number;
  isValid: boolean;
  failureReasons: string[];
  reviewReasons: string[];
}

/**
 * Production Real Dataset Example item.
 */
export interface RealDatasetExample extends CompleteDatasetItem {
  provenance: IngestionProvenance;
  qualityStatus: IngestionQualityStatus;
  qualitySummary: {
    status: IngestionQualityStatus;
    score: number;
    failureReasons: string[];
    reviewReasons: string[];
    geometryValid: boolean;
    connectionValid: boolean;
    assemblyValid: boolean;
  };
}

/**
 * Execution options for pipeline execution.
 */
export interface RealDataIngestionOptions {
  /**
   * When true, executes all 10 stages and returns full validation results,
   * diagnostics, and dataset item preview WITHOUT persisting to disk or dataset registry.
   */
  dryRun?: boolean;

  /**
   * Maximum number of items to process in a batch. Prevents automatic runaway execution.
   */
  maxItems?: number;

  /**
   * In strict mode, any warnings immediately classify the example as REVIEW_REQUIRED
   * rather than PASS.
   */
  strictMode?: boolean;

  /**
   * Fallback material thickness in mm if not deterministically found in source.
   */
  defaultMaterialThicknessMm?: number;

  /**
   * Optional custom user requirement prompt to attach to dataset item.
   */
  userPrompt?: string;

  /**
   * Target difficulty rating for the generated dataset example.
   */
  targetDifficulty?: "easy" | "medium" | "hard" | "expert";
}

/**
 * Trace log entry for one of the 10 stages.
 */
export interface IngestionStageTrace {
  stage:
    | "RAW_SOURCE"
    | "FILE_VALIDATION"
    | "IMPORT"
    | "NORMALIZATION"
    | "CANONICAL_IR"
    | "GEOMETRY_VALIDATION"
    | "CONNECTION_VALIDATION"
    | "ASSEMBLY_VALIDATION"
    | "DATASET_EXAMPLE"
    | "QUALITY_STATUS";
  status: "SUCCESS" | "WARNING" | "FAILED" | "SKIPPED";
  message: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

/**
 * Final output of ingesting a real design file.
 */
export interface RealDataIngestionResult {
  success: boolean;
  qualityStatus: IngestionQualityStatus;
  dryRun: boolean;
  sourceFile: string;
  detectedFormat: SupportedRealDataFormat | "UNKNOWN";
  rawReference: RawDataReference;
  provenance?: IngestionProvenance;
  datasetExample?: RealDatasetExample;
  canonicalPuzzle?: CanonicalPuzzle;
  normalized?: NormalizedRepresentation;
  triStageValidation?: TriStageValidationResult;
  stageTraces: IngestionStageTrace[];
  totalDurationMs: number;
  errors: string[];
  warnings: string[];
}
