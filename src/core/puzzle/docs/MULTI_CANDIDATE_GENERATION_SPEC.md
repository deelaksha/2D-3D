# Multi-Candidate Design Generation Specification (Phase 53)

This document specifies the **Multi-Candidate Design Generation Architecture & Scoring Engine** for producing, independently validating, scoring, and comparing multiple candidate `ParametricDesignSpecification` configurations for a single natural language user requirement.

---

## 1. Architectural Mandate & Hard Constraint Invariant

> [!IMPORTANT]
> **INDEPENDENT VALIDATION & HARD CONSTRAINTS**:
> - **Independent Validation for Every Candidate**: Every generated candidate (Candidate A, Candidate B, Candidate C, Candidate D, Candidate E...) is independently passed through `AIDesignValidationGate`.
> - **Hard Constraint Compliance**: Every candidate strictly respects all hard constraints (`minThicknessMm >= 0.5`, positive dimensions).
> - **Multi-Metric Scoring**: Candidates are evaluated and ranked using 4 sub-metrics: Manufacturability, Assembly Feasibility, Aesthetic Complexity, and Constraint Satisfaction.
> - **Zero Model Training**: Implements the deterministic parameter variation generator, scorer, and comparison engine; zero model training is performed.

---

## 2. Multi-Metric Scoring Formula (`CandidateScorer`)

Overall composite score is calculated across 4 sub-metrics:

$$\text{OverallScore} = 0.3 \cdot S_{\text{manufacturability}} + 0.3 \cdot S_{\text{assemblyFeasibility}} + 0.2 \cdot S_{\text{aestheticComplexity}} + 0.2 \cdot S_{\text{constraintSatisfaction}}$$

Where:
- $S_{\text{manufacturability}}$: Evaluates laser/die cutting feasibility and material limits.
- $S_{\text{assemblyFeasibility}}$: Evaluates physical joining sequence and joining angle feasibility.
- $S_{\text{aestheticComplexity}}$: Evaluates visual intricacy, joint styling, and user engagement.
- $S_{\text{constraintSatisfaction}}$: $1.0$ if accepted by `AIDesignValidationGate`, $0.0$ if rejected.

---

## 3. Future ML Candidate Generator Replacement Roadmap

In future ML phases, a trained Generative Diffusion / Transformer LLM model will replace `DeterministicCandidateGenerator`:

```
  Current (Deterministic Baseline)        Future (Generative AI Model)
  ┌───────────────────────────────┐       ┌───────────────────────────────┐
  │ Deterministic Variations Engine│  ───► │ Fine-Tuned Transformer / LLM  │
  │ (Systematic Parameter Spans)  │       │ (Probabilistic Sampling)      │
  └───────────────┬───────────────┘       └───────────────┬───────────────┘
                  │                                       │
                  └───────────────────┬───────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    AIDesignValidationGate     │
                      │     (Independently Validates) │
                      └───────────────┬───────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │        CandidateScorer        │
                      │   (Scores & Ranks Candidates) │
                      └───────────────────────────────┘
```

---

## 4. Programmatic API Usage

```typescript
import { DeterministicCandidateGenerator } from "@/core/puzzle/multicandidate";

// 1. Generate 5 candidate design specifications for a single requirement
const generator = new DeterministicCandidateGenerator();
const comparison = await generator.generateCandidates("Create a difficult 20-piece puzzle.", 5);

console.log(`Generated Candidates: ${comparison.candidates.length}`);
console.log(`Recommended Candidate: ${comparison.recommendedCandidate?.candidateLabel}`);
console.log(`Ranking Reason: ${comparison.rankingReason}`);
```
