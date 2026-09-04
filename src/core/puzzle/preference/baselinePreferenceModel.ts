/**
 * Baseline Preference Model (Phase 76).
 *
 * Implements the PreferenceModel interface using deterministic heuristics.
 * Serves as the reference implementation and calibration testbed prior to
 * downstream neural network training (e.g. Bradley-Terry or reward models).
 */

import type {
  PairwisePreferencePrediction,
  PreferenceDimension,
  PreferenceExample,
  PreferenceModel,
  PreferenceModelMetrics,
  PreferencePrediction,
  ReviewContext,
} from "./types";

export class BaselinePreferenceModel implements PreferenceModel {
  public readonly modelId = "baseline_heuristic_preference_model_v1";
  public readonly modelVersion = "1.0.0";

  /**
   * Predicts a continuous preference score for a candidate's parametric features.
   */
  public async predictPreference(
    parametricFeatures: Record<string, any>,
    context?: Partial<ReviewContext>
  ): Promise<PreferencePrediction> {
    const pieceCount = parametricFeatures.pieceCount ?? parametricFeatures.piece_count ?? 4;
    const clearance = Number(parametricFeatures.clearance ?? 0.15);
    const aspect = Number(parametricFeatures.aspectRatio ?? 1.5);
    const packingDensity = Number(parametricFeatures.sheetPackingDensityPct ?? 50.0);

    // Heuristic scoring across the 6 dimensions [1.0, 5.0]
    let overallScore = 4.0;
    let diffScore = 4.0;
    let visScore = 4.0;
    let connScore = 4.0;
    let asmScore = 4.0;
    let mfgScore = 4.0;

    // Connection evaluation: clearance centering at 0.15mm
    const clearanceDelta = Math.abs(clearance - 0.15);
    if (clearanceDelta <= 0.01) {
      connScore = 4.8;
    } else if (clearanceDelta <= 0.04) {
      connScore = 4.0;
    } else {
      connScore = 2.5;
    }

    // Manufacturing: sheet packing density
    if (packingDensity >= 40.0 && packingDensity <= 70.0) {
      mfgScore = 4.7;
    } else if (packingDensity < 30.0) {
      mfgScore = 3.0; // excessive waste
    } else {
      mfgScore = 3.8;
    }

    // Visual: aspect balance
    if (aspect >= 1.2 && aspect <= 1.8) {
      visScore = 4.6;
    } else {
      visScore = 3.5;
    }

    // Difficulty: piece count
    if (pieceCount >= 3 && pieceCount <= 6) {
      diffScore = 4.5;
    } else {
      diffScore = 3.8;
    }

    // Overall weighted composite
    overallScore = Number(
      (
        visScore * 0.2 +
        connScore * 0.25 +
        mfgScore * 0.2 +
        diffScore * 0.15 +
        asmScore * 0.2
      ).toFixed(2)
    );

    const dimensionScores: Record<PreferenceDimension, number> = {
      overall: overallScore,
      difficulty: diffScore,
      visual: visScore,
      connection: connScore,
      assembly: asmScore,
      manufacturing: mfgScore,
    };

    const acceptanceLikelihood = Number((overallScore / 5.0).toFixed(2));

    return {
      predictedRating: overallScore,
      confidenceScore: 0.85,
      dimensionScores,
      predictedAcceptanceLikelihood: acceptanceLikelihood,
      rationale: `Evaluated parametric features: clearance (${clearance}mm) fit score: ${connScore}, packing density (${packingDensity}%) score: ${mfgScore}.`,
    };
  }

  /**
   * Predicts pairwise preference probability between Candidate A and Candidate B.
   */
  public async predictPairwisePreference(
    featuresA: Record<string, any>,
    featuresB: Record<string, any>
  ): Promise<PairwisePreferencePrediction> {
    const predA = await this.predictPreference(featuresA);
    const predB = await this.predictPreference(featuresB);

    const delta = predA.predictedRating - predB.predictedRating;
    // Logistic probability: P(A > B) = 1 / (1 + exp(-2.0 * delta))
    const probAWin = Number((1 / (1 + Math.exp(-2.0 * delta))).toFixed(3));
    const probBWin = Number((1 - probAWin).toFixed(3));

    let preferredCandidate: "A" | "B" | "TIE" = "TIE";
    if (probAWin > 0.53) preferredCandidate = "A";
    else if (probBWin > 0.53) preferredCandidate = "B";

    const dimensionAdvantages: Record<PreferenceDimension, "A" | "B" | "TIE"> = {} as any;
    const dims: PreferenceDimension[] = [
      "overall",
      "difficulty",
      "visual",
      "connection",
      "assembly",
      "manufacturing",
    ];

    for (const dim of dims) {
      const diff = predA.dimensionScores[dim] - predB.dimensionScores[dim];
      if (diff > 0.1) dimensionAdvantages[dim] = "A";
      else if (diff < -0.1) dimensionAdvantages[dim] = "B";
      else dimensionAdvantages[dim] = "TIE";
    }

    return {
      preferredCandidate,
      probAWin,
      probBWin,
      confidenceScore: 0.88,
      dimensionAdvantages,
      reason: `Predicted ${preferredCandidate} win with probability ${(Math.max(probAWin, probBWin) * 100).toFixed(1)}% (score delta: ${delta > 0 ? "+" : ""}${delta.toFixed(2)} pts).`,
    };
  }

  /**
   * Evaluates prediction calibration against a labeled dataset of examples.
   */
  public async evaluateCalibration(
    examples: PreferenceExample[]
  ): Promise<PreferenceModelMetrics> {
    if (examples.length === 0) {
      return {
        meanAbsoluteError: 0.0,
        rootMeanSquaredError: 0.0,
        pairwiseRankingAccuracy: 1.0,
        evaluatedExamplesCount: 0,
      };
    }

    let totalAbsError = 0;
    let totalSqError = 0;
    let pairwiseCorrect = 0;
    let pairwiseTotal = 0;

    for (const ex of examples) {
      const pred = await this.predictPreference(
        ex.parametric_features_snapshot || { pieceCount: 4, clearance: 0.15 },
        ex.review_context
      );

      const error = Math.abs(pred.predictedRating - ex.rating);
      totalAbsError += error;
      totalSqError += error * error;

      if (ex.comparison_target) {
        pairwiseTotal++;
        // Check if directional preference matches
        const actualWin = ex.comparison_target.preferredDesign;
        if (actualWin === "this" && pred.predictedRating >= 3.0) pairwiseCorrect++;
        else if (actualWin === "target" && pred.predictedRating <= 3.0) pairwiseCorrect++;
        else if (actualWin === "tie") pairwiseCorrect++;
      }
    }

    const count = examples.length;
    return {
      meanAbsoluteError: Number((totalAbsError / count).toFixed(3)),
      rootMeanSquaredError: Number((Math.sqrt(totalSqError / count)).toFixed(3)),
      pairwiseRankingAccuracy:
        pairwiseTotal > 0 ? Number((pairwiseCorrect / pairwiseTotal).toFixed(3)) : 1.0,
      evaluatedExamplesCount: count,
    };
  }
}
