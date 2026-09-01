# AI Pipeline Integration Specification (Phase 50)

This document specifies the **Master AI Pipeline Integration Subsystem & Rejection Diagnostics Engine** connecting the AI Requirement Parser and AI Design Planner to the authoritative canonical Parametric IR and deterministic validation engines.

---

## 1. 7-Stage Master Pipeline Architecture

```
User Requirement -> AI Requirement Parser -> Design Planner -> Parametric Design Specification -> Schema Validation -> Constraint Validation -> Geometry Engine
```

---

## 2. Core Architectural Invariant: Authoritative Validation

> [!IMPORTANT]
> **THE AI IS NOT AUTHORITATIVE**:
> - **Canonical Representation & Deterministic Validation Are Authoritative**: The AI model proposes structured specifications and design plans, but the deterministic schema and dataset quality validators retain total authority over CAD geometry instantiation.
> - **Strict Rejection Criteria**:
>   - Invalid piece counts ($N \le 0$ or $N > 100$)
>   - Invalid outer footprint dimensions ($W \le 0, H \le 0$)
>   - Invalid material specifications ($T < 0.5\text{mm}$ or $T > 20.0\text{mm}$)
>   - Invalid joining angle ranges (outside $[0^\circ, 360^\circ]$)
>   - Impossible geometric constraints
> - **Rejection Diagnostics for AI Feedback**: Provides detailed feedback (`RejectionDiagnosticItem`) explaining exact failure reasons and `suggestedFixForAI` recommendations.

---

## 3. Rejection Diagnostic Schema (`RejectionDiagnosticItem`)

```typescript
export interface RejectionDiagnosticItem {
  code: string;
  message: string;
  suggestedFixForAI: string;
  severity: "error" | "warning";
}
```

---

## 4. Programmatic API Usage

```typescript
import { AIPipelineEngine } from "@/core/puzzle/aipipeline";

const engine = new AIPipelineEngine();
const result = await engine.executePipeline({
  userRequirement: "Build a 4-piece cardboard chair using 3 mm cardboard.",
});

if (result.status === "SUCCESS") {
  console.log(`Canonical Puzzle Created: ${result.canonicalPuzzle?.metadata.id}`);
  console.log(`Pieces: ${result.canonicalPuzzle?.pieces.length}`);
} else {
  console.error(`Pipeline Rejected AI Proposal:`);
  result.rejectionDiagnostics.forEach((diag) => {
    console.error(`- [${diag.code}] ${diag.message} (Suggested Fix: ${diag.suggestedFixForAI})`);
  });
}
```
