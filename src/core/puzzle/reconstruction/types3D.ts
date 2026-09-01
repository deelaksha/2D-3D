/**
 * 3D Reconstruction & Assembly Pipeline Types.
 */
import type { SolidRepresentation3D } from "../solid3d/types";
import type { AssemblyPlacement } from "../assemblytransforms/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";
import type { GroundTruthAssemblyManifest } from "../benchmark/types";
import type { ReconstructionDiagnostics } from "./diagnostics3D";

export interface GeometricDifferenceReport {
  referenceAssemblyId?: string;
  hausdorffDistanceMm: number;
  chamferDistanceMm: number;
  boundingVolumeIoU: number;
  centroidOffsetMm: number;
  pieceCountDelta: number;
  hasMismatch: boolean;
  mismatchSummary: string;
}

export interface Reconstruction3DOutput {
  success: boolean;
  puzzleId: string;
  solids: Map<string, SolidRepresentation3D>;
  placements: Map<string, AssemblyPlacement>;
  graph: PuzzleAssemblyGraph;
  referenceDifferences?: GeometricDifferenceReport;
  diagnostics: ReconstructionDiagnostics;
  durationMs: number;
}
