/**
 * Automatic Design Repair Subsystem Domain Types.
 *
 * CRITICAL RULE:
 * Repair proposals modify ONLY PARAMETRIC VARIABLES (e.g. slot_width, tab_width, stock_width, joining_angle).
 * The repair system is STRICTLY FORBIDDEN from directly editing arbitrary 3D mesh points or vertices.
 */
import type { ID } from "@/core/model/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { UnifiedValidationReport } from "../unifiedvalidation/types";
import type { AssemblyPlacement } from "../assemblytransforms/types";
import type { SolidRepresentation3D } from "../solid3d/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";

export interface ParameterAdjustment {
  /** Identifier of the target parameter being adjusted. */
  parameterId: ID;
  /** Target piece ID, interface ID, connection ID, or material spec ID. */
  targetEntityId: ID;
  /** Human-readable parameter name (e.g. "slot_width", "tab_width", "joining_angle"). */
  parameterName: string;
  /** Previous parameter value prior to repair. */
  oldValue: number | string | boolean;
  /** Proposed parameter value after repair. */
  proposedValue: number | string | boolean;
  /** Natural language explanation for why this parameter adjustment was selected. */
  reason: string;
  /** Predicted physical effect of this adjustment. */
  expectedEffect: string;
}

export interface RepairRequest {
  /** Invalid canonical puzzle model requiring repair. */
  puzzle: CanonicalPuzzle;
  /** Diagnostic validation report produced by the deterministic engine. */
  validationReport: UnifiedValidationReport;
  placements?: Record<ID, AssemblyPlacement>;
  solids?: Record<ID, SolidRepresentation3D>;
  graph?: PuzzleAssemblyGraph;
}

export interface RepairProposal {
  proposalId: ID;
  strategyName: string;
  /** Array of explicit parametric variable adjustments. */
  adjustments: ParameterAdjustment[];
  rationale: string;
  /** AI confidence score between 0.0 and 1.0. */
  confidenceScore: number;
}

export interface RepairResult {
  /** True if the applied proposal was successfully re-validated with zero errors. */
  success: boolean;
  appliedProposal: RepairProposal;
  /** Fresh validation report generated after applying parameter adjustments. */
  revalidatedReport: UnifiedValidationReport;
  /** Updated canonical puzzle model containing repaired parameters. */
  repairedPuzzle: CanonicalPuzzle;
  iterations: number;
}

export interface RepairStrategy {
  strategyName: string;
  proposeRepairs(request: RepairRequest): Promise<RepairProposal>;
}
