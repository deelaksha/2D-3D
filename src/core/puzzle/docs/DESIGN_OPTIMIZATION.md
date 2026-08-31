# Puzzle Design Optimization Subsystem Specification (Phase 21)

This document specifies the **Puzzle Design Optimization Subsystem** for the Parametric 2D-to-3D Cardboard Puzzle System.

---

## 1. Core Mandate: Separation of Hard Constraints from Optimization Objectives

> [!IMPORTANT]
> **STRICT SEPARATION ENFORCED**:
> - **HARD CONSTRAINTS**: Non-negotiable physical and geometric rules (e.g. 3D spatial non-collision, cardboard sheet dimensions, closed 2D boundary topology). If a candidate design violates ANY hard constraint, it is immediately marked **INFEASIBLE** (`isFeasible: false`, totalScore = 0.0) and rejected.
> - **OPTIMIZATION OBJECTIVES**: Multi-objective fitness criteria used to score and rank FEASIBLE candidate designs.

---

## 2. The 9 Multi-Objective Fitness Criteria

1. **`material_utilization`**: Ratio of total piece surface area to cardboard stock area (\(\text{area}_{\text{pieces}} / \text{area}_{\text{stock}}\)).
2. **`piece_count`**: Proximity score relative to target piece count (\(1.0 - \frac{|\text{actual} - \text{target}|}{\text{target}}\)).
3. **`assembly_difficulty`**: Target assembly difficulty level (`easy`, `medium`, `hard`, `expert`).
4. **`connection_quality`**: Average joint tolerance & interface profile clearance matching score.
5. **`manufacturing_complexity`**: Cut path length vs kerf geometry efficiency score.
6. **`clearance`**: Proximity to optimal joint clearance gap (e.g. 0.15mm target gap).
7. **`symmetry`**: Structural symmetry & balance score across local frame axes.
8. **`aesthetic_objectives`**: Visual proportion score based on bounding envelope aspect ratios.
9. **`assembly_time`**: Estimated assembly duration score based on step count.

---

## 3. Pluggable ML-Based Optimizer Integration Guidelines

While the default implementation is a **`DeterministicGridOptimizer`** (searching small discrete parameter spaces), future ML-based optimizers can be plugged in seamlessly via the **`Optimizer`** interface:

```typescript
export interface Optimizer {
  optimizerName: string;
  optimize(
    puzzle: CanonicalPuzzle,
    objectives: Objective[],
    hardConstraints?: DeclarativeConstraint[],
    searchSpaces?: ParameterSearchSpace[],
  ): Promise<OptimizationResult>;
}
```

### Future ML Optimizer Architectures:
1. **Reinforcement Learning (RL Optimizer)**: An RL agent takes parameter adjustments as actions, receiving positive rewards from `evaluateDesignScore` for feasible candidates with high total score, and heavy negative penalties for HARD constraint violations.
2. **Bayesian Optimization (GP / TPE Optimizer)**: Uses Gaussian Processes or Tree-structured Parzen Estimators to build a surrogate model of the multi-objective fitness landscape, sampling promising parameter vectors efficiently.
3. **AI-Guided MCTS (Monte Carlo Tree Search)**: AI policy networks guide tree search through high-dimensional parameter spaces, using `evaluateDesignScore` as roll-out evaluations.
