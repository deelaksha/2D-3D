/**
 * Professional AI Designer Workspace Core Types (Prompts 101–120).
 *
 * Types for:
 *  - Modes: Create, Modify, Analyze, Assemble, Optimize, Repair
 *  - Context Chips: Pieces, Interfaces, Connections, Assembly, Validation, Material
 *  - Generation Timeline: 17 structured stages with status and diagnostic telemetry
 *  - Result Inspector: CAD overview, geometry, connections, 3D assembly, validation, AI explanation
 *  - Interactive Assembly: Snapping, Ghost Preview, Angle Control, History Stack
 *  - Multi-Solution Solver: Solutions A, B, C with comparative metrics
 *  - Deterministic Difficulty Engine: 0–10 score, categories, and measurable breakdown
 *  - AI Assembly Coach: Guidance, collision explanations, and angle feasibility
 *  - Manufacturing Layout: Fixed cardboard sheet optimization and production layout
 *  - Design Variants & Comparison: Independent variants and multi-metric comparison
 *  - Design Modification Copilot & Repair Center: Parametric deltas and 1-click repairs
 */

import type { ConvertedPuzzle3D, GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import type { PieceTransforms } from "../assembly3d/types";
import type { AssemblyValidationReport } from "../assemblyvalidation/types";
import type { DesignSpecification2D, GeneratedPuzzle2D } from "../automatic2d/types";
import type { PuzzleGenerationResult } from "../highlevelapi/types";
import type { RigidTransform3D } from "../framesystem/types";

export type AIDesignerMode =
  | "create"
  | "modify"
  | "analyze"
  | "assemble"
  | "optimize"
  | "repair";

export interface ContextItem {
  id: string;
  type: "piece" | "interface" | "connection" | "assembly" | "validation" | "material" | "sheet";
  label: string;
  data?: Record<string, any>;
  removable: boolean;
}

export type TimelineStageKey =
  | "UNDERSTANDING_REQUIREMENT"
  | "DESIGN_SPECIFICATION"
  | "GENERATING_BOUNDARY"
  | "PARTITIONING_PIECES"
  | "CREATING_INTERFACES"
  | "BUILDING_CONNECTION_GRAPH"
  | "GENERATING_CONNECTORS"
  | "VALIDATING_2D_GEOMETRY"
  | "CREATING_3D_PIECES"
  | "GENERATING_JOINING_ANGLES"
  | "SOLVING_ASSEMBLY"
  | "COLLISION_DETECTION"
  | "CLEARANCE_VALIDATION"
  | "ASSEMBLY_FEASIBILITY"
  | "REPAIR_IF_REQUIRED"
  | "FINAL_VALIDATION"
  | "SCENE_CREATION"
  | "STAGE_01_REQUIREMENT"
  | "STAGE_02_SPECIFICATION"
  | "STAGE_03_BOUNDARY"
  | "STAGE_04_PARTITIONING"
  | "STAGE_05_INTERFACES"
  | "STAGE_06_GRAPH"
  | "STAGE_07_CONNECTORS"
  | "STAGE_08_PLACEMENT"
  | "STAGE_09_VALIDATION_2D"
  | "STAGE_10_PIECES_3D"
  | "STAGE_11_JOINING_ANGLES"
  | "STAGE_12_SOLVER_3D"
  | "STAGE_13_COLLISIONS"
  | "STAGE_14_CLEARANCE"
  | "STAGE_15_FEASIBILITY"
  | "STAGE_16_REPAIR"
  | "STAGE_17_FINAL_VALIDATION"
  | "STAGE_18_SCENE_CREATION"
  | "STAGE_19_READY_PREVIEW"
  | "STAGE_20_READY_EXPORT";

export type TimelineStageStatus =
  | "pending"
  | "running"
  | "passed"
  | "warning"
  | "failed"
  | "repaired"
  | "idle"
  | "queued"
  | "skipped"
  | "repairing";

export interface TimelineStage {
  key: TimelineStageKey;
  label: string;
  status: TimelineStageStatus;
  elapsedMs: number;
  details?: {
    title?: string;
    summary?: string;
    metrics?: Record<string, number | string | boolean>;
    notes?: string[];
  };
}

/**
 * 20 Canonical Pipeline Stage IDs (Prompt 121 Section 6)
 */
export type CanonicalStageId =
  | "STAGE_01_REQUIREMENT"
  | "STAGE_02_SPECIFICATION"
  | "STAGE_03_BOUNDARY"
  | "STAGE_04_PARTITIONING"
  | "STAGE_05_INTERFACES"
  | "STAGE_06_GRAPH"
  | "STAGE_07_CONNECTORS"
  | "STAGE_08_PLACEMENT"
  | "STAGE_09_VALIDATION_2D"
  | "STAGE_10_PIECES_3D"
  | "STAGE_11_JOINING_ANGLES"
  | "STAGE_12_SOLVER_3D"
  | "STAGE_13_COLLISIONS"
  | "STAGE_14_CLEARANCE"
  | "STAGE_15_FEASIBILITY"
  | "STAGE_16_REPAIR"
  | "STAGE_17_FINAL_VALIDATION"
  | "STAGE_18_SCENE_CREATION"
  | "STAGE_19_READY_PREVIEW"
  | "STAGE_20_READY_EXPORT";

export type CanonicalStageStatus =
  | "idle"
  | "queued"
  | "running"
  | "passed"
  | "warning"
  | "failed"
  | "skipped"
  | "repairing";

export interface CanonicalPipelineStage {
  id: string;
  name: string;
  status: CanonicalStageStatus;
  startedAt?: number | null;
  completedAt?: number | null;
  duration?: number;
  progress?: number;
  message?: string;
  metrics?: Record<string, any>;
  error?: string | null;
  warnings?: string[];
}

export interface CanonicalPipeline {
  currentStage: string | null;
  stages: CanonicalPipelineStage[];
}

export interface AIWorkspaceContext {
  selectedPieceIds: string[];
  selectedInterfaceIds: string[];
  selectedConnectionIds: string[];
  includeAssembly: boolean;
  include3D: boolean;
}

export interface AIWorkspaceValidation {
  status: "unknown" | "valid" | "invalid" | "warning";
  errors: string[];
  warnings: string[];
}

export interface CanonicalAIWorkspaceState {
  status: "idle" | "interpreting" | "generating" | "passed" | "warning" | "failed" | "ready";
  activeMode: AIDesignerMode;
  model: string | null;
  modelStatus: string;
  requirement: string;
  designSpecification: DesignSpecification2D | null;
  context: AIWorkspaceContext;
  pipeline: CanonicalPipeline;
  result: PuzzleGenerationResult | null;
  validation: AIWorkspaceValidation;
  errors: string[];
  history: string[];
  suggestions: string[];
}

export interface PromptInterpretationPreview {
  intent: string;
  targetPieceCount: number;
  puzzleType: string;
  difficultyLevel: string;
  connectionComplexity: string;
  assemblyStyle: string;
  joiningAngleBehavior: string;
  materialName: string;
  thicknessMm: number;
  fixedSheetWidthMm: number;
  fixedSheetHeightMm: number;
  constraints: string[];
}

export interface AssemblyStepHistoryEntry {
  id: string;
  timestamp: string;
  description: string;
  actionType:
    | "move"
    | "rotate"
    | "connect"
    | "disconnect"
    | "angle_change"
    | "auto_snap"
    | "repair"
    | "reset";
  pieceTransforms: PieceTransforms;
  appliedAngles: Record<string, number>;
  connectedPairs: Array<{ pieceAId: string; pieceBId: string; connectionId: string }>;
  validationStatus: "valid" | "warning" | "invalid";
}

export interface GhostPreviewState {
  active: boolean;
  draggedPieceId: string | null;
  targetInterfaceId: string | null;
  proposedConnectionId: string | null;
  joiningAngleDeg: number;
  status: "VALID" | "WARNING" | "INVALID";
  reason?: string;
  ghostTransform?: RigidTransform3D;
  minimumClearanceMm?: number;
  penetrationDepthMm?: number;
}

export interface AssemblySolutionOption {
  id: "solution_a" | "solution_b" | "solution_c" | string;
  name: string;
  description: string;
  rootPieceId: string;
  pieceTransforms: PieceTransforms;
  appliedAngles: Record<string, number>;
  uniqueAnglesCount: number;
  collisionMarginMm: number;
  minimumClearanceMm: number;
  assemblyStepsCount: number;
  structuralScore: number; // 0–100
  difficultyScore: number; // 0–10
  isValid: boolean;
}

export interface AssemblyDifficultyEvaluation {
  score: number; // 0–10
  category: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  reasons: string[];
  metrics: {
    pieceCount: number;
    connectionCount: number;
    uniqueAnglesCount: number;
    validSolutionsCount: number;
    minimumClearanceMm: number;
    orientationAmbiguity: number; // 0–1
    requiredRotationsCount: number;
    sequenceComplexity: number; // 0–1
  };
}

export interface CoachAdvice {
  recommendedPieceId?: string;
  recommendedReason?: string;
  connectionDiagnostics?: {
    connectionId?: string;
    canConnect: boolean;
    reason: string;
    clearanceMm?: number;
    suggestedAngleDeg?: number;
  };
  angleFeasibility?: {
    requestedAngleDeg: number;
    isFeasible: boolean;
    reason: string;
    allowedRange: { min: number; max: number };
  };
}

export interface ManufacturingLayoutOptimizationResult {
  sheetWidthMm: number;
  sheetHeightMm: number;
  materialThicknessMm: number;
  fitsOnConfiguredSheet: boolean;
  totalPieces: number;
  piecesPacked: number;
  sheetsRequired: number;
  materialUtilizationPercent: number;
  wasteAreaMm2: number;
  totalCutLengthMm: number;
  minimumEdgeDistanceMm: number;
  manufacturingClearanceMm: number;
  warnings: string[];
  suggestedAlternatives?: string[];
  packedPlacements: Array<{
    pieceId: string;
    sheetIndex: number;
    x: number;
    y: number;
    rotationDeg: number;
    width: number;
    height: number;
    locked: boolean;
  }>;
}

export interface DesignVariantCard {
  id: "variant_a" | "variant_b" | "variant_c";
  name: string;
  difficultyLabel: "Easy" | "Balanced" | "Expert";
  difficultyScore: number;
  pieceCount: number;
  connectionCount: number;
  uniqueAngles: number[];
  materialUtilizationPercent: number;
  isValid: boolean;
  puzzleResult?: PuzzleGenerationResult;
  manufacturingScore: number; // 0–100
}

export interface DesignComparisonItem {
  metricName: string;
  category: "Overview" | "Geometry" | "Connections" | "Assembly" | "Manufacturing";
  unit?: string;
  values: Record<string, string | number | boolean>;
  favorableVariantId?: string;
}

export interface ProposedDesignDelta {
  originalSpec: DesignSpecification2D;
  proposedSpec: DesignSpecification2D;
  changesSummary: string[];
  affectedPieceIds: string[];
  unaffectedPieceIds: string[];
  requiresConfirmation: boolean;
}

export interface RepairCenterIssue {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "collision" | "clearance" | "angle" | "interface" | "boundary";
  affectedPieceIds: string[];
  affectedConnectionId?: string;
  problemTitle: string;
  rootCause: string;
  possibleRepairs: Array<{
    id: string;
    label: string;
    actionType: "try_angle" | "move_connector" | "use_alternate_interface" | "alternate_solution" | "regenerate_local";
    suggestedValue?: number | string;
    expectedImpact: string;
  }>;
}
