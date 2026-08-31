# Puzzle Assembly Graph Specification (Phase 6)

This document specifies the **Puzzle Assembly Graph \(G = (V, E)\)** for the Parametric 2D-to-3D Puzzle System.

---

## 1. Architectural Principles

The assembly structure is modeled as an undirected mathematical graph \(G = (V, E)\):
- **Vertices \(V\)**: Pieces (`PuzzlePieceNode`) storing piece ID and associated interface IDs.
- **Edges \(E\)**: Physical connections (`AssemblyConnectionEdge`) referencing explicit source and target interface ports (`sourceInterfaceId` and `targetInterfaceId`).

### Independence from 3D Transforms
The graph topology models connection relationships **purely topologically**. It is completely independent of physical 3D spatial position vectors (\(\vec{r}\)) or rotation quaternions (\(Q\)).

---

## 2. Core Graph API (`PuzzleAssemblyGraph`)

### 2.1 Node & Edge Operations
- `addPieceNode(pieceId, interfaceIds, metadata)`: Adds or updates a piece node.
- `removePieceNode(pieceId)`: Removes a piece node and all incident connection edges.
- `addConnectionEdge(edge)`: Adds a connection edge and registers referenced piece nodes.
- `removeConnectionEdge(connectionId)`: Removes a connection edge.

### 2.2 Topological Analysis & Lookups
- `getNeighbors(pieceId)`: Returns array of adjacent piece IDs.
- `getIncidentEdges(pieceId)`: Returns list of connection edges incident to `pieceId`.
- `isConnected(pieceIdA, pieceIdB)`: BFS path reachability check between piece A and B.
- `getConnectedComponents()`: Finds all disconnected subgraphs/clusters of pieces (`ID[][]`).
- `getIsolatedPieces()`: Detects orphan pieces with degree 0.
- `traverseGraph(startPieceId, visitor)`: BFS graph traversal order and depth tracking.
- `getConnectionDegree(pieceId)`: Calculates incident edge count for a piece.
- `getInterfaceDegree(interfaceId)`: Calculates edge count referencing a specific interface.

---

## 3. Serialization (`serializeAssemblyGraph` / `deserializeAssemblyGraph`)

Assembly graphs support lossless JSON export and import with `schemaVersion: 1`:

```json
{
  "schemaVersion": 1,
  "nodes": [
    { "pieceId": "p1", "interfaceIds": ["if1"] },
    { "pieceId": "p2", "interfaceIds": ["if2"] }
  ],
  "edges": [
    {
      "connectionId": "conn1",
      "sourcePieceId": "p1",
      "sourceInterfaceId": "if1",
      "targetPieceId": "p2",
      "targetInterfaceId": "if2",
      "connectionType": "tab_slot",
      "joiningAngleDeg": 90.0,
      "status": "valid"
    }
  ]
}
```
