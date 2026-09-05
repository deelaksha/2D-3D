/**
 * Automatic 2D Generation System Domain Types (Phase 85).
 *
 * Integrated deterministic pipeline:
 *   Design Specification
 *          ↓
 *   Global Boundary Generator
 *          ↓
 *   Piece Partitioning (Phase 82)
 *          ↓
 *   Connection Graph (Topology G = (V, E))
 *          ↓
 *   Connector Generation (Phase 83)
 *          ↓
 *   Connector Placement (Phase 84)
 *          ↓
 *   Parametric Geometry (Exact Boundary with Tabs & Slots)
 *          ↓
 *   2D Validation
 *
 * Provides a single comprehensive GeneratedPuzzle2D output.
 */

import type { ID, Vec2 } from "@/core/model/types";
import type { PartitionStyle } from "../boundarypartition/types";
import type { ConnectorType, ConnectorParameters } from "../connectorgeneration/types";
import type { CanonicalInterface } from "../canonical/types";
import type { Advanced3DConnection } from "../connection/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";

/**
 * High-level design specification input for automatic 2D puzzle generation.
 */
export interface DesignSpecification2D {
  /** Optional specification identifier. */
  id?: string;
  /** Human-readable name. */
  name?: string;

  /** Overall puzzle dimensions. */
  overallSize: {
    widthMm: number;
    heightMm: number;
  };

  /** Boundary shape type or custom vertices. */
  boundaryShape?: "rectangle" | "circle" | "polygon" | "l_shaped";
  /** Optional custom boundary polygon vertices (if boundaryShape is "polygon"). */
  customBoundaryVertices?: Vec2[];

  /** Target piece count (e.g. 16, 4, 9, etc.). */
  targetPieceCount: number;

  /** Partitioning style (rectangular, polygonal, irregular, organic). Default: "polygonal". */
  partitionStyle?: PartitionStyle;

  /** Material definition. */
  material?: {
    id: string;
    name?: string;
    stockThicknessMm: number;
    kerfMm?: number;
  };
  /** Direct stock thickness in mm (shorthand if material object omitted). */
  thicknessMm?: number;

  /** Preferred connector type (tab_slot, notch, interlock, keyed, hinge, rotational, custom). Default: "tab_slot". */
  preferredConnectorType?: ConnectorType;
  /** Nominal joining angle in degrees (default: 180 for planar). */
  targetJoiningAngleDeg?: number;
  /** Manufacturing clearance override in mm. */
  clearanceOverrideMm?: number;

  /** Connector placement preference: "auto" | "single" | "multiple" | "asymmetric". Default: "auto". */
  placementMode?: "auto" | "single" | "multiple" | "asymmetric";

  /** Complexity or difficulty level. */
  difficulty?: "easy" | "medium" | "hard" | "expert";

  /** Deterministic integer seed for reproducible generation. */
  seed?: number;

  /** Minimum feature size or corner margin in mm. */
  minFeatureSizeMm?: number;
  /** Jitter for irregular cuts (0.0 to 1.0). */
  jitter?: number;
  /** Sinusoidal wave amplitude for organic jigsaw style. */
  curvature?: number;
  /** Wave cycles for organic style. */
  waveFrequency?: number;
}

/**
 * Bounding box and dimensions for 2D pieces.
 */
export interface PieceDimensions2D {
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  areaMm2: number;
  perimeterMm: number;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

/**
 * Represents a single physically connected 2D puzzle piece.
 * Conforms strictly to Phase 85 specifications.
 */
export interface GeneratedPiece2D {
  /** Piece identifier (aliases pieceId). */
  id: string;
  /** Piece identifier. */
  pieceId: string;
  /** Human-readable piece name. */
  name: string;

  /**
   * Exact physical 2D boundary polygon including male tabs and female slots.
   * Closed polygon loop where vertices[0] is connected to vertices[N-1].
   */
  exactBoundary: Vec2[];

