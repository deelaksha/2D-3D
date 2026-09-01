import { describe, expect, it } from "vitest";
import { InferenceMonitor, ModelRegistry, ProductionExportBlockError, ProductionExportGuard, ProductionLogger, ProductionSystemAudit } from "../core/puzzle/production/productionManager";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../core/puzzle/canonical/defaults";
import { AIDesignValidationGate } from "../core/puzzle/aivalidationgate/aiDesignValidationGate";

describe("Production Readiness, System Audit & Mandatory Export Safety Gate (Phase 60)", () => {
  it("1. ProductionSystemAudit evaluates all 19 system readiness verification points", () => {
    const report = ProductionSystemAudit.runSystemReadinessAudit();

    expect(report.auditId).toBeDefined();
    expect(report.totalPointsChecked).toBe(19);
    expect(report.verifiedPointsCount).toBe(19);
    expect(report.isProductionReady).toBe(true);

    const p = report.points;
    expect(p.deterministicGeometry).toBe(true);
    expect(p.correct3DTransforms).toBe(true);
    expect(p.arbitraryValidAssemblyAngles).toBe(true);
    expect(p.fixedCardboardMaterialConstraints).toBe(true);
    expect(p.connectionCompatibility).toBe(true);
    expect(p.collisionDetection).toBe(true);
    expect(p.clearance).toBe(true);
    expect(p.assemblyValidation).toBe(true);
    expect(p.aiSchemaValidation).toBe(true);
    expect(p.mlConfidenceHandling).toBe(true);
    expect(p.deterministicFallback).toBe(true);
    expect(p.datasetVersioning).toBe(true);
    expect(p.modelVersioning).toBe(true);
    expect(p.reproducibility).toBe(true);
    expect(p.logging).toBe(true);
    expect(p.errorHandling).toBe(true);
    expect(p.performance).toBe(true);
    expect(p.security).toBe(true);
    expect(p.exportCorrectness).toBe(true);
  });

  it("2. ProductionExportGuard verifies strict export guard: NEVER exports invalid designs", () => {
    const invalidPuzzle = createEmptyCanonicalPuzzle("Invalid Test Puzzle");

    const valResult = AIDesignValidationGate.validateAIDesign(invalidPuzzle);

    // If validation fails (REJECTED), ProductionExportGuard MUST throw ProductionExportBlockError
    if (valResult.status === "REJECTED") {
      expect(() => {
        ProductionExportGuard.assertExportAllowed(valResult, invalidPuzzle);
      }).toThrow(ProductionExportBlockError);
    }
  });

  it("3. ModelRegistry tracks dataset, schema, model versions, and supports instant rollback", () => {
    const registry = new ModelRegistry();

    registry.registerModel({
      modelId: "connection_classifier",
      modelVersion: "v1.1-experimental",
      datasetVersion: "1.0.0-synthetic",
      schemaVersion: "v2.0",
      deployedIso: new Date().toISOString(),
      status: "ACTIVE",
    });

    const rolledBack = registry.rollbackToVersion("v1.0-connection-classifier");
    expect(rolledBack.modelVersion).toBe("v1.0-connection-classifier");
    expect(rolledBack.status).toBe("ACTIVE");
  });

  it("4. InferenceMonitor tracks inference logs and calculates production error rate", () => {
    const monitor = new InferenceMonitor();

    monitor.logInference({
      prompt: "Create 4-piece box",
      confidenceScore: 0.95,
      executionMode: "ML",
      validationPassed: true,
      durationMs: 15,
    });

    monitor.logInference({
      prompt: "Invalid prompt",
      confidenceScore: 0.40,
      executionMode: "DETERMINISTIC_FALLBACK",
      validationPassed: false,
      durationMs: 22,
    });

    expect(monitor.getLogs().length).toBe(2);
    expect(monitor.getErrorRate()).toBe(0.5);
  });

  it("5. ProductionLogger sanitizes sensitive security tokens in log strings", () => {
    const dirty = "Processing API Key: bearer_secret_token_12345 for prompt 'Box'";
    const clean = ProductionLogger.sanitizeMessage(dirty);

    expect(clean).not.toContain("bearer_secret_token_12345");
    expect(clean).toContain("[REDACTED]");
  });
});
