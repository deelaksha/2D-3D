# AI-Assisted Repair Agent Subsystem (Phase 73)

## 1. Overview & Closed-Loop Architecture

The **AI-Assisted Repair Agent** upgrades previous ad-hoc or open-loop repair mechanisms into a formal, deterministic, closed-loop feedback pipeline:

$$\text{Generate} \longrightarrow \text{Validate} \longrightarrow \text{Critique} \longrightarrow \text{Identify Problem} \longrightarrow \text{Select Parameter} \longrightarrow \text{Propose Modification} \longrightarrow \text{Regenerate} \longrightarrow \text{Validate} \longrightarrow \text{Critique Again}$$

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               AIRepairAgent Execution Flow                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
                                ┌───────────────────────┐
                                │ Initial Specification │
                                └──────────┬────────────┘
                                           │
                                           ▼
                                ┌───────────────────────┐
                                │ Compile & Validate    │
                                └──────────┬────────────┘
                                           │
                                           ▼
                                ┌───────────────────────┐
                                │ Design Critic Review  │
                                └──────────┬────────────┘
                                           │
                ┌──────────────────────────┴──────────────────────────┐
                │                                                     │
       PASS / No Issues                                          Has Issues
                │                                                     │
                ▼                                                     ▼
     ┌──────────────────────┐                             ┌───────────────────────┐
     │ CONVERGED_PASS       │                             │ Loop: Iteration 1..N  │
     │ (Zero Repairs Req.)  │                             └──────────┬────────────┘
     └──────────────────────┘                                        │
                                                                     ▼
                                                          ┌───────────────────────┐
                                                          │ Identify & Rank       │
                                                          │ Issues by Severity    │
                                                          └──────────┬────────────┘
                                                                     │
                                                                     ▼
                                                          ┌───────────────────────┐
                                                          │ Select Whitelisted    │
                                                          │ Approved Parameter    │
                                                          └──────────┬────────────┘
                                                                     │
                                                                     ▼
                                                          ┌───────────────────────┐
                                                          │ Apply Modification    │
                                                          │ (No Mesh Vertices)    │
                                                          └──────────┬────────────┘
                                                                     │
                                                                     ▼
                                                          ┌───────────────────────┐
                                                          │ Regenerate via        │
                                                          │ Geometry Compiler     │
                                                          └──────────┬────────────┘
                                                                     │
                                                                     ▼
                                                          ┌───────────────────────┐
                                                          │ Re-Validate Pipeline  │
                                                          └──────────┬────────────┘
                                                                     │
                                                                     ▼
                                                          ┌───────────────────────┐
                                                          │ Re-Critique           │
                                                          └──────────┬────────────┘
                                                                     │
                                         ┌───────────────────────────┴──────────────────────────┐
                                         │                                                      │
                                   CONVERGED_PASS                                        Check Guards:
                              (All Pass / No Hard Fail)                                  - Max iterations?
                                         │                                               - Max parameter changes?
                                         ▼                                               - Cycle / loop detected?
                                   [Session End]                                         - Min improvement threshold?
                                                                                                │
                                                                                                ▼
                                                                                         Next Iteration / Exit
```

---

## 2. Invariants & Strict Parameter Whitelisting

> [!IMPORTANT]
> **No Arbitrary Mesh / CAD Geometry Mutation**:
> The repair agent operates exclusively at the **parametric specification layer**. It is strictly forbidden from directly moving raw CAD vertices, triangulating arbitrary STL loops, or editing boundary coordinates in memory. All geometric realization is delegated deterministically to `DesignSpecificationCompiler`.

### Approved Parametric Variables Whitelist

Only variables registered in the approved whitelist (`APPROVED_PARAMETRIC_VARIABLES`) can be targeted for modification:

| Variable | Approved Domain / Purpose | Physical Bounds |
|---|---|---|
| `tab_width` | Joint tab width on interlocking interfaces | $3.0\text{mm} \le w \le 50.0\text{mm}$ |
| `slot_width` | Joint mating slot width | $3.0\text{mm} \le w \le 50.0\text{mm}$ |
| `clearance` | Joint clearance for friction/sliding fit | $0.05\text{mm} \le c \le 0.60\text{mm}$ |
| `interface_position` | Offset/coordinate of interface along piece boundary | Normalized $[0.0, 1.0]$ or bounded offset |
| `angle_range` | Allowable continuous/discrete joining angles | $0.0^\circ \le \theta \le 180.0^\circ$ |
| `piece_dimension` | Width, height, or depth of individual piece or puzzle | $10.0\text{mm} \le d \le 1000.0\text{mm}$ |
| `connection_density` | Number of interface ports per piece edge | Normalized / discrete count |
| `stock_dimension` | Cardboard raw sheet width/height for nesting | $100.0\text{mm} \le s \le 2000.0\text{mm}$ |

Attempts to modify non-whitelisted attributes (e.g. `raw_mesh_vertices`, `triangle_normals`, `arbitrary_points`) are immediately rejected by `ParametricParameterWhitelister.validateProposal()`.

---

## 3. Convergence & Guard Conditions

To guarantee termination and prevent infinite loops, thrashing, or regressions, the repair agent enforces four strict guard conditions:

1. **Maximum Iterations (`maxIterations`)**:
   - Default: `5` iterations (configurable).
   - If exceeded without achieving convergence, returns `MAX_ITERATIONS_REACHED`.

2. **Maximum Parameter Changes (`maxParameterChanges`)**:
   - Cumulative budget for parameter modifications across the entire session.
   - Prevents cascading drift from the original user design requirement.

3. **Minimum Improvement Threshold (`minImprovementThreshold`)**:
   - Default: `1.0` point composite quality score gain.
   - If an iteration fails to produce the minimum improvement and does not reduce hard failures, the agent halts with `MIN_IMPROVEMENT_NOT_MET` to avoid plateau cycling.

4. **Loop & Cycle Prevention (State Hashing)**:
   - Each specification iteration is fingerprinted with an MD5 hash over normalized parameters:
     $$\text{hash} = \text{MD5}(\text{piece\_count} \parallel \text{dimensions} \parallel \text{stock} \parallel \text{clearance} \parallel \text{constraints})$$
   - If the agent proposes a state that matches a previously visited state hash, it detects an oscillatory loop and terminates immediately with `CYCLE_DETECTED`.

---

## 4. Full Repair History Telemetry

Every repair session outputs a comprehensive `RepairSessionResult` containing an immutable audit log for every iteration (`RepairIterationLog`):

```typescript
export interface RepairIterationLog {
  iterationNumber: number;
  identifiedProblems: CritiqueIssue[];
  selectedParameters: ApprovedParametricVariable[];
  proposedModifications: ParametricModificationProposal[];
  appliedModifications: ParametricModificationProposal[];
  regeneratedSpecification: ParametricDesignSpecification;
  validationPasses: AIValidationPasses;
  critique: DesignCritique;
  qualityScoreBefore: number;
  qualityScoreAfter: number;
  scoreImprovement: number;
  stateHash: string;
  durationMs: number;
}
```

This telemetry enables downstream analytics, automated regression tracking, and human review of repair quality.
