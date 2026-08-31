/**
 * Puzzle Assembly Graph G = (V, E) Types.
 *
 * Models topological connections between explicit interfaces independent of physical 3D transforms.
 */
import type { ID } from "@/core/model/types";

export interface PuzzlePieceNode {
  pieceId: ID;
  interfaceIds: ID[];
  metadata?: Record<string, string | number | boolean>;
}

export interface AssemblyConnectionEdge {
  connectionId: ID;
  sourcePieceId: ID;
  sourceInterfaceId: ID;
  targetPieceId: ID;
  targetInterfaceId: ID;
  connectionType: string;
  joiningAngleDeg: number;
  status: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PieceDegreeInfo {
  pieceId: ID;
  degree: number;
  incidentConnectionIds: ID[];
}

export interface SerializedAssemblyGraph {
  schemaVersion: number;
  nodes: PuzzlePieceNode[];
  edges: AssemblyConnectionEdge[];
}
