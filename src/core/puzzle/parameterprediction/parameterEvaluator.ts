/**
 * Parameter Prediction Evaluation Engine (Phase 47).
 * Evaluates predicted parameter values against ground-truth parametric dimensions.
 */
import type { ParameterEvaluationReport, ParameterPredictionResult } from "./types";

export class ParameterEvaluator {
  /**
   * Evaluates predicted parameters against ground-truth parameters.
   */
  static evaluate(
    prediction: ParameterPredictionResult,
    groundTruthParams: Record<string, number>,
    toleranceMm: number = 0.5
  ): ParameterEvaluationReport {
    const validPreds = prediction.predictions.filter((p) => p.isValidParam);
    if (validPreds.length === 0) {
      return {
        meanAbsoluteError: 0.0,
        rootMeanSquareError: 0.0,
        withinToleranceRate: 1.0,
        evaluatedCount: 0,
      };
    }

    let absoluteErrorSum = 0;
    let squaredErrorSum = 0;
    let withinToleranceCount = 0;
    let evalCount = 0;

    validPreds.forEach((pred) => {
      const gtVal = groundTruthParams[pred.parameterName];
      if (gtVal !== undefined) {
        const error = Math.abs(pred.value - gtVal);
        absoluteErrorSum += error;
        squaredErrorSum += error * error;
        if (error <= toleranceMm) {
          withinToleranceCount++;
        }
        evalCount++;
      }
    });

    const mae = evalCount > 0 ? absoluteErrorSum / evalCount : 0.0;
    const rmse = evalCount > 0 ? Math.sqrt(squaredErrorSum / evalCount) : 0.0;
    const withinToleranceRate = evalCount > 0 ? withinToleranceCount / evalCount : 1.0;

    return {
      meanAbsoluteError: mae,
      rootMeanSquareError: rmse,
      withinToleranceRate,
      evaluatedCount: evalCount,
    };
  }
}
