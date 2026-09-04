/**
 * Multi-Candidate AI Design Generator (Phase 74).
 *
 * Coordinates end-to-end multi-candidate generation:
 *  1. Accepts requirement with configurable candidate count N (default: 3).
 *  2. Generates N diverse parametric design specifications using systematic strategies.
 *  3. Independently compiles and validates each candidate through deterministic geometry engines.
 *  4. Evaluates all 7 metrics (validity, difficulty, material, connection, assembly, similarity, manufacturability).
 *  5. Measures ensemble diversity and detects duplicate candidates.
 *  6. Strictly ranks candidates: valid candidates ALWAYS rank above invalid candidates.
 */

import type {
  CandidateGenerationRequest,
  DesignCandidate,
  MultiCandidateGenerationResult,
} from "./types";
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { CanonicalPuzzle } from "../canonical/types";
import { DesignSpecificationCompiler } from "../designgeneration/designSpecificationCompiler";
import { CandidateMetricsEvaluator } from "./candidateMetricsEvaluator";
import { EnsembleDiversityEngine } from "./ensembleDiversityEngine";
import { CandidateRanker } from "./candidateRanker";
import { uid } from "@/core/model/ids";

export class MultiCandidateGenerator {
  /**
   * Generates, compiles, validates, evaluates, and ranks N candidate designs.
   */
  public static async generateCandidates(
    request: CandidateGenerationRequest
  ): Promise<MultiCandidateGenerationResult> {
    const startTime = Date.now();
    const runId = uid("multi_cand_run_");
    const count = Math.max(1, request.candidateCount ?? 3);

    // 1. Synthesize N diverse parametric specifications
    const unrankedCandidates: DesignCandidate[] = [];

    for (let i = 0; i < count; i++) {
      const candidateId = uid(`cand_${i + 1}_`);
      const { spec, strategy } = this.synthesizeCandidateSpec(i, count, request);

      // 2. Independently compile candidate geometry
      let compiledPuzzle: CanonicalPuzzle | undefined;
      try {
        compiledPuzzle = DesignSpecificationCompiler.compile(spec);
      } catch {
        // Compile failures will be caught and reflected in validity metrics
      }

      // 3. Independently evaluate the 7 required metrics
      const metrics = CandidateMetricsEvaluator.evaluateCandidate(spec, compiledPuzzle, request);

      unrankedCandidates.push({
        candidateId,
        candidateIndex: i,
        strategy,
        specification: spec,
        canonicalPuzzle: metrics.validity.isValid ? compiledPuzzle : undefined,
        metrics,
        rank: i + 1, // Will be updated by ranker
        isViable: metrics.validity.isValid,
      });
    }

    // 4. Measure Ensemble Diversity
    const diversityReport = EnsembleDiversityEngine.measureEnsembleDiversity(unrankedCandidates);

    // 5. Strictly Rank Candidates (Valid ALWAYS above Invalid)
    const { rankedCandidates, topCandidate, rankingCriteria } =
      CandidateRanker.rankCandidates(unrankedCandidates);

    const validCandidateCount = rankedCandidates.filter((c) => c.metrics.validity.isValid).length;
    const invalidCandidateCount = rankedCandidates.length - validCandidateCount;

    return {
      runId,
      prompt: request.prompt,
      candidateCountRequested: count,
      candidateCountGenerated: rankedCandidates.length,
      validCandidateCount,
      invalidCandidateCount,
      candidates: rankedCandidates,
      topCandidate,
      diversityReport,
      rankingCriteria,
      processingDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Synthesizes distinct candidate specifications using systematic design strategies.
   */
  private static synthesizeCandidateSpec(
    index: number,
    totalCount: number,
    request: CandidateGenerationRequest
  ): { spec: ParametricDesignSpecification; strategy: string } {
    const userPref = request.userPreferences || {};
    const ref = request.retrievedDesigns && request.retrievedDesigns.length > 0 ? request.retrievedDesigns[0] : undefined;

    const basePieceCount = userPref.targetPieceCount ?? (ref ? ref.features.pieceCount : 4);
    const baseWidth = userPref.targetDimensions?.widthMm ?? (ref ? ref.features.dimensions.widthMm : 180);
    const baseHeight = userPref.targetDimensions?.heightMm ?? (ref ? ref.features.dimensions.heightMm : 120);
    const baseDepth = userPref.targetDimensions?.depthMm ?? (ref ? ref.features.dimensions.depthMm : 80);
    const baseMaterialId = userPref.preferredMaterialId ?? "cardboard-corrugated-2mm";

    // Strategies tailored to explore the design space
    const strategies = [
      "Balanced Baseline",
      "Compact High-Efficiency",
      "Structural Interlock",
      "Bilateral Symmetrical",
      "Minimalist Sturdy",
      "Continuous Angle Variation",
      "High Density Modular",
    ];

    const strategy = strategies[index % strategies.length];

    let pieceCount = basePieceCount;
    let width = baseWidth;
    let height = baseHeight;
    let depth = baseDepth;
    let clearance = 0.15;
    let joiningAngle = userPref.defaultJoiningAngleDeg ?? 90.0;
    let isSymmetrical = false;
    let stockW = 320;
    let stockH = 260;

    switch (strategy) {
      case "Balanced Baseline":
        pieceCount = Math.max(3, basePieceCount);
        width = baseWidth;
        height = baseHeight;
        stockW = 300;
        stockH = 300;
        clearance = 0.15;
        joiningAngle = 90.0;
        break;

      case "Compact High-Efficiency":
        // Downsized bounding volume for higher packing density
        pieceCount = Math.max(3, basePieceCount);
        width = Math.round(baseWidth * 0.85);
        height = Math.round(baseHeight * 0.85);
        stockW = Math.round(width * 1.3);
        stockH = Math.round(height * 1.3);
        clearance = 0.14;
        joiningAngle = 90.0;
        break;

      case "Structural Interlock":
        // Higher piece count and multi-interface density
        pieceCount = Math.min(8, basePieceCount + 2);
        width = Math.round(baseWidth * 1.15);
        height = Math.round(baseHeight * 1.10);
        stockW = Math.round(width * 1.4);
        stockH = Math.round(height * 1.3);
        clearance = 0.15;
        joiningAngle = 90.0;
        break;

      case "Bilateral Symmetrical":
        // Even piece count with bilateral symmetry
        pieceCount = basePieceCount % 2 === 0 ? basePieceCount : basePieceCount + 1;
        width = baseWidth;
        height = baseHeight;
        isSymmetrical = true;
        stockW = 320;
        stockH = 280;
        clearance = 0.15;
        joiningAngle = 90.0;
        break;

      case "Minimalist Sturdy":
        // Fewer, robust pieces
        pieceCount = Math.max(3, basePieceCount - 1);
        width = Math.round(baseWidth * 1.1);
        height = Math.round(baseHeight * 0.95);
        stockW = 350;
        stockH = 280;
        clearance = 0.16;
        joiningAngle = 90.0;
        break;

      default:
        // Modular variations for N > 5
        pieceCount = Math.max(3, basePieceCount + (index % 3) - 1);
        width = Math.round(baseWidth * (1.0 + (index * 0.05)));
        height = Math.round(baseHeight * (1.0 - (index * 0.03)));
        stockW = Math.round(width * 1.35);
        stockH = Math.round(height * 1.35);
        clearance = 0.15;
        joiningAngle = 90.0;
        break;
    }

    const spec: ParametricDesignSpecification = {
      specificationId: uid(`spec_cand_${index + 1}_`),
      overall_size: {
        widthMm: width,
        heightMm: height,
        depthMm: depth,
      },
      piece_count: pieceCount,
      layers: userPref.layers ?? 1,
      material: {
        stockThicknessMm: 2.0,
        stockWidthMm: stockW,
        stockHeightMm: stockH,
        materialId: baseMaterialId,
      },
      connection_preferences: {
        defaultType: userPref.preferredJointType ?? "tab_slot",
        preferredJoiningAngleDeg: joiningAngle,
        genderStyle: "complementary",
        clearance,
      } as any,
      difficulty: {
        level: userPref.targetDifficulty ?? "medium",
        maxUniquePieces: pieceCount,
      },
      symmetry: {
        isSymmetrical,
        symmetryAxis: "y",
      },
      constraints: [],
    };

    return { spec, strategy };
  }
}
