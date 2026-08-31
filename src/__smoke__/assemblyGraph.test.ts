import { describe, expect, it } from "vitest";
import {
  deserializeAssemblyGraph,
  PuzzleAssemblyGraph,
  serializeAssemblyGraph,
} from "@/core/puzzle";

describe("Phase 6: Puzzle Assembly Graph G = (V, E)", () => {
  it("adds and removes piece nodes and connection edges", () => {
    const graph = new PuzzleAssemblyGraph();

    graph.addPieceNode("piece_base", ["if_base_top"]);
    graph.addPieceNode("piece_wall", ["if_wall_bottom"]);

    expect(graph.hasPieceNode("piece_base")).toBe(true);
    expect(graph.hasPieceNode("piece_wall")).toBe(true);
    expect(graph.getAllPieceNodes()).toHaveLength(2);

    graph.addConnectionEdge({
      connectionId: "conn_1",
      sourcePieceId: "piece_base",
      sourceInterfaceId: "if_base_top",
      targetPieceId: "piece_wall",
      targetInterfaceId: "if_wall_bottom",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    expect(graph.hasConnectionEdge("conn_1")).toBe(true);
    expect(graph.getConnectionDegree("piece_base")).toBe(1);
    expect(graph.getInterfaceDegree("if_base_top")).toBe(1);
  });

  it("performs neighbor lookups and incident edge retrieval", () => {
    const graph = new PuzzleAssemblyGraph();

    graph.addConnectionEdge({
      connectionId: "conn_a_b",
      sourcePieceId: "p_a",
      sourceInterfaceId: "if_a",
      targetPieceId: "p_b",
      targetInterfaceId: "if_b",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    graph.addConnectionEdge({
      connectionId: "conn_b_c",
      sourcePieceId: "p_b",
      sourceInterfaceId: "if_b2",
      targetPieceId: "p_c",
      targetInterfaceId: "if_c",
      connectionType: "interlock",
      joiningAngleDeg: 45.0,
      status: "valid",
    });

    const neighborsB = graph.getNeighbors("p_b");
    expect(neighborsB).toContain("p_a");
    expect(neighborsB).toContain("p_c");
    expect(neighborsB).toHaveLength(2);
  });

  it("checks path reachability between pieces (isConnected)", () => {
    const graph = new PuzzleAssemblyGraph();

    // Chain: p1 -> p2 -> p3, and p4 (isolated)
    graph.addConnectionEdge({
      connectionId: "c12",
      sourcePieceId: "p1",
      sourceInterfaceId: "if1",
      targetPieceId: "p2",
      targetInterfaceId: "if2",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    graph.addConnectionEdge({
      connectionId: "c23",
      sourcePieceId: "p2",
      sourceInterfaceId: "if2b",
      targetPieceId: "p3",
      targetInterfaceId: "if3",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    graph.addPieceNode("p4", ["if4"]);

    expect(graph.isConnected("p1", "p3")).toBe(true);
    expect(graph.isConnected("p1", "p4")).toBe(false);
  });

  it("discovers connected components and isolated pieces", () => {
    const graph = new PuzzleAssemblyGraph();

    // Cluster 1: p1 - p2
    graph.addConnectionEdge({
      connectionId: "c1",
      sourcePieceId: "p1",
      sourceInterfaceId: "i1",
      targetPieceId: "p2",
      targetInterfaceId: "i2",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    // Cluster 2: p3 - p4
    graph.addConnectionEdge({
      connectionId: "c2",
      sourcePieceId: "p3",
      sourceInterfaceId: "i3",
      targetPieceId: "p4",
      targetInterfaceId: "i4",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    // Isolated piece: p5
    graph.addPieceNode("p5");

    const components = graph.getConnectedComponents();
    expect(components).toHaveLength(3);

    const isolated = graph.getIsolatedPieces();
    expect(isolated).toEqual(["p5"]);
  });

  it("traverses assembly graph in BFS order with depth tracking", () => {
    const graph = new PuzzleAssemblyGraph();

    graph.addConnectionEdge({
      connectionId: "c12",
      sourcePieceId: "root",
      sourceInterfaceId: "ir",
      targetPieceId: "child1",
      targetInterfaceId: "ic1",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    graph.addConnectionEdge({
      connectionId: "c13",
      sourcePieceId: "root",
      sourceInterfaceId: "ir2",
      targetPieceId: "child2",
      targetInterfaceId: "ic2",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    const depths: Record<string, number> = {};
    const order = graph.traverseGraph("root", (pieceId, depth) => {
      depths[pieceId] = depth;
    });

    expect(order[0]).toBe("root");
    expect(depths["root"]).toBe(0);
    expect(depths["child1"]).toBe(1);
    expect(depths["child2"]).toBe(1);
  });

  it("serializes and deserializes assembly graph losslessly", () => {
    const graph = new PuzzleAssemblyGraph();

    graph.addConnectionEdge({
      connectionId: "c_main",
      sourcePieceId: "plate_a",
      sourceInterfaceId: "if_a",
      targetPieceId: "plate_b",
      targetInterfaceId: "if_b",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    const json = serializeAssemblyGraph(graph);
    expect(json).toContain("plate_a");
    expect(json).toContain("c_main");

    const restored = deserializeAssemblyGraph(json);
    expect(restored.getAllPieceNodes()).toHaveLength(2);
    expect(restored.getAllConnectionEdges()).toHaveLength(1);
    expect(restored.isConnected("plate_a", "plate_b")).toBe(true);
  });
});
