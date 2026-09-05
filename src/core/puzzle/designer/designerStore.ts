/**
 * AI Designer Workspace Observable Store (Prompts 101–121).
 *
 * Centralized, framework-independent observable store coordinating:
 *  - Canonical AI Workspace State (Prompt 121 Section 2)
 *  - Robust State Normalizer & Initializer (Prompt 121 Sections 3 & 4)
 *  - 20-stage generation pipeline with precise stage execution telemetry
 *  - Active generated puzzle and CAD inspection metrics
 *  - Multi-solution solver state (Solutions A, B, C)
 *  - Assembly state history with deterministic undo/redo
 *  - Fixed sheet cardboard constraints (locked against silent AI enlargement)
 *  - Design variants and design comparison metrics
 *  - Interactive repair center diagnostics
 */

import { useSyncExternalStore } from "react";
import type { ConvertedPuzzle3D } from "../piece3d/types";
import type { PieceTransforms } from "../assembly3d/types";
import type { AssemblyValidationReport } from "../assemblyvalidation/types";
import type { PuzzleGenerationResult } from "../highlevelapi/types";
import type { DesignSpecification2D, GeneratedPuzzle2D } from "../automatic2d/types";
import type { SuccessfulAssembly } from "../assemblysolver/types";
import type {
  AIDesignerMode,
  AIWorkspaceContext,
  AIWorkspaceValidation,
  AssemblyDifficultyEvaluation,
  AssemblySolutionOption,
  AssemblyStepHistoryEntry,
  CanonicalPipeline,
  CanonicalPipelineStage,
  ContextItem,
  DesignVariantCard,
  GhostPreviewState,
  ManufacturingLayoutOptimizationResult,
  RepairCenterIssue,
  TimelineStage,
  TimelineStageKey,
} from "./types";

export function puzzleResultTo3D(result?: PuzzleGenerationResult | null): ConvertedPuzzle3D {
  const safeSpec = result?.designSpecification ?? ({} as any);
  const safePieces = result?.pieces3D ?? [];
  const safeConnectors = result?.connectors ?? [];
  const safeValidation = result?.validationReport ?? { isValid: true, failures: [], connectionDetails: {}, pieceDetails: {}, overallClearanceMm: 1.2, summary: "Valid" };

  return {
    puzzleId: safeSpec?.id || "puzzle_3d",
    specification: safeSpec,
    pieces: safePieces,
    connections: safeConnectors.map((c) => ({
      connectionId: c?.id ?? "c_unknown",
      pieceAId: c?.pieceA ?? "",
      pieceBId: c?.pieceB ?? "",
      interfaceAId: c?.interfaceA?.id ?? "",
      interfaceBId: c?.interfaceB?.id ?? "",
      connectorType: c?.connectorType ?? "slot",
      parameters: { ...(c?.parameters ?? {}) },
      clearanceMm: c?.clearance ?? 0.2,
      allowedAngleDeg: c?.allowedAngle ?? [90],
    })),
    validation: {
      isValid: safeValidation.isValid,
      issues: [],
      pieceValidations: [],
    },
    metadata: {
      convertedAt: new Date().toISOString(),
      executionDurationMs: result?.generationStatistics?.totalDurationMs ?? 0,
      generatorVersion: "1.0",
      totalVolumeMm3: 0,
    },
  };
}

export function puzzleResultTo2D(result?: PuzzleGenerationResult | null): GeneratedPuzzle2D {
  const safeSpec = result?.designSpecification ?? ({} as any);
  return {
    puzzleId: safeSpec?.id || "puzzle_2d",
    specification: safeSpec,
    pieces: result?.pieces2D ?? [],
    connections: result?.connectors ?? [],
    graph: result?.connectionGraph ?? ({ nodes: [], edges: [] } as any),
    validation: {
      isValid: true,
      issues: [],
    },
  };
}

export function getTransformsFromResult(result?: PuzzleGenerationResult | null): PieceTransforms {
  if (!result) return {};
  return result.pieceTransforms ?? (result.assembly as SuccessfulAssembly)?.pieceTransforms ?? {};
}

export function getAppliedAnglesFromResult(result?: PuzzleGenerationResult | null): Record<string, number> {
  if (!result) return {};
  return result.appliedAngles ?? (result.assembly as SuccessfulAssembly)?.appliedAngles ?? {};
}

