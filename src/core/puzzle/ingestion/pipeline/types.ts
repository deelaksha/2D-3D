/**
 * Real-Data Pipeline Integration Types.
 */
import type { CanonicalPiece, CanonicalPuzzle } from "../../canonical/types";
import type { Extracted2DGeometryResult } from "../geometry/types";
import type { Detected2DInterface } from "../interfaces/types";
import type { ConnectionCandidate, OrientationConstraint } from "../connections/types";
import type { ParametricFeature } from "../features/types";
import type { PipelineTraceDiagnostics } from "./diagnostics";

export interface RealPipelineResult {
  success: boolean;
  puzzle: CanonicalPuzzle;
  material: {
    materialId: string;
    thicknessMm: number;
  };
  pieces: CanonicalPiece[];
  geometry: Extracted2DGeometryResult;
  interfaces: Detected2DInterface[];
  connections: ConnectionCandidate[];
  parameters: ParametricFeature[];
  constraints: OrientationConstraint[];
  diagnostics: PipelineTraceDiagnostics;
  totalDurationMs: number;
}
