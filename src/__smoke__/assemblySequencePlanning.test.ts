import { describe, expect, it } from "vitest";
import {
  AssemblyPlacement,
  AssemblySequenceSolver,
  convert2DTo3DSolid,
  createDefaultParametricPiece2D,
  identityTransform,
  PuzzleAssemblyGraph,
  translationTransform,
  vec3,
} from "@/core/puzzle";

describe("Phase 14: Assembly-Sequence Planning Subsystem", () => {
  it("plans a valid explicit step-by-step assembly sequence (P01, P01 + P02, P01 + P02 + P03)", () => {
    const p1 = createDefaultParametricPiece2D(100, 100, 2.0);
    const p2 = createDefaultParametricPiece2D(100, 100, 2.0);
    const p3 = createDefaultParametricPiece2D(100, 100, 2.0);

    const s1 = convert2DTo3DSolid(p1).solid;
    const s2 = convert2DTo3DSolid(p2).solid;
    const s3 = convert2DTo3DSolid(p3).solid;

    // Placements arranged in a non-overlapping row along X axis
    const placements = {
      P01: { pieceId: "P01", transform: identityTransform() },
      P02: { pieceId: "P02", transform: translationTransform(vec3(120, 0, 0)) },
      P03: { pieceId: "P03", transform: translationTransform(vec3(240, 0, 0)) },
    };

    const graph = new PuzzleAssemblyGraph();
    graph.addConnectionEdge({
      connectionId: "c12",
      sourcePieceId: "P01",
      sourceInterfaceId: "if1",
      targetPieceId: "P02",
      targetInterfaceId: "if2",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    graph.addConnectionEdge({
      connectionId: "c23",
      sourcePieceId: "P02",
      sourceInterfaceId: "if2b",
      targetPieceId: "P03",
      targetInterfaceId: "if3",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    const result = AssemblySequenceSolver.planAssemblySequence({
      graph,
      placements,
      solids: { P01: s1, P02: s2, P03: s3 },
      basePieceId: "P01",
    });

    expect(result.success).toBe(true);
    expect(result.bestSequence).toBeDefined();

    const seq = result.bestSequence!;
    expect(seq.isPhysicallyAssemblable).toBe(true);
    expect(seq.totalSteps).toBe(3);

    // Verify explicit subassembly state labels
    expect(seq.steps[0].subAssemblyStateLabel).toBe("P01");
    expect(seq.steps[1].subAssemblyStateLabel).toBe("P01 + P02");
    expect(seq.steps[2].subAssemblyStateLabel).toBe("P01 + P02 + P03");
  });

  it("proves graph connectivity != physical assemblability by rejecting sequences with spatial insertion collisions", () => {
    const p1 = createDefaultParametricPiece2D(100, 100, 2.0);
    const p2 = createDefaultParametricPiece2D(100, 100, 2.0);

    const s1 = convert2DTo3DSolid(p1).solid;
    const s2 = convert2DTo3DSolid(p2).solid;

    // Placements WITH HEAVY UNCONNECTED OVERLAP (e.g. 50mm interpenetration)
    const placements: Record<string, AssemblyPlacement> = {
      P01: { pieceId: "P01", transform: identityTransform() },
      P02: { pieceId: "P02", transform: translationTransform(vec3(50, 0, 0)) },
    };

    // Connected in assembly graph
    const graph = new PuzzleAssemblyGraph();
    graph.addConnectionEdge({
      connectionId: "c12",
      sourcePieceId: "P01",
      sourceInterfaceId: "if1",
      targetPieceId: "P02",
      targetInterfaceId: "if2",
      connectionType: "tab_slot",
      joiningAngleDeg: 90.0,
      status: "valid",
    });

    // Add a 3rd unconnected piece P03 occupying same volume as P02
    const p3 = createDefaultParametricPiece2D(100, 100, 2.0);
    const s3 = convert2DTo3DSolid(p3).solid;
    placements["P03"] = { pieceId: "P03", transform: translationTransform(vec3(60, 0, 0)) };
    graph.addPieceNode("P03"); // Connected to nothing, overlapping P02

    const result = AssemblySequenceSolver.planAssemblySequence({
      graph,
      placements,
      solids: { P01: s1, P02: s2, P03: s3 },
      basePieceId: "P01",
    });

    expect(result.success).toBe(false);
    expect(result.invalidationReasons.length).toBeGreaterThan(0);
    expect(result.invalidationReasons.some((r) => r.includes("UNEXPECTED COLLISION"))).toBe(true);
  });
});
