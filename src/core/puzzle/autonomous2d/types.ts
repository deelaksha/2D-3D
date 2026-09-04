/**
 * Autonomous 2D Puzzle Generation Subsystem Domain Types.
 *
 * Requirements:
 *  - Automatic piece and connector generation directly from validated ParametricDesignSpecification
 *  - Supports multiple puzzle layouts: grid, radial, organic, custom polygonal
 *  - Geometrically exact and deterministic (no random disconnected pieces)
 *  - Every generated piece belongs to the overall puzzle topology
 *  - Explicit outer boundaries vs internal mating interfaces
 *  - Returns: GeneratedPuzzle2D, GeneratedPiece[], GeneratedInterface[], GeneratedConnectionCandidate[]
 *  - Rigorous 2D validation and structured diagnostics on error
 */

import type { ID, Shape, Vec2 } from "@/core/model/types";
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { ParameterDefinition } from "../piece/types";
import type { InferredConnectionType } from "../ingestion/connections/types";

/**
 * Supported layout topology strategies for autonomous 2D puzzle partitioning.
 */
export type PuzzleLayoutType = "grid" | "radial" | "organic" | "custom_polygonal";

/**
 * 2D Boundary Segment representing an edge of a piece.
 */
export interface BoundarySegment2D {
  id: string;
  pieceId: string;
  start: Vec2;
  end: Vec2;
  lengthMm: number;
  /** True if this segment coincides with the exterior boundary of the overall puzzle. */
  isOuter: boolean;
  /** Index of the edge in the piece's closed boundary loop. */
  edgeIndex: number;
  /** If internal, ID of the adjacent mating piece. */
  neighborPieceId?: string;
  /** If internal, ID of the associated connection interface on this piece. */
  interfaceId?: string;
}

/**
 * Overall 2D Boundary of the entire puzzle.
 */
