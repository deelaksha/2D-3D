/**
 * AI-Assisted Design Repair Loop Engine, Planner & Executor (Phase 52).
 * Modifies PARAMETRIC VARIABLES ONLY; never arbitrarily edits raw mesh vertices.
 */
import type { AIRepairIteration, AIRepairLoopResult, AIRepairProposal } from "./types";
import type { DesignSpecification } from "../ai/types";
import type { AIDesignValidationResult } from "../aivalidationgate/types";
import { AIDesignValidationGate } from "../aivalidationgate/aiDesignValidationGate";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../canonical/defaults";
import type { CanonicalPuzzle } from "../canonical/types";

export interface RepairPlanner {
  planRepairs(
    validationResult: AIDesignValidationResult,
    specification: DesignSpecification
  ): Promise<AIRepairProposal[]>;
}

/**
 * Deterministic Mock Repair Planner.
 * Analyzes validation errors and repair targets to generate structured AIRepairProposals modifying parametric variables.
 */
export class MockRepairPlanner implements RepairPlanner {
  async planRepairs(
    validationResult: AIDesignValidationResult,
    specification: DesignSpecification
  ): Promise<AIRepairProposal[]> {
    const proposals: AIRepairProposal[] = [];

    // Analyze Material / Thickness Errors
    const thicknessErr = validationResult.errors.find((e) => e.includes("cardboard thickness"));
    if (thicknessErr) {
      const currentThickness = specification.materialParameters.thicknessMm;
      const targetThickness = 3.0; // Standard safe cardboard thickness
      proposals.push({
        proposalId: `prop_thick_${Date.now()}`,
        parameter: "thickness",
        oldValue: currentThickness,
        newValue: targetThickness,
        reason: "Current thickness violates cardboard manufacturing limits [0.5mm, 20.0mm].",
        affectedGeometry: "all_pieces_3d_extrusion",
        expectedImprovement: "Resolves cardboard material constraint violation.",
      });
    }

    // Analyze Parameter Dimension Errors
    const dimErr = validationResult.errors.find((e) => e.includes("invalid dimensions"));
    if (dimErr) {
      const currentWidth = specification.designParameters.outerBoundary?.widthMm ?? 100;
      const targetWidth = currentWidth <= 0 ? 200.0 : currentWidth;
      proposals.push({
        proposalId: `prop_dim_${Date.now()}`,
        parameter: "outerBoundary_width",
        oldValue: currentWidth,
        newValue: targetWidth,
        reason: "Outer boundary width is non-positive or degenerate.",
        affectedGeometry: "outer_piece_footprint",
        expectedImprovement: "Ensures positive 2D bounding footprint.",
      });
    }

    return proposals;
  }
}

/**
 * Repair Executor.
 * Applies AIRepairProposals directly to mutate parametric specification variables.
 * Does NOT arbitrarily edit raw mesh vertices.
 */
export class RepairExecutor {
  static applyProposals(
    specification: DesignSpecification,
    proposals: AIRepairProposal[]
  ): DesignSpecification {
    // Clone specification to maintain immutability across iterations
    const updatedSpec: DesignSpecification = JSON.parse(JSON.stringify(specification));

    proposals.forEach((prop) => {
      if (prop.parameter === "thickness") {
        updatedSpec.materialParameters.thicknessMm = prop.newValue;
      } else if (prop.parameter === "outerBoundary_width") {
        if (!updatedSpec.designParameters.outerBoundary) {
          updatedSpec.designParameters.outerBoundary = { widthMm: 200, heightMm: 200 };
        }
        updatedSpec.designParameters.outerBoundary.widthMm = prop.newValue;
      }
    });

    return updatedSpec;
  }
}

/**
 * AI Repair Loop Engine.
 * Manages closed repair loop iterations up to maxIterations, preventing infinite loops.
 */
export class AIRepairLoopEngine {
  private planner: RepairPlanner;
  private maxIterations: number;

  constructor(planner?: RepairPlanner, maxIterations: number = 5) {
    this.planner = planner || new MockRepairPlanner();
    this.maxIterations = maxIterations;
  }

  /**
   * Executes the closed AI design repair loop.
   */
  async repairDesign(
    initialPuzzle: CanonicalPuzzle,
    initialSpecification: DesignSpecification
  ): Promise<AIRepairLoopResult> {
    const startTime = Date.now();
    const repairId = `repair_${Date.now()}`;
    const iterations: AIRepairIteration[] = [];

    let currentPuzzle = initialPuzzle;
    let currentSpec = initialSpecification;
    let currentValidation = AIDesignValidationGate.validateAIDesign(currentPuzzle, currentSpec);

    let iterationCount = 0;

    while (currentValidation.status === "REJECTED" && iterationCount < this.maxIterations) {
      iterationCount++;

      // 1. Plan repairs based on validation errors
      const proposals = await this.planner.planRepairs(currentValidation, currentSpec);
      if (proposals.length === 0) {
        // No actionable repair proposals found
        iterations.push({
          iterationNumber: iterationCount,
          validationResult: currentValidation,
          proposals: [],
          status: "FAILED",
        });
        break;
      }

      // 2. Execute parametric modifications
      currentSpec = RepairExecutor.applyProposals(currentSpec, proposals);

      // 3. Regenerate geometry from updated parametric specification
      currentPuzzle = this.regenerateCanonicalPuzzle(currentSpec);

      // 4. Re-validate repaired CAD design
      currentValidation = AIDesignValidationGate.validateAIDesign(currentPuzzle, currentSpec);

      iterations.push({
        iterationNumber: iterationCount,
        validationResult: currentValidation,
        proposals,
        modifiedSpecification: currentSpec,
        status: currentValidation.status === "ACCEPTED" ? "SUCCESS" : "RETRY_REQUIRED",
      });
    }

    const isRepaired = currentValidation.status === "ACCEPTED";
    const status = isRepaired
      ? "REPAIRED"
      : iterationCount >= this.maxIterations
      ? "MAX_ITERATIONS_EXCEEDED"
      : "REPAIR_FAILED";

    return {
      repairId,
      status,
      iterations,
      finalValidationResult: currentValidation,
      repairedPuzzle: isRepaired ? currentPuzzle : undefined,
      repairedSpecification: isRepaired ? currentSpec : undefined,
      totalDurationMs: Date.now() - startTime,
    };
  }

  private regenerateCanonicalPuzzle(spec: DesignSpecification): CanonicalPuzzle {
    const puzzle = createEmptyCanonicalPuzzle(spec.userIntent.summary);
    const pc = spec.designParameters.pieceCount || 3;
    const thickness = spec.materialParameters.thicknessMm;
    const w = spec.designParameters.outerBoundary?.widthMm ?? 100;
    const h = spec.designParameters.outerBoundary?.heightMm ?? 100;

    for (let i = 1; i <= pc; i++) {
      const piece = createCanonicalPiece(`Piece ${i}`, { width: w, height: h, depth: thickness }, thickness);
      piece.id = `p_${i}`;
      puzzle.pieces.push(piece);
    }
    return puzzle;
  }
}
