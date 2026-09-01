# Human Feedback Architecture Specification (Phase 55)

This document specifies the **Human-Feedback Architecture & Preference Data Collection Subsystem** for collecting human reviews, qualitative rating tags, 1-5 star sub-metrics, and text feedback on generated puzzle designs.

---

## 1. Architectural Mandate & Separation Invariant

> [!IMPORTANT]
> **SEPARATION OF FEEDBACK VS CANONICAL GEOMETRY**:
> - **Feedback Stored Separately**: Human review records (`DesignFeedback`) are stored separately in `FeedbackStore`, preserving the immutability of original CAD geometry objects (`CanonicalPuzzle`).
> - **Qualitative Rating Tags & 1-5 Sub-Metrics**:
>   - `ratingTags`: `"looks_good"` | `"poor_geometry"` | `"too_easy"` | `"too_difficult"`
>   - `subMetrics`: 1-5 scale for connection quality, assembly quality, manufacturability, overall preference
> - **Future Preference Dataset Preparation**: Exports structured records (`exportFeedbackDataset()`) to build RLHF / DPO training pair datasets for future ML phases.
> - **Zero Model Training**: Implements the feedback collection schema, store, summary engine, and dataset exporter; zero model training is performed.

---

## 2. Design Feedback Schema (`DesignFeedback`)

```typescript
export type FeedbackRatingTag = "looks_good" | "poor_geometry" | "too_easy" | "too_difficult";

export interface FeedbackSubMetric {
  connectionQuality: number;   // 1 to 5 stars
  assemblyQuality: number;     // 1 to 5 stars
  manufacturability: number;   // 1 to 5 stars
  overallPreference: number;   // 1 to 5 stars
}

export interface DesignFeedback {
  feedbackId: string;
  designId: string;
  reviewerId: string;
  timestampIso: string;
  ratingTags: FeedbackRatingTag[];
  subMetrics: FeedbackSubMetric;
  comments: string;
  version: number;
}
```

---

## 3. Future RLHF & Direct Preference Optimization (DPO) Roadmap

In future ML phases, recorded feedback datasets will be converted into training pairs for RLHF / DPO fine-tuning:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     RLHF & DPO PREFERENCE TRAINING ROADMAP                             │
└────────────────────────────────────────────────────────────────────────────────────────┘

  1. DPO Preference Pairs     • Form pairs (D_preferred, D_dispreferred) where
                                overallPreference(D_preferred) > overallPreference(D_dispreferred).
                              • Loss: L_DPO(theta) = -E [ log sigma( beta * log( pi_theta(D_w|x) / pi_ref(D_w|x) ) - ... ) ]

  2. Qualitative Tag Rewards • Reward bonus (+0.5) for "looks_good".
                              • Reward penalty (-1.0) for "poor_geometry".

  3. Deterministic Invariant  • RLHF fine-tuned models generate candidate specifications only;
                                AIDesignValidationGate retains 100% veto authority over export.
```

---

## 4. Programmatic API Usage

```typescript
import { FeedbackStore } from "@/core/puzzle/feedback";

// 1. Instantiate feedback store
const store = new FeedbackStore();

// 2. Record human reviewer feedback
await store.recordFeedback({
  designId: "puz_box_101",
  reviewerId: "reviewer_charlie",
  ratingTags: ["looks_good"],
  subMetrics: { connectionQuality: 5, assemblyQuality: 4, manufacturability: 5, overallPreference: 5 },
  comments: "Excellent friction fit on tabs!",
  version: 1,
});

// 3. Get aggregated summary statistics
const summary = await store.getFeedbackSummary("puz_box_101");

console.log(`Design: ${summary.designId}, Reviews: ${summary.totalFeedbackCount}`);
console.log(`Average Overall Preference: ${summary.averageOverallPreference} / 5.0`);
```
