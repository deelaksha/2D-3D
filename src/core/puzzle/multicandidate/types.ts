/**
 * Multi-Candidate Design Generation Types & Models (Phase 53).
 */
import type { DesignSpecification } from "../ai/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { AIDesignValidationResult } from "../aivalidationgate/types";

export interface CandidateScore {
  overallScore: number;                 // 0.0 to 1.0
  manufacturabilityScore: number;       // Ease of laser/die cutting
  assemblyFeasibilityScore: number;     // Physical assembly joining feasibility
  aestheticComplexityScore: number;     // Visual intricacy & user interest
  constraintSatisfactionScore: number; // Hard/soft constraint compliance
}

export interface DesignCandidate {
  candidateId: string;
  candidateLabel: string;               // e.g. "Candidate A (Tab & Slot Baseline)"
  specification: DesignSpecification;
  canonicalPuzzle?: CanonicalPuzzle;
  validationResult: AIDesignValidationResult;
  score: CandidateScore;
  parameterVariationSummary: Record<string, string | number>;
}

export interface CandidateComparison {
  comparisonId: string;
  candidates: DesignCandidate[];
  recommendedCandidate?: DesignCandidate;
  rankingReason: string;
  processingDurationMs: number;
}
