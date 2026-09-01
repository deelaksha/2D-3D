import { describe, expect, it } from "vitest";
import { DeterministicRuleBasedConnectionModel, MockGNNConnectionPredictionModel } from "../core/puzzle/connectionprediction/connectionPredictionModel";
import { ConnectionEvaluator } from "../core/puzzle/connectionprediction/connectionEvaluator";
import { createCanonicalConnection, createCanonicalInterface, createCanonicalPiece } from "../core/puzzle/canonical/defaults";

describe("Connection Prediction Architecture & Evaluator (Phase 46)", () => {
  const pieceA = createCanonicalPiece("Piece A", { width: 100, height: 100, depth: 3.0 }, 3.0);
  pieceA.id = "p_A";

  const pieceB = createCanonicalPiece("Piece B", { width: 100, height: 100, depth: 3.0 }, 3.0);
  pieceB.id = "p_B";

  const ifA = createCanonicalInterface("p_A", "Tab Port A", { x: 50, y: 0 }, { x: 0, y: -1 });
  ifA.id = "if_A";
  ifA.compatibility.genderRole = "insert";
  ifA.profile.width = 20.0;

  const ifB = createCanonicalInterface("p_B", "Slot Port B", { x: 50, y: 100 }, { x: 0, y: 1 });
  ifB.id = "if_B";
  ifB.compatibility.genderRole = "receiver";
  ifB.profile.width = 20.0;

  it("1. DeterministicRuleBasedConnectionModel predicts compatible for matching tab and slot pair", async () => {
    const model = new DeterministicRuleBasedConnectionModel();
    const result = await model.predictConnections([pieceA, pieceB], [ifA, ifB]);

    expect(result.predictions.length).toBe(1);
    const pred = result.predictions[0];

    expect(pred.compatible).toBe(true);
    expect(pred.connectionType).toBe("tab_slot");
    expect(pred.confidenceScore).toBe(0.95);
    expect(pred.allowedAngleRange.targetAngleDeg).toBe(90.0);
    expect(pred.rotationAxis).toEqual({ x: 0, y: 1, z: 0 });
    expect(pred.translationConstraints).toEqual({ freeX: false, freeY: false, freeZ: false });
  });

  it("2. rejects incompatible tab-tab pairing (compatible: false)", async () => {
    const ifBTab = createCanonicalInterface("p_B", "Tab Port B", { x: 50, y: 100 }, { x: 0, y: 1 });
    ifBTab.id = "if_B_tab";
    ifBTab.compatibility.genderRole = "insert"; // Tab + Tab conflict

    const model = new DeterministicRuleBasedConnectionModel();
    const result = await model.predictConnections([pieceA, pieceB], [ifA, ifBTab]);

    expect(result.predictions.length).toBe(1);
    expect(result.predictions[0].compatible).toBe(false);
    expect(result.predictions[0].connectionType).toBe("none");
  });

  it("3. MockGNNConnectionPredictionModel predicts GNN connection candidates", async () => {
    const model = new MockGNNConnectionPredictionModel();
    const result = await model.predictConnections([pieceA, pieceB], [ifA, ifB]);

    expect(result.predictions.length).toBe(1);
    expect(result.predictions[0].confidenceScore).toBe(0.88);
    expect(result.predictions[0].source).toBe("gnn_ml_model");
  });

  it("4. ConnectionEvaluator evaluates precision, recall, F1, FPR, and FNR", async () => {
    const model = new DeterministicRuleBasedConnectionModel();
    const result = await model.predictConnections([pieceA, pieceB], [ifA, ifB]);

    const gtConn = createCanonicalConnection("if_A", "if_B", 90.0);

    const evalReport = ConnectionEvaluator.evaluate(result, [gtConn]);

    expect(evalReport.precision).toBe(1.0);
    expect(evalReport.recall).toBe(1.0);
    expect(evalReport.f1Score).toBe(1.0);
    expect(evalReport.falsePositiveRate).toBe(0.0);
    expect(evalReport.falseNegativeRate).toBe(0.0);
    expect(evalReport.tpCount).toBe(1);
  });

  it("5. verifies model predicts physical joint properties without assigning arbitrary customer assembly 3D orientations", async () => {
    const model = new DeterministicRuleBasedConnectionModel();
    const result = await model.predictConnections([pieceA, pieceB], [ifA, ifB]);

    const pred = result.predictions[0];
    expect(pred.allowedAngleRange).toBeDefined();
    expect(pred.rotationAxis).toBeDefined();
    expect(pred.translationConstraints).toBeDefined();
    // Verify no world transform positions are hallucinated
    expect((pred as unknown as Record<string, unknown>).worldPosition).toBeUndefined();
  });
});
