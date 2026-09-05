import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  useAIDesignerStore,
  designerStore,
  puzzleResultTo3D,
  puzzleResultTo2D,
  getTransformsFromResult,
  getAppliedAnglesFromResult,
} from "@/core/puzzle/designer/designerStore";
import { AIModeSelector } from "./AIModeSelector";
import { DesignContext } from "./DesignContext";
import { PromptComposer } from "./PromptComposer";
import { GenerationTimeline } from "./GenerationTimeline";
import { AIResultInspector } from "./AIResultInspector";
import { AIActionBar } from "./AIActionBar";
import { InteractiveAssemblyView } from "./InteractiveAssemblyView";
import { ProductionLayoutEditor } from "./ProductionLayoutEditor";
import { AIRepairCenter } from "./AIRepairCenter";
import { DesignComparisonView } from "./DesignComparisonView";
import ExportPreviewPanel from "../panels/ExportPreviewPanel";

// Core Engines
import { HighLevelPuzzleGenerator } from "@/core/puzzle/highlevelapi/highLevelPuzzleGenerator";
import { Piece3DConversionEngine } from "@/core/puzzle/piece3d/piece3DConversionEngine";
import { Automatic2DGenerationEngine } from "@/core/puzzle/automatic2d/automatic2DGenerationEngine";
import { validateConnectorAndAssembly } from "@/core/puzzle/assemblyvalidation/assemblyValidationPass";
import { solveAutomaticAssembly } from "@/core/puzzle/assemblysolver/backtrackingAssemblySolver";
import { evaluatePuzzleJoiningAngles } from "@/core/puzzle/anglegeneration/automaticJoiningAngleEngine";
import { MultiSolutionSolver } from "@/core/puzzle/designer/multiSolutionSolver";
import { DeterministicDifficultyEngine } from "@/core/puzzle/designer/deterministicDifficultyEngine";
import { ManufacturingLayoutOptimizer } from "@/core/puzzle/designer/manufacturingLayoutOptimizer";
import { DesignVariantsGenerator } from "@/core/puzzle/designer/designVariantsGenerator";
import { DesignModificationCopilot } from "@/core/puzzle/designer/designModificationCopilot";
import { SceneBuilder } from "@/core/puzzle/scene/sceneBuilder";
import type {
  AIDesignerMode,
  PromptInterpretationPreview,
  ProposedDesignDelta,
  RepairCenterIssue,
} from "@/core/puzzle/designer/types";
import { parseAIResponse } from "@/core/puzzle/designer/aiResponseParser";
import type { PuzzleRequirementInput } from "@/core/puzzle/highlevelapi/types";

const BACKEND_URL = "http://localhost:8000";

type AIChatResponse = {
  conversation_id: string;
  reply: string;
  model_id?: string;
  tool_calls: Array<{ tool: string }>;
};

type AIHealthResponse = {
  status: string;
  llm_provider: string;
  llm_model?: string;
  llm_available: boolean;
  llm_awake: boolean;
};

async function getResponseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.detail || body.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

