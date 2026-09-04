/**
 * Candidate Metrics Evaluator (Phase 74).
 *
 * Deterministically evaluates 7 engineering, physical, and requirement metrics
 * for every generated candidate design:
 *  1. Validity (5-Gate Deterministic Validation)
 *  2. Difficulty (Measurable feature breakdown & scoring from Phase 69)
 *  3. Material Utilization (Sheet packing density & nesting efficiency)
 *  4. Connection Quality (Clearance bounds & friction-fit rating)
 *  5. Assembly Quality (Feasibility & sequence stability)
 *  6. Design Similarity (Alignment with user prompt and reference preferences)
 *  7. Manufacturability (Laser kerf tolerance & bridge thickness)
 */

import type { CandidateEvaluationMetrics, CandidateGenerationRequest } from "./types";
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { CanonicalPuzzle } from "../canonical/types";
import { DesignValidationPipeline } from "../designgeneration/designValidationPipeline";
import { DeterministicDifficultyModel } from "../difficulty/deterministicDifficultyModel";

export class CandidateMetricsEvaluator {
  /**
   * Evaluates all 7 metrics for a candidate specification and its compiled puzzle.
   */
  public static evaluateCandidate(
    spec: ParametricDesignSpecification,
    compiledPuzzle: CanonicalPuzzle | undefined,
    request: CandidateGenerationRequest
  ): CandidateEvaluationMetrics {
    // 1. Validity Metric (5-gate validation)
    const validationReport = DesignValidationPipeline.validateDesign(spec, compiledPuzzle);
    const passes = validationReport.passes;
    const gatePassCount = [
      passes.schemaValidation,
      passes.hardConstraintValidation,
      passes.geometryValidation,
      passes.connectionValidation,
      passes.validation3D,
    ].filter(Boolean).length;
    const gatePassRatio = Number((gatePassCount / 5).toFixed(2));
    const isValid = validationReport.overallPassed;

    // 2. Difficulty Metric (Phase 69 alignment)
    const difficultyMetric = this.evaluateDifficulty(spec, compiledPuzzle);

    // 3. Material Utilization Metric
    const materialMetric = this.evaluateMaterialUtilization(spec, compiledPuzzle);

    // 4. Connection Quality Metric
    const connectionMetric = this.evaluateConnectionQuality(spec);

    // 5. Assembly Quality Metric
    const assemblyMetric = this.evaluateAssemblyQuality(spec, compiledPuzzle, isValid);

    // 6. Design Similarity Metric
    const similarityMetric = this.evaluateDesignSimilarity(spec, request);

    // 7. Manufacturability Metric
    const manufacturabilityMetric = this.evaluateManufacturability(spec);

    // Composite Quality Score Calculation
    const weights = request.evaluationWeights || {};
    const wDiff = weights.difficultyWeight ?? 0.15;
    const wMat = weights.materialUtilizationWeight ?? 0.15;
    const wConn = weights.connectionQualityWeight ?? 0.20;
    const wAsm = weights.assemblyQualityWeight ?? 0.20;
    const wSim = weights.designSimilarityWeight ?? 0.15;
    const wMfg = weights.manufacturabilityWeight ?? 0.15;
    const weightSum = wDiff + wMat + wConn + wAsm + wSim + wMfg || 1.0;

    const rawComposite =
      (difficultyMetric.score * wDiff +
        materialMetric.score * wMat +
        connectionMetric.score * wConn +
        assemblyMetric.score * wAsm +
        similarityMetric.score * wSim +
        manufacturabilityMetric.score * wMfg) /
      weightSum;

    const compositeScore = Number(rawComposite.toFixed(1));

    return {
      validity: {
        isValid,
        passes,
        errors: validationReport.errors,
        warnings: validationReport.warnings,
        gatePassCount,
        gatePassRatio,
      },
      difficulty: difficultyMetric,
      materialUtilization: materialMetric,
      connectionQuality: connectionMetric,
      assemblyQuality: assemblyMetric,
      designSimilarity: similarityMetric,
      manufacturability: manufacturabilityMetric,
      compositeScore,
    };
  }

