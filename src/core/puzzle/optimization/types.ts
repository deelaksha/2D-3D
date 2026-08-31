/**
 * Puzzle Design Optimization Subsystem Domain Types.
 *
 * CRITICAL RULE:
 * Strictly separates HARD CONSTRAINTS (non-negotiable physical rules) from OPTIMIZATION OBJECTIVES
 * (multi-objective fitness criteria: material utilization, piece count, assembly difficulty,
 * connection quality, manufacturing complexity, clearance, symmetry, aesthetics, assembly time).
 */
import type { ID } from "@/core/model/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { DeclarativeConstraint } from "../constraintsystem/types";

export type ObjectiveKind =
  | "material_utilization"
  | "piece_count"
  | "assembly_difficulty"
  | "connection_quality"
  | "manufacturing_complexity"
  | "clearance"
  | "symmetry"
  | "aesthetic_objectives"
  | "assembly_time";

export interface Objective {
  objectiveId: ID;
  kind: ObjectiveKind;
  /** Importance weight between 0.0 and 1.0 (normalized across objectives). */
  weight: number;
  /** Optional target value if direction is "target". */
  targetValue?: number;
  direction: "maximize" | "minimize" | "target";
}

export interface DesignScore {
  /** Overall multi-objective fitness score between 0.0 and 1.0. */
  totalScore: number;
  /** True if zero HARD constraint violations exist. */
  isFeasible: boolean;
  /** Individual scores per objective kind (0.0 to 1.0). */
  objectiveScores: Partial<Record<ObjectiveKind, number>>;
  /** List of HARD constraint failure messages. */
  hardConstraintViolations: string[];
}

export interface CandidateDesign {
  candidateId: ID;
  puzzle: CanonicalPuzzle;
  /** Parameter configuration evaluated for this candidate. */
  parameters: Record<string, number | string | boolean>;
  isFeasible: boolean;
  score?: DesignScore;
}

export interface ParameterSearchSpace {
  parameterName: string;
  targetEntityId: ID;
  /** Range of discrete values to evaluate during grid optimization. */
  values: Array<number | string | boolean>;
}

export interface NestingLayoutConfig {
  sheetWidth: number;
  sheetHeight: number;
  margin: number;
  kerf: number;
}

export interface OptimizationResult {
  /** True if at least one feasible candidate was found and scored. */
  success: boolean;
  bestDesign?: CandidateDesign;
  evaluatedCandidatesCount: number;
  feasibleCandidatesCount: number;
  allCandidates: CandidateDesign[];
  optimizationTimeMs: number;
  nestingEfficiency?: number;
  residualError?: number;
  optimizedAssembly?: any;
}

export interface Optimizer {
  optimizerName: string;
  optimize(
    puzzle: CanonicalPuzzle,
    objectives: Objective[],
    hardConstraints?: DeclarativeConstraint[],
    searchSpaces?: ParameterSearchSpace[],
  ): Promise<OptimizationResult>;
}
