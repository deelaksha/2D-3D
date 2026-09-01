/**
 * Multi-Candidate Design Generator, Scorer & Comparison Engine (Phase 53).
 */
import type { CandidateComparison, CandidateScore, DesignCandidate } from "./types";
import type { DesignSpecification } from "../ai/types";
import { RequirementParser } from "../ai/requirementParser";
import { convertPlanToSpecification, MockDesignPlanner } from "../designplanner/designPlanner";
import { AIDesignValidationGate } from "../aivalidationgate/aiDesignValidationGate";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../canonical/defaults";
import type { CanonicalPuzzle } from "../canonical/types";

export interface CandidateGenerator {
  generateCandidates(requirement: string, candidateCount?: number): Promise<CandidateComparison>;
}

export class CandidateScorer {
  static scoreCandidate(
    spec: DesignSpecification,
    puzzle: CanonicalPuzzle,
    validationResult: import("../aivalidationgate/types").AIDesignValidationResult
  ): CandidateScore {
    const pc = spec.designParameters.pieceCount || 3;
    const thickness = spec.materialParameters.thicknessMm;

    // 1. Manufacturability Score (0.0 to 1.0)
    let mfgScore = 0.95;
    if (pc > 30) mfgScore -= 0.15;
    if (thickness < 1.0 || thickness > 10.0) mfgScore -= 0.2;

    // 2. Assembly Feasibility Score (0.0 to 1.0)
    let assemblyScore = 0.90;
    if (spec.assemblyParameters.assemblyType === "multi_angle") assemblyScore += 0.05;

    // 3. Aesthetic Complexity Score (0.0 to 1.0)
    let aestheticScore = 0.70;
    if (pc >= 10) aestheticScore += 0.15;
    if (spec.designParameters.innerPieceComplexity === "complex") aestheticScore += 0.10;

    // 4. Constraint Satisfaction Score (1.0 for ACCEPTED, 0.0 for REJECTED)
    const constraintScore = validationResult.status === "ACCEPTED" ? 1.0 : 0.0;

    const overallScore = Math.max(
      0.0,
      Math.min(
        1.0,
        0.3 * mfgScore + 0.3 * assemblyScore + 0.2 * aestheticScore + 0.2 * constraintScore
      )
    );

    return {
      overallScore: Number(overallScore.toFixed(3)),
      manufacturabilityScore: Number(mfgScore.toFixed(3)),
      assemblyFeasibilityScore: Number(assemblyScore.toFixed(3)),
      aestheticComplexityScore: Number(aestheticScore.toFixed(3)),
      constraintSatisfactionScore: Number(constraintScore.toFixed(3)),
    };
  }
}

export class DeterministicCandidateGenerator implements CandidateGenerator {
  private parser: RequirementParser;
  private planner: MockDesignPlanner;

  constructor(parser?: RequirementParser, planner?: MockDesignPlanner) {
    this.parser = parser || new RequirementParser();
    this.planner = planner || new MockDesignPlanner();
  }

  async generateCandidates(requirement: string, candidateCount: number = 5): Promise<CandidateComparison> {
    const startTime = Date.now();
    const comparisonId = `comp_${Date.now()}`;

    // Base Design Plan
    const basePlan = await this.planner.createDesignPlan({ userRequirement: requirement });
    const baseSpec = convertPlanToSpecification(basePlan);
    const basePieceCount = baseSpec.designParameters.pieceCount || 3;

    const candidateLabels = [
      "Candidate A (Standard Baseline)",
      "Candidate B (High Density Interlock)",
      "Candidate C (Compact Multi-Angle)",
      "Candidate D (Reinforced Heavy Stock)",
      "Candidate E (Complex Radial Symmetry)",
    ];

    const candidates: DesignCandidate[] = [];

    for (let i = 0; i < Math.min(candidateCount, candidateLabels.length); i++) {
      const label = candidateLabels[i];
      const candId = `cand_${String.fromCharCode(65 + i)}`;

      // Systematically vary parameters across valid design space
      const specCopy: DesignSpecification = JSON.parse(JSON.stringify(baseSpec));
      specCopy.specId = `spec_${candId}`;

      const varSummary: Record<string, string | number> = {};

      if (i === 1) {
        specCopy.designParameters.pieceCount = Math.max(1, Math.round(basePieceCount * 1.5));
        specCopy.designParameters.innerPieceComplexity = "complex";
        varSummary["pieceCount"] = specCopy.designParameters.pieceCount;
        varSummary["complexity"] = "complex";
      } else if (i === 2) {
        specCopy.assemblyParameters.assemblyType = "multi_angle";
        specCopy.assemblyParameters.allowedAssemblyAnglesDeg = [0, 45, 90, 135, 180];
        varSummary["assemblyType"] = "multi_angle";
      } else if (i === 3) {
        specCopy.materialParameters.thicknessMm = 4.5;
        varSummary["thicknessMm"] = 4.5;
      } else if (i === 4) {
        specCopy.designParameters.pieceCount = Math.max(1, Math.round(basePieceCount * 2.0));
        specCopy.designParameters.connectionStyle = "finger_joint";
        varSummary["pieceCount"] = specCopy.designParameters.pieceCount;
        varSummary["connectionStyle"] = "finger_joint";
      } else {
        varSummary["baseline"] = "standard_parameters";
      }

      // Generate canonical puzzle geometry for candidate
      const canonicalPuzzle = this.buildCanonicalPuzzleForSpec(specCopy, candId);

      // Independently validate candidate
      const validationResult = AIDesignValidationGate.validateAIDesign(canonicalPuzzle, specCopy);

      // Independently score candidate
      const score = CandidateScorer.scoreCandidate(specCopy, canonicalPuzzle, validationResult);

      candidates.push({
        candidateId: candId,
        candidateLabel: label,
        specification: specCopy,
        canonicalPuzzle,
        validationResult,
        score,
        parameterVariationSummary: varSummary,
      });
    }

    // Sort candidates by overall score descending
    candidates.sort((a, b) => b.score.overallScore - a.score.overallScore);
    const recommended = candidates.find((c) => c.validationResult.status === "ACCEPTED") || candidates[0];

    const rankingReason = recommended
      ? `Selected ${recommended.candidateLabel} with highest overall score (${recommended.score.overallScore}) and passing validation gate.`
      : "No valid candidate passed validation gate.";

    return {
      comparisonId,
      candidates,
      recommendedCandidate: recommended,
      rankingReason,
      processingDurationMs: Date.now() - startTime,
    };
  }

  private buildCanonicalPuzzleForSpec(spec: DesignSpecification, candId: string): CanonicalPuzzle {
    const puzzle = createEmptyCanonicalPuzzle(spec.userIntent.summary);
    puzzle.metadata.id = `puz_${candId}`;
    const pc = spec.designParameters.pieceCount || 3;
    const thickness = spec.materialParameters.thicknessMm;
    const w = spec.designParameters.outerBoundary.widthMm || 100;
    const h = spec.designParameters.outerBoundary.heightMm || 100;

    for (let i = 1; i <= pc; i++) {
      const piece = createCanonicalPiece(`Piece ${i}`, { width: w, height: h, depth: thickness }, thickness);
      piece.id = `${candId}_p_${i}`;
      puzzle.pieces.push(piece);
    }
    return puzzle;
  }
}
