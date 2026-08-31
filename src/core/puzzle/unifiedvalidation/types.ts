/**
 * Unified Puzzle Validation Engine Domain Types.
 *
 * Consolidates 5 validation domains:
 *  1. STRUCTURAL
 *  2. GEOMETRIC
 *  3. CONNECTION
 *  4. MANUFACTURING
 *  5. ASSEMBLY
 *
 * Provides machine-readable AIRepairDirectives for future AI repair systems.
 */
import type { ID } from "@/core/model/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { AssemblyPlacement } from "../assemblytransforms/types";
import type { SolidRepresentation3D } from "../solid3d/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";
import type { DesignParameters, GlobalMaterialParameters } from "../cardboardsubsystem/types";

export type ValidationDomain =
  | "structural"
  | "geometric"
  | "connection"
  | "manufacturing"
  | "assembly";

export interface AIRepairDirective {
  issueId: ID;
  domain: ValidationDomain;
  severity: "warning" | "error";
  /** ID of piece, interface, connection, or material spec requiring repair. */
  targetEntityId: ID;
  /** Standardized defect code (e.g. "UNEXPECTED_COLLISION", "OUT_OF_RANGE_ANGLE"). */
  defectCode: string;
  description: string;
  suggestedRemediation: string;
  /** Machine-readable key-value repair parameters for AI solvers. */
  remediationParams?: Record<string, number | string | boolean>;
}

export interface DomainValidationSummary {
  domain: ValidationDomain;
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  messages: string[];
}

export interface UnifiedValidationReport {
  /** True if zero 'error' severity issues exist across all 5 domains. */
  isValid: boolean;
  overallLevel: "ok" | "warning" | "error";
  /** System health score between 0.0 (unusable) and 1.0 (perfect). */
  overallScore: number;
  domainReports: Record<ValidationDomain, DomainValidationSummary>;
  /** Machine-readable directives for future AI repair systems. */
  aiRepairDirectives: AIRepairDirective[];
}

export interface PuzzleValidationInput {
  puzzle?: CanonicalPuzzle;
  placements?: Record<ID, AssemblyPlacement>;
  solids?: Record<ID, SolidRepresentation3D>;
  graph?: PuzzleAssemblyGraph;
  globalMaterialParams?: GlobalMaterialParameters;
  designParams?: DesignParameters;
}