  /**
   * 2. Evaluates Difficulty using Phase 69 model.
   */
  private static evaluateDifficulty(
    spec: ParametricDesignSpecification,
    compiledPuzzle?: CanonicalPuzzle
  ): CandidateEvaluationMetrics["difficulty"] {
    if (compiledPuzzle) {
      try {
        const diffResult = DeterministicDifficultyModel.calculateDifficulty(compiledPuzzle);
        return {
          score: diffResult.score.compositeScore,
          level: diffResult.score.tier,
          featureBreakdown: diffResult.features,
        };
      } catch {
        // Fall back to specification heuristics
      }
    }

    // Heuristic estimation based on spec parameters
    const count = spec.piece_count || 4;
    const estimatedScore = Math.min(100, Math.max(10, count * 15));
    let level: "easy" | "medium" | "hard" | "expert" = "medium";
    if (estimatedScore < 35) level = "easy";
    else if (estimatedScore < 65) level = "medium";
    else if (estimatedScore < 85) level = "hard";
    else level = "expert";

    return {
      score: estimatedScore,
      level,
      featureBreakdown: { pieceCount: count },
    };
  }

  /**
   * 3. Evaluates Material Utilization and sheet packing density.
   */
  private static evaluateMaterialUtilization(
    spec: ParametricDesignSpecification,
    compiledPuzzle?: CanonicalPuzzle
  ): CandidateEvaluationMetrics["materialUtilization"] {
    const stockW = spec.material?.stockWidthMm ?? 300;
    const stockH = spec.material?.stockHeightMm ?? 300;
    const stockSheetAreaMm2 = Math.max(1, stockW * stockH);

    let totalPieceAreaMm2 = 0;
    if (compiledPuzzle && compiledPuzzle.pieces && compiledPuzzle.pieces.length > 0) {
      for (const piece of compiledPuzzle.pieces) {
        totalPieceAreaMm2 += (piece.dimensions?.widthMm ?? 40) * (piece.dimensions?.heightMm ?? 40);
      }
    } else {
      const pCount = spec.piece_count ?? 4;
      const avgW = (spec.overall_size?.widthMm ?? 160) / Math.max(1, Math.sqrt(pCount));
      const avgH = (spec.overall_size?.heightMm ?? 120) / Math.max(1, Math.sqrt(pCount));
      totalPieceAreaMm2 = pCount * avgW * avgH;
    }

    const sheetPackingDensityPct = Number(
      Math.min(100.0, (totalPieceAreaMm2 / stockSheetAreaMm2) * 100).toFixed(1)
    );

    // Scoring: Ideal packing density for laser cut cardboard is 35% - 70%
    let score = 50;
    if (sheetPackingDensityPct >= 35 && sheetPackingDensityPct <= 75) {
      score = 90 + Math.min(10, (sheetPackingDensityPct - 35) / 4);
    } else if (sheetPackingDensityPct > 75) {
      score = Math.max(70, 100 - (sheetPackingDensityPct - 75) * 2); // Overcrowded
    } else {
      // Under-utilized
      score = Math.max(10, sheetPackingDensityPct * 2.5);
    }

    return {
      score: Number(score.toFixed(1)),
      sheetPackingDensityPct,
      totalPieceAreaMm2: Math.round(totalPieceAreaMm2),
      stockSheetAreaMm2: Math.round(stockSheetAreaMm2),
    };
  }

  /**
   * 4. Evaluates Connection Quality and clearance fit.
   */
  private static evaluateConnectionQuality(
    spec: ParametricDesignSpecification
  ): CandidateEvaluationMetrics["connectionQuality"] {
    const clearanceMm = Number((spec.connection_preferences as any)?.clearance ?? 0.15);
    const jointType = spec.connection_preferences?.defaultType || "tab_slot";

    let score = 70;
    let fitRating: CandidateEvaluationMetrics["connectionQuality"]["fitRating"] = "ACCEPTABLE";

    if (clearanceMm <= 0.0) {
      score = 0;
      fitRating = "INVALID";
    } else if (clearanceMm < 0.08) {
      score = 40;
      fitRating = "TIGHT";
    } else if (clearanceMm >= 0.12 && clearanceMm <= 0.20) {
      score = 95;
      fitRating = "OPTIMAL";
    } else if (clearanceMm > 0.30) {
      score = 45;
      fitRating = "LOOSE";
    } else {
      score = 80;
      fitRating = "ACCEPTABLE";
    }

    return {
      score,
      clearanceMm,
      jointType,
      fitRating,
    };
  }

