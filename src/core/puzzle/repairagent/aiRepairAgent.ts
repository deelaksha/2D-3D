/**
 * AI-Assisted Repair Agent (Phase 73).
 *
 * Implements the complete closed repair loop:
 *  Generate -> Validate -> Critique -> Identify Problem -> Select Parameter ->
 *  Propose Modification -> Regenerate -> Validate -> Critique Again.
 *
 * Enforces parameter whitelisting, cycle detection, iteration caps,
 * minimum improvement thresholds, and complete history logging.
 */

import type {
  ApprovedParametricVariable,
  ParametricModificationProposal,
  RepairAgentConfig,
  RepairIterationLog,
  RepairSessionResult,
  RepairSessionStatus,
} from "./types";
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { CanonicalPuzzle } from "../canonical/types";
import { DesignSpecificationCompiler } from "../designgeneration/designSpecificationCompiler";
import { DesignValidationPipeline } from "../designgeneration/designValidationPipeline";
import { DeterministicDesignCritic } from "../critic/deterministicDesignCritic";
import { ParametricParameterWhitelister } from "./parametricParameterWhitelister";
import { uid } from "@/core/model/ids";

export class AIRepairAgent {
  private critic = new DeterministicDesignCritic();

  /**
   * Executes an autonomous, closed-loop repair session on a candidate design specification.
   */
  public async runRepairSession(
    initialSpec: ParametricDesignSpecification,
    config?: RepairAgentConfig
  ): Promise<RepairSessionResult> {
    const startTime = Date.now();
    const sessionId = uid("repair_sess_");

    const maxIterations = config?.maxIterations ?? 5;
    const maxChangesPerIter = config?.maxParameterChangesPerIteration ?? 3;
    const minImprovementThreshold = config?.minImprovementThreshold ?? 1.5;
    const targetQualityScore = config?.targetQualityScore ?? 85.0;

    const iterations: RepairIterationLog[] = [];
    const visitedStateHashes = new Set<string>();

    // 1. Initial Compilation & Validation & Critique
    let currentSpec: ParametricDesignSpecification = JSON.parse(JSON.stringify(initialSpec));
    let currentPuzzle: CanonicalPuzzle | undefined;
    try {
      currentPuzzle = DesignSpecificationCompiler.compile(currentSpec);
    } catch {
      // Ignored: validation pipeline will flag failure
    }

    let currentValidation = DesignValidationPipeline.validateDesign(currentSpec, currentPuzzle);
    let currentCritique = this.critic.critique(currentPuzzle || ({} as any), currentSpec, currentValidation.passes);

    const initialCritiqueRecord = currentCritique;

    // Check if initial design is already pristine
    if (
      currentValidation.overallPassed &&
      currentCritique.overallAssessment === "PASS" &&
      currentCritique.scores.compositeQualityScore >= targetQualityScore
    ) {
      return {
        sessionId,
        status: "CONVERGED_PASS",
        initialSpecification: initialSpec,
        finalSpecification: currentSpec,
        finalCanonicalPuzzle: currentPuzzle,
        initialCritique: initialCritiqueRecord,
        finalCritique: currentCritique,
        iterations: [],
        totalIterations: 0,
        totalParameterChanges: 0,
        overallScoreImprovement: 0.0,
        totalDurationMs: Date.now() - startTime,
        summary: "Initial design satisfies all physical validation and quality criteria; zero repairs required.",
      };
    }

    let finalStatus: RepairSessionStatus = "MAX_ITERATIONS_REACHED";
    let totalParameterChanges = 0;

    // 2. Closed-Loop Repair Iterations
    for (let iterNum = 1; iterNum <= maxIterations; iterNum++) {
      const iterStart = Date.now();

      // Loop Prevention Check (State Hashing)
      const currentHash = ParametricParameterWhitelister.computeStateHash(currentSpec);
      if (visitedStateHashes.has(currentHash)) {
        finalStatus = "CYCLE_DETECTED";
        break;
      }
      visitedStateHashes.add(currentHash);

      // --- IDENTIFY PROBLEMS ---
      // Sort issues by severity: HARD_FAILURE > WARNING > STYLE_PREFERENCE
      const sortedIssues = [...currentCritique.issues].sort((a, b) => {
        const severityRank = { HARD_FAILURE: 3, WARNING: 2, STYLE_PREFERENCE: 1 };
        return severityRank[b.severity] - severityRank[a.severity];
      });

      // --- SELECT PARAMETERS & PROPOSE MODIFICATIONS ---
      const proposals: ParametricModificationProposal[] = [];
      const selectedParams: ApprovedParametricVariable[] = [];

      for (const issue of sortedIssues) {
        if (proposals.length >= maxChangesPerIter) break;

        const prop = this.formulateProposal(issue, currentSpec);
        if (prop) {
          const validationCheck = ParametricParameterWhitelister.validateProposal(prop);
          if (validationCheck.isValid) {
            proposals.push(prop);
            selectedParams.push(prop.variable);
          }
        }
      }

      if (proposals.length === 0) {
        // No actionable parameter proposal could be formulated for remaining issues
        finalStatus = currentValidation.overallPassed ? "CONVERGED_PASS" : "FAILED_UNREPAIRABLE";
        break;
      }

      // --- APPLY MODIFICATIONS ---
      const nextSpec = ParametricParameterWhitelister.applyProposals(currentSpec, proposals);
      totalParameterChanges += proposals.length;

      // --- REGENERATE GEOMETRY ---
      let nextPuzzle: CanonicalPuzzle | undefined;
      try {
        nextPuzzle = DesignSpecificationCompiler.compile(nextSpec);
      } catch {
        // Ignored
      }

      // --- RE-VALIDATE ---
      const nextValidation = DesignValidationPipeline.validateDesign(nextSpec, nextPuzzle);

      // --- RE-CRITIQUE ---
      const nextCritique = this.critic.critique(nextPuzzle || ({} as any), nextSpec, nextValidation.passes);

      // Score progression
      const qualityScoreBefore = currentCritique.scores.compositeQualityScore;
      const qualityScoreAfter = nextCritique.scores.compositeQualityScore;
      const scoreImprovement = Number((qualityScoreAfter - qualityScoreBefore).toFixed(1));

      // Log this iteration
      const logEntry: RepairIterationLog = {
        iterationNumber: iterNum,
        identifiedProblems: sortedIssues,
        selectedParameters: selectedParams,
        proposedModifications: proposals,
        appliedModifications: proposals,
        regeneratedSpecification: nextSpec,
        validationPasses: nextValidation.passes,
        critique: nextCritique,
        qualityScoreBefore,
        qualityScoreAfter,
        scoreImprovement,
        stateHash: ParametricParameterWhitelister.computeStateHash(nextSpec),
        durationMs: Date.now() - iterStart,
      };
      iterations.push(logEntry);

      // Convergence Check
      if (nextValidation.overallPassed && nextCritique.overallAssessment === "PASS") {
        currentSpec = nextSpec;
        currentPuzzle = nextPuzzle;
        currentValidation = nextValidation;
        currentCritique = nextCritique;
        finalStatus = "CONVERGED_PASS";
        break;
      }

      // Minimum Improvement Threshold Check (Prevent plateau / thrashing)
      if (scoreImprovement < minImprovementThreshold && nextCritique.hardFailuresCount >= currentCritique.hardFailuresCount) {
        currentSpec = nextSpec;
        currentPuzzle = nextPuzzle;
        currentValidation = nextValidation;
        currentCritique = nextCritique;
        finalStatus = "MIN_IMPROVEMENT_NOT_MET";
        break;
      }

      // Update pointers for next iteration
      currentSpec = nextSpec;
      currentPuzzle = nextPuzzle;
      currentValidation = nextValidation;
      currentCritique = nextCritique;
    }

    const overallScoreImprovement = Number(
      (currentCritique.scores.compositeQualityScore - initialCritiqueRecord.scores.compositeQualityScore).toFixed(1)
    );

    const summary = `Repair session completed with status '${finalStatus}' in ${iterations.length} iteration(s) (${totalParameterChanges} parameter change(s)). Overall quality improvement: +${overallScoreImprovement} pts.`;

    return {
      sessionId,
      status: finalStatus,
      initialSpecification: initialSpec,
      finalSpecification: currentSpec,
      finalCanonicalPuzzle: currentPuzzle,
      initialCritique: initialCritiqueRecord,
      finalCritique: currentCritique,
      iterations,
      totalIterations: iterations.length,
      totalParameterChanges,
      overallScoreImprovement,
      totalDurationMs: Date.now() - startTime,
      summary,
    };
  }

