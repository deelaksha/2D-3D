/**
 * End-to-End Puzzle Pipeline Integration Types.
 *
 * Models execution results and stage performance logs for the 15-stage automated puzzle pipeline.
 */
import type { CanonicalPuzzle } from "../canonical/types";
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";
import type { SolidRepresentation3D } from "../solid3d/types";
import type { AssemblyPlacement } from "../assemblytransforms/types";
import type { UnifiedValidationReport } from "../unifiedvalidation/types";
import type { CompleteDatasetItem } from "../training/types";

export interface StageExecutionLog {
  stageIndex: number;
  stageName: string;
  success: boolean;
  durationMs: number;
  details: string;
}

export interface PipelineInput {
  pieceParameters?: {
    width: number;
    height: number;
    thickness: number;
  };
  edgeParameters?: any[];
  interfaceParameters?: any[];
  manufacturing?: any;
}

export interface PipelineValidationIssue {
  code: string;
  message: string;
  severity: "warning" | "error";
  refIds?: string[];
}

export interface PipelineValidationReport {
  level: "ok" | "warning" | "error";
  isValid: boolean;
  issues: PipelineValidationIssue[];
}

export interface PipelineOutput {
  exactBoundary: any;
  sampledOutlines: any[];
  validationReport: PipelineValidationReport;
  deterministicHash: string;
}

export interface PipelineExecutionResult {
  /** True if all 15 stages executed successfully and final validation report returned isValid: true. */
  success: boolean;
  spec?: ParametricDesignSpecification;
  canonicalPuzzle?: CanonicalPuzzle;
  graph?: PuzzleAssemblyGraph;
  solids?: Record<string, SolidRepresentation3D>;
  placements?: Record<string, AssemblyPlacement>;
  validationReport?: UnifiedValidationReport;
  datasetItem?: CompleteDatasetItem;
  /** Non-90-degree joining angle demonstrated in 3D joint assembly (e.g. 45.0°). */
  joiningAngleDeg: number;
  stageLogs: StageExecutionLog[];
  totalDurationMs: number;
}