  /**
   * 5. Evaluates Assembly Quality and kinematic stability.
   */
  private static evaluateAssemblyQuality(
    spec: ParametricDesignSpecification,
    compiledPuzzle: CanonicalPuzzle | undefined,
    isValid: boolean
  ): CandidateEvaluationMetrics["assemblyQuality"] {
    if (!isValid || !compiledPuzzle) {
      return {
        score: 0.0,
        feasibilityPassed: false,
        assemblySequenceSteps: 0,
        stabilityRating: "LOW",
      };
    }

    const pieceCount = compiledPuzzle.pieces?.length ?? spec.piece_count;
    const sequenceSteps = Math.max(1, pieceCount - 1);

    const angle = spec.connection_preferences?.preferredJoiningAngleDeg ?? 90;
    let score = 85;
    let stabilityRating: "HIGH" | "MODERATE" | "LOW" = "HIGH";

    if (angle === 90.0 || angle === 0.0) {
      score += 10;
      stabilityRating = "HIGH";
    } else if (angle === 45.0 || angle === 60.0) {
      score += 5;
      stabilityRating = "MODERATE";
    } else {
      score -= 10;
      stabilityRating = "MODERATE";
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      feasibilityPassed: true,
      assemblySequenceSteps: sequenceSteps,
      stabilityRating,
    };
  }

  /**
   * 6. Evaluates Design Similarity to user prompt and reference preferences.
   */
  private static evaluateDesignSimilarity(
    spec: ParametricDesignSpecification,
    request: CandidateGenerationRequest
  ): CandidateEvaluationMetrics["designSimilarity"] {
    const userPref = request.userPreferences || {};
    const matchingFeatures: string[] = [];
    const deviations: string[] = [];
    let similarityScore = 80;

    // Piece count alignment
    if (userPref.targetPieceCount !== undefined) {
      const delta = Math.abs(spec.piece_count - userPref.targetPieceCount);
      if (delta === 0) {
        similarityScore += 10;
        matchingFeatures.push(`Exact target piece count (${spec.piece_count} pcs)`);
      } else {
        similarityScore -= delta * 5;
        deviations.push(`Piece count differed by ${delta} (actual: ${spec.piece_count})`);
      }
    }

    // Target dimensions alignment
    if (userPref.targetDimensions?.widthMm) {
      const wRatio = spec.overall_size.widthMm / userPref.targetDimensions.widthMm;
      if (wRatio >= 0.85 && wRatio <= 1.15) {
        matchingFeatures.push(`Width closely aligned (${spec.overall_size.widthMm}mm)`);
      } else {
        similarityScore -= 8;
        deviations.push(`Width delta outside 15% corridor (${spec.overall_size.widthMm}mm)`);
      }
    }

    // Material alignment
    if (userPref.preferredMaterialId) {
      if (spec.material.materialId === userPref.preferredMaterialId) {
        similarityScore += 5;
        matchingFeatures.push(`Preferred material '${spec.material.materialId}' matched`);
      }
    }

    const finalScore = Number(Math.min(100, Math.max(10, similarityScore)).toFixed(1));

    return {
      score: finalScore,
      requirementAlignmentScore: finalScore,
      matchingFeatures,
      deviations,
    };
  }

  /**
   * 7. Evaluates Manufacturability (laser kerf, bridge margins, cardboard gauge).
   */
  private static evaluateManufacturability(
    spec: ParametricDesignSpecification
  ): CandidateEvaluationMetrics["manufacturability"] {
    const thickness = spec.material?.stockThicknessMm ?? 2.0;
    const clearance = Number((spec.connection_preferences as any)?.clearance ?? 0.15);

    let laserKerfSafe = true;
    let minBridgeWidthMm = 4.0;
    let score = 90;
    let cutSuitabilityRating: CandidateEvaluationMetrics["manufacturability"]["cutSuitabilityRating"] = "EXCELLENT";

    if (clearance < 0.08) {
      laserKerfSafe = false;
      score -= 30;
      cutSuitabilityRating = "DEFECTIVE";
    }

    if (thickness < 1.0 || thickness > 6.0) {
      score -= 20;
      cutSuitabilityRating = "MARGINAL";
    } else if (thickness >= 1.5 && thickness <= 3.0) {
      score += 10;
      cutSuitabilityRating = "EXCELLENT";
    } else {
      cutSuitabilityRating = "GOOD";
    }

    return {
      score: Number(Math.min(100, Math.max(0, score)).toFixed(1)),
      laserKerfSafe,
      minBridgeWidthMm,
      stockThicknessMm: thickness,
      cutSuitabilityRating,
    };
  }
}
