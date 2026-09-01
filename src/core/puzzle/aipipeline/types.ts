/**
 * Master AI Pipeline Integration & Rejection Diagnostics Types (Phase 50).
 */
import type { Extracted2DGeometryResult } from "../ingestion/geometry/types";
import type { RetrievedDesign } from "../retrievalsystem/types";
import type { DesignPlan } from "../designplanner/types";
import type { DesignSpecification } from "../ai/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { PuzzleValidationReport } from "../validation/types";
import type { DatasetAcceptanceReport } from "../validation/types";

export interface AIPipelineInput {
  userRequirement: string;
  optionalDrawing?: Extracted2DGeometryResult | string;
  retrievedExamples?: RetrievedDesign[];
}

export interface RejectionDiagnosticItem {
  code: string;
  message: string;
  suggestedFixForAI: string;
  severity: "error" | "warning";
}

export interface AIPipelineResult {
  pipelineId: string;
  status: "SUCCESS" | "REJECTED";
  designPlan?: DesignPlan;
  specification?: DesignSpecification;
  canonicalPuzzle?: CanonicalPuzzle;
  schemaReport?: PuzzleValidationReport;
  constraintReport?: DatasetAcceptanceReport;
  rejectionDiagnostics: RejectionDiagnosticItem[];
  processingDurationMs: number;
}
