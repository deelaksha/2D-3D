# AI Requirement Specification Contract (Phase 41)

This document specifies the **AI Requirement Parsing & Structured Design Specification Contract** for translating natural language user prompts into validated `DesignSpecification` configurations.

---

## 1. Architectural Invariants & Contract Mandate

> [!IMPORTANT]
> **ZERO DIRECT GEOMETRY GENERATION & NO Hallucinated DIMENSIONS**:
> - **Zero Direct Geometry Generation**: The AI layer emits structured parameter specifications (`DesignSpecification`). It **never** directly generates 2D boundary polylines, 3D mesh vertices, or raw geometric coordinates.
> - **Missing Information Protocol**: The AI parser **must not silently invent critical dimensions**. If a user prompt lacks required dimensions (e.g. *"Make a large puzzle"*), the system returns an explicit `missingInformation` requirement (`fieldName: "outerBoundary"`) asking the user for clarification.
> - **Deterministic Schema Validation**: Every generated `DesignSpecification` must pass deterministic schema validation before downstream CAD instantiation.

---

## 2. Specification Data Model (`DesignSpecification`)

The specification cleanly separates intent, parameters, constraints, and missing information:

```typescript
export interface DesignSpecification {
  specId: string;
  userIntent: {
    rawPrompt: string;               // Original natural language prompt
    summary: string;                 // Extracted user intent summary
    category: "puzzle" | "furniture" | "box" | "model" | "custom";
    primaryGoal: string;
  };
  designParameters: {
    outerBoundary: {                 // Outer footprint dimensions (mm)
      widthMm?: number;
      heightMm?: number;
      depthMm?: number;
    };
    pieceCount?: number;             // Target piece count
    innerPieceComplexity?: "simple" | "medium" | "complex";
    connectionStyle?: "simple" | "complex" | "finger_joint" | "tab_slot";
  };
  assemblyParameters: {
    allowedAssemblyAnglesDeg?: number[]; // e.g. [0, 45, 90, 135, 180]
    assemblyType?: "rigid" | "articulated" | "multi_angle";
  };
  materialParameters: {
    materialId: string;
    thicknessMm: number;             // Stock cardboard thickness (mm)
    allowableKerfMm: number;         // Laser/CNC cutter kerf offset (mm)
    densityGramsPerCm3: number;
  };
  hardConstraints: HardConstraints;  // Strict non-negotiable rules
  softPreferences: SoftPreferences;  // Optional user preferences
  missingInformation: MissingInformationField[]; // Critical missing fields
  isValidSchema: boolean;
  schemaValidationErrors: string[];
}
```

---

## 3. Programmatic API Usage

To parse a natural language user prompt into a structured design specification:

```typescript
import { RequirementParser } from "@/core/puzzle/ai";

const parser = new RequirementParser();

// 1. Parse prompt
const spec = await parser.parseRequirement("Create a 30-piece puzzle using 3 mm cardboard.");

if (spec.missingInformation.length > 0) {
  console.warn("Missing Critical Information:", spec.missingInformation);
} else {
  console.log("Structured Design Specification:", spec);
  console.log(`Piece Count: ${spec.designParameters.pieceCount}, Thickness: ${spec.materialParameters.thicknessMm}mm`);
}
```
