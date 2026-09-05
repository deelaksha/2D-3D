/**
 * Autonomous Generator to Repair System (Phase 91).
 */

export {
  AutonomousRepairEngine,
  repairAutonomousAssembly,
} from "./autonomousRepairEngine";
export { ParameterFaultLocalizer } from "./parameterFaultLocalizer";
export { LocalGeometryRegenerator } from "./localGeometryRegenerator";
export type {
  ParameterModification,
  RepairAttempt,
  RepairHistory,
  AutonomousRepairConfig,
  FinalRepairStatus,
} from "./types";
