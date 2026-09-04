# Multi-Candidate AI Design Generation & Diversity Ranking (Phase 74)

## 1. Overview & Core Architecture

The **Multi-Candidate AI Design Generation Subsystem** upgrades puzzle design generation from single-output synthesis to generating $N$ candidate designs for a single prompt or requirement.

### Key Objectives:
1. **Multi-Candidate Generation**: Generates $N$ distinct design candidates ($N \ge 1$, configurable) covering diverse design strategies.
2. **Independent Deterministic Compilation & 5-Gate Validation**: Each candidate undergoes separate, independent compilation into `CanonicalPuzzle` geometry and validation across the 5 deterministic gates (Schema, Hard Constraints, 2D Geometry, Connections, 3D Assembly).
3. **7 Formal Evaluation Metrics**: Calculates validity, difficulty, material utilization, connection quality, assembly quality, design similarity, and manufacturability for every candidate.
4. **Strict Invariant Ranking**: **An invalid candidate will NEVER rank above any valid candidate**. Valid candidates are prioritized and ordered by multi-criteria composite score; invalid candidates are partitioned strictly below all valid candidates.
5. **Ensemble Diversity Measurement**: Evaluates pairwise parametric distances across piece count, aspect ratio, volume, joint style, joining angle, stock layout, and symmetry, detecting duplicate or near-identical designs.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Multi-Candidate Generation Workflow                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
                                          CandidateGenerationRequest
                                          • Prompt: "Desk organizer..."
                                          • Candidate Count N (e.g. 4)
                                          • Preferences / References
                                                     │
                                                     ▼
                               ┌───────────────────────────────────────────┐
                               │ MultiCandidateGenerator                   │
                               │ - Strategy 0: Balanced Baseline           │
                               │ - Strategy 1: Compact High-Efficiency     │
                               │ - Strategy 2: Structural Interlock        │
                               │ - Strategy 3: Bilateral Symmetrical       │
                               │ - Strategy 4: Minimalist Sturdy           │
                               └─────────────────────┬─────────────────────┘
                                                     │
                                                     ▼
                              Independent Geometry Compilation & Validation
                                                     │
                  ┌──────────────────────────────────┼──────────────────────────────────┐
                  ▼                                  ▼                                  ▼
             Candidate 1                        Candidate 2                        Candidate N
        Compile & 5-Gate Pass               Compile & 5-Gate Pass              Compile & 5-Gate Pass
                  │                                  │                                  │
                  ▼                                  ▼                                  ▼
        7-Metric Evaluation                7-Metric Evaluation                7-Metric Evaluation
                  │                                  │                                  │
                  └──────────────────────────────────┼──────────────────────────────────┘
                                                     │
                                                     ▼
                                     Ensemble Diversity Measurement
                                     • Pairwise distance matrix: D(Ci, Cj)
                                     • Ensemble diversity score [0.0, 1.0]
                                     • Duplicate detection & diversity flag
                                                     │
                                                     ▼
                                        Strict Invariant Ranking
                             ┌───────────────────────────────────────────────┐
                             │ Tier 1: VALID CANDIDATES (Rank 1 .. K)        │
                             │   - Ranked by composite score descending      │
                             ├───────────────────────────────────────────────┤
                             │ Tier 2: INVALID CANDIDATES (Rank K+1 .. N)    │
                             │   - Ranked by gate pass count descending      │
                             └───────────────────────┬───────────────────────┘
                                                     │
                                                     ▼
                                       MultiCandidateGenerationResult
