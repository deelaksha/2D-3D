import { describe, expect, it } from "vitest";
import { DeterministicGeometryInterfaceModel, MockVisionMLInterfaceModel } from "../core/puzzle/interfacerecognition/interfaceRecognitionModel";
import { InterfaceRecognitionEvaluator } from "../core/puzzle/interfacerecognition/interfaceRecognitionEvaluator";
import { createCanonicalInterface, createCanonicalPiece } from "../core/puzzle/canonical/defaults";

describe("Interface Recognition Architecture & Evaluator (Phase 45)", () => {
  const mockPiece = createCanonicalPiece("Test Piece", { width: 100, height: 100, depth: 3.0 }, 3.0);
  mockPiece.id = "p_test_1";

  it("1. DeterministicGeometryInterfaceModel recognizes tab and slot candidate ports", async () => {
    const model = new DeterministicGeometryInterfaceModel();
    const result = await model.recognizeInterfaces(mockPiece);

    expect(result.pieceId).toBe("p_test_1");
    expect(result.predictions.length).toBe(2);

    const tabPred = result.predictions.find((p) => p.kind === "tab");
    expect(tabPred).toBeDefined();
    expect(tabPred?.confidenceScore).toBe(0.96);
    expect(tabPred?.source).toBe("analytical_geometry");
    expect(tabPred?.canonicalInterface).toBeDefined();
    expect(tabPred?.canonicalInterface?.compatibility.genderRole).toBe("insert");

    const slotPred = result.predictions.find((p) => p.kind === "slot");
    expect(slotPred).toBeDefined();
    expect(slotPred?.canonicalInterface?.compatibility.genderRole).toBe("receiver");
  });

  it("2. MockVisionMLInterfaceModel predicts vision ML interface candidate predictions", async () => {
    const model = new MockVisionMLInterfaceModel();
    const result = await model.recognizeInterfaces(mockPiece);

    expect(result.predictions.length).toBe(1);
    expect(result.predictions[0].kind).toBe("tab");
    expect(result.predictions[0].confidenceScore).toBe(0.84);
    expect(result.predictions[0].source).toBe("vision_ml_model");
  });

  it("3. InterfaceRecognitionEvaluator evaluates precision, recall, F1-score, and type accuracy", async () => {
    const model = new DeterministicGeometryInterfaceModel();
    const result = await model.recognizeInterfaces(mockPiece);

    const gtTab = createCanonicalInterface("p_test_1", "Tab Port", { x: 50, y: 0 }, { x: 0, y: -1 });
    gtTab.compatibility.genderRole = "insert";

    const gtSlot = createCanonicalInterface("p_test_1", "Slot Port", { x: 50, y: 100 }, { x: 0, y: 1 });
    gtSlot.compatibility.genderRole = "receiver";

    const evalReport = InterfaceRecognitionEvaluator.evaluate(result, [gtTab, gtSlot]);

    expect(evalReport.precision).toBe(1.0);
    expect(evalReport.recall).toBe(1.0);
    expect(evalReport.f1Score).toBe(1.0);
    expect(evalReport.typeAccuracy).toBe(1.0);
    expect(evalReport.tpCount).toBe(2);
    expect(evalReport.fpCount).toBe(0);
    expect(evalReport.fnCount).toBe(0);
  });

  it("4. verifies all candidate predictions map strictly to CanonicalInterface objects without direct 3D geometry", async () => {
    const model = new DeterministicGeometryInterfaceModel();
    const result = await model.recognizeInterfaces(mockPiece);

    result.predictions.forEach((pred) => {
      expect(pred.canonicalInterface).toBeDefined();
      expect(pred.canonicalInterface?.owningPieceId).toBe("p_test_1");
      expect(pred.canonicalInterface?.localFrame).toBeDefined();
    });
  });
});
