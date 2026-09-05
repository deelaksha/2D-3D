/**
 * Connector & Assembly Validation Subsystem (Phase 90).
 */

export { AssemblyValidationPass, validateConnectorAndAssembly } from "./assemblyValidationPass";
export { ConnectionValidator } from "./connectionValidator";
export { AssemblyLevelValidator } from "./assemblyLevelValidator";
export type {
  ValidationFailureItem,
  ConnectionValidationDetail,
  PieceValidationDetail,
  AssemblyValidationOptions,
  AssemblyValidationInput,
  AssemblyValidationReport,
} from "./types";