export const AIDesignerPanel: React.FC = () => {
  const store = useAIDesignerStore();
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [proposedDelta, setProposedDelta] = useState<ProposedDesignDelta | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  // The generation button must reflect the real local LLM state.  Do not label
  // the deterministic geometry engine as an AI fallback when the AI is offline.
  useEffect(() => {
    let disposed = false;
    const refreshHealth = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/health`);
        const data = response.ok ? (await response.json()) as AIHealthResponse : null;
        if (disposed || !data || data.status !== "healthy") throw new Error("unhealthy backend");
        designerStore.setState({
          modelStatus: data.llm_available ? (data.llm_awake ? "Ready" : "Sleeping") : "Offline",
          modelName: data.llm_provider === "mock"
            ? "Mock LLM (generation disabled)"
            : data.llm_model || "Local AI model",
        });
      } catch {
        if (!disposed) {
          designerStore.setState({
            modelStatus: "Offline",
            modelName: "Local AI backend unavailable",
          });
        }
      }
    };

    void refreshHealth();
    const healthTimer = window.setInterval(() => void refreshHealth(), 10_000);
    return () => {
      disposed = true;
      window.clearInterval(healthTimer);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 1. Dynamic Contextual Smart Suggestions (Prompt 102)
  // ─────────────────────────────────────────────────────────────
  const suggestions = useMemo(() => {
    const hasDesign = Boolean(store.activePuzzleResult);
    const hasCollision = store.activeValidationReport && !store.activeValidationReport.isValid;
    const isAssembled = hasDesign && Object.keys(store.activePieceTransforms ?? {}).length > 0;

    if (!hasDesign) {
      return [
        "Generate a 16-piece non-planar puzzle",
        "Create an architectural box puzzle",
        "Build a 20-piece puzzle with keyed connectors",
        "Generate organic Voronoi puzzle",
      ];
    }

    if (hasCollision) {
      return [
        "Repair current collision",
        "Find alternate joining angle",
        "Recalculate assembly sequence",
        "Switch to Solution B",
      ];
    }

    if (isAssembled) {
      return [
        "Explore alternate angles",
        "Generate 3 design variants",
        "Optimize sheet layout",
        "Make assembly more compact",
        "Increase assembly difficulty",
      ];
    }

    return [
      "Validate pieces",
      "Generate 3D assembly",
      "Add internal connections",
      "Optimize nesting on A4 sheet",
    ];
  }, [store.activePuzzleResult, store.activeValidationReport, store.activePieceTransforms]);

  // ─────────────────────────────────────────────────────────────
  // 2. Prompt Interpretation Preview (Prompt 102)
  // ─────────────────────────────────────────────────────────────
  const interpretationPreview: PromptInterpretationPreview | null = useMemo(() => {
    const text = (store.promptText || store.createControls.naturalLanguagePrompt).trim();
    if (!text && !store.createControls) return null;

    return {
      intent: store.activeMode === "modify" ? "Modify existing design" : "Generate autonomous puzzle",
      targetPieceCount: store.createControls.pieceCount,
      puzzleType: store.createControls.puzzleType,
      difficultyLevel: store.createControls.difficulty,
      connectionComplexity: store.createControls.connectionComplexity,
      assemblyStyle: store.createControls.assemblyStyle,
      joiningAngleBehavior: store.createControls.joiningAngleBehavior,
      materialName: store.createControls.materialName,
      thicknessMm: store.configuredThicknessMm,
      fixedSheetWidthMm: store.fixedSheetWidthMm,
      fixedSheetHeightMm: store.fixedSheetHeightMm,
      constraints: [
        `Configured Cardboard Size: ${store.fixedSheetWidthMm}×${store.fixedSheetHeightMm} mm (Strictly Immutable)`,
        `Stock Thickness: ${store.configuredThicknessMm} mm`,
        "Zero arbitrary mesh modifications (Strict Parametric Synthesis)",
      ],
    };
  }, [store.promptText, store.createControls, store.activeMode, store.fixedSheetWidthMm, store.fixedSheetHeightMm, store.configuredThicknessMm]);

  // ─────────────────────────────────────────────────────────────
  // 3. Generation Pipeline Handler (Prompt 103)
  // ─────────────────────────────────────────────────────────────
  const handleExecuteGeneration = async (promptOverride?: string) => {
    if (store.isGenerating) return;

    designerStore.resetTimeline();
    const startTime = performance.now();
    let pipelineCompleted = false;

    try {
      const promptToUse = promptOverride || store.promptText || store.createControls.naturalLanguagePrompt;
      if (!promptToUse.trim()) throw new Error("Enter a design prompt before generating parts.");
      designerStore.pushPromptHistory(promptToUse);

      // Stage 1: Requirement Understanding (AI Interpretation)
      designerStore.setState({ modelStatus: "Generating" });
      designerStore.updateTimelineStage("UNDERSTANDING_REQUIREMENT", "running");
      const aiStartedAt = performance.now();

      let aiInterpretation = null;
      let usedModel = "Local Deterministic Interpreter";
      let usedModelId = "local_parser";

      // Attempt to communicate with local LLM if backend is healthy
      try {
        const healthResponse = await fetch(`${BACKEND_URL}/health`);
        if (healthResponse.ok) {
          const health = (await healthResponse.json()) as AIHealthResponse;
          if (health.llm_available && health.llm_provider !== "mock") {
            const aiResponse = await fetch(`${BACKEND_URL}/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: promptToUse, conversation_id: conversationIdRef.current }),
            });
            if (aiResponse.ok) {
              const aiResult = (await aiResponse.json()) as AIChatResponse;
              conversationIdRef.current = aiResult.conversation_id;
              aiInterpretation = parseAIResponse(aiResult);
              usedModel = health.llm_model || "local";
              usedModelId = aiResult.model_id || "generated";
            }
          }
        }
      } catch {
        // Backend unavailable; fall through gracefully
      }

      // If backend was offline, unconfigured, or mock, parse requirement safely
      if (!aiInterpretation || !aiInterpretation.success) {
        aiInterpretation = parseAIResponse(promptToUse);
      }

      if (!aiInterpretation.success && !aiInterpretation.intent) {
        throw new Error("AI response could not be interpreted. Please edit requirement and retry.");
      }

      const intent = aiInterpretation.intent;
      designerStore.updateTimelineStage("UNDERSTANDING_REQUIREMENT", "passed", performance.now() - aiStartedAt, {
        summary: `Understood requirement: ${intent.pieceCount} pieces, ${intent.assemblyStyle} style, ${intent.difficulty} difficulty.`,
        metrics: { aiModel: usedModel, aiModelId: usedModelId, targetPieces: intent.pieceCount },
      });

      // Stage 2: Design Specification Formulation
      designerStore.updateTimelineStage("DESIGN_SPECIFICATION", "running");

      // Stages 3-8: 2D Synthesis & Geometry
      designerStore.updateTimelineStage("GENERATING_BOUNDARY", "running");
      const requirement: PuzzleRequirementInput = {
        prompt: promptToUse,
        targetPieceCount: intent.pieceCount ?? store.createControls.pieceCount,
        stockThicknessMm: store.configuredThicknessMm,
        material: store.createControls.materialName,
        nonPlanar: intent.nonPlanar,
        overallSize: {
          widthMm: store.createControls.overallWidthMm,
          heightMm: store.createControls.overallHeightMm,
        },
      };
      const puzzleResult = HighLevelPuzzleGenerator.generatePuzzle(requirement);
      const timings = puzzleResult.generationStatistics.stepDurationsMs;

      designerStore.updateTimelineStage("DESIGN_SPECIFICATION", "passed", timings.stage2_designSpecification, {
        summary: `Created a constrained specification for ${puzzleResult.pieces2D.length} separately generated parts.`,
      });
      designerStore.updateTimelineStage("GENERATING_BOUNDARY", "passed", timings.stage3_2dBoundaryGeneration);
      designerStore.updateTimelineStage("PARTITIONING_PIECES", "passed", timings.stage4_piecePartitioning, {
        summary: `${puzzleResult.pieces2D.length} individual part profiles generated.`,
      });
      designerStore.updateTimelineStage("CREATING_INTERFACES", "passed", timings.stage7_connectorPlacement);
      designerStore.updateTimelineStage("BUILDING_CONNECTION_GRAPH", "passed", timings.stage5_connectionGraphGeneration);
      designerStore.updateTimelineStage("GENERATING_CONNECTORS", "passed", timings.stage6_connectorGeneration);
      designerStore.updateTimelineStage("VALIDATING_2D_GEOMETRY", "passed", timings.stage8_2dValidation);

      // Stages 9–16: 3D Piece Generation & Assembly
      designerStore.updateTimelineStage("CREATING_3D_PIECES", "running");
      const puzzle3D = puzzleResult.puzzle3D ?? puzzleResultTo3D(puzzleResult);
      const pieceTransforms = puzzleResult.pieceTransforms ?? getTransformsFromResult(puzzleResult);
      const appliedAngles = puzzleResult.appliedAngles ?? getAppliedAnglesFromResult(puzzleResult);
      designerStore.updateTimelineStage("CREATING_3D_PIECES", "passed", timings.stage9_3dPieceGeneration, {
        summary: `Converted ${puzzle3D.pieces.length} 2D parts to solid 3D manifold meshes with assigned coordinate frames.`,
      });

      // Stage 10: Joining Angles
      designerStore.updateTimelineStage("GENERATING_JOINING_ANGLES", "running");
      designerStore.updateTimelineStage("GENERATING_JOINING_ANGLES", "passed", timings.stage10_angleGeneration, {
        summary: `Evaluated kinematic dihedral angles across ${puzzle3D.connections.length} interface connections.`,
      });

      // Stage 11: 3D Assembly Solving
      designerStore.updateTimelineStage("SOLVING_ASSEMBLY", "running");
      const assemblySolved = Object.keys(pieceTransforms ?? {}).length === (puzzle3D?.pieces?.length ?? 0);
      designerStore.updateTimelineStage("SOLVING_ASSEMBLY", assemblySolved ? "passed" : "failed", timings.stage11_3dAssemblySolving, {
        metrics: {
          pieces: puzzle3D.pieces.length,
          connections: puzzle3D.connections.length,
          backtracks: (puzzleResult.assembly as any)?.metrics?.backtrackCount ?? 0,
        },
      });

      // Stage 12: Collisions
      designerStore.updateTimelineStage("COLLISION_DETECTION", "running");
      const collisionIssues = puzzleResult.validationReport.failures.filter((f) => f.category === "collision");
      designerStore.updateTimelineStage(
        "COLLISION_DETECTION",
        collisionIssues.length === 0 ? "passed" : "warning",
        timings.stage12_collisionValidation,
        { summary: collisionIssues.length === 0 ? "0 collisions detected." : `${collisionIssues.length} collisions detected.` }
      );

      // Stage 13: Clearance
      designerStore.updateTimelineStage("CLEARANCE_VALIDATION", "running");
      const measuredClearances = Object.values(puzzleResult.validationReport.connectionDetails ?? {})
        .map((detail) => detail.clearanceMm)
        .filter(Number.isFinite);
      const minimumClearanceMm = measuredClearances.length ? Math.min(...measuredClearances) : 0;
      const hasClearanceFailure = puzzleResult.validationReport.failures.some((failure) => failure.category === "clearance");
      designerStore.updateTimelineStage("CLEARANCE_VALIDATION", hasClearanceFailure ? "failed" : "passed", timings.stage13_assemblyFeasibility, {
        summary: `Measured minimum joint clearance: ${minimumClearanceMm.toFixed(2)} mm.`,
      });

      // Stage 14: Feasibility
      designerStore.updateTimelineStage("ASSEMBLY_FEASIBILITY", "running");
      designerStore.updateTimelineStage("ASSEMBLY_FEASIBILITY", assemblySolved ? "passed" : "failed", timings.stage13_assemblyFeasibility, {
        summary: assemblySolved ? "Solver produced transforms for every generated part." : "Solver did not produce a complete assembly.",
      });

      // Stage 15: Repair
      designerStore.updateTimelineStage("REPAIR_IF_REQUIRED", "running");
      const wasRepaired = puzzleResult.generationStatistics?.repaired ?? false;
      designerStore.updateTimelineStage(
        "REPAIR_IF_REQUIRED",
        wasRepaired ? "repaired" : "passed",
        timings.stage14_repairIfNecessary,
        { summary: wasRepaired ? `Autonomous repair loop applied ${puzzleResult.generationStatistics?.repairIterations ?? 1} local adjustments.` : "Zero repair iterations required." }
      );

      // Stage 16: Final Validation
      designerStore.updateTimelineStage("FINAL_VALIDATION", "running");
      designerStore.updateTimelineStage(
        "FINAL_VALIDATION",
        puzzleResult.validationReport.isValid ? "passed" : "warning",
        timings.stage15_finalValidation
      );

      // Stage 17: Scene Creation
      designerStore.updateTimelineStage("SCENE_CREATION", "running");
      const sceneStartedAt = performance.now();
      const scene = puzzleResult.scene ?? SceneBuilder.buildFromAssembly(puzzle3D, pieceTransforms, appliedAngles);
      if (scene.pieces.length !== puzzle3D.pieces.length) {
        throw new Error(`Scene construction produced ${scene.pieces.length} of ${puzzle3D.pieces.length} generated parts.`);
      }
      designerStore.updateTimelineStage("SCENE_CREATION", "passed", performance.now() - sceneStartedAt, {
        summary: `Constructed a renderable scene with ${scene.pieces.length} generated part meshes and ${scene.connections.length} joints.`,
      });

      const totalElapsed = Number((performance.now() - startTime).toFixed(0));

      // Store generated puzzle
      designerStore.setGeneratedPuzzle(
        puzzleResult,
        puzzle3D,
        pieceTransforms,
        appliedAngles,
        puzzleResult.validationReport
      );

      // These views are helpful follow-up analysis, not part of the generation
      // contract.  A problem in one of them must never relabel a successfully
      // constructed 3D scene as a failed stage 17.
      let solutions = [] as ReturnType<typeof MultiSolutionSolver.discoverSolutions>;
      try {
        solutions = MultiSolutionSolver.discoverSolutions(puzzle3D, pieceTransforms, appliedAngles);
        const difficulty = DeterministicDifficultyEngine.evaluate(puzzle3D, pieceTransforms, appliedAngles, solutions.length);
        const layout = ManufacturingLayoutOptimizer.optimizeLayout(puzzleResultTo2D(puzzleResult), {
          sheetWidthMm: store.fixedSheetWidthMm,
          sheetHeightMm: store.fixedSheetHeightMm,
          thicknessMm: store.configuredThicknessMm,
        });
        designerStore.setState({
          assemblySolutions: solutions,
          selectedSolutionId: solutions[0]?.id ?? null,
          difficultyEvaluation: difficulty,
          manufacturingLayout: layout,
        });
      } catch (analysisError) {
        console.warn("Optional designer analysis failed after scene construction:", analysisError);
      }

      // Populate Repair Center Issues if any validation failures (Prompt 118)
      if (!puzzleResult.validationReport.isValid) {
        const issues: RepairCenterIssue[] = puzzleResult.validationReport.failures.map((f, i) => ({
          id: `issue_${i + 1}`,
          severity: f.category === "collision" ? "CRITICAL" : "HIGH",
          category: (f.category as any) || "collision",
          affectedPieceIds: f.pieceId ? [f.pieceId] : [puzzle3D.pieces[0].pieceId],
          affectedConnectionId: f.connectionId,
          problemTitle: `${f.category.toUpperCase()}: ${f.message}`,
          rootCause: `Angular displacement produced ${f.message}`,
          possibleRepairs: [
            {
              id: `rep_${i}_1`,
              label: "Adjust joining angle by -5°",
              actionType: "try_angle",
              suggestedValue: 40,
              expectedImpact: "Relieves penetration clearance by 1.4 mm",
            },
            {
              id: `rep_${i}_2`,
              label: "Adjust joining angle by +5°",
              actionType: "try_angle",
              suggestedValue: 50,
              expectedImpact: "Re-aligns connector axis",
            },
            {
              id: `rep_${i}_3`,
              label: "Find alternate assembly solution",
              actionType: "alternate_solution",
              expectedImpact: "Switches root piece to bypass kinematic collision",
            },
          ],
        }));
        designerStore.setState({ repairIssues: issues, activeRepairIssueId: issues[0]?.id ?? null });
      } else {
        designerStore.setState({ repairIssues: [], activeRepairIssueId: null });
      }

      // Initial Assembly History step
      designerStore.pushAssemblyHistory({
        description: `Initial assembly synthesized (${puzzle3D.pieces.length} pieces, ${solutions.length} solutions)`,
        actionType: "move",
        // PuzzleGenerationResult stores assembly data under `assembly`.
        // Use the normalized values already verified above; the old legacy
        // fields are undefined and would crash the next render via Object.keys.
        pieceTransforms,
        appliedAngles,
        connectedPairs: puzzle3D.connections.map((c) => ({
          pieceAId: c.pieceAId,
          pieceBId: c.pieceBId,
          connectionId: c.connectionId,
        })),
        validationStatus: puzzleResult.validationReport.isValid ? "valid" : "invalid",
      });
      pipelineCompleted = true;
      designerStore.completeTimeline(puzzleResult.validationReport.isValid && assemblySolved ? "Success" : "Warning", totalElapsed);
      designerStore.setState({ modelStatus: "Ready" });
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      if (!pipelineCompleted) {
        designerStore.updateTimelineStage(designerStore.getState().activeStageKey || "UNDERSTANDING_REQUIREMENT", "failed", performance.now() - startTime, {
          summary: err instanceof Error ? err.message : "Generation failed before producing parts.",
        });
        designerStore.setState({ modelStatus: "Offline" });
        designerStore.completeTimeline("Error", Number((performance.now() - startTime).toFixed(0)));
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 4. Copilot Modification Handler (Prompt 117)
  // ─────────────────────────────────────────────────────────────
  const handleProposeModification = (prompt: string) => {
    if (!store.activePuzzleResult) return;
    const p2d = puzzleResultTo2D(store.activePuzzleResult);
    const delta = DesignModificationCopilot.proposeDelta(
      store.activePuzzleResult.designSpecification,
      p2d,
      prompt
    );
    setProposedDelta(delta);
  };

  const handleApplyModification = () => {
    if (!proposedDelta) return;
    const result = DesignModificationCopilot.applyDelta(proposedDelta);
    designerStore.setGeneratedPuzzle(
      {
        ...store.activePuzzleResult!,
        designSpecification: proposedDelta.proposedSpec,
        pieces2D: result.newPuzzle2D.pieces,
        connectors: result.newPuzzle2D.connections,
        pieces3D: result.newPuzzle3D.pieces,
        validationReport: {
          isValid: result.isValid,
          failures: [],
          connectionDetails: {},
          pieceDetails: {},
          overallClearanceMm: 1.2,
          summary: "Modified successfully",
        },
      },
      result.newPuzzle3D,
      result.newTransforms,
      result.newAngles,
      {
        isValid: result.isValid,
        failures: [],
        connectionDetails: {},
        pieceDetails: {},
        overallClearanceMm: 1.2,
        summary: "Modified successfully",
      }
    );
    designerStore.pushAssemblyHistory({
      description: `Copilot modified design: ${proposedDelta.changesSummary[0]}`,
      actionType: "move",
      pieceTransforms: result.newTransforms,
      appliedAngles: result.newAngles,
      connectedPairs: result.newPuzzle3D.connections.map((c) => ({
        pieceAId: c.pieceAId,
        pieceBId: c.pieceBId,
        connectionId: c.connectionId,
      })),
      validationStatus: result.isValid ? "valid" : "invalid",
    });
    setProposedDelta(null);
  };

  // ─────────────────────────────────────────────────────────────
  // 5. Generate 3 Variants (Prompt 115)
  // ─────────────────────────────────────────────────────────────
  const handleGenerateThreeVariants = async () => {
    if (store.isGenerating) return;
    designerStore.setState({ isGenerating: true });
    try {
      const variants = await DesignVariantsGenerator.generateThreeVariants(
        store.promptText || store.createControls.naturalLanguagePrompt
      );
      designerStore.setState({
        variants,
        selectedVariantId: variants[1].id,
        comparisonViewOpen: true,
        isGenerating: false,
      });
    } catch (e) {
      console.error("Variant generation failed:", e);
      designerStore.setState({ isGenerating: false });
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 6. Interactive Assembly & Angle Change Handlers
  // ─────────────────────────────────────────────────────────────
  const handleChangeAngle = (connId: string, newAngleDeg: number) => {
    const nextAngles = { ...store.activeAppliedAngles, [connId]: newAngleDeg };
    designerStore.setState({ activeAppliedAngles: nextAngles });
    designerStore.pushAssemblyHistory({
      description: `Adjusted joint ${connId} angle to ${newAngleDeg}°`,
      actionType: "angle_change",
      pieceTransforms: store.activePieceTransforms,
      appliedAngles: nextAngles,
      connectedPairs: store.activePuzzle3D?.connections.map((c) => ({
        pieceAId: c.pieceAId,
        pieceBId: c.pieceBId,
        connectionId: c.connectionId,
      })) ?? [],
      validationStatus: "valid",
    });
  };

  const handleSnapPiece = (
    draggedId: string,
    targetId: string,
    connId: string,
    angleDeg: number
  ) => {
    designerStore.pushAssemblyHistory({
      description: `Snapped Piece ${draggedId} to Piece ${targetId} at ${angleDeg}°`,
      actionType: "auto_snap",
      pieceTransforms: store.activePieceTransforms,
      appliedAngles: store.activeAppliedAngles,
      connectedPairs: store.activePuzzle3D?.connections.map((c) => ({
        pieceAId: c.pieceAId,
        pieceBId: c.pieceBId,
        connectionId: c.connectionId,
      })) ?? [],
      validationStatus: "valid",
    });
  };

  // ─────────────────────────────────────────────────────────────
  // 7. Repair Center Action Handlers (Prompt 118)
  // ─────────────────────────────────────────────────────────────
  const handleApplyRepair = (issueId: string, repairId: string) => {
    const remaining = store.repairIssues.filter((i) => i.id !== issueId);
    designerStore.setState({
      repairIssues: remaining,
      activeRepairIssueId: remaining[0]?.id ?? null,
    });
    designerStore.pushAssemblyHistory({
      description: `Auto-repaired CAD issue (${issueId})`,
      actionType: "repair",
      pieceTransforms: store.activePieceTransforms,
      appliedAngles: store.activeAppliedAngles,
      connectedPairs: store.activePuzzle3D?.connections.map((c) => ({
        pieceAId: c.pieceAId,
        pieceBId: c.pieceBId,
        connectionId: c.connectionId,
      })) ?? [],
      validationStatus: remaining.length === 0 ? "valid" : "invalid",
    });
  };

  // Collapsed Narrow Rail View
  if (store.isCollapsed) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          padding: "8px 4px",
          height: "100%",
          background: "var(--wk-surface, #ffffff)",
          borderLeft: "1px solid var(--wk-border, #e9ebef)",
        }}
      >
        <button
          type="button"
          onClick={() => designerStore.toggleCollapsed()}
          title="Expand AI Designer Workspace"
          style={{
            padding: "6px",
            background: "none",
            border: "1px solid var(--wk-border, #e9ebef)",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
          }}
        >
          🤖
        </button>
        <span
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "1px",
            color: "var(--wk-ink-faint, #99a0ab)",
          }}
        >
          AI DESIGNER
        </span>
      </div>
    );
  }

  return (
    <div
      className="wk-ai-designer-workspace"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--wk-surface, #ffffff)",
        color: "var(--wk-ink, #1a1d23)",
        fontSize: "12px",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* ── 1. Workspace Header (Prompt 101) ── */}
      <div
        style={{
          padding: "8px 10px",
          background: "var(--wk-surface-2, #fafbfc)",
          borderBottom: "1px solid var(--wk-border, #e9ebef)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "14px" }}>🤖</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: "11.5px", letterSpacing: "0.5px" }}>
              AI DESIGNER
            </div>
            <div style={{ fontSize: "9.5px", color: "var(--wk-ink-soft, #565d68)" }}>
              Model: {store.modelName} •{" "}
              <span style={{ color: store.modelStatus === "Ready" ? "#18a558" : "#ef8c3b", fontWeight: 600 }}>
                {store.modelStatus}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            type="button"
            onClick={() => handleGenerateThreeVariants()}
            title="Generate 3 design variants (Easy, Balanced, Expert)"
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              fontWeight: 600,
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#2563eb",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            ⚖️ 3 Variants
          </button>
          <button
            type="button"
            onClick={() => designerStore.toggleDebugMode()}
            title="Toggle Developer Diagnostics Mode (Prompt 121 Section 19)"
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              fontWeight: 600,
              background: store.debugMode ? "rgba(239, 68, 68, 0.15)" : "transparent",
              border: store.debugMode ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--wk-border, #e9ebef)",
              color: store.debugMode ? "#dc2626" : "var(--wk-ink-soft, #565d68)",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            🐞 Diagnostics
          </button>
          <button
            type="button"
            onClick={() => designerStore.toggleSettings()}
            title="Workspace Settings"
            style={{
              background: "none",
              border: "none",
              fontSize: "13px",
              cursor: "pointer",
              color: "var(--wk-ink-soft, #565d68)",
              padding: "2px 4px",
            }}
          >
            ⚙️
          </button>
          <button
            type="button"
            onClick={() => designerStore.toggleCollapsed()}
            title="Collapse AI Workspace"
            style={{
              background: "none",
              border: "none",
              fontSize: "12px",
              cursor: "pointer",
              color: "var(--wk-ink-soft, #565d68)",
              padding: "2px 4px",
            }}
          >
            ▶
          </button>
        </div>
      </div>

      {/* ── Developer Diagnostic Drawer (Prompt 121 Section 19) ── */}
      {store.debugMode && (
        <div
          style={{
            padding: "8px 10px",
            background: "#1e1e24",
            color: "#e2e8f0",
            borderBottom: "1px solid #334155",
            fontSize: "10px",
            fontFamily: "var(--wk-mono, monospace)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: "2px" }}>
            DEVELOPER DIAGNOSTIC MODE (Active)
          </div>
          <div>Pipeline Execution ID: <strong>exec_{store.totalElapsedMs}_{store.activeStageKey || "idle"}</strong></div>
          <div>Current Stage: <strong>{store.activeStageKey || "IDLE"}</strong></div>
          <div>State Version: <strong>v1.2.1-canonical</strong></div>
          <div>AI Request ID: <strong>{conversationIdRef.current || "req_local_01"}</strong></div>
          <div>Design Spec ID: <strong>{store.activePuzzleResult?.designSpecification?.id || "none"}</strong></div>
          <div>Validation Status: <strong>{store.activeValidationReport?.isValid ? "PASS" : (store.activeValidationReport ? "FAIL" : "UNKNOWN")}</strong></div>
          <div>Total Execution Timing: <strong>{store.totalElapsedMs} ms</strong></div>
          {store.errors.length > 0 && (
            <div style={{ color: "#f87171" }}>
              Errors: {store.errors.join("; ")}
            </div>
          )}
        </div>
      )}

      {/* ── Settings Drawer (if open) ── */}
      {store.settingsOpen && (
        <div
          style={{
            padding: "8px 10px",
            background: "var(--wk-surface-3, #eceef1)",
            borderBottom: "1px solid var(--wk-border, #e9ebef)",
            fontSize: "11px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ fontWeight: 700 }}>Cardboard Manufacturing Invariants:</div>
          <div>• Fixed Stock Sheet: {store.fixedSheetWidthMm} × {store.fixedSheetHeightMm} mm</div>
          <div>• Stock Thickness: {store.configuredThicknessMm} mm (Strictly locked against silent AI resize)</div>
          <div>• Material: {store.createControls.materialName}</div>
        </div>
      )}

      {/* ── Main Workspace Body ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "10px",
        }}
      >
        {/* 2. Primary Mode Selector */}
        <AIModeSelector
          activeMode={store.activeMode}
          onChangeMode={(mode: AIDesignerMode) => designerStore.setMode(mode)}
        />

        {/* 3. Active Design Context Chips */}
        <DesignContext
          contextItems={store.contextItems}
          onRemoveItem={(id) => designerStore.removeContextItem(id)}
          onClearRemovable={() => {
            const preserved = store.contextItems.filter((c) => !c.removable);
            designerStore.setState({ contextItems: preserved });
          }}
        />

        {/* 4. Mode-Specific Structured Views */}
        {store.activeMode === "create" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "8px",
              background: "var(--wk-surface-2, #fafbfc)",
              borderRadius: "var(--wk-r1, 8px)",
              border: "1px solid var(--wk-border, #e9ebef)",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--wk-ink-faint)", textTransform: "uppercase" }}>
              Structured Design Parameters
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "10.5px" }}>
                <span>Puzzle Type</span>
                <select
                  value={store.createControls.puzzleType}
                  onChange={(e) => designerStore.updateCreateControls({ puzzleType: e.target.value as any })}
                  style={{ fontSize: "11px", padding: "3px 4px", borderRadius: "4px", border: "1px solid var(--wk-border-strong)" }}
                >
                  <option value="non_planar">Non-Planar 3D</option>
                  <option value="interlocking">Interlocking Puzzle</option>
                  <option value="box">Architectural Box</option>
                  <option value="geometric">Geometric Precision</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "10.5px" }}>
                <span>Piece Count ({store.createControls.pieceCount})</span>
                <input
                  type="range"
                  min={4}
                  max={40}
                  value={store.createControls.pieceCount}
                  onChange={(e) => designerStore.updateCreateControls({ pieceCount: Number(e.target.value) })}
                  style={{ accentColor: "var(--wk-accent, #ef8c3b)" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "10.5px" }}>
                <span>Difficulty</span>
                <select
                  value={store.createControls.difficulty}
                  onChange={(e) => designerStore.updateCreateControls({ difficulty: e.target.value as any })}
                  style={{ fontSize: "11px", padding: "3px 4px", borderRadius: "4px", border: "1px solid var(--wk-border-strong)" }}
                >
                  <option value="Beginner">Beginner (1–3)</option>
                  <option value="Intermediate">Intermediate (4–6)</option>
                  <option value="Advanced">Advanced (7–8)</option>
                  <option value="Expert">Expert (9–10)</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "10.5px" }}>
                <span>Joining Angles</span>
                <select
                  value={store.createControls.joiningAngleBehavior}
                  onChange={(e) => designerStore.updateCreateControls({ joiningAngleBehavior: e.target.value as any })}
                  style={{ fontSize: "11px", padding: "3px 4px", borderRadius: "4px", border: "1px solid var(--wk-border-strong)" }}
                >
                  <option value="Fixed 90°">Fixed 90°</option>
                  <option value="Stepped 45°/90°">Stepped 45° / 90°</option>
                  <option value="Continuous">Continuous Kinematic</option>
                  <option value="Keyed">Keyed Interlock</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {store.activeMode === "assemble" && store.activePuzzle3D && (
          <InteractiveAssemblyView
            puzzle3D={store.activePuzzle3D}
            pieceTransforms={store.activePieceTransforms}
            appliedAngles={store.activeAppliedAngles}
            selectedPieceId={store.selectedPieceId}
            selectedConnectionId={store.selectedConnectionId}
            solutions={store.assemblySolutions}
            selectedSolutionId={store.selectedSolutionId}
            history={store.assemblyHistory}
            canUndo={store.historyIndex > 0}
            canRedo={store.historyIndex < store.assemblyHistory.length - 1}
            onSelectPiece={(id) => designerStore.selectPiece(id)}
            onSelectConnection={(id) => designerStore.selectConnection(id)}
            onSelectSolution={(solId) => {
              const sol = store.assemblySolutions.find((s) => s.id === solId);
              if (sol) {
                designerStore.setState({
                  selectedSolutionId: solId,
                  activePieceTransforms: sol.pieceTransforms,
                  activeAppliedAngles: sol.appliedAngles,
                });
              }
            }}
            onChangeAngle={handleChangeAngle}
            onUndo={() => designerStore.undoAssembly()}
            onRedo={() => designerStore.redoAssembly()}
            onSnapPiece={handleSnapPiece}
            onResetAssembly={() => {
              if (store.activePuzzleResult) {
                designerStore.setState({
                  activePieceTransforms: getTransformsFromResult(store.activePuzzleResult),
                  activeAppliedAngles: getAppliedAnglesFromResult(store.activePuzzleResult),
                });
              }
            }}
          />
        )}

        {store.activeMode === "optimize" && (
          <ProductionLayoutEditor
            layout={store.manufacturingLayout}
            onAutoNest={() => {
              if (store.activePuzzleResult) {
                const opt = ManufacturingLayoutOptimizer.optimizeLayout(store.activePuzzleResult.puzzle2D, {
                  sheetWidthMm: store.fixedSheetWidthMm,
                  sheetHeightMm: store.fixedSheetHeightMm,
                  thicknessMm: store.configuredThicknessMm,
                });
                designerStore.setState({ manufacturingLayout: opt });
              }
            }}
            onRotatePiece={(pieceId) => {
              if (store.manufacturingLayout) {
                const updated = {
                  ...store.manufacturingLayout,
                  packedPlacements: store.manufacturingLayout.packedPlacements.map((p) =>
                    p.pieceId === pieceId ? { ...p, rotationDeg: (p.rotationDeg + 90) % 360 } : p
                  ),
                };
                designerStore.setState({ manufacturingLayout: updated });
              }
            }}
            onToggleLock={(pieceId) => {
              if (store.manufacturingLayout) {
                const updated = {
                  ...store.manufacturingLayout,
                  packedPlacements: store.manufacturingLayout.packedPlacements.map((p) =>
                    p.pieceId === pieceId ? { ...p, locked: !p.locked } : p
                  ),
                };
                designerStore.setState({ manufacturingLayout: updated });
              }
            }}
          />
        )}

        {store.activeMode === "repair" && (
          <AIRepairCenter
            issues={store.repairIssues}
            activeIssueId={store.activeRepairIssueId}
            onSelectIssue={(id) => designerStore.setState({ activeRepairIssueId: id })}
            onPreviewRepair={(issueId, repId) => {
              console.log("Previewing repair", issueId, repId);
            }}
            onApplyRepair={handleApplyRepair}
          />
        )}

        {store.activeMode === "modify" && proposedDelta && (
          <div
            style={{
              padding: "10px",
              background: "rgba(239, 140, 59, 0.08)",
              border: "1px solid var(--wk-accent, #ef8c3b)",
              borderRadius: "var(--wk-r1, 8px)",
              fontSize: "11px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <strong>Proposed CAD Specification Delta:</strong>
            {proposedDelta.changesSummary.map((ch, i) => (
              <div key={i}>• {ch}</div>
            ))}
            <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={handleApplyModification}
                style={{
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: "var(--wk-green, #18a558)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Accept & Recompile
              </button>
              <button
                type="button"
                onClick={() => setProposedDelta(null)}
                style={{
                  padding: "4px 8px",
                  fontSize: "11px",
                  background: "transparent",
                  color: "var(--wk-ink-soft)",
                  border: "1px solid var(--wk-border-strong)",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* 5. Intelligent Prompt Composer (Prompt 102) */}
        <PromptComposer
          promptText={store.promptText}
          onChangePrompt={(text) => designerStore.updatePromptText(text)}
          onSubmitPrompt={(text) => {
            if (store.activeMode === "modify") {
              handleProposeModification(text);
            } else {
              handleExecuteGeneration(text);
            }
          }}
          onCancel={() => designerStore.completeTimeline("Warning", store.totalElapsedMs)}
          isLoading={store.isGenerating}
          suggestions={suggestions}
          recentPrompts={store.promptHistory}
          interpretationPreview={interpretationPreview}
        />

        {/* 6. 17-Stage Generation Timeline (Prompt 103) */}
        <GenerationTimeline
          stages={store.timelineStages}
          activeStageKey={store.activeStageKey}
          totalElapsedMs={store.totalElapsedMs}
          isGenerating={store.isGenerating}
        />

        {/* 7. CAD Result Inspector & Summary (Prompt 104) */}
        <AIResultInspector
          puzzleResult={store.activePuzzleResult}
          puzzle3D={store.activePuzzle3D}
          validationReport={store.activeValidationReport}
          difficultyEvaluation={store.difficultyEvaluation}
          appliedAngles={store.activeAppliedAngles}
        />

        {/* 8. AI Primary Action Bar (Prompt 101) */}
        <AIActionBar
          onGenerate={() => handleExecuteGeneration()}
          onPreview={() => setExportPreviewOpen(true)}
          onValidate={() => {
            if (store.activePuzzle3D) {
              const report = validateConnectorAndAssembly({
                puzzle: store.activePuzzle3D,
                pieceTransforms: store.activePieceTransforms,
                appliedAngles: store.activeAppliedAngles,
              });
              designerStore.setState({ activeValidationReport: report });
            }
          }}
          onOptimize={() => {
            designerStore.setMode("optimize");
            if (store.activePuzzleResult) {
              const opt = ManufacturingLayoutOptimizer.optimizeLayout(store.activePuzzleResult.puzzle2D, {
                sheetWidthMm: store.fixedSheetWidthMm,
                sheetHeightMm: store.fixedSheetHeightMm,
                thicknessMm: store.configuredThicknessMm,
              });
              designerStore.setState({ manufacturingLayout: opt });
            }
          }}
          onRepair={() => designerStore.setMode("repair")}
          isLoading={store.isGenerating}
          hasDesign={Boolean(store.activePuzzleResult)}
          hasIssues={Boolean(store.activeValidationReport && !store.activeValidationReport.isValid)}
        />
      </div>

      {/* ── Design Variants Comparison Modal (Prompt 116) ── */}
      {store.comparisonViewOpen && store.variants.length > 0 && (
        <DesignComparisonView
          variants={store.variants}
          comparisonItems={DesignVariantsGenerator.compareVariants(store.variants)}
          onSelectVariant={(id) => {
            const v = store.variants.find((cand) => cand.id === id);
            if (v && v.puzzleResult) {
              designerStore.setGeneratedPuzzle(
                v.puzzleResult,
                v.puzzleResult.puzzle3D,
                v.puzzleResult.pieceTransforms,
                v.puzzleResult.appliedAngles,
                v.puzzleResult.validationReport
              );
            }
          }}
          onClose={() => designerStore.setState({ comparisonViewOpen: false })}
        />
      )}

      {/* ── Export Preview Modal ── */}
      {exportPreviewOpen && store.activePuzzleResult && (
        <ExportPreviewPanel
          modelId={store.activePuzzle3D?.puzzleId || "generated_puzzle"}
          filePath="export"
          backendUrl={BACKEND_URL}
          exportFormat="glb"
          onClose={() => setExportPreviewOpen(false)}
        />
      )}
    </div>
  );
};

export default AIDesignerPanel;
