/**
 * Automatic Design Repair Engine.
 *
 * Consumes diagnostic validation reports, applies proposed parametric variable adjustments
 * (never directly editing raw 3D mesh points), and re-evaluates deterministic validation rules.
 */
import type {
  ParameterAdjustment,
  RepairProposal,
  RepairRequest,
  RepairResult,
  RepairStrategy,
} from "./types";
import { PuzzleValidationEngine } from "../unifiedvalidation/engine";
import { MockAIRepairStrategy } from "./mockStrategy";

export class DesignRepairEngine {
  static async attemptRepair(
    request: RepairRequest,
    strategy: RepairStrategy = new MockAIRepairStrategy(),
  ): Promise<RepairResult> {
    // 1. Generate repair proposal from strategy
    const proposal: RepairProposal = await strategy.proposeRepairs(request);

    // 2. Clone canonical puzzle model
    const repairedPuzzle = JSON.parse(JSON.stringify(request.puzzle));

    // 3. Apply parametric variable adjustments strictly to model parameters
    for (const adj of proposal.adjustments) {
      DesignRepairEngine.applyParameterAdjustment(repairedPuzzle, adj);
    }

    // 4. Re-validate repaired model using deterministic engine
    const revalidatedReport = PuzzleValidationEngine.validatePuzzle({
      puzzle: repairedPuzzle,
      placements: request.placements,
      solids: request.solids,
      graph: request.graph,
    });

    return {
      success: revalidatedReport.isValid,
      appliedProposal: proposal,
      revalidatedReport,
      repairedPuzzle,
      iterations: 1,
    };
  }

  /**
   * Applies a single parametric adjustment to the canonical puzzle structure.
   */
  private static applyParameterAdjustment(puzzle: any, adj: ParameterAdjustment): void {
    const { targetEntityId, parameterName, proposedValue } = adj;

    // Piece parameter adjustment
    const piece = (puzzle.pieces as any[])?.find((p) => p.id === targetEntityId);
    if (piece) {
      if (parameterName === "width" || parameterName === "piece_width") {
        piece.dimensions.width = Number(proposedValue);
      } else if (parameterName === "height" || parameterName === "piece_height") {
        piece.dimensions.height = Number(proposedValue);
      } else if (parameterName === "thickness") {
        piece.thickness = Number(proposedValue);
        piece.dimensions.depth = Number(proposedValue);
      }
      return;
    }

    // Interface parameter adjustment
    const iface = (puzzle.interfaces as any[])?.find((i) => i.id === targetEntityId);
    if (iface) {
      if (parameterName === "slot_width" || parameterName === "tab_width" || parameterName === "width") {
        iface.profile.width = Number(proposedValue);
      } else if (parameterName === "clearance") {
        iface.profile.clearance = Number(proposedValue);
      }
      return;
    }

    // Connection parameter adjustment
    const conn = (puzzle.connections as any[])?.find((c) => c.id === targetEntityId);
    if (conn) {
      if (parameterName === "joining_angle" || parameterName === "joiningAngleDeg") {
        if (conn.allowedAngleRange) {
          conn.allowedAngleRange.targetAngleDeg = Number(proposedValue);
          conn.allowedAngleRange.minAngleDeg = Number(proposedValue);
          conn.allowedAngleRange.maxAngleDeg = Number(proposedValue);
        }
      }
      return;
    }

    // Global material specification parameter adjustment
    if (targetEntityId === "global_material" || targetEntityId === "stock_material") {
      const mat = puzzle.materialSpecification?.[0];
      if (mat) {
        if (parameterName === "stockWidth" || parameterName === "stockWidthMm") {
          mat.stockWidthMm = Number(proposedValue);
        } else if (parameterName === "stockHeight" || parameterName === "stockHeightMm") {
          mat.stockHeightMm = Number(proposedValue);
        }
      }
    }
  }
}
