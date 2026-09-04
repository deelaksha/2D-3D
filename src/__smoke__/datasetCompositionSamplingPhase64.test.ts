import { describe, expect, it } from "vitest";
import { RealDataIngestionPipeline } from "../core/puzzle/realdata/realDataIngestionPipeline";
import { SyntheticPuzzleGenerator } from "../core/puzzle/generator/syntheticGenerator";
import {
  DataOriginAdapter,
  DatasetComposer,
  DatasetSampler,
  FeatureClassifier,
} from "../core/puzzle/composition";
import type { RealDatasetExample } from "../core/puzzle/realdata/types";
import type { SyntheticGeneratedExample, SyntheticGenerationConfig } from "../core/puzzle/generator/types";

function createRealExample(id: string, piecesCount = 2, angle = 90.0): RealDatasetExample {
  const parts = [];
  const connections = [];

  for (let i = 0; i < piecesCount; i++) {
    parts.push({
      id: `part_${i + 1}`,
      name: `Part ${i + 1}`,
      width: 100 + i * 10,
      height: 80,
      thickness: 3.0,
      connectors: [
        {
          id: `conn_${i + 1}`,
          partId: `part_${i + 1}`,
          name: `Port ${i + 1}`,
          type: i % 2 === 0 ? "tab" : "slot",
          position: { x: 50, y: 0 },
          orientation: 0,
          width: 20,
          height: 5,
          depth: 5,
          tolerance: 0.1,
          compatibleWith: i % 2 === 0 ? ["slot"] : ["tab"],
        },
      ],
    });
  }

  for (let i = 0; i < piecesCount - 1; i++) {
    connections.push({
      id: `conn_link_${i}`,
      fromPartId: `part_${i + 1}`,
      fromConnectorId: `conn_${i + 1}`,
      toPartId: `part_${i + 2}`,
      toConnectorId: `conn_${i + 2}`,
      joiningAngleDeg: angle,
      status: "valid",
    });
  }

  const projectJson = JSON.stringify({
    schemaVersion: 1,
    meta: { id, name: `Real Project ${id}`, displayUnit: "mm" },
    parts,
    materials: [{ id: "cardboard_3mm", name: "Cardboard", thickness: 3.0 }],
    groups: [],
    dimensions: [],
    assembly: {
      placements: parts.map((p, idx) => ({
        partId: p.id,
        position: { x: 0, y: 0, z: idx * 50 },
        rotation: { x: 0, y: 0, z: 0 },
      })),
      connections,
    },
  });

  const res = RealDataIngestionPipeline.ingestFile({
    filename: `${id}.json`,
    content: projectJson,
  });

  if (!res.datasetExample) throw new Error("Failed to produce real example.");
  res.datasetExample.itemId = id;
  return res.datasetExample;
}

function createSyntheticExample(seed: number, pieceCount = 3): SyntheticGeneratedExample {
  const cfg: SyntheticGenerationConfig = {
    seed,
    pieceCountRange: [pieceCount, pieceCount],
    thicknessMmRange: [3.0, 3.0],
    dimensionMmRange: [80, 120],
    tabWidthMmRange: [15, 20],
    slotWidthMmRange: [15, 20],
    clearanceMmRange: [0.1, 0.2],
    connectionTypes: ["tab_slot"],
    joiningAnglesDeg: [90],
    symmetryMode: "none",
    layers: 1,
    targetValidity: "valid",
  };
  return SyntheticPuzzleGenerator.generateExample(cfg);
}

