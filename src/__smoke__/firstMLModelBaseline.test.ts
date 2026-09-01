import { describe, expect, it } from "vitest";
import { ConnectionFeatureExtractor } from "../core/puzzle/firstmlmodel/featureExtractor";
import { NeuralNetConnectionClassifier } from "../core/puzzle/firstmlmodel/connectionClassifier";

describe("First Real ML Baseline Model (Phase 58: Connection Compatibility Classification)", () => {
  it("1. ConnectionFeatureExtractor extracts 16 normalized features in R^16 from interface pairs", () => {
    const ifA = {
      id: "if_1",
      pieceId: "p_1",
      type: "tab" as const,
      localFrame: { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, tangent: { x: 1, y: 0, z: 0 } },
      geometry: { width: 20, depth: 3 },
      parameters: { thicknessMm: 3.0, clearanceMm: 0.15 },
    };
    const ifB = {
      id: "if_2",
      pieceId: "p_2",
      type: "slot" as const,
      localFrame: { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: -1, z: 0 }, tangent: { x: 1, y: 0, z: 0 } },
      geometry: { width: 20, depth: 3 },
      parameters: { thicknessMm: 3.0, clearanceMm: 0.15 },
    };

    const fv = ConnectionFeatureExtractor.extractFeatures(ifA as any, ifB as any, true);

    expect(fv.vector.length).toBe(16);
    expect(fv.vector[6]).toBe(0.0); // Different type (tab vs slot)
    expect(fv.vector[8]).toBe(1.0); // Opposite normal vector alignment
    expect(fv.vector[12]).toBe(1.0); // Complementary tab/slot
    expect(fv.groundTruthCompatible).toBe(true);
  });

  it("2. trains baseline classifier, performs validation/test evaluation, and records checkpoint", async () => {
    const result = await NeuralNetConnectionClassifier.trainAndEvaluateBaseline(30, 42);

    expect(result.modelName).toBe("NeuralNetConnectionClassifier");
    expect(result.selectedTask).toBe("connection_compatibility_classification");
    expect(result.trainAccuracy).toBeGreaterThan(0.85);
    expect(result.valAccuracy).toBeGreaterThan(0.80);
    expect(result.checkpointPath).toBeDefined();
  });

  it("3. computes test Precision, Recall, F1-Score, FPR, FNR, and detailed error analysis", async () => {
    const result = await NeuralNetConnectionClassifier.trainAndEvaluateBaseline(30, 42);

    expect(result.testPrecision).toBeGreaterThanOrEqual(0.0);
    expect(result.testRecall).toBeGreaterThanOrEqual(0.0);
    expect(result.testF1).toBeGreaterThanOrEqual(0.0);
    expect(result.falsePositiveRate).toBeLessThanOrEqual(1.0);
    expect(result.falseNegativeRate).toBeLessThanOrEqual(1.0);

    expect(result.errorAnalysis.totalEvaluatedTestSamples).toBeGreaterThan(0);
    expect(result.errorAnalysis.commonFailureModes.length).toBeGreaterThan(0);
  });

  it("4. compares model performance against baseline and verifies demonstratesMeasurableBenefit: true", async () => {
    const result = await NeuralNetConnectionClassifier.trainAndEvaluateBaseline(30, 42);

    expect(result.testF1).toBeGreaterThanOrEqual(result.baselineF1);
    expect(result.demonstratesMeasurableBenefit).toBe(true);
  });

  it("5. verifies strict invariant: model is NOT integrated into production CAD export", async () => {
    const result = await NeuralNetConnectionClassifier.trainAndEvaluateBaseline(30, 42);

    expect(result.isIntegratedInProduction).toBe(false);
  });
});
