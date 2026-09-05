/**
 * High-Level Autonomous Puzzle Generator API Types (Phase 92).
 *
 * Implements full domain models for:
 *   - Natural language and structured requirement inputs
 *   - 15-stage pipeline orchestrator
 *   - Comprehensive PuzzleGenerationResult
 *   - Stage-by-stage generation statistics
 */

import type { ID, Vec2 } from "@/core/model/types";
import type {
  DesignSpecification2D,
  GeneratedConnection2D,
  GeneratedPiece2D,
} from "../automatic2d/types";
import type { GeneratedPiece3D } from "../piece3d/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";
import type { SuccessfulAssembly } from "../assemblysolver/types";
import type { GeneratedAssembly3D } from "../assembly3d/types";
import type { AssemblyValidationReport } from "../assemblyvalidation/types";
import type { RepairHistory } from "../autonomousrepair/types";
import type { PartitionStyle } from "../boundarypartition/types";
import type { ConnectorType } from "../connectorgeneration/types";

/**
 * Caller requirement input: either a natural language string or structured request object.
 */
export type PuzzleRequirementInput =
  | string
  | {
      prompt?: string;
      pieceCount?: number;
      targetPieceCount?: number;
      thickness?: number;
      stockThicknessMm?: number;
      material?: string;
      nonPlanar?: boolean;
      boundaryShape?: "rectangle" | "circle" | "polygon" | "l_shaped";
      partitionStyle?: PartitionStyle;
      preferredConnectorType?: ConnectorType;
      overallSize?: {
        width?: number;
        height?: number;
        widthMm?: number;
        heightMm?: number;
      };
      seed?: number;
    };

/**
 * Parsed requirement intent ready for design specification synthesis.
 */
export interface ParsedRequirement {
  rawPrompt: string;
  /** Shorthand alias for targetPieceCount. */
  pieceCount: number;
  targetPieceCount: number;
  /** Shorthand alias for stockThicknessMm. */
  thickness: number;
  stockThicknessMm: number;
  /** Shorthand alias for materialId. */
  material: string;
  materialId: string;
  materialName: string;
  nonPlanar: boolean;
  boundaryShape: "rectangle" | "circle" | "polygon" | "l_shaped";
  partitionStyle: PartitionStyle;
  preferredConnectorType: ConnectorType;
  overallSize: {
    widthMm: number;
    heightMm: number;
  };
  gridDimensions: {
    rows: number;
    cols: number;
  };
  seed: number;
}

/**
 * Detailed step timings and metadata across all 15 stages.
 */
export interface GenerationStatistics {
  /** Overall wall-clock pipeline duration in milliseconds. */
  totalDurationMs: number;
  /** Granular duration per stage in milliseconds. */
  stepDurationsMs: {
    stage1_requirementParsing: number;
    stage2_designSpecification: number;
    stage3_2dBoundaryGeneration: number;
    stage4_piecePartitioning: number;
    stage5_connectionGraphGeneration: number;
    stage6_connectorGeneration: number;
    stage7_connectorPlacement: number;
    stage8_2dValidation: number;
    stage9_3dPieceGeneration: number;
    stage10_angleGeneration: number;
    stage11_3dAssemblySolving: number;
    stage12_collisionValidation: number;
    stage13_assemblyFeasibility: number;
    stage14_repairIfNecessary: number;
    stage15_finalValidation: number;
  };
  /** Friendly stage durations mapping without prefixes. */
  stageDurationsMs: {
    requirementParsing: number;
    designSpecification: number;
    boundaryGeneration: number;
    piecePartitioning: number;
    connectionGraphGeneration: number;
    connectorGeneration: number;
    connectorPlacement: number;
    validation2D: number;
    piece3DGeneration: number;
    angleGeneration: number;
    assembly3D: number;
    collisionValidation: number;
    assemblyFeasibility: number;
    repair: number;
    finalValidation: number;
  };
  /** Total count of generated pieces. */
  pieceCount: number;
  /** Total count of physical connections. */
  connectionCount: number;
  /** Whether the repair system was invoked. */
  repaired: boolean;
  /** Count of repair iterations executed. */
  repairIterations: number;
  /** Whether the assembly exhibits non-planar (out-of-plane) 3D geometry. */
  nonPlanar: boolean;
  /** Average interface alignment error in mm. */
  averageAlignmentErrorMm: number;
}

import type { ConvertedPuzzle3D } from "../piece3d/types";
import type { GeneratedPuzzle2D } from "../automatic2d/types";
import type { PieceTransforms } from "../assembly3d/types";
import type { Scene } from "../scene/types";

/**
 * Unified high-level generation result containing all artifacts and reports.
 */
export interface PuzzleGenerationResult {
  /** High-level design specification. */
  designSpecification: DesignSpecification2D;
  /** Generated 2D pieces with embedded connector geometry. */
  pieces2D: GeneratedPiece2D[];
  /** Generated physical connectors with parametric properties. */
  connectors: GeneratedConnection2D[];
  /** Topological connection graph G = (V, E). */
  connectionGraph: PuzzleAssemblyGraph;
  /** Exact 3D converted pieces with local frames and solid representations. */
  pieces3D: GeneratedPiece3D[];
  /** Solved 3D assembly containing transforms, placement sequence, and applied angles. */
  assembly: GeneratedAssembly3D | SuccessfulAssembly;
  /** Complete Phase 90 validation report. */
  validationReport: AssemblyValidationReport;
  /** Chronological Phase 91 repair history. */
  repairHistory: RepairHistory;
  /** Comprehensive generation & execution statistics. */
  generationStatistics: GenerationStatistics;

  /** Overall pipeline success flag. */
  success?: boolean;
  /** Full 2D generated puzzle container. */
  puzzle2D?: GeneratedPuzzle2D;
  /** Full 3D converted puzzle container. */
  puzzle3D?: ConvertedPuzzle3D;
  /** Solved 3D rigid transforms per piece. */
  pieceTransforms?: PieceTransforms;
  /** Solved applied joining angles in degrees per connection. */
  appliedAngles?: Record<string, number>;
  /** Ordered piece assembly sequence. */
  assemblySequence?: string[];
  /** Authoritative 3D scene representation ready for renderer. */
  scene?: Scene;
  /** Alias for validationReport. */
  validation?: AssemblyValidationReport;
  /** Pipeline stages execution summary. */
  pipeline?: any;
  /** Non-fatal warnings produced during generation. */
  warnings?: string[];
  /** Errors encountered during generation. */
  errors?: string[];
  /** Arbitrary execution metrics. */
  metrics?: Record<string, any>;
  /** Alias for pieces2D. */
  pieces?: GeneratedPiece2D[];
  /** Alias for connectors. */
  connections?: GeneratedConnection2D[];
}

/**
 * Canonical GenerationResult alias as required by Prompt 121 Section 16.
 */
export type GenerationResult = PuzzleGenerationResult;
