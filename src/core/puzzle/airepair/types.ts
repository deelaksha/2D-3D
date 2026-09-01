/**
 * AI-Assisted Design Repair Loop Types & Models (Phase 52).
 */
import type { AIDesignValidationResult } from "../aivalidationgate/types";
import type { DesignSpecification } from "../ai/types";
import type { CanonicalPuzzle } from "../canonical/types";

export interface AIRepairProposal {
  proposalId: string;
  parameter: string; // e.g. "thickness", "slot_width", "tab_width", "clearance", "outerBoundary"
  oldValue: number;
  newValue: number;
  reason: string;
  affectedGeometry: string;
  expectedImprovement: string;
}

export interface AIRepairIteration {
  iterationNumber: number;
  validationResult: AIDesignValidationResult;
  proposals: AIRepairProposal[];
  modifiedSpecification?: DesignSpecification;
  status: "SUCCESS" | "RETRY_REQUIRED" | "FAILED";
}

export interface AIRepairLoopResult {
  repairId: string;
  status: "REPAIRED" | "REPAIR_FAILED" | "MAX_ITERATIONS_EXCEEDED";
  iterations: AIRepairIteration[];
  finalValidationResult: AIDesignValidationResult;
  repairedPuzzle?: CanonicalPuzzle;
  repairedSpecification?: DesignSpecification;
  totalDurationMs: number;
}