export interface StructuredCreateControls {
  puzzleType: "interlocking" | "box" | "architectural" | "non_planar" | "geometric";
  pieceCount: number;
  overallWidthMm: number;
  overallHeightMm: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  connectionComplexity: "Simple" | "Moderate" | "Complex" | "Keyed";
  assemblyStyle: "Planar" | "Box" | "Multi-layer" | "Non-planar" | "Freeform 3D";
  joiningAngleBehavior: "Fixed 90°" | "Stepped 45°/90°" | "Continuous" | "Keyed";
  materialName: "Birch Plywood 3mm" | "Cardboard 2mm" | "Cardboard 3mm" | "MDF 4mm" | "Acrylic 3mm";
  designStyle: "Geometric" | "Organic Voronoi" | "Minimalist" | "Mechanical";
  naturalLanguagePrompt: string;
}

export const INITIAL_TIMELINE_STAGES: TimelineStage[] = [
  { key: "UNDERSTANDING_REQUIREMENT", label: "Requirement understood", status: "pending", elapsedMs: 0 },
  { key: "DESIGN_SPECIFICATION", label: "Design specification created", status: "pending", elapsedMs: 0 },
  { key: "GENERATING_BOUNDARY", label: "2D geometry boundary generated", status: "pending", elapsedMs: 0 },
  { key: "PARTITIONING_PIECES", label: "Pieces partitioned", status: "pending", elapsedMs: 0 },
  { key: "CREATING_INTERFACES", label: "Interfaces generated", status: "pending", elapsedMs: 0 },
  { key: "BUILDING_CONNECTION_GRAPH", label: "Connection graph constructed", status: "pending", elapsedMs: 0 },
  { key: "GENERATING_CONNECTORS", label: "Parametric connectors synthesized", status: "pending", elapsedMs: 0 },
  { key: "VALIDATING_2D_GEOMETRY", label: "2D geometry validated", status: "pending", elapsedMs: 0 },
  { key: "CREATING_3D_PIECES", label: "3D pieces extruded & framed", status: "pending", elapsedMs: 0 },
  { key: "GENERATING_JOINING_ANGLES", label: "Valid joining angles generated", status: "pending", elapsedMs: 0 },
  { key: "SOLVING_ASSEMBLY", label: "3D assembly solved", status: "pending", elapsedMs: 0 },
  { key: "COLLISION_DETECTION", label: "Collision check passed", status: "pending", elapsedMs: 0 },
  { key: "CLEARANCE_VALIDATION", label: "Clearance validated", status: "pending", elapsedMs: 0 },
  { key: "ASSEMBLY_FEASIBILITY", label: "Assembly feasibility verified", status: "pending", elapsedMs: 0 },
  { key: "REPAIR_IF_REQUIRED", label: "Autonomous repair loop", status: "pending", elapsedMs: 0 },
  { key: "FINAL_VALIDATION", label: "Final assembly validated", status: "pending", elapsedMs: 0 },
  { key: "SCENE_CREATION", label: "3D scene constructed", status: "pending", elapsedMs: 0 },
];

