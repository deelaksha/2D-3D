/**
 * Production-Quality Real-Data Ingestion Pipeline Master Orchestrator (Phase 61).
 *
 * Orchestrates the complete 10-stage lifecycle:
 *   RAW SOURCE
 *       ↓
 *   FILE VALIDATION
 *       ↓
 *   IMPORT
 *       ↓
 *   NORMALIZATION
 *       ↓
 *   CANONICAL IR
 *       ↓
 *   GEOMETRY VALIDATION
 *       ↓
 *   CONNECTION VALIDATION
 *       ↓
 *   ASSEMBLY VALIDATION
 *       ↓
 *   DATASET EXAMPLE
 *       ↓
 *   QUALITY STATUS
 *
 * Guarantees:
 *  - Non-destructive processing (original source files never modified or overwritten).
 *  - Full provenance retention and immutable raw-data references.
 *  - First-class dryRun mode.
 *  - Strict batch size safeguards (no runaway automatic processing).
 */
import type { RawFilePayload } from "../ingestion/types";
import { FileIntegrityValidator } from "./fileValidator";
import { UnifiedIngestionPipeline } from "../ingestion/unifiedIngestionPipeline";
import { TriStageValidator } from "./triStageValidator";
import { DatasetExampleBuilder } from "./datasetExampleBuilder";
import { QualityStatusEvaluator } from "./qualityEvaluator";
import type {
  IngestionQualityStatus,
  IngestionStageTrace,
  RealDataIngestionOptions,
  RealDataIngestionResult,
} from "./types";

export const DEFAULT_MAX_BATCH_ITEMS = 25;

