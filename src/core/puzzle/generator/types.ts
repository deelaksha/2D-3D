/**
 * Synthetic Puzzle Data Generator Types (Phase 42).
 */
import type { CanonicalPuzzle } from "../canonical/types";
import type { Extracted2DGeometryResult } from "../ingestion/geometry/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";
import type { AssemblyPlacement } from "../assemblytransforms/types";
import type { DatasetAcceptanceReport } from "../validation/types";

export type SyntheticInvalidityReason =
  | "incompatible_interfaces"
  | "collision"
  | "insufficient_clearance"
  | "disconnected_assembly"
  | "invalid_dimensions"
  | "invalid_cardboard_size"
  | "impossible_angle"
  | "self_intersection";

export interface SyntheticGenerationConfig {
  seed: number;
  pieceCountRange: [number, number];
  thicknessMmRange: [number, number];
  dimensionMmRange: [number, number];
  tabWidthMmRange: [number, number];
  slotWidthMmRange: [number, number];
  clearanceMmRange: [number, number];
  connectionTypes: string[];
  joiningAnglesDeg: number[];
  symmetryMode: "none" | "bilateral" | "radial";
  layers: number;
  targetValidity: "valid" | "invalid" | "random";
  specificInvalidityReason?: SyntheticInvalidityReason;
}

export interface SyntheticGeneratedExample {
  exampleId: string;
  seed: number;
  inputParameters: SyntheticGenerationConfig;
  canonicalPuzzle: CanonicalPuzzle;
  geometry: Extracted2DGeometryResult;
  connectionGraph: PuzzleAssemblyGraph;
  assemblyPlacements: Map<string, AssemblyPlacement>;
  validationResult: DatasetAcceptanceReport;
  isValid: boolean;
  invalidityReason?: SyntheticInvalidityReason;
}
