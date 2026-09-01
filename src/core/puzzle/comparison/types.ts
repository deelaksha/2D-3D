/**
 * Ground-Truth Comparison Subsystem Types (Step 36).
 */
import type { Vec3 } from "@/core/model/types";
import type { ComparisonDiagnostics } from "./diagnostics";

export type ComparisonMode = "exact" | "tolerance" | "topological";

export interface ComparisonTolerances {
  linearToleranceMm: number;        // e.g. 0.5 mm
  angularToleranceDeg: number;      // e.g. 1.0 deg
  profileToleranceMm: number;      // e.g. 0.2 mm
  allowPieceOrderMismatch: boolean; // default true
}

export type DiffCategory = "geometry" | "topology" | "assembly";

export interface StructuredDiffItem {
  id: string;
  propertyName: string;
  category: DiffCategory;
  expected: number | string;
  generated: number | string;
  difference: number;
  unit: string;
  withinTolerance: boolean;
  toleranceUsed: number;
  location?: Vec3;
  reasoning?: string;
}

export interface GeometryComparisonResult {
  hasMismatch: boolean;
  boundaryOverlapRatio: number; // 0.0 to 1.0
  dimensionDeltaMaxMm: number;
  interfaceLocationMaxDeltaMm: number;
  profileDeltaMaxMm: number;
  diffItems: StructuredDiffItem[];
}

export interface TopologyComparisonResult {
  hasMismatch: boolean;
  expectedPieceCount: number;
  generatedPieceCount: number;
  expectedConnectionCount: number;
  generatedConnectionCount: number;
  topologicalPrecision: number;
  topologicalRecall: number;
  overallF1Score: number;
  diffItems: StructuredDiffItem[];
}

export interface AssemblyComparisonResult {
  hasMismatch: boolean;
  hausdorffDistanceMm: number;
  chamferDistanceMm: number;
  maxCentroidOffsetMm: number;
  maxRotationDeltaDeg: number;
  diffItems: StructuredDiffItem[];
}

export interface ComparisonReport {
  referenceDesignId: string;
  generatedDesignId: string;
  mode: ComparisonMode;
  isMatched: boolean;
  totalPropertiesCompared: number;
  mismatchesOutsideTolerance: number;
  geometry: GeometryComparisonResult;
  topology: TopologyComparisonResult;
  assembly: AssemblyComparisonResult;
  diffItems: StructuredDiffItem[];
  diagnostics: ComparisonDiagnostics;
  durationMs: number;
}
