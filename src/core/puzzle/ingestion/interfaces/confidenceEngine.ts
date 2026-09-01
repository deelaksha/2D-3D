/**
 * Confidence & Uncertainty Engine.
 * Evaluates feature geometry, aspect ratios, and feature parameters to compute confidence scores (0.0 to 1.0).
 * Flags uncertain features (confidence < 0.6) with explicit diagnostic reasons.
 */
import type { DetectedFeatureKind } from "./types";

export interface ConfidenceEvaluation {
  confidence: number;
  uncertain: boolean;
  diagnosticReason?: string;
}

export class ConfidenceEngine {
  /**
   * Evaluates feature confidence for tabs, slots, notches, finger interlocks, and flat contact edges.
   */
  static evaluateConfidence(
    featureKind: DetectedFeatureKind,
    widthMm: number,
    depthMm: number,
    materialThicknessMm: number
  ): ConfidenceEvaluation {
    if (featureKind === "tab") {
      if (widthMm >= 5.0 && widthMm <= 50.0 && Math.abs(depthMm - materialThicknessMm) <= 2.0) {
        return { confidence: 0.95, uncertain: false };
      } else if (widthMm < 3.0 || widthMm > 80.0) {
        return {
          confidence: 0.45,
          uncertain: true,
          diagnosticReason: `Tab width (${widthMm.toFixed(1)}mm) is outside typical manufacturing bounds.`,
        };
      } else {
        return { confidence: 0.75, uncertain: false };
      }
    }

    if (featureKind === "slot") {
      if (widthMm >= 5.0 && widthMm <= 50.0 && Math.abs(depthMm - materialThicknessMm) <= 2.0) {
        return { confidence: 0.95, uncertain: false };
      } else if (widthMm < 2.0) {
        return {
          confidence: 0.40,
          uncertain: true,
          diagnosticReason: `Slot width (${widthMm.toFixed(1)}mm) is too narrow for standard slot mating.`,
        };
      } else {
        return { confidence: 0.80, uncertain: false };
      }
    }

    if (featureKind === "notch") {
      return { confidence: 0.85, uncertain: false };
    }

    if (featureKind === "interlock") {
      return { confidence: 0.90, uncertain: false };
    }

    if (featureKind === "flat_contact") {
      if (widthMm >= 15.0) {
        return { confidence: 0.90, uncertain: false };
      } else {
        return {
          confidence: 0.50,
          uncertain: true,
          diagnosticReason: `Flat contact length (${widthMm.toFixed(1)}mm) is too short for stable mating.`,
        };
      }
    }

    // Default fallback for ambiguous or unclassified features
    return {
      confidence: 0.35,
      uncertain: true,
      diagnosticReason: "Feature geometry could not be confidently matched to a known interface profile.",
    };
  }
}
