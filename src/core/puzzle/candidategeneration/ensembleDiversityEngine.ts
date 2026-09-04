/**
 * Ensemble Diversity Engine (Phase 74).
 *
 * Measures pairwise and ensemble-wide parametric diversity among generated candidates.
 * Ensures the system does not produce redundant or identical designs.
 */

import type {
  DesignCandidate,
  EnsembleDiversityReport,
  PairwiseCandidateDistance,
} from "./types";

export class EnsembleDiversityEngine {
  /**
   * Evaluates diversity across an ensemble of generated candidates.
   */
  public static measureEnsembleDiversity(
    candidates: DesignCandidate[]
  ): EnsembleDiversityReport {
    const n = candidates.length;

    if (n <= 1) {
      return {
        ensembleDiversityScore: 1.0,
        pairwiseDistances: [],
        minPairwiseDistance: 1.0,
        maxPairwiseDistance: 1.0,
        averagePairwiseDistance: 1.0,
        isSufficientlyDiverse: true,
        duplicatePairsDetected: [],
      };
    }

    const pairwiseDistances: PairwiseCandidateDistance[] = [];
    const duplicatePairsDetected: Array<[string, string]> = [];
    let totalDistance = 0;
    let minDistance = 1.0;
    let maxDistance = 0.0;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const pairResult = this.computePairwiseDistance(candidates[i], candidates[j]);
        pairwiseDistances.push(pairResult);
        totalDistance += pairResult.distance;

        if (pairResult.distance < minDistance) minDistance = pairResult.distance;
        if (pairResult.distance > maxDistance) maxDistance = pairResult.distance;

        if (pairResult.distance < 0.03) {
          duplicatePairsDetected.push([candidates[i].candidateId, candidates[j].candidateId]);
        }
      }
    }

    const pairCount = pairwiseDistances.length;
    const averageDistance = Number((totalDistance / Math.max(1, pairCount)).toFixed(3));
    const isSufficientlyDiverse = duplicatePairsDetected.length === 0 && averageDistance >= 0.08;

    return {
      ensembleDiversityScore: averageDistance,
      pairwiseDistances,
      minPairwiseDistance: Number(minDistance.toFixed(3)),
      maxPairwiseDistance: Number(maxDistance.toFixed(3)),
      averagePairwiseDistance: averageDistance,
      isSufficientlyDiverse,
      duplicatePairsDetected,
    };
  }

  /**
   * Computes normalized distance D(A, B) in [0.0, 1.0] between two candidates.
   */
  public static computePairwiseDistance(
    candA: DesignCandidate,
    candB: DesignCandidate
  ): PairwiseCandidateDistance {
    const specA = candA.specification;
    const specB = candB.specification;
    const diffs: string[] = [];

    // 1. Piece Count Distance (weight 0.25)
    const maxPieces = Math.max(specA.piece_count, specB.piece_count, 1);
    const pieceCountDiff = Math.abs(specA.piece_count - specB.piece_count) / maxPieces;
    if (specA.piece_count !== specB.piece_count) {
      diffs.push(`Piece count: ${specA.piece_count} vs ${specB.piece_count}`);
    }

    // 2. Aspect Ratio Distance (weight 0.20)
    const arA = specA.overall_size.widthMm / Math.max(1, specA.overall_size.heightMm);
    const arB = specB.overall_size.widthMm / Math.max(1, specB.overall_size.heightMm);
    const maxAr = Math.max(arA, arB, 0.1);
    const arDiff = Math.min(1.0, Math.abs(arA - arB) / maxAr);
    if (Math.abs(arA - arB) > 0.1) {
      diffs.push(`Aspect ratio: ${arA.toFixed(2)} vs ${arB.toFixed(2)}`);
    }

    // 3. Overall Volume / Scale Distance (weight 0.15)
    const volA = specA.overall_size.widthMm * specA.overall_size.heightMm * (specA.overall_size.depthMm || 100);
    const volB = specB.overall_size.widthMm * specB.overall_size.heightMm * (specB.overall_size.depthMm || 100);
    const maxVol = Math.max(volA, volB, 1);
    const volDiff = Math.min(1.0, Math.abs(volA - volB) / maxVol);
    if (volDiff > 0.1) {
      diffs.push(`Bounding volume delta: ${(volDiff * 100).toFixed(0)}%`);
    }

    // 4. Connection Topology & Joining Angle Distance (weight 0.20)
    const jointTypeA = specA.connection_preferences?.defaultType || "tab_slot";
    const jointTypeB = specB.connection_preferences?.defaultType || "tab_slot";
    const jointTypeDiff = jointTypeA === jointTypeB ? 0.0 : 0.6;
    if (jointTypeA !== jointTypeB) {
      diffs.push(`Joint style: ${jointTypeA} vs ${jointTypeB}`);
    }

    const angleA = specA.connection_preferences?.preferredJoiningAngleDeg ?? 90;
    const angleB = specB.connection_preferences?.preferredJoiningAngleDeg ?? 90;
    const angleDiff = Math.min(1.0, Math.abs(angleA - angleB) / 180.0);
    if (Math.abs(angleA - angleB) > 5) {
      diffs.push(`Joining angle: ${angleA}° vs ${angleB}°`);
    }

    // 5. Stock Layout / Sheet Dimensions Distance (weight 0.10)
    const stockAreaA = (specA.material?.stockWidthMm ?? 300) * (specA.material?.stockHeightMm ?? 300);
    const stockAreaB = (specB.material?.stockWidthMm ?? 300) * (specB.material?.stockHeightMm ?? 300);
    const maxStock = Math.max(stockAreaA, stockAreaB, 1);
    const stockDiff = Math.min(1.0, Math.abs(stockAreaA - stockAreaB) / maxStock);

    // 6. Symmetry Distance (weight 0.10)
    const symA = specA.symmetry?.isSymmetrical ?? false;
    const symB = specB.symmetry?.isSymmetrical ?? false;
    const symDiff = symA === symB ? 0.0 : 1.0;
    if (symA !== symB) {
      diffs.push(`Symmetry: ${symA ? "Symmetrical" : "Asymmetrical"} vs ${symB ? "Symmetrical" : "Asymmetrical"}`);
    }

    // Weighted composite distance
    const totalDistance =
      pieceCountDiff * 0.25 +
      arDiff * 0.20 +
      volDiff * 0.15 +
      (jointTypeDiff * 0.5 + angleDiff * 0.5) * 0.20 +
      stockDiff * 0.10 +
      symDiff * 0.10;

    const normalizedDistance = Number(Math.min(1.0, Math.max(0.0, totalDistance)).toFixed(3));

    return {
      candidateAId: candA.candidateId,
      candidateBId: candB.candidateId,
      distance: normalizedDistance,
      differences: diffs.length > 0 ? diffs : ["Identical parametric specifications"],
    };
  }
}