  /**
   * Formulates an approved parametric modification proposal from a critique issue.
   */
  private formulateProposal(
    issue: CritiqueIssue,
    spec: ParametricDesignSpecification
  ): ParametricModificationProposal | undefined {
    const p = issue.suggestedParameter;
    if (!p) return undefined;

    let variable: ApprovedParametricVariable | undefined;
    let path = p.parameterName;

    if (p.parameterName.includes("clearance")) {
      variable = "clearance";
      path = "connection_preferences.clearance";
    } else if (p.parameterName.includes("stockWidth") || p.parameterName.includes("stockHeight")) {
      variable = "stock_dimension";
      path = `material.${p.parameterName}`;
    } else if (p.parameterName.includes("piece_count")) {
      variable = "connection_density";
      path = "piece_count";
    } else if (p.parameterName.includes("dimensions") || p.parameterName.includes("overall_size")) {
      variable = "piece_dimension";
      path = `overall_size.${p.parameterName.split(".").pop() || "widthMm"}`;
    } else if (p.parameterName.includes("JoiningAngle") || p.parameterName.includes("angle")) {
      variable = "angle_range";
      path = "connection_preferences.preferredJoiningAngleDeg";
    } else if (p.parameterName.includes("tab") || p.parameterName.includes("profileWidth")) {
      variable = "tab_width";
      path = "connection_preferences.profileWidthMm";
    }

    if (!variable) return undefined;

    return {
      proposalId: uid("prop_"),
      variable,
      parameterPath: path,
      oldValue: p.currentValue,
      newValue: p.suggestedValue,
      rationale: p.rationale,
      targetIssueId: issue.id,
      affectedEntityId: issue.affectedEntity.id,
    };
  }
}
