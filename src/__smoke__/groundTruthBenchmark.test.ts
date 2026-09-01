import { describe, expect, it } from "vitest";
import { RealAssemblyImporter } from "../core/puzzle/benchmark/realAssemblyImporter";
import { GroundTruthComparator } from "../core/puzzle/benchmark/groundTruthComparator";
import { DatasetAnnotationTool } from "../core/puzzle/benchmark/annotationTool";
import { DatasetQualityValidator } from "../core/puzzle/benchmark/datasetQualityValidator";
import { PilotDataset } from "../core/puzzle/benchmark/pilotDataset";
import { RealDataBenchmarkHarness } from "../core/puzzle/benchmark/realDataBenchmarkHarness";
import { CanonicalConverter2D } from "../core/puzzle/reconstruction/canonicalConverter2D";

describe("Steps 35–40: Ground-Truth Evaluation & Real-Data Benchmark", () => {
  it("Step 35: loads 3D ground-truth assembly manifests", () => {
    const manifest = RealAssemblyImporter.createMockManifest("gt_test_1", "Test GT Manifest", ["P01", "P02"]);
    expect(manifest.assemblyId).toBe("gt_test_1");
    expect(manifest.piecesCount).toBe(2);
  });

  it("Step 36: calculates quantitative geometric error metrics", () => {
    const manifest = RealAssemblyImporter.createMockManifest("gt_test_2", "Test GT Manifest", ["piece_seg_1", "piece_seg_2"]);
    const mockReconstruction = {
      puzzleId: "puz_test",
      solids: new Map([["piece_seg_1", {} as any], ["piece_seg_2", {} as any]]),
      placements: new Map([
        ["piece_seg_1", { pieceId: "piece_seg_1", transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } }, isFixed: true }],
        ["piece_seg_2", { pieceId: "piece_seg_2", transform: { position: { x: 50, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } }, isFixed: false }],
      ]),
      graph: {} as any,
      reconstructionSuccess: true,
    };

    const metrics = GroundTruthComparator.compare(mockReconstruction, manifest);
    expect(metrics.pieceCountDelta).toBe(0);
    expect(metrics.topologicalPrecision).toBe(1.0);
    expect(metrics.overallF1Score).toBe(1.0);
  });

  it("Step 37: annotates dataset metadata", () => {
    const pilotItems = PilotDataset.getPilotDataset();
    const item = pilotItems[0];
    const annotated = DatasetAnnotationTool.annotateItem(item, {
      reviewedBy: "QA Lead",
      verified: true,
    });

    expect(annotated.groundTruthManifest.annotations?.reviewedBy).toBe("QA Lead");
  });

  it("Step 38: validates canonical IR dataset quality", () => {
    const canonical = CanonicalConverter2D.convertToCanonicalIR(
      "puz_qual_1",
      [],
      new Map(),
      [],
      {
        inferredThicknessMm: 3.0,
        defaultTabWidthMm: 10.0,
        defaultSlotDepthMm: 3.0,
        detectedJoiningAnglesDeg: [45.0],
        overallPieceCount: 0,
        overallInterfaceCount: 0,
        overallConnectionCount: 0,
      }
    );

    const report = DatasetQualityValidator.validateQuality(canonical);
    expect(report.datasetItemId).toBe("puz_qual_1");
  });

  it("Step 39: loads 20-item pilot dataset collection", () => {
    const items = PilotDataset.getPilotDataset();
    expect(items.length).toBe(20);
  });

  it("Step 40: executes end-to-end benchmark harness across pilot dataset", () => {
    const benchmarkResult = RealDataBenchmarkHarness.runBenchmark();

    expect(benchmarkResult.totalItemsEvaluated).toBe(20);
    expect(benchmarkResult.successfulReconstructions).toBe(20);
    expect(benchmarkResult.averageF1Score).toBeGreaterThan(0.0);
  });
});
