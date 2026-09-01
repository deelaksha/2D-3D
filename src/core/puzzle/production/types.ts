/**
 * Production System Architecture & Readiness Types (Phase 60).
 */

export interface ModelRegistryMetadata {
  modelId: string;
  modelVersion: string;
  datasetVersion: string;
  schemaVersion: string;
  deployedIso: string;
  rollbackVersion?: string;
  status: "ACTIVE" | "DEPRECATED" | "ROLLED_BACK";
}

export interface ProductionConfig {
  environment: "production" | "staging" | "development";
  strictExportGuard: boolean;        // STRICT INVARIANT: Never export invalid designs
  maxRepairIterations: number;      // Default 5
  loggingLevel: "info" | "debug" | "error" | "warn";
  securitySanitization: boolean;
  modelRegistry: {
    activeModelVersion: string;
    datasetVersion: string;
    schemaVersion: string;
  };
  monitoringEnabled: boolean;
}

export interface InferenceMonitoringLog {
  inferenceId: string;
  timestampIso: string;
  prompt: string;
  confidenceScore: number;
  executionMode: "ML" | "DETERMINISTIC_FALLBACK" | "HUMAN_REVIEW";
  validationPassed: boolean;
  durationMs: number;
  errorDetails?: string;
}

export interface SystemReadinessAuditReport {
  auditId: string;
  timestampIso: string;
  verifiedPointsCount: number;
  totalPointsChecked: number;
  points: {
    deterministicGeometry: boolean;
    correct3DTransforms: boolean;
    arbitraryValidAssemblyAngles: boolean;
    fixedCardboardMaterialConstraints: boolean;
    connectionCompatibility: boolean;
    collisionDetection: boolean;
    clearance: boolean;
    assemblyValidation: boolean;
    aiSchemaValidation: boolean;
    mlConfidenceHandling: boolean;
    deterministicFallback: boolean;
    datasetVersioning: boolean;
    modelVersioning: boolean;
    reproducibility: boolean;
    logging: boolean;
    errorHandling: boolean;
    performance: boolean;
    security: boolean;
    exportCorrectness: boolean;
  };
  isProductionReady: boolean;
}
