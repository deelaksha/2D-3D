/**
 * Serialization & Deserialization Engine for Puzzle Assembly Graphs G = (V, E).
 */
import type { SerializedAssemblyGraph } from "./types";
import { PuzzleAssemblyGraph } from "./graph";

export function serializeAssemblyGraph(graph: PuzzleAssemblyGraph): string {
  const payload: SerializedAssemblyGraph = {
    schemaVersion: 1,
    nodes: graph.getAllPieceNodes(),
    edges: graph.getAllConnectionEdges(),
  };

  return JSON.stringify(payload, null, 2);
}

export function deserializeAssemblyGraph(jsonString: string): PuzzleAssemblyGraph {
  if (!jsonString || typeof jsonString !== "string") {
    throw new Error("Cannot deserialize empty graph JSON string.");
  }

  const parsed = JSON.parse(jsonString) as SerializedAssemblyGraph;

  if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error("Invalid assembly graph JSON payload: missing nodes or edges array.");
  }

  return new PuzzleAssemblyGraph(parsed.nodes, parsed.edges);
}
