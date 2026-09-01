# AI Design Validation Gate Specification (Phase 51)

This document specifies the **AI Design Validation Gate Subsystem** for enforcing a strict safety and validity boundary between AI-generated design proposals and deterministic CAD geometry.

---

## 1. Safety & Validity Boundary Invariant

> [!IMPORTANT]
> **THE AI IS NEVER AUTHORITATIVE**:
> - **Deterministic Geometry Engine is Authoritative**: AI models propose specifications, plans, and parameters. However, final physical validity, non-interpenetration, material feasibility, and assembly sequence compatibility are 100% governed by deterministic CAD solvers.
> - **Strict Export Guard (`assertExportAllowed`)**: If an AI proposal fails any of the 9 validation passes (`status === "REJECTED"`), it is strictly blocked from reaching production export formats (DXF, SVG, STEP, JSON).

---

## 2. All 9 Deterministic Validation Passes

| Pass # | Validation Pass Name | Engine / Evaluator | Rejection Criteria |
| :--- | :--- | :--- | :--- |
| **1** | **Schema Validation** | `DesignSpecification` | Missing required fields, invalid JSON schema |
| **2** | **Parameter Validation** | `DeterministicParameterValidator` | Negative dimensions, tab width $\ge$ piece width |
| **3** | **2D Geometry Validation** | `GeometryExtractor` | Self-intersecting contours, zero piece count |
| **4** | **Connection Validation** | `ConnectionCompatibilityEngine` | Incompatible interface pairings |
| **5** | **3D Geometry Validation** | `GeometricValidation3DEngine` | Non-positive 3D thickness, zero volume |
| **6** | **Collision Detection** | `AssemblyTransformationSystem` | Rigid-body mesh interpenetration, duplicate IDs |
| **7** | **Clearance Validation** | `MaterialConstraintEngine` | Insufficient kerf allowance / clearance |
| **8** | **Material/Cardboard Validation** | `CardboardConstraintRules` | Thickness $< 0.5\text{mm}$ or $> 20.0\text{mm}$ |
| **9** | **Assembly Validation** | `AssemblySequenceSolver` | Impossible physical joining sequence |

---

## 3. Diagnostic Result Schema (`AIDesignValidationResult`)

```typescript
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
```

---

## 4. Programmatic API Usage

```typescript
import { AIDesignValidationGate } from "@/core/puzzle/aivalidationgate";

// 1. Run 9-pass validation gate on proposed canonical puzzle
const result = AIDesignValidationGate.validateAIDesign(canonicalPuzzle);

if (result.status === "ACCEPTED") {
  // 2. Assert export is allowed (throws error if rejected)
  AIDesignValidationGate.assertExportAllowed(result);
  console.log("AI Proposal passed validation gate! Proceeding to DXF/STEP export.");
} else {
  console.error(`AI Proposal BLOCKED: ${result.errors.join(", ")}`);
  console.log(`Suggested Repairs:`, result.suggestedRepairTargets);
}
```
