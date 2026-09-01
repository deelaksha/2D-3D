/**
 * Replaceable Parameter Prediction Models & Baseline Providers (Phase 47).
 */
import type { ObservedGeometryRegion, ParameterPrediction, ParameterPredictionName, ParameterPredictionResult } from "./types";
import type { CanonicalPiece } from "../canonical/types";

export interface ParameterPredictionModel {
  predictParameters(
    piece: CanonicalPiece | unknown,
    observedRegion?: ObservedGeometryRegion
  ): Promise<ParameterPredictionResult>;
}

/**
 * Deterministic Parameter Validator Gate.
 * Enforces physical validity on all predicted parameters before CAD instantiation.
 * Prevents ML models from directly introducing degenerate or invalid geometry.
 */
export class DeterministicParameterValidator {
  static validatePrediction(
    paramName: ParameterPredictionName,
    value: number,
    pieceWidth: number = 100
  ): { isValid: boolean; error?: string } {
    if (isNaN(value) || !isFinite(value)) {
      return { isValid: false, error: "Parameter value is NaN or infinite." };
    }

    if (value <= 0) {
      return { isValid: false, error: `Parameter ${paramName} must be positive (> 0), got ${value}.` };
    }

    if (paramName === "thickness" && value < 0.5) {
      return { isValid: false, error: `Cardboard thickness ${value}mm is below minimum allowable threshold (0.5mm).` };
    }

    if ((paramName === "tab_width" || paramName === "slot_width") && value >= pieceWidth) {
      return { isValid: false, error: `${paramName} (${value}mm) exceeds total piece width (${pieceWidth}mm).` };
    }

    return { isValid: true };
  }
}

/**
 * Deterministic Analytical Feature Parameter Model (Baseline).
 * Extracts analytical parameters from 2D piece bounding properties.
 */
export class DeterministicAnalyticalParameterModel implements ParameterPredictionModel {
  async predictParameters(
    piece: CanonicalPiece | unknown,
    observedRegion?: ObservedGeometryRegion
  ): Promise<ParameterPredictionResult> {
    const startTime = Date.now();
    const cPiece = piece as CanonicalPiece;
    const pId = cPiece.id || "p_unknown";

    const region: ObservedGeometryRegion = observedRegion || {
      regionId: `reg_${pId}`,
      pieceId: pId,
      boundaryPoints: [
        { x: 0, y: 0 },
        { x: cPiece.dimensions?.width || 100, y: 0 },
        { x: cPiece.dimensions?.width || 100, y: cPiece.dimensions?.height || 100 },
        { x: 0, y: cPiece.dimensions?.height || 100 },
      ],
      description: `Observed geometry contour for piece ${pId}`,
    };

    const rawParams: Array<{ name: ParameterPredictionName; val: number }> = [
      { name: "width", val: cPiece.dimensions?.width || 100.0 },
      { name: "height", val: cPiece.dimensions?.height || 100.0 },
      { name: "thickness", val: cPiece.dimensions?.depth || 3.0 },
      { name: "tab_width", val: 20.0 },
      { name: "tab_depth", val: 10.0 },
      { name: "slot_width", val: 20.0 },
      { name: "slot_depth", val: 10.0 },
      { name: "clearance", val: 0.15 },
    ];

    const predictions: ParameterPrediction[] = [];

    rawParams.forEach((param, idx) => {
      const vResult = DeterministicParameterValidator.validatePrediction(
        param.name,
        param.val,
        cPiece.dimensions?.width || 100
      );

      predictions.push({
        predictionId: `pred_param_${pId}_${idx}`,
        pieceId: pId,
        parameterName: param.name,
        value: param.val,
        unit: "mm",
        confidenceScore: 0.97,
        source: "analytical_fitting",
        observedRegion: region,
        isValidParam: vResult.isValid,
        validationError: vResult.error,
      });
    });

    return {
      resultId: `res_param_analytical_${Date.now()}`,
      pieceId: pId,
      predictions,
      overallConfidence: 0.97,
      processingDurationMs: Date.now() - startTime,
    };
  }
}

/**
 * Mock ML Regression Parameter Prediction Model (Replaceable ML Stub).
 */
export class MockMLRegressionParameterModel implements ParameterPredictionModel {
  async predictParameters(
    piece: CanonicalPiece | unknown,
    observedRegion?: ObservedGeometryRegion
  ): Promise<ParameterPredictionResult> {
    const startTime = Date.now();
    const cPiece = piece as CanonicalPiece;
    const pId = cPiece.id || "p_unknown";

    const region: ObservedGeometryRegion = observedRegion || {
      regionId: `reg_ml_${pId}`,
      pieceId: pId,
      boundaryPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
      description: `ML observed image patch for piece ${pId}`,
    };

    const rawParams: Array<{ name: ParameterPredictionName; val: number }> = [
      { name: "tab_width", val: 19.8 },
      { name: "tab_depth", val: 10.2 },
      { name: "slot_width", val: 20.1 },
      { name: "thickness", val: 3.0 },
    ];

    const predictions: ParameterPrediction[] = [];

    rawParams.forEach((param, idx) => {
      const vResult = DeterministicParameterValidator.validatePrediction(
        param.name,
        param.val,
        cPiece.dimensions?.width || 100
      );

      predictions.push({
        predictionId: `pred_ml_param_${pId}_${idx}`,
        pieceId: pId,
        parameterName: param.name,
        value: param.val,
        unit: "mm",
        confidenceScore: 0.86,
        source: "ml_regression_model",
        observedRegion: region,
        isValidParam: vResult.isValid,
        validationError: vResult.error,
      });
    });

    return {
      resultId: `res_param_ml_${Date.now()}`,
      pieceId: pId,
      predictions,
      overallConfidence: 0.86,
      processingDurationMs: Date.now() - startTime,
    };
  }
}
