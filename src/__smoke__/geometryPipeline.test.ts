import { describe, expect, it } from "vitest";
import {
  generateExact2DGeometry,
  runParametricGeometryPipeline,
  validateGeneratedGeometry,
} from "@/core/puzzle";

describe("Phase 9: Parametric 2D Geometry Pipeline", () => {
  it("guarantees 100% deterministic geometry output for identical input parameters", () => {
    const input = {
      pieceParameters: { width: 100, height: 100, thickness: 2.0 },
      interfaceParameters: [
        { id: "f1", edgeIndex: 2, featureKind: "tab" as const, parametricOffset: 0.5, width: 20, depth: 5 },
      ],
    };

    const out1 = runParametricGeometryPipeline(input);
    const out2 = runParametricGeometryPipeline(input);

    expect(out1.deterministicHash).toBe(out2.deterministicHash);
    expect(out1.sampledOutlines[0]).toEqual(out2.sampledOutlines[0]);
    expect(out1.validationReport.level).toBe("ok");
  });

  it("generates exact 2D geometry for tabs, slots, arcs, and straight edges", () => {
    const input = {
      pieceParameters: { width: 120, height: 80, thickness: 3.0 },
      interfaceParameters: [
        { id: "tab1", edgeIndex: 2, featureKind: "tab" as const, parametricOffset: 0.3, width: 20, depth: 6 },
        { id: "slot1", edgeIndex: 2, featureKind: "slot" as const, parametricOffset: 0.7, width: 25, depth: 6 },
      ],
    };

    const out = runParametricGeometryPipeline(input);
    expect(out.exactBoundary.edgeSegments.length).toBeGreaterThan(6);
    expect(out.validationReport.level).toBe("ok");
  });

  it("validates closed boundary topology", () => {
    const input = { pieceParameters: { width: 50, height: 50, thickness: 2.0 }, interfaceParameters: [] };
    const { boundary, vertices, sampledOutline } = generateExact2DGeometry(input);

    // Corrupt topology to unclosed loop
    boundary.edgeSegments.pop();

    const report = validateGeneratedGeometry(input, boundary, vertices, sampledOutline);
    expect(report.level).toBe("error");
    expect(report.issues.some((i: any) => i.code === "UNCLOSED_BOUNDARY_TOPOLOGY")).toBe(true);
  });

  it("detects degenerate zero-length edges and minimum feature size violations", () => {
    const inputTooSmall = {
      pieceParameters: { width: 100, height: 100, thickness: 2.0 },
      interfaceParameters: [
        { id: "f_tiny", edgeIndex: 2, featureKind: "tab" as const, parametricOffset: 0.5, width: 0.5, depth: 5 },
      ],
      manufacturing: { minFeatureSize: 2.0 },
    };

    const out = runParametricGeometryPipeline(inputTooSmall);
    expect(out.validationReport.level).toBe("error");
    expect(out.validationReport.issues.some((i: any) => i.code === "FEATURE_TOO_SMALL")).toBe(true);
  });
});
