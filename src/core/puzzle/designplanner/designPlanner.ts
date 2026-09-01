/**
 * AI Design Planner Provider & Specification Converter (Phase 49).
 */
import type { DesignPlan, PlannerInput } from "./types";
import type { DesignSpecification } from "../ai/types";

export interface DesignPlanner {
  createDesignPlan(input: PlannerInput): Promise<DesignPlan>;
}

export class MockDesignPlanner implements DesignPlanner {
  async createDesignPlan(input: PlannerInput): Promise<DesignPlan> {
    const req = (input.userRequirement || "").toLowerCase();
    const planId = `plan_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // 1. Piece Strategy Reasoning
    let targetPieceCount = 3;
    const pcMatch = req.match(/(\d+)\s*piece|(\d+)\s*-\s*piece/);
    if (pcMatch) {
      targetPieceCount = parseInt(pcMatch[1] || pcMatch[2], 10);
    } else if (input.retrievedExamples && input.retrievedExamples.length > 0) {
      // Use reference retrieved example to inform piece count strategy
      targetPieceCount = input.retrievedExamples[0].canonicalPuzzle.pieces.length;
    }

    // 2. Material & Thickness Reasoning
    let thicknessMm = 3.0;
    const thickMatch = req.match(/(\d+(?:\.\d+)?)\s*mm/);
    if (thickMatch) {
      thicknessMm = parseFloat(thickMatch[1]);
    }

    // 3. Category & Symmetry Reasoning
    const isFurniture = req.includes("chair") || req.includes("table") || req.includes("furniture");
    const category = isFurniture ? "furniture" : "puzzle";
    const symmetry = req.includes("symmetry") || req.includes("symmetric") ? "bilateral" : "none";

    const plan: DesignPlan = {
      planId,
      intent: {
        goalSummary: `High-level design plan for "${input.userRequirement.slice(0, 40)}..."`,
        targetCategory: category,
        difficulty: req.includes("complex") ? "hard" : "medium",
        symmetry,
      },
      pieceStrategy: {
        targetPieceCount,
        geometryComplexity: req.includes("complex") ? "complex" : "medium",
        layerCount: 1,
        outerBoundaryStrategy: "rectangular_footprint_with_interlocking_tabs",
      },
      connectionStrategy: {
        primaryConnectionType: req.includes("finger") ? "finger_joint" : "tab_slot",
        connectionDensity: "moderate",
        jointClearanceMm: 0.15,
      },
      materialStrategy: {
        materialId: "cardboard_stock",
        thicknessMm,
        allowableKerfMm: 0.15,
        manufacturingConstraints: ["laser_cutter_friendly", "cnc_router_compatible"],
      },
      assemblyStrategy: {
        assemblyType: req.includes("different angles") ? "multi_angle" : "rigid",
        allowedJoiningAnglesDeg: req.includes("different angles") ? [0, 45, 90, 135, 180] : [90, 180],
        sequencePlanningRequired: targetPieceCount > 5,
      },
      constraintStrategy: {
        mandatoryPieceCount: targetPieceCount,
        maxFootprintMm: { widthMm: 800, heightMm: 800 },
        nonNegotiableRules: ["non_negative_dimensions", "no_rigid_body_interpenetration"],
      },
      createdIso: new Date().toISOString(),
    };

    return plan;
  }
}

/**
 * Deterministically converts a DesignPlan into a canonical DesignSpecification.
 */
export function convertPlanToSpecification(plan: DesignPlan): DesignSpecification {
  const connectionStyle =
    plan.connectionStrategy.primaryConnectionType === "finger_joint" ? "finger_joint" : "tab_slot";

  return {
    specId: `spec_from_${plan.planId}`,
    userIntent: {
      rawPrompt: plan.intent.goalSummary,
      summary: plan.intent.goalSummary,
      category: plan.intent.targetCategory,
      primaryGoal: "Canonical CAD Design Specification derived from AI Design Plan",
    },
    designParameters: {
      outerBoundary: {
        widthMm: plan.constraintStrategy.maxFootprintMm.widthMm,
        heightMm: plan.constraintStrategy.maxFootprintMm.heightMm,
      },
      pieceCount: plan.pieceStrategy.targetPieceCount,
      innerPieceComplexity: plan.pieceStrategy.geometryComplexity,
      connectionStyle,
    },
    assemblyParameters: {
      allowedAssemblyAnglesDeg: plan.assemblyStrategy.allowedJoiningAnglesDeg,
      assemblyType: plan.assemblyStrategy.assemblyType,
    },
    materialParameters: {
      materialId: plan.materialStrategy.materialId,
      thicknessMm: plan.materialStrategy.thicknessMm,
      allowableKerfMm: plan.materialStrategy.allowableKerfMm,
      densityGramsPerCm3: 0.6,
    },
    hardConstraints: {
      minThicknessMm: 0.5,
      maxDimensionsMm: plan.constraintStrategy.maxFootprintMm,
      mandatoryPieceCount: plan.pieceStrategy.targetPieceCount,
    },
    softPreferences: {
      preferredMaterial: plan.materialStrategy.materialId,
      preferredStyle: connectionStyle,
      complexityPreference: plan.pieceStrategy.geometryComplexity,
    },
    missingInformation: [],
    isValidSchema: true,
    schemaValidationErrors: [],
  };
}
