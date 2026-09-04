# Preference Learning Infrastructure (Phase 76)

## 1. Overview & Architectural Role

The **Preference Learning Infrastructure Subsystem** provides a formal framework for collecting, validating, curating, and analyzing structured human and customer feedback on generated 2D-to-3D puzzle designs.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Preference Learning Lifecycle                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

          Generated Puzzle Design
          • design_id
          • design_version
          • Parametric Features Snapshot (piece count, clearance, aspect ratio)
                     │
                     ▼
       Human Review & Evaluation Context
       • Reviewer (customer, engineer, assembler, evaluator)
       • Review environment (physical prototype, 3D interactive preview)
                     │
                     ▼
       6-Dimensional Structured Feedback
       ├── 1. Overall Preference [1.0 - 5.0]
       ├── 2. Difficulty Preference (perceived difficulty, tier alignment)
       ├── 3. Visual Preference (aesthetic balance, symmetry appreciation)
       ├── 4. Connection Preference (joint friction fit: tight vs loose)
       ├── 5. Assembly Preference (sequence intuitiveness, ergonomic grip)
       └── 6. Manufacturing Preference (cardboard grain, waste acceptability)
                     │
                     ▼
           PreferenceExample Record
       [STRICT GROUND-TRUTH ISOLATION GUARD: is_ground_truth_isolated === true]
                     │
                     ▼
           PreferenceDataset Collection
       • Schema Validation & Invariant Guard
       • Query Filtering & Multi-Dimensional Aggregation
       • Versioned Snapshot Serialization (JSON)
                     │
                     ▼
       Downstream Preference Models (Future AI Learning)
       • Pointwise Rating Prediction: predictPreference()
       • Pairwise Ranking / Choice Modeling: predictPairwisePreference()
       • Calibration & Error Analysis: evaluateCalibration()
```

---

## 2. Invariants & Strict Ground-Truth Isolation

> [!IMPORTANT]
> **Strict Ground-Truth Isolation Invariant**:
> Human and customer preferences represent **subjective opinions, perceptions, and qualitative feedback**. They must **NEVER** overwrite, mutate, or contaminate objective geometric ground truth (CAD boundary polygons, 3D extruded solids, collision state matrices, or 5-gate deterministic validation passes).
>
> 1. `PreferenceExample` stores design pointers (`design_id`, `design_version`) and normalized parametric snapshots.
> 2. `PreferenceDataset` strictly prohibits storing raw CAD vertices, triangle normals, or B-Rep solid meshes. Attempts to inject raw geometry trigger immediate exceptions.
> 3. An explicit architectural boolean flag `is_ground_truth_isolated: true` is permanently stamped on every record.

---

## 3. The 6 Structured Feedback Dimensions

Every `PreferenceExample` captures granular feedback across 6 dimensions:

| Dimension | Evaluation Focus | Typical Attributes & Perceptions |
|---|---|---|
| **1. Overall** | Holisitic satisfaction & delight | Rating $[1.0, 5.0]$, diagnostic tags (`sturdy`, `satisfying_interlock`) |
| **2. Difficulty** | Cognitive load & sequence challenge | Rating, `perceivedDifficulty: 'too_easy' \| 'just_right' \| 'too_hard'`, `preferredTier` |
| **3. Visual** | Aesthetic proportions & balance | Rating, `aestheticBalanceRating` $[1 - 5]$, `symmetryAppreciation: boolean` |
| **4. Connection** | Joint friction fit & tactile sensation | Rating, `fitPerception: 'too_tight' \| 'ideal' \| 'too_loose'`, `preferredJointType` |
| **5. Assembly** | Kinematic sequence intuitiveness | Rating, `sequenceIntuitiveness` $[1 - 5]$, `ergonomicRating` $[1 - 5]$ |
| **6. Manufacturing** | Material quality & nesting waste | Rating, `materialQualityRating` $[1 - 5]$, `wasteAcceptabilityRating` $[1 - 5]$ |

---

## 4. PreferenceDataset & Telemetry

The `PreferenceDataset` class provides:
- **Validation**: Strict boundary checks ($1.0 \le \text{rating} \le 5.0$, non-empty reason, reviewer context).
- **Filtering**: Multi-parameter search by `designId`, `designVersion`, `minRating`, `reviewerRole`, and `reviewEnvironment`.
- **Statistical Aggregation**:
  $$\mu_{\text{overall}} = \frac{1}{N} \sum_{i=1}^N \text{rating}_i, \quad \mu_{\text{dim}} = \frac{1}{N} \sum_{i=1}^N \text{rating}_{i, \text{dim}}$$
  Rating histograms $[1..5]$ and evaluation channel distributions.
- **Pairwise Comparison Tracking**: Stores and aggregates Design A vs Design B choice outcomes with victory margins.
- **Serialization**: Complete JSON import/export preserving isolation guarantees and metadata.

---

## 5. Roadmap: How Future Preference Learning Will Be Introduced

In accordance with Phase 76 requirements, no preference models are trained in this phase. However, the system defines the formal `PreferenceModel` interface and `BaselinePreferenceModel` testbed to enable future machine learning:

### 1. Pairwise Bradley-Terry Reward Modeling
Using collected pairwise preference pairs $(C_A, C_B)$ where human annotators preferred $C_A$ over $C_B$:
$$P(C_A \succ C_B) = \sigma(r_\theta(C_A) - r_\theta(C_B)) = \frac{1}{1 + e^{-(r_\theta(C_A) - r_\theta(C_B))}}$$
A neural reward model $r_\theta$ can be trained by minimizing binary cross-entropy loss over preferences.

### 2. Direct Preference Optimization (DPO) on Parametric Generator
The parametric reasoning layer can be fine-tuned via DPO to directly maximize customer preference scores without requiring an explicit reinforcement learning policy loop.

### 3. Preference-Guided Multi-Candidate Re-Ranking
The candidate ranker (Phase 74) can incorporate the learned preference model's score as an adaptive weight in the multi-criteria composite score:
$$\text{RankScore}(C) = (1 - \alpha) \cdot \text{DeterministicScore}(C) + \alpha \cdot r_\theta(C)$$
Subject to the invariant that valid candidates **always** outrank invalid candidates.
