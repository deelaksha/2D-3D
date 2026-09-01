/**
 * Interface Recognition Evaluation Engine (Phase 45).
 * Evaluates predicted interface candidate ports against ground-truth canonical interfaces.
 */
import type { InterfacePrediction, InterfaceRecognitionEvaluationReport, InterfaceRecognitionResult } from "./types";
import type { CanonicalInterface } from "../canonical/types";

export class InterfaceRecognitionEvaluator {
  /**
   * Evaluates interface candidate recognition predictions against ground truth canonical interfaces.
   */
  static evaluate(
    prediction: InterfaceRecognitionResult,
    groundTruthInterfaces: CanonicalInterface[]
  ): InterfaceRecognitionEvaluationReport {
    const gtCount = groundTruthInterfaces.length;
    const predList = prediction.predictions;

    let tp = 0;
    let fp = 0;
    let correctTypes = 0;
    const matchedGt = new Set<string>();

    predList.forEach((pred) => {
      // Find matching ground truth interface by owning piece and local origin distance
      const gtMatch = groundTruthInterfaces.find((gt) => {
        if (matchedGt.has(gt.id)) return false;
        const dx = Math.abs(gt.localFrame.origin.x - pred.localFrame.origin.x);
        const dy = Math.abs(gt.localFrame.origin.y - pred.localFrame.origin.y);
        return dx < 5.0 && dy < 5.0; // Within 5mm tolerance
      });

      if (gtMatch) {
        tp++;
        matchedGt.add(gtMatch.id);

        // Check if interface kind matches gender role (e.g. "tab" <-> "insert", "slot" <-> "receiver")
        const expectedKind = gtMatch.compatibility.genderRole === "insert" ? "tab" : "slot";
        if (pred.kind === expectedKind) {
          correctTypes++;
        }
      } else {
        fp++;
      }
    });

    const fn = Math.max(0, gtCount - tp);

    const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1.0;
    const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0.0;
    const typeAccuracy = tp > 0 ? correctTypes / tp : 1.0;

    return {
      precision,
      recall,
      f1Score,
      typeAccuracy,
      tpCount: tp,
      fpCount: fp,
      fnCount: fn,
    };
  }
}