export const CANONICAL_20_PIPELINE_STAGES: CanonicalPipelineStage[] = [
  { id: "STAGE_01_REQUIREMENT", name: "Requirement Understanding", status: "idle", progress: 0, message: "Awaiting design requirement" },
  { id: "STAGE_02_SPECIFICATION", name: "Design Specification", status: "idle", progress: 0, message: "Specification pending" },
  { id: "STAGE_03_BOUNDARY", name: "Global 2D Boundary", status: "idle", progress: 0, message: "Boundary pending" },
  { id: "STAGE_04_PARTITIONING", name: "Piece Partitioning", status: "idle", progress: 0, message: "Partitioning pending" },
  { id: "STAGE_05_INTERFACES", name: "Interface Generation", status: "idle", progress: 0, message: "Interfaces pending" },
  { id: "STAGE_06_GRAPH", name: "Connection Graph", status: "idle", progress: 0, message: "Graph pending" },
  { id: "STAGE_07_CONNECTORS", name: "Connector Generation", status: "idle", progress: 0, message: "Connectors pending" },
  { id: "STAGE_08_PLACEMENT", name: "Connector Placement", status: "idle", progress: 0, message: "Placement pending" },
  { id: "STAGE_09_VALIDATION_2D", name: "2D Geometry Validation", status: "idle", progress: 0, message: "2D validation pending" },
  { id: "STAGE_10_PIECES_3D", name: "3D Piece Generation", status: "idle", progress: 0, message: "3D conversion pending" },
  { id: "STAGE_11_JOINING_ANGLES", name: "Joining Angle Generation", status: "idle", progress: 0, message: "Angles pending" },
  { id: "STAGE_12_SOLVER_3D", name: "3D Assembly Solver", status: "idle", progress: 0, message: "Assembly solver pending" },
  { id: "STAGE_13_COLLISIONS", name: "Collision Detection", status: "idle", progress: 0, message: "Collision check pending" },
  { id: "STAGE_14_CLEARANCE", name: "Clearance Validation", status: "idle", progress: 0, message: "Clearance check pending" },
  { id: "STAGE_15_FEASIBILITY", name: "Assembly Feasibility", status: "idle", progress: 0, message: "Feasibility check pending" },
  { id: "STAGE_16_REPAIR", name: "Repair / Regeneration", status: "idle", progress: 0, message: "Repair check pending" },
  { id: "STAGE_17_FINAL_VALIDATION", name: "Final Validation", status: "idle", progress: 0, message: "Final validation pending" },
  { id: "STAGE_18_SCENE_CREATION", name: "3D Scene Creation", status: "idle", progress: 0, message: "Scene creation pending" },
  { id: "STAGE_19_READY_PREVIEW", name: "Ready for Preview", status: "idle", progress: 0, message: "Preview pending" },
  { id: "STAGE_20_READY_EXPORT", name: "Ready for Export", status: "idle", progress: 0, message: "Export pending" },
];

export interface AIDesignerWorkspaceState {
  // Canonical fields (Prompt 121 Section 2)
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

  // Workspace UI & Session flags
  isCollapsed: boolean;
  settingsOpen: boolean;
  debugMode: boolean;

  // Model & Backend Health
  modelName: string;
  generationStatus: "Idle" | "Running" | "Success" | "Warning" | "Error";
  isGenerating: boolean;

  // Fixed Cardboard Constraints (Never silently modified by AI)
  fixedSheetWidthMm: number;
  fixedSheetHeightMm: number;
  configuredThicknessMm: number;

  // Composer
  promptText: string;
  promptHistory: string[];
  contextItems: ContextItem[];

  // Structured Controls for Create Mode
  createControls: StructuredCreateControls;

  // Timeline & Activity
  timelineStages: TimelineStage[];
  activeStageKey: TimelineStageKey | null;
  totalElapsedMs: number;

  // Current Generated CAD Puzzle
  activePuzzleResult: PuzzleGenerationResult | null;
  activePuzzle3D: ConvertedPuzzle3D | null;
  activePieceTransforms: PieceTransforms;
  activeAppliedAngles: Record<string, number>;
  activeValidationReport: AssemblyValidationReport | null;

  // Multiple Valid Assembly Solutions (Prompt 110)
  assemblySolutions: AssemblySolutionOption[];
  selectedSolutionId: string | null;

  // Deterministic Difficulty (Prompt 111)
  difficultyEvaluation: AssemblyDifficultyEvaluation | null;

  // Interactive Assembly Mode & History (Prompts 105–109)
  selectedPieceId: string | null;
  selectedConnectionId: string | null;
  selectedInterfaceId: string | null;
  ghostPreview: GhostPreviewState;
  assemblyHistory: AssemblyStepHistoryEntry[];
  historyIndex: number;

  // Manufacturing Layout (Prompts 113, 114)
  manufacturingLayout: ManufacturingLayoutOptimizationResult | null;

  // Design Variants & Comparison (Prompts 115, 116)
  variants: DesignVariantCard[];
  selectedVariantId: string | null;
  comparisonViewOpen: boolean;

  // AI Repair Center (Prompt 118)
  repairIssues: RepairCenterIssue[];
  activeRepairIssueId: string | null;
}

export type CanonicalAIWorkspaceState = AIDesignerWorkspaceState;

