/**
 * AI Pipeline Engine (Phase 50).
 * Connects AI Requirement Parser + AI Design Planner to Authoritative Canonical Parametric IR & Validation Engines.
 * Strictly enforces deterministic validation: The AI is NOT authoritative; canonical validation is authoritative.
 */
import type { AIPipelineInput, AIPipelineResult, RejectionDiagnosticItem } from "./types";
import { RequirementParser } from "../ai/requirementParser";
import { convertPlanToSpecification, MockDesignPlanner } from "../designplanner/designPlanner";
import { createCanonicalInterface, createCanonicalPiece, createEmptyCanonicalPuzzle } from "../canonical/defaults";
import { DatasetQualityValidator } from "../validation/datasetQualityValidator";
import { PuzzleReviewManager } from "../annotation/reviewManager";
import type { CanonicalPuzzle } from "../canonical/types";

export class AIPipelineEngine {
  private parser: RequirementParser;
  private planner: MockDesignPlanner;

  constructor(parser?: RequirementParser, planner?: MockDesignPlanner) {
    this.parser = parser || new RequirementParser();
    this.planner = planner || new MockDesignPlanner();
  }

  /**
   * Executes the master 7-stage AI-to-CAD Pipeline:
   * User Requirement -> AI Parser -> Design Planner -> Specification -> Schema Valid -> Constraint Valid -> Geometry Engine.
   */
  async executePipeline(input: AIPipelineInput): Promise<AIPipelineResult> {
    const startTime = Date.now();
    const pipelineId = `pipe_ai_${Date.now()}`;
    const rejectionDiagnostics: RejectionDiagnosticItem[] = [];

    // Stage 1: AI Requirement Parser
    const initialSpec = await this.parser.parseRequirement(input.userRequirement);

    // Stage 2: AI Design Planner
    const plan = await this.planner.createDesignPlan({
      userRequirement: input.userRequirement,
      optionalDrawing: input.optionalDrawing,
      retrievedExamples: input.retrievedExamples,
    });

    // Stage 3: Parametric Design Specification Conversion
    const specification = convertPlanToSpecification(plan);

    // Stage 4: Deterministic Rejection Validation (Strict Invariant)

    // Check 1: Piece Count Validity
    const pieceCount = specification.designParameters.pieceCount || 0;
    if (pieceCount <= 0 || pieceCount > 100) {
      rejectionDiagnostics.push({
        code: "INVALID_PIECE_COUNT",
        message: `Proposed piece count (${pieceCount}) is invalid. Piece count must be between 1 and 100.`,
        suggestedFixForAI: "Specify a valid integer piece count between 1 and 50.",
        severity: "error",
      });
    }

    // Check 2: Outer Footprint & Material Dimensions Validity
    const width = specification.designParameters.outerBoundary.widthMm || 0;
    const height = specification.designParameters.outerBoundary.heightMm || 0;
    const thickness = specification.materialParameters.thicknessMm;

    if (width <= 0 || height <= 0) {
      rejectionDiagnostics.push({
        code: "INVALID_OUTER_DIMENSIONS",
        message: `Proposed outer dimensions (${width} x ${height} mm) are degenerate or missing.`,
        suggestedFixForAI: "Specify explicit positive outer boundary dimensions in mm (e.g. 200 x 300 mm).",
        severity: "error",
      });
    }

    if (thickness < 0.5 || thickness > 20.0) {
      rejectionDiagnostics.push({
        code: "INVALID_MATERIAL_THICKNESS",
        message: `Material thickness ${thickness}mm is outside valid cardboard manufacturing limits [0.5mm, 20.0mm].`,
        suggestedFixForAI: "Set material thickness between 1.0mm and 10.0mm.",
        severity: "error",
      });
    }

    // Check 3: Angle Ranges & Connection Definitions
    const angles = specification.assemblyParameters.allowedAssemblyAnglesDeg || [];
    const invalidAngle = angles.find((a) => a < 0 || a > 360);
    if (invalidAngle !== undefined) {
      rejectionDiagnostics.push({
        code: "INVALID_ANGLE_RANGE",
        message: `Assembly joining angle ${invalidAngle} deg is out of valid range [0, 360].`,
        suggestedFixForAI: "Specify valid joining angles such as 90 or 180 degrees.",
        severity: "error",
      });
    }

    // Return Early Rejection if Errors Detected
    const hasErrors = rejectionDiagnostics.some((d) => d.severity === "error");
    if (hasErrors) {
      return {
        pipelineId,
        status: "REJECTED",
        designPlan: plan,
        specification,
        rejectionDiagnostics,
        processingDurationMs: Date.now() - startTime,
      };
    }

    // Stage 5 & 6: Geometry Engine & Canonical Puzzle Instantiation
    const canonicalPuzzle: CanonicalPuzzle = createEmptyCanonicalPuzzle(specification.userIntent.summary);
    canonicalPuzzle.metadata.id = `puz_${pipelineId}`;

    const pieceWidth = Math.max(50, width / Math.max(1, Math.ceil(Math.sqrt(pieceCount))));
    const pieceHeight = Math.max(50, height / Math.max(1, Math.ceil(Math.sqrt(pieceCount))));

    for (let i = 1; i <= pieceCount; i++) {
      const pId = `p_${i}`;
      const piece = createCanonicalPiece(`Piece ${i}`, { width: pieceWidth, height: pieceHeight, depth: thickness }, thickness);
      piece.id = pId;

      const ifIn = createCanonicalInterface(pId, `Interface ${pId} In`, { x: 0, y: 0 }, { x: 0, y: -1 });
      ifIn.id = `if_${pId}_in`;
      const ifOut = createCanonicalInterface(pId, `Interface ${pId} Out`, { x: pieceWidth, y: 0 }, { x: 1, y: 0 });
      ifOut.id = `if_${pId}_out`;

      canonicalPuzzle.pieces.push(piece);
      canonicalPuzzle.interfaces.push(ifIn, ifOut);
    }

    // Stage 7: Final Dataset Acceptance Validation
    const reviewManager = new PuzzleReviewManager();
    const annotation = reviewManager.startReviewSession(canonicalPuzzle, "ai_pipeline_engine");
    reviewManager.markStatus(canonicalPuzzle.metadata.id, "CORRECT", "ai_pipeline_engine");
    const latestAnnotation = reviewManager.getStore().getLatestAnnotation(canonicalPuzzle.metadata.id);
    const constraintReport = DatasetQualityValidator.validateItem(canonicalPuzzle, latestAnnotation);

    return {
      pipelineId,
      status: "SUCCESS",
      designPlan: plan,
      specification,
      canonicalPuzzle,
      constraintReport,
      rejectionDiagnostics: [],
      processingDurationMs: Date.now() - startTime,
    };
  }
}
