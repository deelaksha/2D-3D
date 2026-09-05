/**
 * Complete End-to-End Autonomous Generation Demonstration Types (Phase 100).
 *
 * Captures all 23 autonomous generation stages, validation audits,
 * 3D scene/preview representations, live angle inspections, and export packages.
 */

import type { ParsedRequirement, PuzzleGenerationResult } from "../highlevelapi/types";
import type { Scene } from "../scene/types";
import type { Puzzle3DVisualState } from "@/ui/preview3d/types";
import type { ExplicitAssemblySequence } from "../sequencesolver/types";
import type { AssemblyAnimationTimeline } from "../animation/types";
import type { ConnectionAngleInspection } from "../manipulation/types";
import type { PuzzleExportPackage } from "../export/types";

/**
 * Execution log for one of the 23 autonomous stages.
 */
export interface DemonstrationStep {
  stepNumber: number;
  /** Stage name. */
  stepName: string;
  /** Alias for stepName. */
  name: string;
  durationMs: number;
  status: "PASS" | "FAIL";
  details: string;
}

/**
 * Key performance and engineering measurements required by Phase 100.
 */
export interface DemonstrationMeasurements {
  /** Total wall-clock duration of autonomous generation in milliseconds. */
  generationTimeMs: number;
  /** Actual count of generated physical pieces. */
  pieceCount: number;
  /** Actual count of generated physical connections. */
  connectionCount: number;
  /** Number of local/global repair iterations executed (0 if solved on first pass). */
  repairIterations: number;
  /** Number of validation failures in final assembly (must be 0 for valid design). */
  validationFailures: number;
  /** Final multi-domain validity confirmation. */
  finalValidity: boolean;
  /** Whether complete 3D assembly was solved successfully. */
  assemblySuccess: boolean;
  /** Whether assembly exhibits non-planar 3D geometry. */
  nonPlanar: boolean;
  /** Number of supported production export formats. */
  exportFormatCount?: number;
}

/**
 * Master result container returned by Phase 100 Autonomous Demonstration Pipeline.
 */
export interface AutonomousDemonstrationResult {
  /** Overall success flag. */
  success: boolean;
  /** Input requirement prompt. */
  requirement: string;
  /** Alias for requirement. */
  rawPrompt: string;
  /** Parsed requirement intent. */
  parsedRequirement: ParsedRequirement;
  /** Complete authoritative generation result. */
  puzzle: PuzzleGenerationResult;
  /** Alias for puzzle. */
  generationResult: PuzzleGenerationResult;
  /** Renderer-independent 3D scene (Phase 93). */
  scene: Scene;
  /** Preview visual status (Phase 94). */
  previewState: {
    visualState: Puzzle3DVisualState;
    pieceCount: number;
    connectionCount: number;
    cameraState?: any;
  };
  /** Alias for previewState. */
  preview: {
    visualState: Puzzle3DVisualState;
    pieceCount: number;
    connectionCount: number;
    cameraState?: any;
  };
  /** Authoritative assembly sequence. */
  assemblySequence: ExplicitAssemblySequence;
  /** 4-phase physical assembly animation timeline (Phase 97). */
  animationTimeline: AssemblyAnimationTimeline;
  /** Inspected connection angles across all joints (Phase 95). */
  inspectedConnections: ConnectionAngleInspection[];
  /** Alias for inspectedConnections. */
  angleInspections: ConnectionAngleInspection[];
  /** Comprehensive multi-format export package (Phase 99). */
  exportPackage: PuzzleExportPackage;
  /** Explicit measurements required by Phase 100. */
  measurements: DemonstrationMeasurements;
  /** 23-stage audit trail. */
  stepExecutionSummary: DemonstrationStep[];
  /** Alias for stepExecutionSummary. */
  steps: DemonstrationStep[];
}

