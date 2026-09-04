# Dataset Composition & Stratified Sampling Strategy (Phase 64)

## 1. Overview & Architecture

The **Hybrid Dataset Composition System** integrates verified real-world engineering puzzles with procedural synthetic assemblies to produce curated, balanced, and compact training and evaluation splits for the 2D-to-3D puzzle assembly pipeline.

```
┌───────────────────────────────┐        ┌───────────────────────────────┐
│     REAL DATASET POOL         │        │    SYNTHETIC DATASET POOL     │
│  (Verified Ingested & Review) │        │  (Procedural Seeded Geometry) │
└───────────────┬───────────────┘        └───────────────┬───────────────┘
                │                                        │
                ▼                                        ▼
    DataOriginAdapter.fromReal              DataOriginAdapter.fromSynthetic
    • origin: "REAL"                        • origin: "SYNTHETIC"
    • isGroundTruth: true                   • isGroundTruth: false (ENFORCED)
    • provenance: source_file, sha256       • provenance: synthetic://seed
                │                                        │
                └───────────────────┬────────────────────┘
                                    ▼
                     ┌─────────────────────────────┐
                     │      DatasetComposer        │
                     │  • Controlled Ratio Mixing  │
                     │  • Bounded Size Safeguard   │
                     │  • Pure Real Eval Policy    │
                     └──────────────┬──────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
      DatasetSampler                            Train / Val / Test
  (Stratified 7-Axis Sampling)              Distribution & Split Audit
```

---

## 2. Core Invariants

### 2.1 Strict Origin Tracking & Ground-Truth Separation
Synthetic data serves as rich procedural scaffolding to teach structural priors and geometric reasoning. However, **synthetic examples must never contaminate benchmark truth**:
- Real verified items: `origin = "REAL"`, `isGroundTruth = true`.
- Synthetic items: `origin = "SYNTHETIC"`, `isGroundTruth = false` (strictly enforced by `DataOriginAdapter.fromSyntheticExample`).
- Any attempt to flag a synthetic example as `isGroundTruth = true` is intercepted and overridden to `false`.

### 2.2 Bounded Dataset Size Safeguard
Large-scale model training is strictly out of scope. The composer enforces explicit bounded caps (default `targetTotalCount: 30`, max bounds configured in `CompositionRatioConfig`) to prevent memory runaway and inadvertent mass generation.

---

## 3. Stratified Sampling Across 7 Dimensions

The `FeatureClassifier` and `DatasetSampler` extract and group examples across 7 physical and parametric axes:

| Dimension | Extracted Values / Tiers | Description |
|---|---|---|
| **1. Piece Count** | Positive integers (e.g. 2, 3, 4, 8+) | Discrete count of distinct 2D contour pieces. |
| **2. Connection Type** | `tab_slot`, `finger_joint`, `dovetail`, `interlock`, `rigid` | Structural interlocking joint mechanism. |
| **3. Difficulty** | `easy`, `medium`, `hard`, `expert` | Design complexity level based on constraints. |
| **4. Geometry Complexity** | `simple` (≤4 vertices/part), `medium` (5–10), `complex` (>10) | Boundary polygon vertex density and contour features. |
| **5. Assembly Angle** | Degrees (e.g. `0°`, `30°`, `45°`, `60°`, `90°`) | Dominant 3D spatial alignment angle of connected interfaces. |
| **6. Material** | e.g. `cardboard-stock`, `plywood_3mm`, `acrylic_3mm` | Substrate stock material and kerf/clearance characteristics. |
| **7. Failure Type** | `none` (valid), `collision`, `incompatible_interfaces`, etc. | Physical defect category for negative-sample balancing. |

### Balanced Sampling Algorithm
`DatasetSampler.sampleStratified()` groups the candidate pool into stratum keys (e.g. `pc:3|ct:tab_slot|gc:simple`), iterates over stratum buckets in a round-robin schedule, and draws balanced examples up to the requested target count without skewing toward overrepresented categories.

---

## 4. Controlled Ratio Mixing & Evaluation Sets

The composer supports arbitrary mixing ratios through `CompositionRatioConfig`:
- **20% Real / 80% Synthetic**: Standard early-stage hybrid configuration.
- **50% Real / 50% Synthetic**: Balanced mid-stage alignment configuration.
- **Custom Ratios**: E.g., 30/70, 70/30, with automatic fallback when the real pool has fewer samples than requested.

### Balanced Evaluation Set Policy (`pure_real`)
Evaluation metrics must reflect real-world performance without synthetic shortcuts:
- `evaluationPolicy: "pure_real"`: Strictly allocates verified real examples to `test` splits (`actualRealRatio = 1.0` in test split).
- `evaluationPolicy: "balanced"`: Maintains equal real/synthetic distribution across train, validation, and test.

