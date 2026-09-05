/**
 * Autonomous Repair Engine (Phase 91).
 *
 * Connects the autonomous generator to the deterministic repair system.
 *
 * Executes the complete closed-loop pipeline:
 *   Generate
 *      ↓
 *   Validate
 *      ↓
 *   Find failure
 *      ↓
 *   Identify responsible parameter
 *      ↓
 *   Modify parameter
 *      ↓
 *   Regenerate affected geometry (Local-first)
 *      ↓
 *   Reassemble
 *      ↓
 *   Validate again
 *
 * Features:
 *   - Local-first repair precedence (repairs single connection/interfaces without touching whole puzzle)
 *   - Global regeneration fallback if local repair fails
 *   - Configurable retry limits
 *   - Infinite loop prevention with cycle detection state hashing
 *   - Strictly forbids raw mesh editing
 */

import { Automatic2DGenerationEngine } from "../automatic2d/automatic2DGenerationEngine";
import { Piece3DConversionEngine } from "../piece3d/piece3DConversionEngine";
import { solveAutomaticAssembly } from "../assemblysolver/backtrackingAssemblySolver";
import { evaluatePuzzleJoiningAngles } from "../anglegeneration/automaticJoiningAngleEngine";
import { validateConnectorAndAssembly } from "../assemblyvalidation/assemblyValidationPass";
import type { AssemblyValidationReport, ValidationFailureItem } from "../assemblyvalidation/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { ConvertedPuzzle3D } from "../piece3d/types";
import { ParameterFaultLocalizer } from "./parameterFaultLocalizer";
import { LocalGeometryRegenerator } from "./localGeometryRegenerator";
import type {
  AutonomousRepairConfig,
  FinalRepairStatus,
  ParameterModification,
  RepairAttempt,
  RepairHistory,
} from "./types";

export class AutonomousRepairEngine {
  /**
   * Computes a deterministic state hash of the puzzle parameters to detect cycles.
   */
  private static computeStateHash(
    puzzle: ConvertedPuzzle3D,
    appliedAngles: Record<string, number>
  ): string {
    const connTokens = puzzle.connections
      .map(
        (c) =>
          `${c.connectionId}:${c.connectorType}:${c.clearanceMm}:${c.parameters?.tabWidth}:${c.parameters?.slotWidth}:${c.parameters?.joiningAngleDeg}:${appliedAngles[c.connectionId] ?? ""}`
      )
      .sort()
      .join("|");

    const pieceTokens = puzzle.pieces
      .map((p) => `${p.pieceId}:${p.thickness}:${p.profile?.isClosed}`)
      .sort()
      .join("|");

    return `${connTokens}#${pieceTokens}`;
  }

