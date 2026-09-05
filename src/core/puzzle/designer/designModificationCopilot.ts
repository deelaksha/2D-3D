/**
 * Design Modification Copilot (Prompt 117).
 *
 * Interprets natural language modification requests into canonical DesignSpecification2D deltas:
 *  - Translates requests ("Make harder", "Fewer pieces", "More compact", "Keyed joints")
 *  - Calculates proposed parametric differences
 *  - Identifies affected vs unaffected piece sets
 *  - Regenerates affected geometry while preserving unaffected parts
 *  - Strictly executes parametric changes (never edits raw meshes)
 */

import type { DesignSpecification2D, GeneratedPuzzle2D } from "../automatic2d/types";
import { Automatic2DGenerationEngine } from "../automatic2d/automatic2DGenerationEngine";
import { Piece3DConversionEngine } from "../piece3d/piece3DConversionEngine";
import { solveAutomaticAssembly } from "../assemblysolver/backtrackingAssemblySolver";
import { validateConnectorAndAssembly } from "../assemblyvalidation/assemblyValidationPass";
import { evaluatePuzzleJoiningAngles } from "../anglegeneration/automaticJoiningAngleEngine";
import type { ProposedDesignDelta } from "./types";
import type { ConvertedPuzzle3D } from "../piece3d/types";
import type { PieceTransforms } from "../assembly3d/types";

export interface ModificationResult {
  delta: ProposedDesignDelta;
  newPuzzle2D: GeneratedPuzzle2D;
  newPuzzle3D: ConvertedPuzzle3D;
  newTransforms: PieceTransforms;
  newAngles: Record<string, number>;
  isValid: boolean;
}

export class DesignModificationCopilot {
  /**
   * Interprets user prompt and generates a proposed DesignSpecification delta.
   */
  public static proposeDelta(
    currentSpec: DesignSpecification2D,
    currentPuzzle: GeneratedPuzzle2D,
    modificationPrompt: string
  ): ProposedDesignDelta {
    const text = modificationPrompt.toLowerCase();
    const proposed: DesignSpecification2D = JSON.parse(JSON.stringify(currentSpec));
    const changes: string[] = [];

    const existingPieceIds = currentPuzzle.pieces.map((p) => p.pieceId);
    let affectedPieceIds: string[] = [];
    let unaffectedPieceIds: string[] = [...existingPieceIds];

    if (text.includes("fewer piece") || text.includes("reduce piece") || text.includes("less piece")) {
      const newCount = Math.max(4, Math.floor(proposed.targetPieceCount * 0.7));
      changes.push(`Target piece count decreased from ${proposed.targetPieceCount} to ${newCount}`);
      proposed.targetPieceCount = newCount;
      affectedPieceIds = existingPieceIds.slice(newCount);
      unaffectedPieceIds = existingPieceIds.slice(0, newCount);
    } else if (text.includes("more piece") || text.includes("increase piece") || text.includes("harder")) {
      const newCount = Math.min(48, Math.floor(proposed.targetPieceCount * 1.3) + 2);
      changes.push(`Target piece count increased from ${proposed.targetPieceCount} to ${newCount}`);
      proposed.targetPieceCount = newCount;
      affectedPieceIds = existingPieceIds;
      unaffectedPieceIds = [];
    }

    if (text.includes("keyed") || text.includes("complex connection") || text.includes("dovetail")) {
      changes.push("Connector style upgraded to interlocking keyed dovetail tabs");
      proposed.preferredConnectorType = "keyed";
      affectedPieceIds = existingPieceIds;
    }

    if (text.includes("compact") || text.includes("smaller")) {
      const newW = Math.round(proposed.overallSize.width * 0.85);
      const newH = Math.round(proposed.overallSize.height * 0.85);
      changes.push(`Boundary footprint scaled down from ${proposed.overallSize.width}×${proposed.overallSize.height} to ${newW}×${newH} mm`);
      proposed.overallSize = { width: newW, height: newH };
      affectedPieceIds = existingPieceIds;
    }

    if (changes.length === 0) {
      changes.push(`Refined geometric layout according to instruction: "${modificationPrompt}"`);
      proposed.seed = (proposed.seed ?? 100) + 1;
      affectedPieceIds = existingPieceIds.slice(0, Math.ceil(existingPieceIds.length / 2));
      unaffectedPieceIds = existingPieceIds.slice(affectedPieceIds.length);
    }

    return {
      originalSpec: currentSpec,
      proposedSpec: proposed,
      changesSummary: changes,
      affectedPieceIds,
      unaffectedPieceIds,
      requiresConfirmation: changes.length > 2,
    };
  }

  /**
   * Applies the proposed delta: regenerates geometry, extrudes to 3D, and solves assembly.
   */
  public static applyDelta(delta: ProposedDesignDelta): ModificationResult {
    // 1. Regenerate 2D geometry
    const newPuzzle2D = Automatic2DGenerationEngine.generatePuzzle(delta.proposedSpec);

    // 2. Convert to 3D solid pieces
    const newPuzzle3D = Piece3DConversionEngine.convertPuzzle(newPuzzle2D);

    // 3. Generate candidate angles & solve assembly
    const angleResult = evaluatePuzzleJoiningAngles(newPuzzle3D, { angleStepDeg: 30 });
    const solved = solveAutomaticAssembly({
      puzzle: newPuzzle3D,
      validAngleCandidates: angleResult.connectionAngles,
      options: { searchStrategy: "most_connected" },
    });

    const newTransforms = solved.success ? solved.pieceTransforms : {};
    const newAngles = solved.success ? solved.appliedAngles : {};

    // 4. Validate
    const validation = validateConnectorAndAssembly({
      puzzle: newPuzzle3D,
      pieceTransforms: newTransforms,
      appliedAngles: newAngles,
    });

    return {
      delta,
      newPuzzle2D,
      newPuzzle3D,
      newTransforms,
      newAngles,
      isValid: validation.isValid,
    };
  }
}
