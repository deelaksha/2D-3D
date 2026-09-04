/**
 * AI Design Critic Domain Types (Phase 72).
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 *  - The critic must distinguish HARD_FAILURE, WARNING, and STYLE_PREFERENCE.
 *  - The critic must NOT override or bypass deterministic validation results.
 *  - The critic must NOT directly modify CAD geometry or piece boundaries.
 *  - Feedback is strictly structured as diagnostic issues and suggested parameters.
 */

import type { ID } from "@/core/model/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { AIValidationPasses } from "../designgeneration/types";

/**
 * 3-Tier Severity Classification.
 */
export type CritiqueSeverity =
  | "HARD_FAILURE"       // Physical impossibility, clash, zero dimension, sheet overflow (violates hard validation)
  | "WARNING"            // Suboptimal or risky condition (tight clearance, low sheet utilization, narrow bridge)
  | "STYLE_PREFERENCE";  // Non-critical aesthetic, ergonomic, symmetry, or preference suggestion

/**
 * The 8 evaluated design domains.
 */
export type CritiqueCategory =
  | "geometry_quality"
  | "connection_quality"
  | "assembly_flexibility"
  | "difficulty"
  | "material_utilization"
  | "manufacturability"
  | "symmetry"
  | "aesthetic_preference";

/**
 * Target entity affected by the critique issue.
 */
export interface AffectedEntity {
  type: "piece" | "interface" | "connection" | "material" | "specification" | "assembly";
  id: ID;
  name?: string;
}

/**
 * Actionable parameter suggestion allowing downstream adjustment without manual geometry hacking.
 */
export interface SuggestedParameter {
  parameterName: string;
  currentValue: number | string | boolean;
  suggestedValue: number | string | boolean;
  rationale: string;
}

/**
 * Individual critique issue record.
 */
export interface CritiqueIssue {
  id: string;
  category: CritiqueCategory;
  severity: CritiqueSeverity;
  affectedEntity: AffectedEntity;
  reason: string;
  suggestedParameter?: SuggestedParameter;
}

/**
 * Domain score breakdown on continuous [0.0, 100.0] scale.
 */
export interface DesignCritiqueDomainScores {
  geometryQuality: number;
  connectionQuality: number;
  assemblyFlexibility: number;
  difficultyAlignment: number;
  materialUtilization: number;
  manufacturability: number;
  symmetry: number;
  aestheticPreference: number;
  compositeQualityScore: number;
}

/**
 * Overall structured critique artifact produced by the AI Design Critic.
 */
export interface DesignCritique {
  critiqueId: string;
  designId: string;
  overallAssessment: "PASS" | "NEEDS_REVISION" | "REJECTED";
  scores: DesignCritiqueDomainScores;
  issues: CritiqueIssue[];
  hardFailuresCount: number;
  warningsCount: number;
  stylePreferencesCount: number;

  /**
   * STRICT INVARIANT:
   * Confirms the critic strictly preserved deterministic validation passes without altering them.
   */
  deterministicValidationUnaltered: true;

  summary: string;
  evaluatedAt: string;
}

/**
 * Formal interface for AI Design Critic implementations.
 */
export interface AIDesignCritic {
  readonly criticId: string;
  readonly version: string;

  /**
   * Produces a structured design critique for a given design, specification, and validation report.
   */
  critique(
    design: CanonicalPuzzle,
    specification?: ParametricDesignSpecification,
    validationPasses?: AIValidationPasses
  ): DesignCritique;
}