---

## 5. Recommended Curriculum Strategy: Gradually Increasing Real-Data Proportion

To safely transition the model from procedural geometry priors to production CAD and hand-drawn puzzles, adopt this 5-stage progressive curriculum:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       5-STAGE HYBRID CURRICULUM                             │
│                                                                             │
│ Stage 1:  0% Real / 100% Synthetic   ──► Geometric Pre-Training & Priors    │
│ Stage 2: 10% Real / 90% Synthetic    ──► Initial Real Inoculation           │
│ Stage 3: 25% Real / 75% Synthetic    ──► Domain Alignment & Feature Co-Tune │
│ Stage 4: 50% Real / 50% Synthetic    ──► Balanced Joint Adaptation          │
│ Stage 5: 80% Real / 20% Synthetic    ──► Real-World Production Primacy      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Stage 1: Synthetic Warm-Up & Geometry Priors (0% Real / 100% Synthetic)
- **Goal**: Initialize coordinate transforms, interface polarity, collision detection, and assembly graph topological understanding.
- **Real Ratio**: `0.0`
- **Evaluation**: 100% pure real benchmark (zero-shot transfer baseline).
- **Safety Gate**: Verify model achieves >85% synthetic kinematic accuracy before proceeding.

### Stage 2: Initial Real Inoculation (10% Real / 90% Synthetic)
- **Goal**: Expose the representation layer to real-world edge tolerances, hand-drawn vector noise, and real CAD formatting.
- **Real Ratio**: `0.10`
- **Sampling Focus**: Stratify on `geometryComplexity` (`simple`) and standard `90°` assembly angles.
- **Safety Gate**: Ensure synthetic regression does not exceed 3% while real validation loss drops monotonically.

### Stage 3: Domain Alignment & Feature Co-Training (25% Real / 75% Synthetic)
- **Goal**: Align latent feature embeddings between procedural slot profiles and real manufactured cuts.
- **Real Ratio**: `0.25`
- **Sampling Focus**: Introduce varied connection types (`finger_joint`, `dovetail`) and multi-material examples (`plywood`, `acrylic`).
- **Safety Gate**: Verify zero data leakage between train and test splits using Phase 63 `DatasetQualityReport`.

### Stage 4: Balanced Joint Adaptation (50% Real / 50% Synthetic)
- **Goal**: Formulate equal weighting between deterministic synthetic variations (used as mathematical regularizers) and nuanced real engineering blueprints.
- **Real Ratio**: `0.50`
- **Sampling Focus**: Stratify evenly across all 7 dimensions, including negative failure samples (`failureType` balancing).
- **Safety Gate**: Evaluation benchmark must score >80% on the `pure_real` test split.

### Stage 5: Real-World Dominant Specialization (80%+ Real / 20% Synthetic)
- **Goal**: Final production tuning where real examples provide primary ground truth, while synthetic data is retained exclusively to augment rare failure modes or extreme assembly angles.
- **Real Ratio**: `0.80+`
- **Sampling Focus**: Real examples drive primary gradient flow; synthetic examples inject edge cases (e.g. 15° acute angles, 12+ piece assemblies).
- **Safety Gate**: Human-in-the-loop review (Phase 62) required for 100% of real training examples before snapshotting.

---

## 6. Programmatic Usage Example

```typescript
import {
  DatasetComposer,
  DatasetSampler,
  FeatureClassifier,
  DataOriginAdapter
} from "@/core/puzzle/composition";

// 1. Compose a 20/80 hybrid dataset with pure real evaluation
const hybridSplits = DatasetComposer.composeDataset(
  "puz_hybrid_v1",
  "1.0.0",
  verifiedRealExamples,
  syntheticExamples,
  {
    realRatio: 0.2,
    syntheticRatio: 0.8,
    targetTotalCount: 30,
    evaluationPolicy: "pure_real"
  }
);

// 2. Perform stratified sub-sampling balanced by connection type & difficulty
const stratifiedSubset = DatasetSampler.sampleStratified(
  hybridSplits.train,
  {
    dimensions: ["connectionType", "difficulty"],
    targetCount: 10,
    balanceEqual: true
  }
);

console.log(`Composed ${hybridSplits.distributionStats.totalExamples} items.`);
console.log(`Real count: ${hybridSplits.distributionStats.realCount}`);
console.log(`Ground truth count: ${hybridSplits.distributionStats.groundTruthCount}`);
```