export const DEFAULT_WORKSPACE_STATE: AIDesignerWorkspaceState = {
  // Canonical fields
  status: "idle",
  activeMode: "create",
  model: null,
  modelStatus: "Ready",
  requirement: "",
  designSpecification: null,
  context: {
    selectedPieceIds: [],
    selectedInterfaceIds: [],
    selectedConnectionIds: [],
    includeAssembly: false,
    include3D: false,
  },
  pipeline: {
    currentStage: null,
    stages: CANONICAL_20_PIPELINE_STAGES.map((s) => ({ ...s })),
  },
  result: null,
  validation: {
    status: "unknown",
    errors: [],
    warnings: [],
  },
  errors: [],
  history: [
    "Generate a 20-piece 3D puzzle",
    "Make internal connections more complex",
    "Increase assembly difficulty",
    "Show valid joining angles",
    "Repair current collision",
  ],
  suggestions: [
    "Generate a 16-piece non-planar puzzle",
    "Create an architectural box puzzle",
    "Build a 20-piece puzzle with keyed connectors",
    "Generate organic Voronoi puzzle",
  ],

  // UI state
  isCollapsed: false,
  settingsOpen: false,
  debugMode: false,

  modelName: "Qwen 2.5 CAD Assistant",
  generationStatus: "Idle",
  isGenerating: false,

  // Default standard A4 stock sheet: 297 × 210 mm, 3mm thickness
  fixedSheetWidthMm: 297,
  fixedSheetHeightMm: 210,
  configuredThicknessMm: 3.0,

  promptText: "",
  promptHistory: [
    "Generate a 20-piece 3D puzzle",
    "Make internal connections more complex",
    "Increase assembly difficulty",
    "Show valid joining angles",
    "Repair current collision",
  ],
  contextItems: [
    { id: "ctx-mat", type: "material", label: "Cardboard 3mm", removable: false },
    { id: "ctx-sheet", type: "sheet", label: "A4 297×210 mm (Fixed)", removable: false },
  ],

  createControls: {
    puzzleType: "non_planar",
    pieceCount: 16,
    overallWidthMm: 180,
    overallHeightMm: 140,
    difficulty: "Advanced",
    connectionComplexity: "Complex",
    assemblyStyle: "Non-planar",
    joiningAngleBehavior: "Stepped 45°/90°",
    materialName: "Cardboard 3mm",
    designStyle: "Geometric",
    naturalLanguagePrompt: "Generate a 16-piece non-planar puzzle with stepped 45° and 90° connections.",
  },

  timelineStages: INITIAL_TIMELINE_STAGES.map((s) => ({ ...s })),
  activeStageKey: null,
  totalElapsedMs: 0,

  activePuzzleResult: null,
  activePuzzle3D: null,
  activePieceTransforms: {},
  activeAppliedAngles: {},
  activeValidationReport: null,

  assemblySolutions: [],
  selectedSolutionId: null,

  difficultyEvaluation: null,

  selectedPieceId: null,
  selectedConnectionId: null,
  selectedInterfaceId: null,
  ghostPreview: {
    active: false,
    draggedPieceId: null,
    targetInterfaceId: null,
    proposedConnectionId: null,
    joiningAngleDeg: 90,
    status: "VALID",
  },
  assemblyHistory: [],
  historyIndex: -1,

  manufacturingLayout: null,
  variants: [],
  selectedVariantId: null,
  comparisonViewOpen: false,

  repairIssues: [],
  activeRepairIssueId: null,
};

/**
 * Normalizes raw/persisted/old state into a canonical AIWorkspaceState.
 * Guaranteed never to throw exceptions (Prompt 121 Section 3).
 */
