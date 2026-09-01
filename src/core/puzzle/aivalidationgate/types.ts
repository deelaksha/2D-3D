/**
 * AI Design Validation Gate Types & Models (Phase 51).
 */

export interface SuggestedRepairTarget {
  targetType: "piece" | "interface" | "parameter" | "material";
  targetId: string;
  suggestedFix: string;
}

export interface ValidationPassSummary {
  schemaValidation: boolean;
  parameterValidation: boolean;
  geometry2DValidation: boolean;
  connectionValidation: boolean;
  geometry3DValidation: boolean;
  collisionDetection: boolean;
  clearanceValidation: boolean;
  materialCardboardValidation: boolean;
  assemblyValidation: boolean;
}

export interface AIDesignValidationResult {
  gateId: string;
  status: "ACCEPTED" | "REJECTED";
  errors: string[];
  warnings: string[];
  violatedConstraints: string[];
  affectedPieces: string[];
  affectedInterfaces: string[];
  suggestedRepairTargets: SuggestedRepairTarget[];
  validationPasses: ValidationPassSummary;
  processingDurationMs: number;
}
