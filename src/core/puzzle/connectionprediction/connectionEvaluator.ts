/**
 * Connection Prediction Evaluation Engine (Phase 46).
 * Evaluates predicted connection candidate pairs against ground-truth canonical connections.
 */
import type { ConnectionEvaluationReport, ConnectionPredictionResult } from "./types";
import type { CanonicalConnection } from "../canonical/types";

export class ConnectionEvaluator {
  /**
   * Evaluates connection predictions against ground truth canonical connections.
   */
  static evaluate(
    prediction: ConnectionPredictionResult,
    groundTruthConnections: CanonicalConnection[]
  ): ConnectionEvaluationReport {
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;

    prediction.predictions.forEach((pred) => {
      // Find matching ground truth connection pair
      const gtMatch = groundTruthConnections.find(
        (gt) =>
          (gt.interfaceAId === pred.sourceInterfaceId && gt.interfaceBId === pred.targetInterfaceId) ||
          (gt.interfaceAId === pred.targetInterfaceId && gt.interfaceBId === pred.sourceInterfaceId)
      );

      const gtIsCompatible = !!gtMatch;

      if (pred.compatible && gtIsCompatible) {
        tp++;
      } else if (pred.compatible && !gtIsCompatible) {
        fp++;
      } else if (!pred.compatible && !gtIsCompatible) {
        tn++;
      } else if (!pred.compatible && gtIsCompatible) {
        fn++;
      }
    });

    const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1.0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0.0;
    const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0.0;
    const falseNegativeRate = fn + tp > 0 ? fn / (fn + tp) : 0.0;

    return {
      precision,
      recall,
      f1Score,
      falsePositiveRate,
      falseNegativeRate,
      tpCount: tp,
      fpCount: fp,
      tnCount: tn,
      fnCount: fn,
    };
  }
}
