/**
 * Candidate Ranker (Phase 74).
 *
 * Implements strict multi-tier candidate ranking:
 *
 * STRICT INVARIANT:
 *  "The system must never rank an invalid candidate above a valid candidate."
 *  - Every valid candidate strictly precedes any invalid candidate in rank.
 *  - Valid candidates are ranked by their multi-criteria composite score.
 *  - Invalid candidates are partitioned strictly below all valid candidates and
 *    ranked by gate pass count and defect severity.
 */

import type { DesignCandidate } from "./types";

export class CandidateRanker {
  /**
   * Strictly ranks an ensemble of candidates ensuring the validity invariant is preserved.
   */
  public static rankCandidates(candidates: DesignCandidate[]): {
    rankedCandidates: DesignCandidate[];
    topCandidate?: DesignCandidate;
    rankingCriteria: string[];
  } {
    const rankingCriteria = [
      "Strict Invariant: Valid candidates (passing all 5 gates) ALWAYS precede invalid candidates",
      "Valid tier: Ordered by multi-criteria composite score [0.0, 100.0] descending",
      "Invalid tier: Ordered by number of passed validation gates descending, then composite score",
    ];

    const sorted = [...candidates].sort((a, b) => {
      const aValid = a.metrics.validity.isValid;
      const bValid = b.metrics.validity.isValid;

      // --- 1. STRICT VALIDITY INVARIANT ---
      if (aValid && !bValid) return -1; // a comes first
      if (!aValid && bValid) return 1;  // b comes first

      // --- 2. BOTH VALID TIER ---
      if (aValid && bValid) {
        if (b.metrics.compositeScore !== a.metrics.compositeScore) {
          return b.metrics.compositeScore - a.metrics.compositeScore;
        }
        // Tie-breaker: Assembly quality score
        return b.metrics.assemblyQuality.score - a.metrics.assemblyQuality.score;
      }

      // --- 3. BOTH INVALID TIER ---
      // Rank by number of passed validation gates first
      if (b.metrics.validity.gatePassCount !== a.metrics.validity.gatePassCount) {
        return b.metrics.validity.gatePassCount - a.metrics.validity.gatePassCount;
      }
      // Then by composite score
      return b.metrics.compositeScore - a.metrics.compositeScore;
    });

    // Assign 1-indexed ranks and isViable flags
    const rankedCandidates = sorted.map((cand, idx) => ({
      ...cand,
      rank: idx + 1,
      isViable: cand.metrics.validity.isValid,
    }));

    const topCandidate = rankedCandidates.find((c) => c.metrics.validity.isValid);

    return {
      rankedCandidates,
      topCandidate,
      rankingCriteria,
    };
  }
}