  /**
   * Executes the full closed-loop repair pipeline.
   */
  public static repairAssembly(
    puzzle: ConvertedPuzzle3D,
    initialTransforms: Record<string, RigidTransform3D> = {},
    initialAngles: Record<string, number> = {},
    config: AutonomousRepairConfig = {}
  ): FinalRepairStatus {
    const globalStartTime = performance.now();
    const maxRetries = config.maxRetries ?? 5;
    const maxLocalRetries = config.maxLocalRetries ?? 3;
    const maxGlobalRetries = config.maxGlobalRetries ?? 2;
    const preferLocal = config.preferLocal ?? true;
    const defaultClearanceMm = config.defaultClearanceMm ?? 0.15;

    let currentPuzzle: ConvertedPuzzle3D = puzzle;
    let currentTransforms: Record<string, RigidTransform3D> = { ...initialTransforms };
    let currentAngles: Record<string, number> = { ...initialAngles };

    // Initial assembly solving only if transforms were not provided at all
    if (Object.keys(currentTransforms).length === 0) {
      const angleResult = evaluatePuzzleJoiningAngles(currentPuzzle, { angleStepDeg: 30 });
      const solved = solveAutomaticAssembly({
        puzzle: currentPuzzle,
        validAngleCandidates: angleResult.connectionAngles,
      });
      if (solved.success) {
        currentTransforms = solved.pieceTransforms;
        currentAngles = { ...solved.appliedAngles, ...currentAngles };
      }
    }

    // Initial validation pass
    let currentReport = validateConnectorAndAssembly({
      puzzle: currentPuzzle,
      pieceTransforms: currentTransforms,
      appliedAngles: currentAngles,
    });

    const history: RepairHistory = {
      totalAttempts: 0,
      localAttemptsCount: 0,
      globalAttemptsCount: 0,
      attempts: [],
      stateHashes: [],
    };

    const seenStateHashes = new Set<string>();
    const modifiedParametersSet = new Set<string>();

    // If already 100% valid, return immediately
    if (currentReport.isValid) {
      return {
        status: "repaired",
        repaired: true,
        repairedPuzzle: currentPuzzle,
        pieceTransforms: currentTransforms,
        appliedAngles: currentAngles,
        validationReport: currentReport,
        history,
        totalIterations: 0,
        repairedParametersCount: 0,
        durationMs: Number((performance.now() - globalStartTime).toFixed(2)),
      };
    }

    let iteration = 0;
    let localAttempts = 0;
    let globalAttempts = 0;
    let status: FinalRepairStatus["status"] = "unrepaired";

    while (iteration < maxRetries) {
      iteration++;
      const iterStartTime = performance.now();

      // Infinite Loop & Cycle Detection
      const stateHash = this.computeStateHash(currentPuzzle, currentAngles);
      history.stateHashes.push(stateHash);

      if (seenStateHashes.has(stateHash)) {
        status = "cycle_detected";
        break;
      }
      seenStateHashes.add(stateHash);

      // Find first actionable failure from diagnostic report
      const failure: ValidationFailureItem =
        currentReport.failures.find((f) => f.severity === "error") ?? currentReport.failures[0];

      if (!failure) {
        // No errors remain!
        status = "repaired";
        break;
      }

      // Determine scope: prefer local repair first
      let canAttemptLocal =
        preferLocal &&
        localAttempts < maxLocalRetries &&
        (failure.connectionId !== undefined ||
          (failure.pieceId !== undefined &&
            (failure.category === "thickness" || failure.category === "geometry")));

      let proposals: ParameterModification[] = [];
      if (canAttemptLocal) {
        proposals = ParameterFaultLocalizer.localizeAndPropose(
          failure,
          currentPuzzle,
          currentAngles,
          defaultClearanceMm
        );
        if (proposals.length === 0) {
          canAttemptLocal = false;
        }
      }

      if (canAttemptLocal) {
        // ─────────────────────────────────────────────────────────
        // LOCAL REPAIR PASS
        // ─────────────────────────────────────────────────────────
        localAttempts++;
        history.localAttemptsCount++;

        for (const p of proposals) {
          modifiedParametersSet.add(`${p.entityId}.${p.parameterName}`);
        }

        // 2. Regenerate affected geometry locally
        const localRegen = LocalGeometryRegenerator.applyLocalRepair(
          currentPuzzle,
          proposals,
          currentTransforms,
          currentAngles
        );

        currentPuzzle = localRegen.repairedPuzzle;
        currentTransforms = localRegen.updatedTransforms;
        currentAngles = localRegen.updatedAngles;

        // 3. Reassemble
        // If transforms were broken, re-run assembly solver with updated parameters
        let reassembledTransforms = currentTransforms;
        if (
          Object.keys(currentTransforms).length < currentPuzzle.pieces.length ||
          proposals.some((p) => p.parameterName === "joiningAngleDeg")
        ) {
          const angleResult = evaluatePuzzleJoiningAngles(currentPuzzle, { angleStepDeg: 30 });
          const solved = solveAutomaticAssembly({
            puzzle: currentPuzzle,
            validAngleCandidates: angleResult.connectionAngles,
          });
          if (solved.success) {
            reassembledTransforms = solved.pieceTransforms;
            currentAngles = { ...solved.appliedAngles, ...currentAngles };
          }
        }
        currentTransforms = reassembledTransforms;

        // 4. Validate again
        const newReport = validateConnectorAndAssembly({
          puzzle: currentPuzzle,
          pieceTransforms: currentTransforms,
          appliedAngles: currentAngles,
        });

        const attemptRecord: RepairAttempt = {
          iteration,
          scope: "local",
          targetConnectionId: failure.connectionId,
          targetPieceId: failure.pieceId,
          detectedFailure: failure,
          modifications: proposals,
          revalidatedValid: newReport.isValid,
          remainingErrorCount: newReport.summary.errorCount,
          durationMs: Number((performance.now() - iterStartTime).toFixed(2)),
        };

        history.attempts.push(attemptRecord);
        history.totalAttempts++;
        currentReport = newReport;

        if (newReport.isValid) {
          status = "repaired";
          break;
        }
      } else if (globalAttempts < maxGlobalRetries) {
        // ─────────────────────────────────────────────────────────
        // GLOBAL REGENERATION FALLBACK PASS
        // ─────────────────────────────────────────────────────────
        globalAttempts++;
        history.globalAttemptsCount++;

        const spec =
          config.specification ??
          currentPuzzle.specification ?? {
            id: currentPuzzle.puzzleId,
            targetPieceCount: currentPuzzle.pieces.length,
            overallSize: { widthMm: 120, heightMm: 120 },
            boundaryShape: "rectangle",
            partitionStyle: "rectangular",
            material: {
              id: "plywood",
              name: "Birch Plywood",
              stockThicknessMm: 3.0,
            },
          };

        // Apply parametric adjustments at spec level
        const updatedSpec = {
          ...spec,
          preferredConnectorType: "tab_slot",
          material: {
            ...spec.material,
            stockThicknessMm: spec.material?.stockThicknessMm ?? 3.0,
          },
        };

        const globalProposals: ParameterModification[] = [
          {
            parameterName: "globalPuzzleSpecification",
            entityId: currentPuzzle.puzzleId,
            oldValue: "unresolvable_local_defect",
            newValue: "full_regenerated_puzzle",
            reason: `Local repair could not resolve '${failure.failureReason}'. Triggered controlled global regeneration.`,
          },
        ];
        modifiedParametersSet.add(`puzzle.${currentPuzzle.puzzleId}.globalRegen`);

        // Regenerate completely
        const newPuzzle2D = Automatic2DGenerationEngine.generatePuzzle(updatedSpec as any);
        const newPuzzle3D = Piece3DConversionEngine.convertPuzzle(newPuzzle2D);

        // Reassemble
        const angleResult = evaluatePuzzleJoiningAngles(newPuzzle3D, { angleStepDeg: 30 });
        const solved = solveAutomaticAssembly({
          puzzle: newPuzzle3D,
          validAngleCandidates: angleResult.connectionAngles,
        });

        if (solved.success) {
          currentPuzzle = newPuzzle3D;
          currentTransforms = solved.pieceTransforms;
          currentAngles = solved.appliedAngles;

          // Validate again
          const newReport = validateConnectorAndAssembly({
            puzzle: currentPuzzle,
            pieceTransforms: currentTransforms,
            appliedAngles: currentAngles,
          });

          const attemptRecord: RepairAttempt = {
            iteration,
            scope: "global",
            detectedFailure: failure,
            modifications: globalProposals,
            revalidatedValid: newReport.isValid,
            remainingErrorCount: newReport.summary.errorCount,
            durationMs: Number((performance.now() - iterStartTime).toFixed(2)),
          };

          history.attempts.push(attemptRecord);
          history.totalAttempts++;
          currentReport = newReport;

          if (newReport.isValid) {
            status = "repaired";
            break;
          }
        }
      } else {
        // Exceeded allowed retries
        status = "max_retries_exceeded";
        break;
      }
    }

    if (iteration >= maxRetries && !currentReport.isValid && status !== "cycle_detected") {
      status = "max_retries_exceeded";
    }

    const durationMs = Number((performance.now() - globalStartTime).toFixed(2));

    return {
      status,
      repaired: currentReport.isValid,
      repairedPuzzle: currentPuzzle,
      pieceTransforms: currentTransforms,
      appliedAngles: currentAngles,
      validationReport: currentReport,
      history,
      totalIterations: iteration,
      repairedParametersCount: modifiedParametersSet.size,
      durationMs,
    };
  }
}

/**
 * Convenience entry point function.
 */
export function repairAutonomousAssembly(
  puzzle: ConvertedPuzzle3D,
  initialTransforms?: Record<string, RigidTransform3D>,
  initialAngles?: Record<string, number>,
  config?: AutonomousRepairConfig
): FinalRepairStatus {
  return AutonomousRepairEngine.repairAssembly(
    puzzle,
    initialTransforms,
    initialAngles,
    config
  );
}