export class RealDataIngestionPipeline {
  /**
   * Ingests a single real design file payload through the 10-stage pipeline.
   */
  static ingestFile(
    payload: RawFilePayload,
    options: RealDataIngestionOptions = {}
  ): RealDataIngestionResult {
    const pipelineStartTime = Date.now();
    const stageTraces: IngestionStageTrace[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const dryRun = options.dryRun ?? false;

    // ─────────────────────────────────────────────────────────────
    // STAGE 1: RAW SOURCE
    // ─────────────────────────────────────────────────────────────
    const t1 = Date.now();
    stageTraces.push({
      stage: "RAW_SOURCE",
      status: "SUCCESS",
      message: `Received raw source '${payload.filename}'. Read-only access enforced.`,
      durationMs: Date.now() - t1,
    });

    // ─────────────────────────────────────────────────────────────
    // STAGE 2: FILE VALIDATION
    // ─────────────────────────────────────────────────────────────
    const t2 = Date.now();
    const fileVal = FileIntegrityValidator.validate(payload);
    errors.push(...fileVal.syntaxErrors);
    warnings.push(...fileVal.warnings);

    stageTraces.push({
      stage: "FILE_VALIDATION",
      status: fileVal.isValid ? (fileVal.warnings.length > 0 ? "WARNING" : "SUCCESS") : "FAILED",
      message: fileVal.isValid
        ? `Validated format ${fileVal.detectedFormat} (${fileVal.rawReference.sizeBytes} bytes, SHA-256=${fileVal.rawReference.sha256.slice(0, 10)}...).`
        : `File validation failed: ${fileVal.syntaxErrors.join("; ")}`,
      durationMs: Date.now() - t2,
      details: { format: fileVal.detectedFormat, rawRef: fileVal.rawReference },
    });

    if (!fileVal.isValid) {
      const duration = Date.now() - pipelineStartTime;
      return {
        success: false,
        qualityStatus: "FAIL",
        dryRun,
        sourceFile: payload.filename,
        detectedFormat: fileVal.detectedFormat,
        rawReference: fileVal.rawReference,
        stageTraces,
        totalDurationMs: duration,
        errors,
        warnings,
      };
    }

    // ─────────────────────────────────────────────────────────────
    // STAGE 3: IMPORT
    // ─────────────────────────────────────────────────────────────
    const t3 = Date.now();
    let importResult;
    try {
      importResult = UnifiedIngestionPipeline.importFile(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`IMPORT_EXCEPTION: ${msg}`);
      stageTraces.push({
        stage: "IMPORT",
        status: "FAILED",
        message: `Unhandled exception during importer execution: ${msg}`,
        durationMs: Date.now() - t3,
      });

      return {
        success: false,
        qualityStatus: "FAIL",
        dryRun,
        sourceFile: payload.filename,
        detectedFormat: fileVal.detectedFormat,
        rawReference: fileVal.rawReference,
        stageTraces,
        totalDurationMs: Date.now() - pipelineStartTime,
        errors,
        warnings,
      };
    }

    if (importResult.diagnostics.hasWarnings()) {
      warnings.push(...importResult.diagnostics.getWarnings().map((w) => `${w.code}: ${w.message}`));
    }
    if (importResult.diagnostics.hasErrors()) {
      errors.push(...importResult.diagnostics.getErrors().map((e) => `${e.code}: ${e.message}`));
    }

    stageTraces.push({
      stage: "IMPORT",
      status: importResult.success ? "SUCCESS" : "FAILED",
      message: importResult.success
        ? `Imported structure with ${importResult.normalized?.segmentedPieces.length ?? 0} piece(s).`
        : `Import stage encountered diagnostic errors.`,
      durationMs: Date.now() - t3,
    });

    // ─────────────────────────────────────────────────────────────
    // STAGE 4: NORMALIZATION
    // ─────────────────────────────────────────────────────────────
    const t4 = Date.now();
    const normalized = importResult.normalized;
    const normSuccess = !!normalized && normalized.segmentedPieces.length > 0;

    stageTraces.push({
      stage: "NORMALIZATION",
      status: normSuccess ? "SUCCESS" : "WARNING",
      message: normSuccess
        ? `Normalized coordinate space (units=${normalized?.units}, scaleFactor=${normalized?.scaleToMmFactor}).`
        : `Normalization resulted in empty piece list.`,
      durationMs: Date.now() - t4,
    });

    // ─────────────────────────────────────────────────────────────
    // STAGE 5: CANONICAL IR
    // ─────────────────────────────────────────────────────────────
    const t5 = Date.now();
    const canonicalPuzzle = importResult.puzzle;

    if (!canonicalPuzzle || !canonicalPuzzle.pieces || canonicalPuzzle.pieces.length === 0) {
      errors.push("CANONICAL_IR_EMPTY: Failed to produce Canonical IR containing pieces.");
      stageTraces.push({
        stage: "CANONICAL_IR",
        status: "FAILED",
        message: "Canonical IR could not be generated.",
        durationMs: Date.now() - t5,
      });

      return {
        success: false,
        qualityStatus: "FAIL",
        dryRun,
        sourceFile: payload.filename,
        detectedFormat: fileVal.detectedFormat,
        rawReference: fileVal.rawReference,
        normalized,
        stageTraces,
        totalDurationMs: Date.now() - pipelineStartTime,
        errors,
        warnings,
      };
    }

    stageTraces.push({
      stage: "CANONICAL_IR",
      status: "SUCCESS",
      message: `Generated Canonical IR with ${canonicalPuzzle.pieces.length} piece(s) and ${canonicalPuzzle.connections.length} connection(s).`,
      durationMs: Date.now() - t5,
    });

    // ─────────────────────────────────────────────────────────────
    // STAGE 6, 7, 8: 3-GATE PHYSICAL VALIDATION
    // ─────────────────────────────────────────────────────────────
    const t6 = Date.now();
    const triStageResult = TriStageValidator.validate(canonicalPuzzle);

    // Stage 6 Trace
    stageTraces.push({
      stage: "GEOMETRY_VALIDATION",
      status: triStageResult.geometry.isValid ? "SUCCESS" : "FAILED",
      message: triStageResult.geometry.isValid
        ? `Geometry valid across ${triStageResult.geometry.pieceCount} piece(s).`
        : `Geometry issues: ${triStageResult.geometry.errors.join("; ")}`,
      durationMs: Date.now() - t6,
    });

    // Stage 7 Trace
    const t7 = Date.now();
    stageTraces.push({
      stage: "CONNECTION_VALIDATION",
      status: triStageResult.connection.isValid ? "SUCCESS" : "FAILED",
      message: triStageResult.connection.isValid
        ? `Connections valid (${triStageResult.connection.matchedConnections} matched, ${triStageResult.connection.unmatchedInterfaces} open).`
        : `Connection issues: ${triStageResult.connection.errors.join("; ")}`,
      durationMs: Date.now() - t7,
    });

    // Stage 8 Trace
    const t8 = Date.now();
    stageTraces.push({
      stage: "ASSEMBLY_VALIDATION",
      status: triStageResult.assembly.isValid ? "SUCCESS" : "FAILED",
      message: triStageResult.assembly.isValid
        ? `Assembly graph connected=${triStageResult.assembly.isGraphConnected}, sequence solvable=${triStageResult.assembly.isSequenceSolvable}.`
        : `Assembly issues: ${triStageResult.assembly.errors.join("; ")}`,
      durationMs: Date.now() - t8,
    });

    // ─────────────────────────────────────────────────────────────
    // STAGE 10: QUALITY STATUS EVALUATION
    // ─────────────────────────────────────────────────────────────
    const qualityEvaluation = QualityStatusEvaluator.evaluate(
      fileVal,
      triStageResult,
      { strictMode: options.strictMode }
    );
    const finalQualityStatus = qualityEvaluation.status;

    // ─────────────────────────────────────────────────────────────
    // STAGE 9: DATASET EXAMPLE
    // ─────────────────────────────────────────────────────────────
    const t9 = Date.now();
    const datasetExample = DatasetExampleBuilder.buildExample(
      canonicalPuzzle,
      fileVal.rawReference,
      triStageResult,
      finalQualityStatus,
      {
        userPrompt: options.userPrompt,
        targetDifficulty: options.targetDifficulty,
      }
    );

    stageTraces.push({
      stage: "DATASET_EXAMPLE",
      status: "SUCCESS",
      message: `Constructed CompleteDatasetItem '${datasetExample.itemId}' with full provenance.`,
      durationMs: Date.now() - t9,
    });

    stageTraces.push({
      stage: "QUALITY_STATUS",
      status: finalQualityStatus === "PASS" ? "SUCCESS" : finalQualityStatus === "REVIEW_REQUIRED" ? "WARNING" : "FAILED",
      message: `Assigned Quality Status: ${finalQualityStatus} (Score: ${triStageResult.overallScore}).`,
      durationMs: 0,
      details: { qualityStatus: finalQualityStatus, reasons: qualityEvaluation.reasons },
    });

    const totalDurationMs = Date.now() - pipelineStartTime;
    const success = finalQualityStatus !== "FAIL";

    return {
      success,
      qualityStatus: finalQualityStatus,
      dryRun,
      sourceFile: payload.filename,
      detectedFormat: fileVal.detectedFormat,
      rawReference: fileVal.rawReference,
      provenance: datasetExample.provenance,
      datasetExample,
      canonicalPuzzle,
      normalized,
      triStageValidation: triStageResult,
      stageTraces,
      totalDurationMs,
      errors: [...errors, ...triStageResult.failureReasons],
      warnings: [...warnings, ...triStageResult.reviewReasons],
    };
  }

  /**
   * Ingests a batch of real design files with strict execution limit guards.
   */
  static ingestBatch(
    payloads: RawFilePayload[],
    options: RealDataIngestionOptions = {}
  ): RealDataIngestionResult[] {
    const limit = options.maxItems ?? DEFAULT_MAX_BATCH_ITEMS;
    const toProcess = payloads.slice(0, limit);

    const results: RealDataIngestionResult[] = [];
    for (const payload of toProcess) {
      const res = this.ingestFile(payload, options);
      results.push(res);
    }
    return results;
  }
}
