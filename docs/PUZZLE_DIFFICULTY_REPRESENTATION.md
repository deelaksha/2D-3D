# Formal Puzzle Difficulty Representation & Scoring Subsystem (Phase 69)

## 1. Overview

The **Puzzle Difficulty Representation Subsystem** replaces ad-hoc or arbitrary difficulty labels with a **formal, mathematically grounded, and deterministic scoring model**.

Difficulty is derived strictly from **11 measurable physical, topological, kinematic, and combinatorial properties**. The subsystem computes a continuous composite score ($[0.0, 100.0]$), classifies the puzzle into 4 discrete rating levels (`easy`, `medium`, `hard`, `expert`), aggregates sub-domain component scores, and preserves the complete feature breakdown for future machine learning model training.

```
                  DifficultyEvaluationContext
  (Pieces, Connections, Target Transforms, Assembly Paths, Dead Ends)
                               │
                               ▼
               DifficultyFeatureExtractor.extractFeatures()
                               │
                               ▼
                   DifficultyFeatures (11 Raw Metrics)
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  pieceCount (N)         ambiguity (A)         interlocking (I)
  connectionDensity (ρ)  seqLength (L)         motionDifficulty (M)
  configurations (K)     validAngles (Θ)       deadEnds (D)
  symmetryOrder (S)      constrainedInterfaces (C)
                               │
                               ▼
          DeterministicDifficultyModel.evaluate()
                               │
         ┌─────────────────────┴─────────────────────┐
         ▼                                           ▼
  Normalized Vectors f_i ∈ [0, 1]              Domain Components [0, 100]
  • Sublinear / Log2 scaling                   • Structural Complexity
  • Bounded intervals & ratios                 • Combinatorial Search
                                               • Geometric & Kinematic
                                               • Symmetry Factor
                               │
                               ▼
                        DifficultyScore
                 • overallScore: [0.0, 100.0]
                 • level: easy | medium | hard | expert
                 • featureBreakdown: Record<key, FeatureContribution>
                   (Preserved for downstream ML training)
```

---

## 2. The 11 Measurable Properties

| Property | Symbol | Definition & Derivation | Normalization Function $f(x) \in [0, 1]$ | Default Weight |
|---|---|---|---|---|
| **`pieceCount`** | $N$ | Total piece count in the puzzle ($N \ge 1$). | $\min\left(1.0, \frac{\log_2(\max(1, N))}{\log_2(64)}\right)$ | 0.12 |
| **`connectionDensity`** | $\rho$ | Ratio of actual unique connected piece pairs to maximum possible pairs: $\frac{\|E_{\text{pairs}}\|}{\binom{N}{2}}$. | $\min(1.0, \max(0.0, \rho))$ | 0.06 |
| **`possibleConfigurationsCount`** | $K$ | Cardinality of distinct valid assembly configurations or combinatorial state space size. | $\min\left(1.0, \frac{\log_{10}(\max(1, K))}{4.0}\right)$ | 0.08 |
| **`ambiguity`** | $A$ | Degree of identical piece dimensions or multiple matching candidate slots ($A \ge 1.0$). | $\min\left(1.0, \frac{A - 1.0}{4.0}\right)$ | 0.10 |
| **`assemblySequenceLength`** | $L$ | Number of sequential assembly steps required to reach the completed state. | $\min\left(1.0, \frac{L}{30.0}\right)$ | 0.07 |
| **`validAnglesCount`** | $\Theta$ | Count of allowable joining angles / discrete angular sectors across all connections. | $\min\left(1.0, \frac{\log_2(\max(1, \Theta))}{5.0}\right)$ | 0.05 |
| **`constrainedInterfacesCount`** | $C$ | Number of interfaces with tight tolerances ($\le 0.2\text{mm}$), non-planar contact, or keyed interlocks. | $\min\left(1.0, \frac{C}{15.0}\right)$ | 0.08 |
| **`symmetryOrder`** | $S$ | Global or piece-level rotational/reflective symmetry order ($S \ge 1$). | $\min\left(1.0, \frac{\log_2(\max(1, S))}{3.0}\right)$ | 0.10 |
| **`interlockingComplexity`** | $I$ | Metric of interlocked joints (`INTERLOCK`, `SNAP`, `SLIDING`) restricting translation in $\ge 2$ axes. | $\min\left(1.0, \frac{I}{10.0}\right)$ | 0.12 |
| **`motionPlanningDifficulty`** | $M$ | Ratio of restricted insertion vectors, clearance sensitivity, and intermediate sweep waypoints ($M \in [0, 1]$). | $\min(1.0, \max(0.0, M))$ | 0.10 |
| **`deadEndPathsCount`** | $D$ | Count of assembly sequence branches that lead to dead-end blocking states requiring back-tracking. | $\min\left(1.0, \frac{D}{10.0}\right)$ | 0.12 |