describe("Phase 64: Hybrid Dataset Composition & Stratified Sampling", () => {
  describe("1. Origin Tracking & Ground-Truth Separation", () => {
    it("strictly tracks REAL vs SYNTHETIC origin and protects ground truth flag", () => {
      const realEx = createRealExample("real_01");
      const synthEx = createSyntheticExample(42);

      const adaptedReal = DataOriginAdapter.fromRealExample(realEx, "train");
      const adaptedSynth = DataOriginAdapter.fromSyntheticExample(synthEx, "train");

      // 1. Origin verification
      expect(adaptedReal.origin).toBe("REAL");
      expect(adaptedSynth.origin).toBe("SYNTHETIC");

      // 2. CRITICAL GROUND TRUTH ENFORCEMENT:
      // Real verified data is ground truth; synthetic data is NEVER ground truth
      expect(adaptedReal.isGroundTruth).toBe(true);
      expect(adaptedSynth.isGroundTruth).toBe(false);

      // 3. Provenance distinction
      expect(adaptedReal.provenance.source_file).toContain("real_01.json");
      expect(adaptedSynth.syntheticSeed).toBe(42);
      expect(adaptedSynth.provenance.source_file).toContain("synthetic://");
    });
  });

  describe("2. Controlled Ratio Mixing (20/80 and 50/50)", () => {
    it("composes dataset with 20% real / 80% synthetic controlled ratio", () => {
      const realPool = [
        createRealExample("r1"),
        createRealExample("r2"),
        createRealExample("r3"),
        createRealExample("r4"),
        createRealExample("r5"),
      ];

      const synthPool = [];
      for (let i = 0; i < 25; i++) {
        synthPool.push(createSyntheticExample(100 + i));
      }

      // Target total = 20: 20% real (4) + 80% synthetic (16)
      const splits = DatasetComposer.composeDataset(
        "hybrid_dataset_20_80",
        "v1.0.0",
        realPool,
        synthPool,
        {
          realRatio: 0.2,
          syntheticRatio: 0.8,
          targetTotalCount: 20,
        }
      );

      const stats = splits.distributionStats;
      expect(stats.totalExamples).toBe(20);
      expect(stats.realCount).toBe(4);
      expect(stats.syntheticCount).toBe(16);
      expect(stats.actualRealRatio).toBe(0.2);
      expect(stats.actualSyntheticRatio).toBe(0.8);
      expect(stats.groundTruthCount).toBe(4);
    });

    it("composes dataset with 50% real / 50% synthetic balanced ratio", () => {
      const realPool = [];
      for (let i = 0; i < 12; i++) realPool.push(createRealExample(`r_50_${i}`));

      const synthPool = [];
      for (let i = 0; i < 15; i++) synthPool.push(createSyntheticExample(200 + i));

      // Target total = 20: 50% real (10) + 50% synthetic (10)
      const splits = DatasetComposer.composeDataset(
        "hybrid_dataset_50_50",
        "v1.0.0",
        realPool,
        synthPool,
        {
          realRatio: 0.5,
          syntheticRatio: 0.5,
          targetTotalCount: 20,
        }
      );

      const stats = splits.distributionStats;
      expect(stats.totalExamples).toBe(20);
      expect(stats.realCount).toBe(10);
      expect(stats.syntheticCount).toBe(10);
      expect(stats.actualRealRatio).toBe(0.5);
      expect(stats.actualSyntheticRatio).toBe(0.5);
    });
  });

  describe("3. Stratified Sampling Across 7 Dimensions", () => {
    it("extracts all 7 stratification dimensions in FeatureClassifier", () => {
      const realEx = createRealExample("real_dim_test", 3, 45.0);
      const dims = FeatureClassifier.classify(realEx);

      expect(dims.pieceCount).toBe(3);
      expect(dims.connectionType).toBe("tab_slot");
      expect(dims.difficulty).toBeDefined();
      expect(dims.geometryComplexity).toBe("simple");
      expect(dims.assemblyAngle).toBe(45.0);
      expect(dims.material).toBe("cardboard-stock");
      expect(dims.failureType).toBe("none");
    });

    it("samples stratified subsets balanced by piece count and connection type", () => {
      const pool = [
        DataOriginAdapter.fromRealExample(createRealExample("ex_p2", 2)),
        DataOriginAdapter.fromRealExample(createRealExample("ex_p3", 3)),
        DataOriginAdapter.fromRealExample(createRealExample("ex_p4", 4)),
        DataOriginAdapter.fromRealExample(createRealExample("ex_p5", 5)),
        DataOriginAdapter.fromSyntheticExample(createSyntheticExample(1, 2)),
        DataOriginAdapter.fromSyntheticExample(createSyntheticExample(2, 3)),
        DataOriginAdapter.fromSyntheticExample(createSyntheticExample(3, 4)),
        DataOriginAdapter.fromSyntheticExample(createSyntheticExample(4, 5)),
      ];

      const sampled = DatasetSampler.sampleStratified(pool, 4, {
        targetPieceCounts: [2, 3, 4, 5],
      });

      expect(sampled.length).toBe(4);
      const pieceCounts = sampled.map((s) => s.samplingDimensions.pieceCount);
      expect(new Set(pieceCounts).size).toBeGreaterThan(1);
    });
  });

  describe("4. Balanced Evaluation Sets", () => {
    it("enforces pure_real evaluation policy where test split is 100% real ground truth", () => {
      const realPool = [
        createRealExample("r_eval_1"),
        createRealExample("r_eval_2"),
        createRealExample("r_eval_3"),
        createRealExample("r_eval_4"),
        createRealExample("r_eval_5"),
      ];

      const synthPool = [];
      for (let i = 0; i < 20; i++) synthPool.push(createSyntheticExample(300 + i));

      const splits = DatasetComposer.composeDataset(
        "benchmark_dataset",
        "v1.0.0",
        realPool,
        synthPool,
        {
          realRatio: 0.25,
          syntheticRatio: 0.75,
          targetTotalCount: 20,
        },
        {},
        {
          policy: "pure_real",
          testSplitRatio: 0.2,
          valSplitRatio: 0.2,
        }
      );

      // Verify test split
      expect(splits.test.length).toBeGreaterThan(0);
      for (const testItem of splits.test) {
        expect(testItem.origin).toBe("REAL");
        expect(testItem.isGroundTruth).toBe(true);
      }
    });
  });

  describe("5. Bounded Dataset Size Safeguard", () => {
    it("does not create a huge dataset and strictly respects targetTotalCount", () => {
      const realPool = [createRealExample("r_cap_1"), createRealExample("r_cap_2")];
      const synthPool = [];
      for (let i = 0; i < 50; i++) synthPool.push(createSyntheticExample(500 + i));

      // Request compact size of 10 examples
      const splits = DatasetComposer.composeDataset(
        "compact_dataset",
        "v1.0.0",
        realPool,
        synthPool,
        {
          realRatio: 0.2,
          syntheticRatio: 0.8,
          targetTotalCount: 10,
        }
      );

      const total = splits.train.length + splits.validation.length + splits.test.length;
      expect(total).toBe(10);
      expect(splits.distributionStats.totalExamples).toBe(10);
    });
  });
});
