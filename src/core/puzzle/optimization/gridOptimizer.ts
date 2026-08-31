/**
 * Deterministic Baseline Grid Optimizer Implementation.
 *
 * Systematically evaluates parameter grid combinations over small search spaces without machine learning.
 * Enforces HARD physical constraints and ranks feasible candidates by multi-objective fitness scores.
 */
import type {
  CandidateDesign,
  OptimizationResult,
  Optimizer,
  ParameterSearchSpace,
  Objective,
} from "./types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { DeclarativeConstraint } from "../constraintsystem/types";
import { evaluateDesignScore } from "./evaluator";
import { uid } from "@/core/model/ids";

export class DeterministicGridOptimizer implements Optimizer {
  public optimizerName = "Deterministic_Grid_Search_Optimizer";

  async optimize(
    puzzle: CanonicalPuzzle,
    objectives: Objective[],
    hardConstraints: DeclarativeConstraint[] = [],
    searchSpaces: ParameterSearchSpace[] = [],
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    const candidates: CandidateDesign[] = [];

    // Default search space if none provided
    const spaces =
      searchSpaces.length > 0
        ? searchSpaces
        : [
            {
              parameterName: "piece_width",
              targetEntityId: "all_pieces",
              values: [80, 100, 120],
            },
          ];

    // Generate Cartesian product grid combinations
    const combinations = this.cartesianProduct(spaces);

    for (const combo of combinations) {
      const candidatePuzzle: CanonicalPuzzle = JSON.parse(JSON.stringify(puzzle));

      // Apply grid parameter values
      for (const [paramName, val] of Object.entries(combo)) {
        this.applyParameterToPuzzle(candidatePuzzle, paramName, val);
      }

      const candidate: CandidateDesign = {
        candidateId: uid("cand_"),
        puzzle: candidatePuzzle,
        parameters: combo,
        isFeasible: true,
      };

      const score = evaluateDesignScore(candidate, objectives, hardConstraints);
      candidate.score = score;
      candidate.isFeasible = score.isFeasible;

      candidates.push(candidate);
    }

    // Rank candidates: Feasible first, then by totalScore descending
    candidates.sort((a, b) => {
      if (a.isFeasible && !b.isFeasible) return -1;
      if (!a.isFeasible && b.isFeasible) return 1;
      return (b.score?.totalScore ?? 0) - (a.score?.totalScore ?? 0);
    });

    const feasibleCandidates = candidates.filter((c) => c.isFeasible);
    const bestDesign = feasibleCandidates.length > 0 ? feasibleCandidates[0] : undefined;

    return {
      success: bestDesign !== undefined,
      bestDesign,
      evaluatedCandidatesCount: candidates.length,
      feasibleCandidatesCount: feasibleCandidates.length,
      allCandidates: candidates,
      optimizationTimeMs: Date.now() - startTime,
    };
  }

  private applyParameterToPuzzle(puzzle: CanonicalPuzzle, paramName: string, val: any): void {
    const pieceList = (Array.isArray(puzzle.pieces) ? puzzle.pieces : Object.values(puzzle.pieces)) as any[];
    for (const p of pieceList) {
      if (paramName === "piece_width" || paramName === "width") {
        p.dimensions.width = Number(val);
      } else if (paramName === "piece_height" || paramName === "height") {
        p.dimensions.height = Number(val);
      }
    }
  }

  private cartesianProduct(spaces: ParameterSearchSpace[]): Array<Record<string, any>> {
    let results: Array<Record<string, any>> = [{}];

    for (const space of spaces) {
      const nextResults: Array<Record<string, any>> = [];
      for (const res of results) {
        for (const val of space.values) {
          nextResults.push({
            ...res,
            [space.parameterName]: val,
          });
        }
      }
      results = nextResults;
    }

    return results;
  }
}
