/**
 * Puzzle Assembly Graph Engine G = (V, E).
 *
 * Provides mathematically rigorous topological graph operations:
 *  - Node & Edge management
 *  - Neighbor lookup
 *  - Path reachability (isConnected)
 *  - Connected components discovery
 *  - Isolated piece detection
 *  - BFS graph traversal
 *  - Degree analysis
 */
import type { ID } from "@/core/model/types";
import type { AssemblyConnectionEdge, PieceDegreeInfo, PuzzlePieceNode } from "./types";

export class PuzzleAssemblyGraph {
  private nodes: Map<ID, PuzzlePieceNode> = new Map();
  private edges: Map<ID, AssemblyConnectionEdge> = new Map();

  constructor(nodes: PuzzlePieceNode[] = [], edges: AssemblyConnectionEdge[] = []) {
    for (const node of nodes) this.addPieceNode(node.pieceId, node.interfaceIds, node.metadata);
    for (const edge of edges) this.addConnectionEdge(edge);
  }

  /* ------------------------------------------------------------------ */
  /* Node Operations (Pieces)                                           */
  /* ------------------------------------------------------------------ */

  addPieceNode(pieceId: ID, interfaceIds: ID[] = [], metadata?: Record<string, any>): PuzzlePieceNode {
    const existing = this.nodes.get(pieceId);
    const node: PuzzlePieceNode = {
      pieceId,
      interfaceIds: existing ? Array.from(new Set([...existing.interfaceIds, ...interfaceIds])) : [...interfaceIds],
      metadata: metadata || existing?.metadata,
    };
    this.nodes.set(pieceId, node);
    return node;
  }

  removePieceNode(pieceId: ID): boolean {
    if (!this.nodes.has(pieceId)) return false;

    // Remove all incident connection edges connected to this piece
    const incident = this.getIncidentEdges(pieceId);
    for (const edge of incident) {
      this.removeConnectionEdge(edge.connectionId);
    }

    return this.nodes.delete(pieceId);
  }

  hasPieceNode(pieceId: ID): boolean {
    return this.nodes.has(pieceId);
  }

  getPieceNode(pieceId: ID): PuzzlePieceNode | undefined {
    return this.nodes.get(pieceId);
  }

  getAllPieceNodes(): PuzzlePieceNode[] {
    return Array.from(this.nodes.values());
  }

  /* ------------------------------------------------------------------ */
  /* Edge Operations (Connections)                                      */
  /* ------------------------------------------------------------------ */

  addConnectionEdge(edge: AssemblyConnectionEdge): AssemblyConnectionEdge {
    // Automatically register piece nodes if not already registered
    if (!this.nodes.has(edge.sourcePieceId)) {
      this.addPieceNode(edge.sourcePieceId, [edge.sourceInterfaceId]);
    } else {
      const node = this.nodes.get(edge.sourcePieceId)!;
      if (!node.interfaceIds.includes(edge.sourceInterfaceId)) {
        node.interfaceIds.push(edge.sourceInterfaceId);
      }
    }

    if (!this.nodes.has(edge.targetPieceId)) {
      this.addPieceNode(edge.targetPieceId, [edge.targetInterfaceId]);
    } else {
      const node = this.nodes.get(edge.targetPieceId)!;
      if (!node.interfaceIds.includes(edge.targetInterfaceId)) {
        node.interfaceIds.push(edge.targetInterfaceId);
      }
    }

    this.edges.set(edge.connectionId, { ...edge });
    return edge;
  }

  removeConnectionEdge(connectionId: ID): boolean {
    return this.edges.delete(connectionId);
  }

  hasConnectionEdge(connectionId: ID): boolean {
    return this.edges.has(connectionId);
  }

  getConnectionEdge(connectionId: ID): AssemblyConnectionEdge | undefined {
    return this.edges.get(connectionId);
  }

  getAllConnectionEdges(): AssemblyConnectionEdge[] {
    return Array.from(this.edges.values());
  }

  /* ------------------------------------------------------------------ */
  /* Topology & Neighbor Lookups                                        */
  /* ------------------------------------------------------------------ */

  getNeighbors(pieceId: ID): ID[] {
    const neighbors = new Set<ID>();
    for (const edge of this.edges.values()) {
      if (edge.sourcePieceId === pieceId) {
        neighbors.add(edge.targetPieceId);
      } else if (edge.targetPieceId === pieceId) {
        neighbors.add(edge.sourcePieceId);
      }
    }
    return Array.from(neighbors);
  }

  getIncidentEdges(pieceId: ID): AssemblyConnectionEdge[] {
    const incident: AssemblyConnectionEdge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.sourcePieceId === pieceId || edge.targetPieceId === pieceId) {
        incident.push(edge);
      }
    }
    return incident;
  }

  getConnectionDegree(pieceId: ID): number {
    return this.getIncidentEdges(pieceId).length;
  }

  getInterfaceDegree(interfaceId: ID): number {
    let count = 0;
    for (const edge of this.edges.values()) {
      if (edge.sourceInterfaceId === interfaceId || edge.targetInterfaceId === interfaceId) {
        count++;
      }
    }
    return count;
  }

  /* ------------------------------------------------------------------ */
  /* Path Reachability & Connected Components                           */
  /* ------------------------------------------------------------------ */

  isConnected(pieceIdA?: ID, pieceIdB?: ID): boolean {
    if (pieceIdA === undefined && pieceIdB === undefined) {
      if (this.nodes.size <= 1) return true;
      return this.getConnectedComponents().length === 1 && this.getIsolatedPieces().length === 0;
    }
    if (!pieceIdA || !pieceIdB) return false;
    if (!this.nodes.has(pieceIdA) || !this.nodes.has(pieceIdB)) return false;
    if (pieceIdA === pieceIdB) return true;

    const visited = new Set<ID>([pieceIdA]);
    const queue: ID[] = [pieceIdA];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === pieceIdB) return true;

      for (const neighbor of this.getNeighbors(current)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return false;
  }

  getConnectedComponents(): ID[][] {
    const visited = new Set<ID>();
    const components: ID[][] = [];

    for (const pieceId of this.nodes.keys()) {
      if (!visited.has(pieceId)) {
        const component: ID[] = [];
        const queue: ID[] = [pieceId];
        visited.add(pieceId);

        while (queue.length > 0) {
          const current = queue.shift()!;
          component.push(current);

          for (const neighbor of this.getNeighbors(current)) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }

        components.push(component);
      }
    }

    return components;
  }

  getIsolatedPieces(): ID[] {
    const isolated: ID[] = [];
    for (const pieceId of this.nodes.keys()) {
      if (this.getConnectionDegree(pieceId) === 0) {
        isolated.push(pieceId);
      }
    }
    return isolated;
  }

  /* ------------------------------------------------------------------ */
  /* BFS Graph Traversal                                                 */
  /* ------------------------------------------------------------------ */

  traverseGraph(
    startPieceId: ID,
    visitor?: (pieceId: ID, depth: number) => void,
  ): ID[] {
    if (!this.nodes.has(startPieceId)) return [];

    const visited = new Set<ID>([startPieceId]);
    const queue: Array<{ id: ID; depth: number }> = [{ id: startPieceId, depth: 0 }];
    const order: ID[] = [];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      order.push(id);
      if (visitor) visitor(id, depth);

      for (const neighbor of this.getNeighbors(id)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ id: neighbor, depth: depth + 1 });
        }
      }
    }

    return order;
  }
}