  /** Original unmodulated partition boundary before connector embedding. */
  rawBoundary: Vec2[];

  /** Physical dimensions, bounding box, area, and perimeter. */
  dimensions: PieceDimensions2D;

  /** All canonical connection interfaces defined on this piece. */
  interfaces: CanonicalInterface[];

  /** Detailed parameters for all connectors attached to this piece. */
  connectorParameters: ConnectorParameters[];

  /** Material specification. */
  material: {
    id: string;
    name: string;
    stockThicknessMm: number;
    kerfMm: number;
  };

  /** Stock thickness in mm. */
  thickness: number;

  /** Whether this piece touches the outer puzzle boundary. */
  isBorderPiece: boolean;

  /** IDs of all directly connected neighbor pieces. */
  neighborPieceIds: string[];

  /** Piece geometric centroid. */
  centroid: Vec2;
}

/**
 * Represents a single physical connection between two adjacent pieces.
 * Conforms strictly to Phase 85 specifications.
 */
export interface GeneratedConnection2D {
  /** Connection identifier (aliases connectionId). */
  id: string;
  /** Connection identifier. */
  connectionId: string;

  /** ID of Piece A (typically male / insert role). */
  pieceA: string;
  /** ID of Piece B (typically female / receiver role). */
  pieceB: string;

  /** Canonical interface on Piece A. */
  interfaceA: CanonicalInterface;
  /** Canonical interface on Piece B. */
  interfaceB: CanonicalInterface;

  /** Connector type (tab_slot, notch, interlock, keyed, hinge, rotational, custom). */
  connectorType: ConnectorType;

  /** Parametric connector dimensions and offsets. */
  parameters: ConnectorParameters;

  /** Manufacturing clearance in mm. */
  clearance: number;

  /** Allowed joining angle in degrees (or nominal joining angle). */
  allowedAngle: number;

  /** Advanced 3D connection model (for kinematic compatibility). */
  advancedConnection?: Advanced3DConnection;

  /** Parametric placement location details. */
  placementLocation?: {
    parametricOffsetT: number;
    worldPosition: Vec2;
    normal: Vec2;
    tangent: Vec2;
  };
}

/**
 * Structured 2D validation report.
 */
export interface ValidationIssue2D {
  code: string;
  severity: "error" | "warning";
  message: string;
  remediation?: string;
  details?: Record<string, any>;
}

export interface ValidationResult2D {
  isValid: boolean;
  pieceCount: number;
  connectionCount: number;
  graphConnected: boolean;
  areaConservationPct: number;
  issues: ValidationIssue2D[];
  metrics: {
    totalPieceAreaMm2: number;
    globalBoundaryAreaMm2: number;
    minClearanceMm: number;
    maxClearanceMm: number;
    isolatedPieceCount: number;
  };
}

/**
 * Complete, single generated 2D puzzle model.
 * Top-level container output of Phase 85.
 */
export interface GeneratedPuzzle2D {
  /** Unique puzzle identifier. */
  id: string;
  /** Human-readable puzzle name. */
  name: string;

  /** Design specification used to generate this puzzle. */
  specification: DesignSpecification2D;

  /** Global outer puzzle boundary geometry. */
  globalBoundary: {
    vertices: Vec2[];
    areaMm2: number;
    perimeterMm: number;
    bounds: {
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    };
  };

  /** Complete set of physically connected 2D pieces. */
  pieces: GeneratedPiece2D[];

  /** Complete set of complementary connections between pieces. */
  connections: GeneratedConnection2D[];

  /** Topological assembly graph G = (V, E). */
  graph: PuzzleAssemblyGraph;

  /** 2D verification and validation report. */
  validation: ValidationResult2D;

  /** Overall puzzle dimensions. */
  dimensions: {
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
  };

  /** Execution metadata. */
  metadata: {
    generatedAt: string;
    executionDurationMs: number;
    generatorVersion: string;
    seed: number;
  };
}