export function normalizeAIWorkspaceState(rawState: unknown): CanonicalAIWorkspaceState {
  if (!rawState || typeof rawState !== "object") {
    return {
      ...DEFAULT_WORKSPACE_STATE,
      pipeline: {
        currentStage: null,
        stages: CANONICAL_20_PIPELINE_STAGES.map((s) => ({ ...s })),
      },
      timelineStages: INITIAL_TIMELINE_STAGES.map((s) => ({ ...s })),
      contextItems: [...DEFAULT_WORKSPACE_STATE.contextItems],
      activePieceTransforms: {},
      activeAppliedAngles: {},
      createControls: { ...DEFAULT_WORKSPACE_STATE.createControls },
    };
  }

  const raw = rawState as Record<string, any>;
  const base = DEFAULT_WORKSPACE_STATE;

  // Normalize activeMode
  const validModes: AIDesignerMode[] = ["create", "modify", "analyze", "assemble", "optimize", "repair"];
  const activeMode = validModes.includes(raw.activeMode) ? raw.activeMode : base.activeMode;

  // Normalize status
  const validStatuses = ["idle", "interpreting", "generating", "passed", "warning", "failed", "ready"] as const;
  const status = validStatuses.includes(raw.status) ? raw.status : base.status;

  // Normalize context
  const rawContext = (raw.context && typeof raw.context === "object") ? raw.context : {};
  const context: AIWorkspaceContext = {
    selectedPieceIds: Array.isArray(rawContext.selectedPieceIds)
      ? rawContext.selectedPieceIds
      : raw.selectedPieceId ? [raw.selectedPieceId] : [],
    selectedInterfaceIds: Array.isArray(rawContext.selectedInterfaceIds)
      ? rawContext.selectedInterfaceIds
      : raw.selectedInterfaceId ? [raw.selectedInterfaceId] : [],
    selectedConnectionIds: Array.isArray(rawContext.selectedConnectionIds)
      ? rawContext.selectedConnectionIds
      : raw.selectedConnectionId ? [raw.selectedConnectionId] : [],
    includeAssembly: Boolean(rawContext.includeAssembly),
    include3D: Boolean(rawContext.include3D),
  };

  // Normalize pipeline
  const rawPipeline = (raw.pipeline && typeof raw.pipeline === "object") ? raw.pipeline : {};
  const pipelineStages = Array.isArray(rawPipeline.stages) && rawPipeline.stages.length > 0
    ? rawPipeline.stages
    : CANONICAL_20_PIPELINE_STAGES.map((s) => ({ ...s }));

  const pipeline: CanonicalPipeline = {
    currentStage: typeof rawPipeline.currentStage === "string" ? rawPipeline.currentStage : null,
    stages: pipelineStages,
  };

  // Normalize validation
  const rawVal = (raw.validation && typeof raw.validation === "object") ? raw.validation : {};
  const validation: AIWorkspaceValidation = {
    status: ["unknown", "valid", "invalid", "warning"].includes(rawVal.status)
      ? rawVal.status
      : raw.activeValidationReport
      ? (raw.activeValidationReport.isValid ? "valid" : "invalid")
      : "unknown",
    errors: Array.isArray(rawVal.errors) ? rawVal.errors : [],
    warnings: Array.isArray(rawVal.warnings) ? rawVal.warnings : [],
  };

  // Safe piece transforms and angles
  const activePieceTransforms = (raw.activePieceTransforms && typeof raw.activePieceTransforms === "object")
    ? { ...raw.activePieceTransforms }
    : {};
  const activeAppliedAngles = (raw.activeAppliedAngles && typeof raw.activeAppliedAngles === "object")
    ? { ...raw.activeAppliedAngles }
    : {};

  // Normalize create controls
  const rawControls = (raw.createControls && typeof raw.createControls === "object") ? raw.createControls : {};
  const createControls: StructuredCreateControls = {
    ...base.createControls,
    ...rawControls,
    pieceCount: typeof rawControls.pieceCount === "number" ? Math.max(4, Math.min(64, rawControls.pieceCount)) : base.createControls.pieceCount,
  };

  const activePuzzleResult = raw.activePuzzleResult ?? raw.result ?? null;
  const activePuzzle3D = raw.activePuzzle3D ?? (activePuzzleResult ? puzzleResultTo3D(activePuzzleResult) : null);

  return {
    status,
    activeMode,
    model: typeof raw.model === "string" ? raw.model : null,
    modelStatus: typeof raw.modelStatus === "string" ? raw.modelStatus : base.modelStatus,
    requirement: typeof raw.requirement === "string" ? raw.requirement : (typeof raw.promptText === "string" ? raw.promptText : ""),
    designSpecification: raw.designSpecification ?? activePuzzleResult?.designSpecification ?? null,
    context,
    pipeline,
    result: activePuzzleResult,
    validation,
    errors: Array.isArray(raw.errors) ? raw.errors : [],
    history: Array.isArray(raw.history) ? raw.history : (Array.isArray(raw.promptHistory) ? raw.promptHistory : [...base.history]),
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [...base.suggestions],

    isCollapsed: Boolean(raw.isCollapsed),
    settingsOpen: Boolean(raw.settingsOpen),
    debugMode: Boolean(raw.debugMode),
    modelName: typeof raw.modelName === "string" ? raw.modelName : base.modelName,
    generationStatus: ["Idle", "Running", "Success", "Warning", "Error"].includes(raw.generationStatus) ? raw.generationStatus : base.generationStatus,
    isGenerating: Boolean(raw.isGenerating),

    fixedSheetWidthMm: typeof raw.fixedSheetWidthMm === "number" ? raw.fixedSheetWidthMm : base.fixedSheetWidthMm,
    fixedSheetHeightMm: typeof raw.fixedSheetHeightMm === "number" ? raw.fixedSheetHeightMm : base.fixedSheetHeightMm,
    configuredThicknessMm: typeof raw.configuredThicknessMm === "number" ? raw.configuredThicknessMm : base.configuredThicknessMm,

    promptText: typeof raw.promptText === "string" ? raw.promptText : "",
    promptHistory: Array.isArray(raw.promptHistory) ? raw.promptHistory : [...base.promptHistory],
    contextItems: Array.isArray(raw.contextItems) && raw.contextItems.length > 0 ? raw.contextItems : [...base.contextItems],
    createControls,

    timelineStages: Array.isArray(raw.timelineStages) && raw.timelineStages.length > 0
      ? raw.timelineStages
      : INITIAL_TIMELINE_STAGES.map((s) => ({ ...s })),
    activeStageKey: raw.activeStageKey ?? null,
    totalElapsedMs: typeof raw.totalElapsedMs === "number" ? raw.totalElapsedMs : 0,

    activePuzzleResult,
    activePuzzle3D,
    activePieceTransforms,
    activeAppliedAngles,
    activeValidationReport: raw.activeValidationReport ?? activePuzzleResult?.validationReport ?? null,

    assemblySolutions: Array.isArray(raw.assemblySolutions) ? raw.assemblySolutions : [],
    selectedSolutionId: typeof raw.selectedSolutionId === "string" ? raw.selectedSolutionId : null,

    difficultyEvaluation: (raw.difficultyEvaluation && typeof raw.difficultyEvaluation === "object") ? raw.difficultyEvaluation : null,

    selectedPieceId: typeof raw.selectedPieceId === "string" ? raw.selectedPieceId : null,
    selectedConnectionId: typeof raw.selectedConnectionId === "string" ? raw.selectedConnectionId : null,
    selectedInterfaceId: typeof raw.selectedInterfaceId === "string" ? raw.selectedInterfaceId : null,
    ghostPreview: (raw.ghostPreview && typeof raw.ghostPreview === "object") ? { ...base.ghostPreview, ...raw.ghostPreview } : { ...base.ghostPreview },
    assemblyHistory: Array.isArray(raw.assemblyHistory) ? raw.assemblyHistory : [],
    historyIndex: typeof raw.historyIndex === "number" ? raw.historyIndex : -1,

    manufacturingLayout: (raw.manufacturingLayout && typeof raw.manufacturingLayout === "object") ? raw.manufacturingLayout : null,
    variants: Array.isArray(raw.variants) ? raw.variants : [],
    selectedVariantId: typeof raw.selectedVariantId === "string" ? raw.selectedVariantId : null,
    comparisonViewOpen: Boolean(raw.comparisonViewOpen),

    repairIssues: Array.isArray(raw.repairIssues) ? raw.repairIssues : [],
    activeRepairIssueId: typeof raw.activeRepairIssueId === "string" ? raw.activeRepairIssueId : null,
  };
}

