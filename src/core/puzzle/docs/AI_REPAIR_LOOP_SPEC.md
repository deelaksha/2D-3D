# AI-Assisted Design Repair Loop Specification (Phase 52)

This document specifies the **AI-Assisted Design Repair Loop Subsystem** for closed-loop, automated parametric CAD repair.

---

## 1. Architectural Mandate & Parametric Mutation Invariant

> [!IMPORTANT]
> **PARAMETRIC MUTATIONS ONLY**:
> - **Modify Parametric Variables Only**: The repair system modifies **PARAMETRIC VARIABLES ONLY** (`thickness`, `slot_width`, `tab_width`, `clearance`, `outerBoundary`). **It must NOT arbitrarily edit raw mesh vertices**.
> - **Structured Repair Proposals**: Every repair proposal must detail `parameter`, `oldValue`, `newValue`, `reason`, `affectedGeometry`, and `expectedImprovement`.
> - **Infinite Loop Prevention**: Executes up to a configurable `maxIterations` limit (default 5 iterations). Halts with `status: "MAX_ITERATIONS_EXCEEDED"` if unrepairable.
> - **Zero Model Training**: Implements the repair planner, executor, and loop coordinator; zero model training is performed.

---

## 2. Subsystem Flow

```
AI Proposal -> AIDesignValidationGate -> ValidationReport -> RepairPlanner -> RepairProposal[] -> RepairExecutor (Mutates Spec Params) -> Geometry Regeneration -> Re-Validation
```

---

## 3. Repair Proposal Schema (`RepairProposal`)

```typescript
export interface RepairProposal {
  proposalId: string;
  parameter: string; // e.g. "thickness", "slot_width", "tab_width", "clearance", "outerBoundary"
  oldValue: number;
  newValue: number;
  reason: string;
  affectedGeometry: string;
  expectedImprovement: string;
}
```

---

## 4. Programmatic API Usage

```typescript
import { AIRepairLoopEngine } from "@/core/puzzle/airepair";

// 1. Instantiate closed repair loop engine (max 5 iterations)
const engine = new AIRepairLoopEngine(undefined, 5);

// 2. Repair invalid AI-generated design proposal
const result = await engine.repairDesign(rejectedPuzzle, invalidSpec);

if (result.status === "REPAIRED") {
  console.log(`Design successfully repaired in ${result.iterations.length} iteration(s)!`);
  console.log(`Repaired Thickness: ${result.repairedSpecification?.materialParameters.thicknessMm}mm`);
} else {
  console.error(`Repair failed with status: ${result.status}`);
}
```
