/**
 * Quality Status Evaluator (Phase 61).
 *
 * Implements Stage 10: QUALITY STATUS.
 * Evaluates file validation, import diagnostics, and 3-gate validation
 * to assign one of three production quality tiers:
 *   - PASS: Clean, fully validated design ready for ML training.
 *   - FAIL: Corrupted, unparseable, or physically impossible geometry.
 *   - REVIEW_REQUIRED: Structurally valid, but has ambiguities or warnings needing human/AI check.
 */
import type { FileValidationResult, IngestionQualityStatus, TriStageValidationResult } from "./types";

export class QualityStatusEvaluator {
  /**
   * Computes the final quality tier based on file and tri-stage validation results.
   */
  static evaluate(
    fileResult: FileValidationResult,
    triStageResult?: TriStageValidationResult,
    options?: { strictMode?: boolean }
  ): {
    status: IngestionQualityStatus;
    reasons: string[];
    isApprovedForTraining: boolean;
  } {
    const reasons: string[] = [];

    // 1. Check File Validation Gate
    if (!fileResult.isValid || fileResult.syntaxErrors.length > 0) {
      reasons.push(...fileResult.syntaxErrors);
      return {
        status: "FAIL",
        reasons,
        isApprovedForTraining: false,
      };
    }

    // If tri-stage validation was not reached (e.g. import failed)
    if (!triStageResult) {
      reasons.push("PIPELINE_INCOMPLETE: 3-gate physical validation was not reached.");
      return {
        status: "FAIL",
        reasons,
        isApprovedForTraining: false,
      };
    }

    // 2. Check Fatal Physical/Geometric Validation Errors
    if (!triStageResult.isValid || triStageResult.failureReasons.length > 0) {
      reasons.push(...triStageResult.failureReasons);
      return {
        status: "FAIL",
        reasons,
        isApprovedForTraining: false,
      };
    }

    // 3. Check for Review Required Triggers
    const reviewTriggers: string[] = [];

    // Check raster format without DPI / physical scale
    if (fileResult.detectedFormat === "PNG" || fileResult.detectedFormat === "JPG") {
      reviewTriggers.push(`RASTER_IMAGE_UNCALIBRATED: ${fileResult.detectedFormat} file requires manual scale verification.`);
    }

    // Check file-level warnings
    if (fileResult.warnings.length > 0) {
      reviewTriggers.push(...fileResult.warnings);
    }

    // Check tri-stage warnings
    if (triStageResult.reviewReasons.length > 0) {
      reviewTriggers.push(...triStageResult.reviewReasons);
    }

    // Disconnected multi-piece graph check
    if (!triStageResult.assembly.isGraphConnected && triStageResult.assembly.orphanedPieceCount > 0) {
      reviewTriggers.push(`DISCONNECTED_PIECES: Puzzle has ${triStageResult.assembly.orphanedPieceCount} disconnected piece(s).`);
    }

    if (reviewTriggers.length > 0 || (options?.strictMode && triStageResult.overallScore < 1.0)) {
      return {
        status: "REVIEW_REQUIRED",
        reasons: reviewTriggers,
        isApprovedForTraining: false,
      };
    }

    // 4. Clean PASS
    return {
      status: "PASS",
      reasons: ["ALL_CHECKS_PASSED: Clean geometry, valid connections, and feasible assembly."],
      isApprovedForTraining: true,
    };
  }
}
