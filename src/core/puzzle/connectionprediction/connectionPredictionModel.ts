/**
 * Replaceable Connection Prediction Models & Baseline Providers (Phase 46).
 */
import type { ConnectionPrediction, ConnectionPredictionResult } from "./types";
import type { CanonicalInterface, CanonicalPiece } from "../canonical/types";
import { createCanonicalConnection } from "../canonical/defaults";

export interface ConnectionPredictionModel {
  predictConnections(
    pieces: CanonicalPiece[],
    interfaces: CanonicalInterface[]
  ): Promise<ConnectionPredictionResult>;
}

/**
 * Deterministic Rule-Based Connection Prediction Model (Baseline).
 * Pairs interface ports across pieces, evaluating gender role complementarity (insert + receiver) and profile width bounds.
 */
export class DeterministicRuleBasedConnectionModel implements ConnectionPredictionModel {
  async predictConnections(
    pieces: CanonicalPiece[],
    interfaces: CanonicalInterface[]
  ): Promise<ConnectionPredictionResult> {
    const startTime = Date.now();
    const predictions: ConnectionPrediction[] = [];

    for (let i = 0; i < interfaces.length; i++) {
      for (let j = i + 1; j < interfaces.length; j++) {
        const ifA = interfaces[i];
        const ifB = interfaces[j];

        if (ifA.owningPieceId === ifB.owningPieceId) continue;

        // Gender role check: one insert (male tab) and one receiver (female slot)
        const genderA = ifA.compatibility?.genderRole || "neutral";
        const genderB = ifB.compatibility?.genderRole || "neutral";
        const genderMatch =
          (genderA === "insert" && genderB === "receiver") ||
          (genderA === "receiver" && genderB === "insert");

        // Profile width variance check
        const widthA = ifA.profile?.width || 20.0;
        const widthB = ifB.profile?.width || 20.0;
        const widthDelta = Math.abs(widthA - widthB);
        const widthCompatible = widthDelta <= 1.5;

        const isCompatible = genderMatch && widthCompatible;
        const joiningAngle = 90.0;

        const canonicalConn = isCompatible
          ? createCanonicalConnection(ifA.id, ifB.id, joiningAngle)
          : undefined;

        predictions.push({
          predictionId: `pred_conn_${ifA.id}_${ifB.id}`,
          sourcePieceId: ifA.owningPieceId,
          sourceInterfaceId: ifA.id,
          targetPieceId: ifB.owningPieceId,
          targetInterfaceId: ifB.id,
          compatible: isCompatible,
          connectionType: isCompatible ? "tab_slot" : "none",
          confidenceScore: isCompatible ? 0.95 : 0.05,
          possibleRelativeOrientation: { rxDeg: 0, ryDeg: joiningAngle, rzDeg: 0 },
          allowedAngleRange: {
            minAngleDeg: joiningAngle - 45,
            maxAngleDeg: joiningAngle + 45,
            targetAngleDeg: joiningAngle,
          },
          rotationAxis: { x: 0, y: 1, z: 0 },
          translationConstraints: { freeX: false, freeY: false, freeZ: false },
          source: "rule_based_engine",
          canonicalConnection: canonicalConn,
        });
      }
    }

    return {
      resultId: `res_conn_rule_${Date.now()}`,
      predictions,
      overallConfidence: 0.95,
      processingDurationMs: Date.now() - startTime,
    };
  }
}

/**
 * Mock Graph Neural Network Connection Prediction Model (Replaceable GNN ML Stub).
 */
export class MockGNNConnectionPredictionModel implements ConnectionPredictionModel {
  async predictConnections(
    pieces: CanonicalPiece[],
    interfaces: CanonicalInterface[]
  ): Promise<ConnectionPredictionResult> {
    const startTime = Date.now();
    const ruleModel = new DeterministicRuleBasedConnectionModel();
    const ruleResult = await ruleModel.predictConnections(pieces, interfaces);

    // Simulate ML predictions with confidence scores
    const gnnPredictions = ruleResult.predictions.map((p) => ({
      ...p,
      confidenceScore: p.compatible ? 0.88 : 0.12,
      source: "gnn_ml_model" as const,
    }));

    return {
      resultId: `res_conn_gnn_${Date.now()}`,
      predictions: gnnPredictions,
      overallConfidence: 0.88,
      processingDurationMs: Date.now() - startTime,
    };
  }
}
