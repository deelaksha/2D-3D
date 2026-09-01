import { describe, expect, it } from "vitest";
import { DeterministicAnalyticalParameterModel, DeterministicParameterValidator, MockMLRegressionParameterModel } from "../core/puzzle/parameterprediction/parameterPredictionModel";
import { ParameterEvaluator } from "../core/puzzle/parameterprediction/parameterEvaluator";
import { createCanonicalPiece } from "../core/puzzle/canonical/defaults";

describe("Parametric Feature Prediction Architecture & Evaluator (Phase 47)", () => {
  const pieceA = createCanonicalPiece("Piece A", { width: 100, height: 100, depth: 3.0 }, 3.0);
  pieceA.id = "p_A";

  it("1. DeterministicAnalyticalParameterModel predicts analytical CAD parameters", async () => {
    const model = new DeterministicAnalyticalParameterModel();
    const result = await model.predictParameters(pieceA);

    expect(result.pieceId).toBe("p_A");
    expect(result.predictions.length).toBeGreaterThan(0);

    const tabWidthPred = result.predictions.find((p) => p.parameterName === "tab_width");
    expect(tabWidthPred).toBeDefined();
    expect(tabWidthPred?.value).toBe(20.0);
    expect(tabWidthPred?.unit).toBe("mm");
    expect(tabWidthPred?.confidenceScore).toBe(0.97);
    expect(tabWidthPred?.source).toBe("analytical_fitting");
  });

  it("2. explicitly separates OBSERVED GEOMETRY from PREDICTED PARAMETERS", async () => {
    const model = new DeterministicAnalyticalParameterModel();
    const result = await model.predictParameters(pieceA);

    const pred = result.predictions[0];

    // Observed Geometry Region
    expect(pred.observedRegion).toBeDefined();
    expect(pred.observedRegion.regionId).toBe("reg_p_A");
    expect(pred.observedRegion.boundaryPoints.length).toBeGreaterThan(0);

    // Predicted Parameters
    expect(pred.parameterName).toBeDefined();
    expect(pred.value).toBeDefined();
    expect(pred.confidenceScore).toBeDefined();
  });

  it("3. Deterministic Parameter Validator Gate rejects invalid/negative parameters", () => {
    const negativeRes = DeterministicParameterValidator.validatePrediction("tab_width", -5.0, 100);
    expect(negativeRes.isValid).toBe(false);
    expect(negativeRes.error).toContain("must be positive");

    const exceedRes = DeterministicParameterValidator.validatePrediction("tab_width", 150.0, 100);
    expect(exceedRes.isValid).toBe(false);
    expect(exceedRes.error).toContain("exceeds total piece width");

    const validRes = DeterministicParameterValidator.validatePrediction("tab_width", 20.0, 100);
    expect(validRes.isValid).toBe(true);
  });

  it("4. MockMLRegressionParameterModel predicts ML parameters with confidence scores", async () => {
    const model = new MockMLRegressionParameterModel();
    const result = await model.predictParameters(pieceA);

    expect(result.predictions.length).toBeGreaterThan(0);
    expect(result.predictions[0].confidenceScore).toBe(0.86);
    expect(result.predictions[0].source).toBe("ml_regression_model");
  });

  it("5. ParameterEvaluator evaluates MAE, RMSE, and within-tolerance rate", async () => {
    const model = new MockMLRegressionParameterModel();
    const result = await model.predictParameters(pieceA);

    const groundTruth = {
      tab_width: 20.0,  // ML predicted 19.8 -> delta = 0.2mm
      tab_depth: 10.0,  // ML predicted 10.2 -> delta = 0.2mm
      slot_width: 20.0, // ML predicted 20.1 -> delta = 0.1mm
      thickness: 3.0,   // ML predicted 3.0  -> delta = 0.0mm
    };

    const evalReport = ParameterEvaluator.evaluate(result, groundTruth, 0.5);

    expect(evalReport.evaluatedCount).toBe(4);
    expect(evalReport.meanAbsoluteError).toBeLessThan(0.3); // ~0.125mm MAE
    expect(evalReport.rootMeanSquareError).toBeLessThan(0.3);
    expect(evalReport.withinToleranceRate).toBe(1.0); // All deltas <= 0.5mm
  });
});
