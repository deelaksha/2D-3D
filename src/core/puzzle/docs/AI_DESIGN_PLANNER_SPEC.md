# AI Design Planner Specification (Phase 49)

This document specifies the **AI Design Planner Subsystem** for converting user requirements, optional drawing inputs, and optional retrieved reference designs (`RetrievedDesign[]`) into a structured high-level `DesignPlan`.

---

## 1. Architectural Mandate & Non-Geometry Invariant

> [!IMPORTANT]
> **ZERO MESH GEOMETRY GENERATION**:
> - **Structured Plan Output Only**: The AI Planner emits a high-level, structured **DesignPlan**, **never direct STL/STEP files or raw mesh vertices**.
> - **Reference Guidance Invariant**: Retrieved reference designs inform piece strategies and joint choices without copying reference geometry.
> - **Convertible to Specification**: Every `DesignPlan` is deterministically convertible into a canonical `DesignSpecification` (`convertPlanToSpecification(plan)`).
> - **Zero Model Training**: Implements the planner architecture, mock provider, and conversion engine; zero model training is performed in this phase.

---

## 2. Design Plan Data Schema (`DesignPlan`)

```typescript
export interface DesignPlan {
  planId: string;
  intent: {
    goalSummary: string;
    targetCategory: "puzzle" | "furniture" | "box" | "model" | "custom";
    difficulty: "easy" | "medium" | "hard";
    symmetry: "none" | "bilateral" | "radial";
  };
  pieceStrategy: {
    targetPieceCount: number;
    geometryComplexity: "simple" | "medium" | "complex";
    layerCount: number;
    outerBoundaryStrategy: string;
  };
  connectionStrategy: {
    primaryConnectionType: "tab_slot" | "finger_joint" | "interlock" | "flat_contact";
    connectionDensity: "sparse" | "moderate" | "dense";
    jointClearanceMm: number;
  };
  materialStrategy: {
    materialId: string;
    thicknessMm: number;
    allowableKerfMm: number;
    manufacturingConstraints: string[];
  };
  assemblyStrategy: {
    assemblyType: "rigid" | "articulated" | "multi_angle";
    allowedJoiningAnglesDeg: number[];
    sequencePlanningRequired: boolean;
  };
  constraintStrategy: {
    mandatoryPieceCount?: number;
    maxFootprintMm: { widthMm: number; heightMm: number };
    nonNegotiableRules: string[];
  };
  createdIso: string;
}
```

---

## 3. Programmatic API Usage

```typescript
import { MockDesignPlanner, convertPlanToSpecification } from "@/core/puzzle/designplanner";

// 1. Create high-level design plan
const planner = new MockDesignPlanner();
const plan = await planner.createDesignPlan({
  userRequirement: "Create a 6-piece cardboard box using 3mm stock.",
});

// 2. Convert to canonical DesignSpecification
const spec = convertPlanToSpecification(plan);

console.log(`Plan ID: ${plan.planId}, Target Pieces: ${plan.pieceStrategy.targetPieceCount}`);
console.log(`Spec ID: ${spec.specId}, Valid Schema: ${spec.isValidSchema}`);
```
