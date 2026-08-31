/**
 * Assembly Sequence Planning Subsystem Domain Types.
 *
 * Models explicit assembly sequences step-by-step (P01, P01 + P02, P01 + P02 + P03)
 * and physical assemblability verification results.
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";
import type { AssemblyPlacement } from "../assemblytransforms/types";
import type { SolidRepresentation3D } from "../solid3d/types";
import type { CanonicalInterface } from "../canonical/types";
import type { DeclarativeConstraint } from "../constraintsystem/types";

export interface ExplicitAssemblyStep {
  stepNumber: number;
  /** ID of piece attached in this step. */
  addedPieceId: ID;
  /** Active interface connection IDs engaged in this step. */
  activeConnectionIds: ID[];
  /** List of all piece IDs present in the subassembly after this step. */
  subAssemblyPieces: ID[];
  /** Explicit subassembly state string (e.g. "P01 + P02 + P03"). */
  subAssemblyStateLabel: string;
  /** 3D insertion trajectory vector for this piece. */
  insertionVector?: Vec3;
  /** Joining angle in degrees at this connection. */
  joiningAngleDeg?: number;
  /** Descriptive human-readable step label. */
  stepDescription: string;
}

export interface ExplicitAssemblySequence {
  sequenceId: ID;
  steps: ExplicitAssemblyStep[];
  /** True if ALL steps satisfy physical 3D collision, connection, angle, and insertion constraints. */
  isPhysicallyAssemblable: boolean;
  totalSteps: number;
  invalidationReasons: string[];
}

export interface AssemblySequenceSolverInput {
  graph: PuzzleAssemblyGraph;
  placements: Record<ID, AssemblyPlacement>;
  solids: Record<ID, SolidRepresentation3D>;
  interfaces?: Record<ID, CanonicalInterface>;
  constraints?: DeclarativeConstraint[];
  basePieceId?: ID;
}

export interface AssemblySequenceSolverResult {
  success: boolean;
  validSequences: ExplicitAssemblySequence[];
  bestSequence?: ExplicitAssemblySequence;
  totalEvaluatedSequences: number;
  invalidationReasons: string[];
}
