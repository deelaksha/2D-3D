/**
 * Material/Cardboard Constraint Subsystem Domain Types.
 *
 * Distinctly separates four parameter levels:
 * 1. GLOBAL MATERIAL PARAMETERS
 * 2. DESIGN PARAMETERS
 * 3. PIECE PARAMETERS
 * 4. ASSEMBLY PARAMETERS
 */
import type { ID } from "@/core/model/types";

export interface GlobalMaterialParameters {
  /** Stock sheet width (mm). */
  stockWidth: number;
  /** Stock sheet height (mm). */
  stockHeight: number;
  /** Stock cardboard thickness (mm). */
  stockThickness: number;
  /** Mechanical slot fit tolerance offset (mm). */
  stockTolerance: number;
  /** Material density in g/cm^3. */
  density: number;
  /** Material grain/flute orientation angle (degrees). */
  grainDirectionDeg: number;
  /** Minimum allowable bend radius (mm). */
  minBendRadius: number;
}

export interface DesignParameters {
  /** Outer sheet margin required for laser/cutter bed clamping (mm). */
  manufacturingMargin: number;
  /** Minimum clearance distance between adjacent pieces/features (mm). */
  minClearance: number;
  /** Minimum feature size for slots, tabs, pegs, or holes (mm). */
  minFeatureSize: number;
  /** Lock flag preventing silent AI or automated parameter mutations. */
  isLockedByDesign: boolean;
}

export interface PieceParameters {
  pieceId: ID;
  name: string;
  width: number;
  height: number;
  thickness: number;
  materialId: ID;
  /** Optional piece-level minimum feature size override. */
  minFeatureSize?: number;
}

export interface AssemblyParameters {
  totalMaterialAreaUsed: number; // mm^2
  stockSheetCount: number;
  maxCantileverOverhang: number; // mm
}

export interface MaterialConstraintCheckResult {
  code: string;
  satisfied: boolean;
  level: "ok" | "warning" | "error";
  message: string;
  refIds?: ID[];
}

export interface MaterialConstraintValidationReport {
  level: "ok" | "warning" | "error";
  usableAreaWidth: number;
  usableAreaHeight: number;
  results: MaterialConstraintCheckResult[];
}
