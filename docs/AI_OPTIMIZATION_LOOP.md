# Complete AI + Optimization Loop (Phase 75)

## 1. Overview & Full 10-Stage Pipeline

The **Master AI + Optimization Loop Subsystem** unifies all puzzle generation, reasoning, validation, critique, repair, and parametric optimization capabilities into an automated, deterministic master pipeline:

```
                              User Requirement
                                     │
                                     ▼
                            1. AI Planning
                                     │
                                     ▼
                        2. Candidate Generation (N)
                                     │
                                     ▼
                       3. Deterministic Geometry
                                     │
                                     ▼
                           4. Validation Gates (5)
                                     │
                                     ▼
                               5. AI Critique
                                     │
                                     ▼
                            6. Repair Agent
                                     │
                                     ▼
                        7. Parametric Optimization
                                     │
                                     ▼
                           8. Re-Evaluation
                                     │
                                     ▼
                          9. Candidate Ranking
                                     │
                                     ▼
                        10. Best Valid Design
```

---

## 2. Invariants & Optimization Philosophy

> [!IMPORTANT]
> **Strict Parametric Invariant**:
> The optimizer operates **exclusively on approved parametric variables** (`stock_width`, `stock_height`, `clearance`, `bounding_width`, etc.).
> **Never modify raw mesh geometry, vertex loops, or normals**. All geometric realization is delegated deterministically to `DesignSpecificationCompiler`.

> [!IMPORTANT]
> **Hard Constraints Non-Negotiable**:
> Hard physical constraints are strictly non-negotiable and cannot be violated or relaxed to achieve higher soft scores:
> - Minimum piece dimensions $\ge 10.0\text{mm}$.
> - Closed boundary outlines with positive area.
> - Cardboard stock sheet boundaries must contain all pieces ($\text{stock} \ge \text{bounding} + \text{margins}$).
> - Minimum cardboard substrate thickness ($\ge 1.0\text{mm}$).
> - Zero physical penetration in 3D assembly.

> [!TIP]
> **Soft Objectives Are Continuously Optimized**:
> Within the feasible space bounded by hard constraints, soft objectives are optimized:
> - **Material Utilization**: Sheet nesting packing density targeted to $40\% - 65\%$.
> - **Clearance Centering**: Joint clearance centered at $0.15\text{mm}$ (optimal friction-fit for corrugated cardboard).
> - **Aspect Proportions**: Dimensional proportions tuned toward ergonomic desk-top aspect ratios ($1.3 - 1.6$).

---

## 3. Pipeline Stages Telemetry & Data Structures

Every run produces an audit-grade `OptimizationTrace` tracking the entire lifecycle:

```typescript
export interface OptimizationTrace {
  traceId: string;
  requirementPrompt: string;
  stages: OptimizationStageLog[];
  candidateTraces: CandidateTraceLog[];
  totalModificationsApplied: number;
  totalDurationMs: number;
}
```

### Stage Execution Breakdown

| Stage | Operations | Telemetry / Output |
|---|---|---|
| **1. Requirement Parsing** | Extracts design intent, token keywords, and user target preferences. | `OptimizationStageLog` |
| **2. AI Planning** | Establishes piece count budgets, joining angle preferences, and material grades. | Target parameters & constraints |
| **3. Candidate Generation** | Synthesizes $N$ distinct candidates exploring parametric strategies (Balanced, Compact, Interlock, Symmetrical, Minimalist). | $N$ `ParametricDesignSpecification` candidates |
| **4. Geometry Compilation** | Deterministically compiles 2D boundary polygons, interfaces, and 3D extrusions. | $N$ `CanonicalPuzzle` records |
| **5. Deterministic Validation** | Evaluates all 5 gates (Schema, Hard Constraints, 2D Geometry, Connections, 3D Assembly). | $N$ `AIValidationPasses` |
| **6. AI Critique** | Evaluates 8 domains (geometry, connection, assembly, difficulty, material, manufacturability, symmetry, aesthetics). | Granular issues and suggested parameters |
| **7. Repair Stage** | Runs `AIRepairAgent` on flawed candidates using closed feedback iterations. | Repaired specifications and modification logs |
| **8. Parametric Optimization** | Optimizes soft objectives (packing density, clearance centering) on parametric variables. | Optimized specifications and parameter records |
| **9. Re-Evaluation & Ranking** | Re-compiles geometry, re-evaluates all 7 metrics, and strictly ranks candidates (valid always beats invalid). | Ranked candidate list and diversity report |
| **10. Best Valid Design** | Selects top valid candidate with granular score breakdown and selection rationale. | `BestDesign`, `ScoreBreakdown`, `ReasonForSelection` |

---

## 4. Returned Artifacts: BestDesign, ScoreBreakdown & ReasonForSelection

### Score Breakdown Schema
```typescript
export interface ScoreBreakdown {
  compositeScore: number; // [0.0, 100.0]
  validityPassRatio: number; // 1.0 (all 5 gates passed)
  difficultyScore: number;
  materialUtilizationScore: number;
  connectionQualityScore: number;
  assemblyQualityScore: number;
  designSimilarityScore: number;
  manufacturabilityScore: number;
  softObjectiveOptimizations: {
    sheetPackingDensityPct: number;
    clearanceCenteringMm: number;
    aspectRatioBalance: number;
  };
}
```

### Comprehensive Selection Rationale
`ReasonForSelection` provides an explainable multi-factor justification for the winning candidate:
- Validation gate satisfaction.
- Composite score leadership across the candidate ensemble.
- Sheet nesting packing density and cardboard waste minimization.
- Joint clearance optimality for reliable friction fit.
- Prompt requirement alignment.