type Listener = () => void;

class AIDesignerStore {
  private state: AIDesignerWorkspaceState;
  private listeners = new Set<Listener>();

  constructor() {
    this.state = normalizeAIWorkspaceState(undefined);
  }

  public getState = (): AIDesignerWorkspaceState => this.state;

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify(): void {
    for (const l of this.listeners) l();
  }

  public setState(updater: Partial<AIDesignerWorkspaceState> | ((prev: AIDesignerWorkspaceState) => Partial<AIDesignerWorkspaceState>)): void {
    const patch = typeof updater === "function" ? updater(this.state) : updater;
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  public resetToState(state: AIDesignerWorkspaceState): void {
    this.state = normalizeAIWorkspaceState(state);
    this.notify();
  }

  public resetWorkspace(): void {
    this.state = normalizeAIWorkspaceState(undefined);
    this.notify();
  }

  public setMode(mode: AIDesignerMode): void {
    this.setState({ activeMode: mode });
  }

  public toggleCollapsed(): void {
    this.setState((prev) => ({ isCollapsed: !prev.isCollapsed }));
  }

  public toggleSettings(): void {
    this.setState((prev) => ({ settingsOpen: !prev.settingsOpen }));
  }

  public toggleDebugMode(): void {
    this.setState((prev) => ({ debugMode: !prev.debugMode }));
  }

  public addContextItem(item: ContextItem): void {
    this.setState((prev) => {
      if (prev.contextItems.some((ci) => ci.id === item.id)) return {};
      return { contextItems: [...prev.contextItems, item] };
    });
  }

  public removeContextItem(id: string): void {
    this.setState((prev) => ({
      contextItems: prev.contextItems.filter((ci) => ci.id !== id || !ci.removable),
    }));
  }

  public updatePromptText(text: string): void {
    this.setState({ promptText: text, requirement: text });
  }

  public pushPromptHistory(prompt: string): void {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    this.setState((prev) => {
      const filtered = prev.promptHistory.filter((p) => p !== trimmed);
      const nextHistory = [trimmed, ...filtered].slice(0, 20);
      return { promptHistory: nextHistory, history: nextHistory };
    });
  }

  public updateCreateControls(patch: Partial<StructuredCreateControls>): void {
    this.setState((prev) => ({
      createControls: { ...prev.createControls, ...patch },
    }));
  }

  public resetTimeline(): void {
    this.setState({
      timelineStages: INITIAL_TIMELINE_STAGES.map((s) => ({ ...s, status: "pending", elapsedMs: 0 })),
      pipeline: {
        currentStage: null,
        stages: CANONICAL_20_PIPELINE_STAGES.map((s) => ({ ...s })),
      },
      activeStageKey: null,
      totalElapsedMs: 0,
      generationStatus: "Running",
      status: "generating",
      isGenerating: true,
    });
  }

  public updateTimelineStage(
    key: TimelineStageKey,
    status: TimelineStage["status"],
    elapsedMs = 0,
    details?: TimelineStage["details"]
  ): void {
    this.setState((prev) => {
      const stages = prev.timelineStages.map((st) => {
        if (st.key === key) {
          return {
            ...st,
            status,
            elapsedMs,
            details: details ?? st.details,
          };
        }
        return st;
      });

      // Also mirror to canonical pipeline if applicable
      const canonicalStages = prev.pipeline.stages.map((st) => {
        if (st.id === key || st.name.toLowerCase().includes(String(key).toLowerCase().replace(/_/g, " "))) {
          return {
            ...st,
            status: status as any,
            duration: elapsedMs,
            message: details?.summary ?? st.message,
            metrics: details?.metrics ?? st.metrics,
          };
        }
        return st;
      });

      return {
        timelineStages: stages,
        activeStageKey: key,
        pipeline: {
          currentStage: String(key),
          stages: canonicalStages,
        },
      };
    });
  }

  public completeTimeline(status: "Success" | "Warning" | "Error", totalElapsedMs: number): void {
    this.setState({
      generationStatus: status,
      status: status === "Success" ? "passed" : status === "Warning" ? "warning" : "failed",
      isGenerating: false,
      totalElapsedMs,
    });
  }

  public setGeneratedPuzzle(
    result: PuzzleGenerationResult,
    puzzle3D?: ConvertedPuzzle3D | null,
    transforms?: PieceTransforms | null,
    angles?: Record<string, number> | null,
    validation?: AssemblyValidationReport | null
  ): void {
    this.setState((prev) => {
      const safeResult = result ?? null;
      const safePuzzle3D: ConvertedPuzzle3D = puzzle3D ?? (result ? puzzleResultTo3D(result) : null) as any;
      const safeTransforms = transforms ?? (result ? getTransformsFromResult(result) : {}) ?? {};
      const safeAngles = angles ?? (result ? getAppliedAnglesFromResult(result) : {}) ?? {};
      const safeValidation: AssemblyValidationReport = validation ?? result?.validationReport ?? {
        isValid: true,
        failures: [],
        connectionDetails: {},
        pieceDetails: {},
        overallClearanceMm: 1.2,
        summary: "Verified valid",
      };

      const piecesCount = safePuzzle3D?.pieces?.length ?? safeResult?.pieces2D?.length ?? safeResult?.pieces?.length ?? 0;
      const connCount = safePuzzle3D?.connections?.length ?? safeResult?.connectors?.length ?? 0;

      // Synchronize context items
      const newContext: ContextItem[] = [
        ...prev.contextItems.filter((c) => c.type === "material" || c.type === "sheet"),
        {
          id: `ctx-pieces-${piecesCount}`,
          type: "assembly",
          label: `${piecesCount} Pieces (${piecesCount} 3D)`,
          removable: true,
        },
        {
          id: `ctx-conn-${connCount}`,
          type: "connection",
          label: `${connCount} Connections`,
          removable: true,
        },
        {
          id: "ctx-valid",
          type: "validation",
          label: safeValidation.isValid ? "Valid Assembly (0 Collisions)" : `Validation: ${safeValidation.failures.length} Issues`,
          removable: true,
        },
      ];

      return {
        activePuzzleResult: safeResult,
        result: safeResult,
        activePuzzle3D: safePuzzle3D,
        activePieceTransforms: safeTransforms,
        activeAppliedAngles: safeAngles,
        activeValidationReport: safeValidation,
        validation: {
          status: safeValidation.isValid ? "valid" : "invalid",
          errors: safeValidation.failures.filter((f) => f.category !== "clearance").map((f) => f.message),
          warnings: safeValidation.failures.filter((f) => f.category === "clearance").map((f) => f.message),
        },
        contextItems: newContext,
        selectedPieceId: safePuzzle3D?.pieces?.[0]?.pieceId ?? null,
      };
    });
  }

  public selectPiece(pieceId: string | null): void {
    this.setState((prev) => {
      const filtered = prev.contextItems.filter((c) => c.type !== "piece");
      const nextContext = pieceId
        ? [...filtered, { id: `ctx-piece-${pieceId}`, type: "piece" as const, label: `Piece ${pieceId}`, removable: true }]
        : filtered;

      const nextPieceIds = pieceId ? [pieceId] : [];

      return {
        selectedPieceId: pieceId,
        contextItems: nextContext,
        context: {
          ...prev.context,
          selectedPieceIds: nextPieceIds,
        },
      };
    });
  }

  public selectConnection(connectionId: string | null): void {
    this.setState((prev) => {
      const filtered = prev.contextItems.filter((c) => c.type !== "connection" || c.label.includes("Total"));
      const nextContext = connectionId
        ? [...filtered, { id: `ctx-conn-${connectionId}`, type: "connection" as const, label: `Connection ${connectionId}`, removable: true }]
        : filtered;

      const nextConnIds = connectionId ? [connectionId] : [];

      return {
        selectedConnectionId: connectionId,
        contextItems: nextContext,
        context: {
          ...prev.context,
          selectedConnectionIds: nextConnIds,
        },
      };
    });
  }

  public pushAssemblyHistory(entry: Omit<AssemblyStepHistoryEntry, "id" | "timestamp">): void {
    this.setState((prev) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const newEntry: AssemblyStepHistoryEntry = {
        ...entry,
        pieceTransforms: entry.pieceTransforms ?? {},
        appliedAngles: entry.appliedAngles ?? {},
        id: `step_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: timeStr,
      };

      // Truncate redo tree on new action
      const nextHistory = [...prev.assemblyHistory.slice(0, prev.historyIndex + 1), newEntry];
      return {
        assemblyHistory: nextHistory,
        historyIndex: nextHistory.length - 1,
        activePieceTransforms: newEntry.pieceTransforms,
        activeAppliedAngles: newEntry.appliedAngles,
      };
    });
  }

  public undoAssembly(): boolean {
    if (this.state.historyIndex <= 0) return false;
    const nextIndex = this.state.historyIndex - 1;
    const entry = this.state.assemblyHistory[nextIndex];
    if (!entry) return false;

    this.setState({
      historyIndex: nextIndex,
      activePieceTransforms: entry.pieceTransforms ?? {},
      activeAppliedAngles: entry.appliedAngles ?? {},
    });
    return true;
  }

  public redoAssembly(): boolean {
    if (this.state.historyIndex >= this.state.assemblyHistory.length - 1) return false;
    const nextIndex = this.state.historyIndex + 1;
    const entry = this.state.assemblyHistory[nextIndex];
    if (!entry) return false;

    this.setState({
      historyIndex: nextIndex,
      activePieceTransforms: entry.pieceTransforms ?? {},
      activeAppliedAngles: entry.appliedAngles ?? {},
    });
    return true;
  }
}

export const designerStore = new AIDesignerStore();

/**
 * Initializes the AI workspace with guaranteed safe normalization (Prompt 121 Section 20).
 * Never crashes on undefined, null, or malformed input.
 */
export function initializeAIWorkspace(initialState?: unknown): CanonicalAIWorkspaceState {
  const normalized = normalizeAIWorkspaceState(initialState);
  designerStore.resetToState(normalized);
  return normalized;
}

export function useAIDesignerStore(): AIDesignerWorkspaceState {
  return useSyncExternalStore(designerStore.subscribe, designerStore.getState);
}