```

---

## 2. The 7 Candidate Evaluation Metrics

Every candidate $C_i$ is evaluated deterministically across 7 distinct physical, engineering, and user-alignment dimensions:

| Metric | Domain / Computation | Output / Range |
|---|---|---|
| **1. Validity** | 5-Gate Deterministic Validation (`DesignValidationPipeline`) | `isValid: boolean`, `passes: AIValidationPasses`, `gatePassRatio: [0.0, 1.0]`, errors & warnings |
| **2. Difficulty** | Cognitive load & feature breakdown from Phase 69 model (`DeterministicDifficultyModel`) | `score: [0.0, 100.0]`, `level: 'easy' \| 'medium' \| 'hard' \| 'expert'`, feature breakdown |
| **3. Material Utilization** | Sheet nesting packing density ($\sum A_{\text{piece}} / A_{\text{stock}} \times 100$) | `score: [0.0, 100.0]`, `sheetPackingDensityPct`, piece area vs sheet area in $\text{mm}^2$ |
| **4. Connection Quality** | Joint clearance tolerances, tab-slot proportions, friction-fit rating | `score: [0.0, 100.0]`, `clearanceMm`, `fitRating: 'OPTIMAL' \| 'ACCEPTABLE' \| 'TIGHT' \| 'LOOSE' \| 'INVALID'` |
| **5. Assembly Quality** | Feasibility, assembly sequence steps, degree-of-freedom stability | `score: [0.0, 100.0]`, `feasibilityPassed: boolean`, `sequenceSteps`, `stabilityRating: 'HIGH' \| 'MODERATE' \| 'LOW'` |
| **6. Design Similarity** | Alignment with user target piece count, dimensions, and material | `score: [0.0, 100.0]`, `requirementAlignmentScore`, matching features & deviations |
| **7. Manufacturability** | Laser kerf margins, minimum bridge widths ($\ge 3.0\text{mm}$), stock thickness gauge | `score: [0.0, 100.0]`, `laserKerfSafe: boolean`, `minBridgeWidthMm`, `cutSuitabilityRating` |

### Multi-Criteria Composite Score

The composite score summarizes the 6 quality metrics using normalized weights:

$$\text{CompositeScore} = \frac{\sum_{m \in M} w_m \times S_m}{\sum_{m \in M} w_m} \in [0.0, 100.0]$$

Default weight configuration:
- Difficulty: $0.15$
- Material Utilization: $0.15$
- Connection Quality: $0.20$
- Assembly Quality: $0.20$
- Design Similarity: $0.15$
- Manufacturability: $0.15$

---

## 3. Strict Ranking Invariant: Valid ALWAYS Beats Invalid

> [!IMPORTANT]
> **Strict Validity Priority Invariant**:
> $$\forall c_{\text{valid}} \in \text{Candidates}_{\text{valid}}, \forall c_{\text{invalid}} \in \text{Candidates}_{\text{invalid}}: \text{Rank}(c_{\text{valid}}) < \text{Rank}(c_{\text{invalid}})$$
>
> An invalid candidate that fails physical validation (e.g. geometric penetration, open loops, or non-positive boundaries) can **never** be ranked higher than any valid candidate, regardless of its raw aesthetic or difficulty score.

### Ranking Algorithm (`CandidateRanker`)

```typescript
candidates.sort((a, b) => {
  const aValid = a.metrics.validity.isValid;
  const bValid = b.metrics.validity.isValid;

  // 1. Strict Validity Invariant: valid candidate always precedes invalid
  if (aValid && !bValid) return -1;
  if (!aValid && bValid) return 1;

  // 2. Both Valid Tier: rank by composite quality score descending
  if (aValid && bValid) {
    if (b.metrics.compositeScore !== a.metrics.compositeScore) {
      return b.metrics.compositeScore - a.metrics.compositeScore;
    }
    return b.metrics.assemblyQuality.score - a.metrics.assemblyQuality.score;
  }

  // 3. Both Invalid Tier: rank by number of passed validation gates descending
  if (b.metrics.validity.gatePassCount !== a.metrics.validity.gatePassCount) {
    return b.metrics.validity.gatePassCount - a.metrics.validity.gatePassCount;
  }
  return b.metrics.compositeScore - a.metrics.compositeScore;
});
```

---

## 4. Ensemble Diversity Engine

To ensure generated candidates are genuinely distinct and explore different regions of the parametric solution space, `EnsembleDiversityEngine` evaluates pairwise dissimilarity:

$$D(C_i, C_j) = w_N \cdot d_N + w_{AR} \cdot d_{AR} + w_V \cdot d_V + w_J \cdot d_J + w_S \cdot d_S + w_{\text{sym}} \cdot d_{\text{sym}} \in [0.0, 1.0]$$

Where:
- $d_N$: Normalized piece count difference.
- $d_{AR}$: Aspect ratio difference ($W/H$).
- $d_V$: Bounding volume scale difference ($W \times H \times D$).
- $d_J$: Joint style match (0.0 if same, 0.6 if different) and joining angle delta ($|\theta_i - \theta_j| / 180^\circ$).
- $d_S$: Stock nesting area difference.
- $d_{\text{sym}}$: Bilateral symmetry disparity.

### Overall Ensemble Diversity Score:
$$\text{EnsembleDiversityScore} = \frac{1}{\binom{N}{2}} \sum_{i < j} D(C_i, C_j)$$

If any pair has $D(C_i, C_j) < 0.03$, it is flagged as a duplicate design, and `isSufficientlyDiverse` is marked `false`.