export interface PuzzleBoundary2D {
  kind: "rectangle" | "circle" | "polygon";
  widthMm: number;
  heightMm: number;
  /** Explicit closed polygon vertices in 2D puzzle space (mm). */
  vertices: Vec2[];
  /** Total surface area in square mm. */
  areaMm2: number;
  /** Perimeter length in mm. */
  perimeterMm: number;
  /** Axis-aligned bounding box. */
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

/**
 * Geometrically exact piece boundary representation.
 */
export interface PieceBoundary2D {
  /** Closed polygon vertices in clockwise or counter-clockwise order. */
  vertices: Vec2[];
  /** Planar surface area (mm^2), strictly > 0. */
  areaMm2: number;
  /** Perimeter length (mm). */
  perimeterMm: number;
  /** Local centroid (mm). */
  centroid: Vec2;
}

/**
 * Autonomous Generated Piece domain model.
 */
export interface GeneratedPiece {
  id: ID;
  name: string;
  /** Piece boundary polygon. */
  boundary: PieceBoundary2D;
  /** Segments that belong to the outer perimeter of the puzzle. */
  outerBoundary: BoundarySegment2D[];
  /** Segments that mate with adjacent internal pieces. */
  internalEdges: BoundarySegment2D[];
  /** Associated 2D shape contour for visualization and 3D extrusion. */
  contour: Shape;
  /** Physical bounding box dimensions in mm. */
  dimensions: {
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
  };
  thicknessMm: number;
  materialId: ID;
  /** Attached connection interfaces for interlocking with neighbors. */
  interfaces: GeneratedInterface[];
  /** Explicit piece parameters. */
  parameters: Record<string, ParameterDefinition>;
  parameterValues: Record<string, number>;
  /** Coordinate frame in 2D assembly layout. */
  localOrigin: Vec2;
  /** Layout metadata (e.g. grid coordinate, radial sector index). */
  layoutMetadata: {
    layoutType: PuzzleLayoutType;
    index: number;
    gridPosition?: { row: number; col: number };
    radialPosition?: { sector: number; ring: number; angleStartDeg: number; angleEndDeg: number };
    customRegionId?: string;
  };
}

/**
 * Autonomous Generated Interface for mating pieces.
 */
export interface GeneratedInterface {
  id: ID;
  pieceId: ID;
  neighborPieceId: ID;
  name: string;
  edgeIndex: number;
  /** Local and global 2D positions of the interface center (mm). */
  position: Vec2;
  /** Outward normal vector from the piece edge (unit length). */
  normal: Vec2;
  /** Tangent vector along the edge (unit length). */
  tangent: Vec2;
  /** Interface role: male insert or female receiver. */
  role: "insert" | "receiver";
  /** Joint pattern design: tab_slot, finger, dovetail, or interlock. */
  pattern: "tab_slot" | "finger" | "dovetail" | "interlock";
  /** Geometric feature width along the edge (mm). */
  widthMm: number;
  /** Geometric feature depth/projection (mm). */
  depthMm: number;
  /** Recommended clearance tolerance (mm). */
  toleranceMm: number;
  /** Complementary mating interface ID on neighbor piece. */
  matingInterfaceId?: ID;
}

/**
 * Autonomous Generated Connection Candidate.
 */
export interface GeneratedConnectionCandidate {
  candidateId: string;
  interfaceAId: string;
  interfaceBId: string;
  pieceAId: string;
  pieceBId: string;
  compatible: boolean;
  connectionType: InferredConnectionType;
  profileCompatibility: {
    widthDeltaMm: number;
    depthDeltaMm: number;
    fitQuality: "exact" | "tight" | "loose" | "incompatible";
  };
  matingGeometry: {
    contactCenter: Vec2;
    contactNormal: Vec2;
  };
  requiredClearanceMm: number;
  confidence: number;
  reason: string;
}

/**
 * The primary result model of the Autonomous 2D Puzzle Generator.
 */
export interface GeneratedPuzzle2D {
  puzzleId: string;
  specificationId: string;
  layoutType: PuzzleLayoutType;
  boundary: PuzzleBoundary2D;
  pieceCount: number;
  pieces: GeneratedPiece[];
  interfaces: GeneratedInterface[];
  connectionCandidates: GeneratedConnectionCandidate[];
  outerBoundarySegments: BoundarySegment2D[];
  internalInterfaceCount: number;
  dimensions: {
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
  };
  metadata: {
    difficulty: string;
    materialId: string;
    generatedAt: string;
    deterministicSeed: number;
    generatorVersion: string;
  };
}

/**
 * Options to guide autonomous generation.
 */
export interface Autonomous2DGenerationOptions {
  /** Override layout strategy (default: inferred from spec symmetry/constraints or grid). */
  layoutType?: PuzzleLayoutType;
  /** Deterministic integer seed for reproducible generation. */
  seed?: number;
  /** Preferred joint feature pattern. */
  jointPattern?: "tab_slot" | "finger" | "dovetail" | "interlock";
  /** Override clearance tolerance (mm). */
  clearanceMm?: number;
  /** Minimum feature bridge size (mm). */
  minBridgeMm?: number;
}

/**
 * Structured diagnostic item returned when generation fails or issues are found.
 */
export interface Autonomous2DDiagnostic {
  code: string;
  stage:
    | "specification_validation"
    | "boundary_generation"
    | "piece_partitioning"
    | "interface_generation"
    | "connector_synthesis"
    | "validation_2d";
  severity: "error" | "warning";
  message: string;
  remediation: string;
  details?: Record<string, any>;
}

/**
 * 2D Validation Check Report.
 */
export interface Autonomous2DValidationReport {
  isValid: boolean;
  checks: {
    boundaryValid: boolean;
    pieceCountMatches: boolean;
    allPiecesClosedAndPositiveArea: boolean;
    noSelfIntersections: boolean;
    topologyConnected: boolean;
    noOrphanPieces: boolean;
    allInterfacesPaired: boolean;
    normalsOpposed: boolean;
    outerBoundaryCoversPerimeter: boolean;
    physicalTolerancesValid: boolean;
  };
  errors: string[];
  warnings: string[];
  diagnostics: Autonomous2DDiagnostic[];
}

/**
 * Complete Generation Subsystem Result.
 */
export interface Autonomous2DGenerationResult {
  success: boolean;
  puzzle?: GeneratedPuzzle2D;
  validationReport: Autonomous2DValidationReport;
  diagnostics: Autonomous2DDiagnostic[];
  executionDurationMs: number;
}
