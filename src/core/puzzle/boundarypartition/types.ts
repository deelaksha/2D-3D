/**
 * Automatic Puzzle-Boundary Partitioning Engine Types (Phase 82).
 *
 * Requirements:
 *  - Partition an arbitrary 2D puzzle boundary into pieces whose union exactly matches the boundary.
 *  - Strictly zero unintended gaps or overlaps.
 *  - Support rectangular, polygonal, irregular, and organic partition styles.
 *  - Parametric control (complexity, minimum feature size, jitter, curvature, seed).
 *  - Comprehensive validation: area conservation, containment, connectivity, self-intersection, min feature size.
 *  - No connectors yet.
 */

import type { Vec2 } from "@/core/model/types";

export type PartitionStyle = "rectangular" | "polygonal" | "irregular" | "organic";

export interface BoundaryInput {
  vertices: Vec2[];
  name?: string;
}

export interface PartitionParameters {
  /** Deterministic integer seed for reproducible generation. */
  seed?: number;
  /** Complexity tier or normalized factor (0.0 to 1.0). */
  complexity?: "low" | "medium" | "high" | number;
  /** Minimum allowable edge length or feature width in mm (default: 5.0 mm). */
  minFeatureSizeMm?: number;
  /** Amount of random slant / angle variation (0.0 to 1.0). */
  jitter?: number;
  /** Organic wave modulation amplitude (mm). */
  curvature?: number;
  /** Wave cycles per internal boundary edge for organic style. */
  waveFrequency?: number;
  /** Optional custom tuning parameters. */
  customOptions?: Record<string, any>;
}

export interface PartitionRequest {
  /** Overall global puzzle boundary (closed polygon). */
  boundary: BoundaryInput | Vec2[];
  /** Desired number of partitioned pieces (N >= 2). */
  targetPieceCount: number;
  /** Selected partitioning style (default: "polygonal"). */
  style?: PartitionStyle;
  /** Parametric geometry and complexity settings. */
  parameters?: PartitionParameters;
}

export interface SharedBoundaryEdge {
  neighborId: string;
  start: Vec2;
  end: Vec2;
  lengthMm: number;
}

export interface PartitionedPiece {
  id: string;
  name: string;
  vertices: Vec2[];
  areaMm2: number;
  perimeterMm: number;
  centroid: Vec2;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  isBorderPiece: boolean;
  neighborIds: string[];
  sharedEdges: SharedBoundaryEdge[];
}

export interface PartitionIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  remediation?: string;
  details?: Record<string, any>;
}

export interface PartitionMetrics {
  areaConservationErrorPct: number;
  containmentViolationsCount: number;
  selfIntersectionCount: number;
  minFeatureSizeFoundMm: number;
  minFeatureSizeViolationsCount: number;
  isolatedPieceCount: number;
  overlapDetected: boolean;
  gapDetected: boolean;
}

export interface PartitionDiagnostics {
  isValid: boolean;
  issues: PartitionIssue[];
  metrics: PartitionMetrics;
}

export interface PartitionResult {
  success: boolean;
  pieces: PartitionedPiece[];
  boundary: {
    vertices: Vec2[];
    areaMm2: number;
    perimeterMm: number;
  };
  actualPieceCount: number;
  areaCoverageRatio: number;
  diagnostics: PartitionDiagnostics;
  executionDurationMs: number;
}
