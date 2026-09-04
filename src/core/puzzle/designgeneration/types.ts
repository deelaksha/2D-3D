/**
 * AI-Assisted Puzzle Design Generation Types (Phase 71).
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 *  - The AI layer NEVER directly generates STL, STEP, raw mesh vertices, or uncontrolled CAD geometry.
 *  - The AI layer strictly outputs a structured ParametricDesignSpecification JSON payload.
 *  - The deterministic geometry engine remains the sole authority for physical coordinates,
 *    boundaries, 3D extrusions, coordinate frames, and validation.
 *  - Every design must pass all 5 validation gates: Schema, Hard Constraints, 2D Geometry,
 *    Connections, and 3D Assembly.
 */

import type { ID } from "@/core/model/types";
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { RetrievedDesign } from "../retrievalsystem/types";
import type { CanonicalPuzzle } from "../canonical/types";

/**
 * Input request for AI-assisted puzzle design generation.
 */
export interface AIDesignGenerationRequest {
  /** 1. Natural language design requirement or customer prompt */
  prompt: string;

  /** 2. Optional base64-encoded reference drawing, sketch, or photo */
  referenceImageBase64?: string;

  /** 3. Optional retrieved reference designs (from Phase 70 retrieval system) */
  retrievedDesigns?: RetrievedDesign[];

  /** 4. User preferences and target parameters */
  userPreferences?: {
    targetPieceCount?: number;
    targetDimensions?: {
      widthMm?: number;
      heightMm?: number;
      depthMm?: number;
    };
    preferredMaterialId?: ID;
    defaultJoiningAngleDeg?: number;
    preferredJointType?: string;
    targetDifficulty?: "easy" | "medium" | "hard" | "expert";
    layers?: number;
  };
}

/**
 * Structured reasoning breakdown across all 11 required physical/manufacturing domains.
 */
export interface AIReasoningSummary {
  /** 1. Piece count reasoning */
  pieceCountReasoning: string;

  /** 2. Geometric bounds, proportions, and shape decomposition */
  geometryReasoning: string;

  /** 3. Interface ports, placement, and clearance tolerances */
  interfacesReasoning: string;

  /** 4. Connection joint types and topological relationships */
  connectionsReasoning: string;

  /** 5. Material selection (cardboard grade, stock thickness) */
  materialReasoning: string;

  /** 6. Cardboard stock dimensions and nesting feasibility */
  cardboardDimensionsReasoning: string;

  /** 7. Target difficulty rating and complexity reasoning (Phase 69 alignment) */
  difficultyReasoning: string;

  /** 8. Assembly flexibility, kinematics, and sequencing */
  assemblyFlexibilityReasoning: string;

  /** 9. Permitted joining angles (45°, 90°, continuous, etc.) */
  allowedAnglesReasoning: string;

  /** 10. Stacking layers and multi-layer structural depth */
  layersReasoning: string;

  /** 11. Manufacturing constraints (laser kerf, min bridge width, grain direction) */
  manufacturingConstraintsReasoning: string;
}

/**
 * Status of the 5 required deterministic validation gates.
 */
export interface AIValidationPasses {
  /** Gate 1: Schema validation */
  schemaValidation: boolean;

  /** Gate 2: Hard constraint validation (positive dimensions, non-overflow, declarative constraints) */
  hardConstraintValidation: boolean;

  /** Gate 3: 2D Geometry validation (closed loops, valid outlines, positive areas) */
  geometryValidation: boolean;

  /** Gate 4: Connection validation (complementary pairs, tolerance compatibility) */
  connectionValidation: boolean;

  /** Gate 5: 3D Assembly validation (no physical penetration, kinematic feasibility) */
  validation3D: boolean;

  /** Overall status across all 5 gates */
  overallPassed: boolean;
}

/**
 * Comprehensive result of the AI-assisted design generation workflow.
 */
export interface AIDesignGenerationResult {
  /** Unique generation run identifier */
  generationId: string;

  /** Lifecycle status of the generation */
  status: "ACCEPTED" | "REJECTED";

  /** The structured ParametricDesignSpecification produced by the AI reasoning layer */
  specification: ParametricDesignSpecification;

  /** The 11-domain reasoning summary */
  reasoningSummary: AIReasoningSummary;

  /** Explicit anti-cloning adaptation documentation if retrieved designs were used */
  referenceAdaptationNotes?: string[];

  /** Detailed report from the 5 validation gates */
  validationReport: {
    passes: AIValidationPasses;
    errors: string[];
    warnings: string[];
  };

  /** The compiled canonical puzzle produced by the deterministic geometry engine (if ACCEPTED) */
  canonicalPuzzle?: CanonicalPuzzle;

  /** Wall clock duration in milliseconds */
  processingDurationMs: number;
}