---

## 3. Mathematical Formulation

### 3.1 Composite Score Formulation
The composite difficulty score $\mathcal{S}$ is computed as the weighted linear combination of the normalized feature values scaled to $[0.0, 100.0]$:

$$\mathcal{S} = 100.0 \times \sum_{i=1}^{11} w_i \cdot f_i(x_i)$$

Where:
- $w_i$ is the weight of feature $i$, satisfying $\sum_{i=1}^{11} w_i = 1.00$.
- $f_i(x_i) \in [0.0, 1.0]$ is the bounded monotonic normalization function for raw feature $x_i$.

### 3.2 Four Domain Component Scores
For explainability and user feedback, features are clustered into 4 high-level domain scores:

1. **Structural Complexity** ($\sum w = 0.25$):
   $$\mathcal{S}_{\text{struct}} = 100 \times \frac{w_N f_N + w_\rho f_\rho + w_L f_L}{w_N + w_\rho + w_L}$$
2. **Combinatorial Search Complexity** ($\sum w = 0.30$):
   $$\mathcal{S}_{\text{comb}} = 100 \times \frac{w_K f_K + w_A f_A + w_D f_D}{w_K + w_A + w_D}$$
3. **Geometric & Kinematic Complexity** ($\sum w = 0.35$):
   $$\mathcal{S}_{\text{geom}} = 100 \times \frac{w_I f_I + w_M f_M + w_C f_C + w_\Theta f_\Theta}{w_I + w_M + w_C + w_\Theta}$$
4. **Symmetry Factor** ($\sum w = 0.10$):
   $$\mathcal{S}_{\text{sym}} = 100 \times f_S$$

### 3.3 Difficulty Level Classification
$$\text{Level}(\mathcal{S}) = \begin{cases} 
\text{"easy"} & \mathcal{S} < 25.0 \\
\text{"medium"} & 25.0 \le \mathcal{S} < 55.0 \\
\text{"hard"} & 55.0 \le \mathcal{S} < 80.0 \\
\text{"expert"} & \mathcal{S} \ge 80.0
\end{cases}$$

---

## 4. Preservation of Feature Breakdown for Future ML

Every evaluation produces a comprehensive `FeatureContribution` record for each of the 11 features:

```typescript
interface FeatureContribution {
  featureName: keyof DifficultyFeatures;
  rawValue: number;              // Unscaled engineering unit (count, mm, ratio)
  normalizedValue: number;        // Scaled [0.0, 1.0]
  weight: number;                 // Baseline or custom weight
  weightedContribution: number;   // Points contributed to overallScore
}
```

This telemetry enables downstream machine learning models (e.g. gradient boosted regression, neural networks, or human-preference reward models) to:
1. Ingest raw and normalized feature matrices directly without recomputing geometry.
2. Optimize feature weights against empirical human solve-time datasets.
3. Train non-linear neural regressors using `DifficultyScore.features` as input embeddings.

---

## 5. Extensibility: `DifficultyModel` Interface

The system is designed with modularity:

```typescript
export interface DifficultyModel {
  readonly id: string;
  readonly version: string;
  computeFeatures(context: DifficultyEvaluationContext): DifficultyFeatures;
  evaluate(features: DifficultyFeatures): DifficultyScore;
  scorePuzzle(context: DifficultyEvaluationContext): DifficultyScore;
}
```

Developers can instantiate `DeterministicDifficultyModel` with custom weights or alternate threshold distributions, or implement custom data-driven models complying with the same interface.
