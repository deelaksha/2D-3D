/**
 * Mock AI Repair Strategy implementation for testing without live LLMs.
 *
 * Consumes AIRepairDirectives from ValidationReport and generates structured ParameterAdjustments
 * specifying affected parameter, old value, proposed value, reason, and expected effect.
 */
import type { ParameterAdjustment, RepairProposal, RepairRequest, RepairStrategy } from "./types";
import { uid } from "@/core/model/ids";

export class MockAIRepairStrategy implements RepairStrategy {
  public strategyName = "Mock_AI_Parametric_Repair_Strategy";

  async proposeRepairs(request: RepairRequest): Promise<RepairProposal> {
    const adjustments: ParameterAdjustment[] = [];

    const directives = request.validationReport.aiRepairDirectives || [];

    for (const dir of directives) {
      if (dir.defectCode === "PIECE_WIDTH_BOUNDS") {
        adjustments.push({
          parameterId: uid("p_adj_"),
          targetEntityId: "stock_material",
          parameterName: "stockWidth",
          oldValue: 600,
          proposedValue: 800,
          reason: `Stock width 600mm is insufficient for piece width footprint.`,
          expectedEffect: `Increases sheet stock width to 800mm, resolving manufacturing margin overflow.`,
        });
      } else if (dir.defectCode === "INTERFACE_INCOMPATIBLE") {
        adjustments.push({
          parameterId: uid("p_adj_"),
          targetEntityId: dir.targetEntityId,
          parameterName: "slot_width",
          oldValue: 9.8,
          proposedValue: 10.35,
          reason: `Slot width 9.8mm causes interference fit with 10.2mm mating tab width.`,
          expectedEffect: `Adjusts slot width to 10.35mm, restoring positive 0.15mm mechanical clearance.`,
        });
      } else if (dir.defectCode === "OUT_OF_RANGE_ANGLE") {
        adjustments.push({
          parameterId: uid("p_adj_"),
          targetEntityId: dir.targetEntityId,
          parameterName: "joining_angle",
          oldValue: 135.0,
          proposedValue: 90.0,
          reason: `Joining angle 135° exceeds allowed interface angle range [0°, 90°].`,
          expectedEffect: `Sets joining angle to valid 90° right-angle joint configuration.`,
        });
      }
    }

    // Default fallback repair if no specific directives were matched
    if (adjustments.length === 0) {
      adjustments.push({
        parameterId: uid("p_adj_"),
        targetEntityId: "stock_material",
        parameterName: "stockWidth",
        oldValue: 600,
        proposedValue: 800,
        reason: "Default parametric optimization fallback.",
        expectedEffect: "Expands manufacturing sheet envelope.",
      });
    }

    return {
      proposalId: uid("prop_"),
      strategyName: this.strategyName,
      adjustments,
      rationale: `Proposed ${adjustments.length} parametric variable adjustments based on diagnostic directives.`,
      confidenceScore: 0.95,
    };
  }
}
