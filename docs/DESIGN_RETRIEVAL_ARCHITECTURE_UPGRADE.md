# Upgraded Design Retrieval Architecture (Phase 70)

## 1. Overview & Objectives

The **Upgraded Design Retrieval Subsystem** provides a multi-modal semantic search and reference retrieval mechanism across 8 physical, geometric, and topological design dimensions.

Its primary role is to serve as a **knowledge retrieval backbone for future generative AI pipelines** (e.g. LLM-guided design planning, diffusion-based shape generation, and parametric adaptation). Instead of synthesizing complex interlocking 3D structures from scratch in a vacuum, generative systems can query the repository for proven structural references, inspect their topological patterns, and parameterize novel designs while strictly avoiding cloning.

```
                         AdvancedDesignQuery
 ┌───────────────────────────────────────────────────────────────────────┐
 │ • Natural-Language Prompt ("folding phone stand with hinge")         │
 │ • Piece Count (target / range)                                        │
 │ • Bounding Dimensions (width, height, depth)                          │
 │ • Connection Topology (graph density, tree vs cyclic)                 │
 │ • Interface Joint Types ("tab_slot", "mortise_tenon", "interlock")    │
 │ • Difficulty Level & Score ("easy", "medium", "hard", "expert")       │
 │ • Assembly Characteristics (steps, planarity, max angle)              │
 │ • Geometry Features (thickness, symmetry, style)                      │
 └───────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
                      DesignSimilarityEngine.evaluate()
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
  Structured Similarity (S_struct)              Dense Vector Cosine (S_emb)
  • Active dimension normalization              • 128-dimensional L2-norm
  • Multi-attribute weighted scores             • Cosine similarity dot product
         └───────────────────────────┬───────────────────────────┘
                                     │
                                     ▼
                   Composite Similarity: α·S_struct + (1-α)·S_emb
                                     │
                                     ▼
                           RetrievedDesign Record
 ┌───────────────────────────────────────────────────────────────────────┐
 │ • designId, name, CanonicalPuzzle reference                           │
 │ • features: NormalizedDesignFeature (8 dimensions)                    │
 │ • similarity: DesignRetrievalSimilarity                               │
 │ • matchingFeatures: Array<{ dimension, description, similarity }>    │
 │ • differences: Array<{ dimension, queryTarget, deltaDescription }>    │
 │ • isReferenceOnly: true (STRICT INVARIANT)                            │
 │ • referenceAdaptationGuidance: Parametric adaptation instructions     │
 └───────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 8 Searchable Dimensions & `NormalizedDesignFeature`

| Dimension | Description | Normalization & Extraction |
|---|---|---|
| **1. Natural Language** | Semantic keywords extracted from title, descriptions, tags, and piece names. | Lowercase tokenization, punctuation removal, stopword filtering, 32-dim hash projection. |
| **2. Piece Count** | Total pieces in the assembly ($N$). | Ratio match: $1 - \frac{\|N_{\text{target}} - N_{\text{cand}}\|}{\max(N_{\text{target}}, N_{\text{cand}})}$. |
| **3. Dimensions** | Bounding box ($W \times H \times D$), aspect ratio, volume. | Dimension ratios: $\frac{\min(d_1, d_2)}{\max(d_1, d_2)}$ per axis. |
| **4. Connection Topology** | Graph density, average degree, tree structure vs cycles. | Exact density comparison, spanning tree structure match. |
| **5. Interface Types** | Joint mechanisms (`tab_slot`, `mortise_tenon`, `sliding_interlock`, `hinge`). | Jaccard set overlap: $\frac{\|I_Q \cap I_D\|}{\|I_Q \cup I_D\|}$. |
| **6. Difficulty** | Categorical tier and continuous score ($[0, 100]$ from Phase 69). | Exact tier match (1.0) / adjacent tier (0.4) or score delta: $1 - \frac{\|\Delta\|}{100}$. |
| **7. Assembly Characteristics** | Sequence step length, non-planar joins, max joining angles. | Step count ratio, planarity boolean alignment. |
| **8. Geometry Features** | Material thickness, surface area, symmetry orders. | Thickness delta $|t_1 - t_2| / 5.0$, symmetry order match. |

---

## 3. Dual Similarity Search

The system computes two independent similarity metrics:

1. **Structured Multi-Attribute Similarity ($S_{\text{structured}}$)**:
   - Dynamic weight normalization: only dimensions that are **actively specified** in the query contribute to the denominator.
   - Evaluates specific tolerances and ranges for engineering attributes.
2. **Dense Vector Embedding Similarity ($S_{\text{embedding}}$)**:
   - Computes a 128-dimensional dense vector representing the joint distribution of keywords, geometric dimensions, interface types, and topological harmonics.
   - Vectors are L2-normalized ($\|\mathbf{v}\|_2 = 1.0$), so vector dot product directly yields cosine similarity in $[0.0, 1.0]$.
3. **Composite Similarity**:
   $$S_{\text{overall}} = \alpha \cdot S_{\text{structured}} + (1 - \alpha) \cdot S_{\text{embedding}}$$
   - $\alpha = 0.75$ by default when explicit engineering filters (piece count, dimensions, joint types) are present; $\alpha = 0.60$ for text-driven queries.

---

## 4. Matching Features & Granular Differences

Every retrieved design returns explainability vectors:

- **`matchingFeatures`**: Explains why the reference was chosen (e.g. `"Keywords matched: 'storage, box, finger'"` or `"Piece count matches query (5 pieces)"`).
- **`differences`**: Pinpoints deviations between the query targets and the retrieved reference:
  ```json
  {
    "dimension": "pieceCount",
    "queryTarget": 4,
    "designValue": 3,
    "deltaDescription": "Target requested 4 pieces, design has 3 (-1 pieces)."
  }
  ```

---

## 5. Strict Anti-Cloning Invariant & AI Generation Safeguards

> [!IMPORTANT]
> **Retrieved designs are references only. Never automatically clone a retrieved design.**

### 5.1 System Invariants
1. **`isReferenceOnly: true`**: Hardcoded on every `RetrievedDesign` object.
2. **`referenceAdaptationGuidance`**: Automatically generated adaptation directives detailing which dimensions must be scaled or re-parameterized.
3. **`ReferenceDesignProtector`**: Automated guard asserting that generated candidate designs are distinct:
   - Blocks duplicate metadata IDs (`cand.id !== ref.id`).
   - Blocks identical piece ID sets.
   - Blocks exact 1:1 piece dimension replicas with identical names.

### 5.2 How Retrieval Supports Future Generative AI
In upcoming phases, AI generative planners will utilize retrieved designs as follows:
1. **Structural Conditioning**: The retrieved reference's connection topology (e.g. tree vs. cyclic) conditions the layout generation model.
2. **Parametric Scaling**: Dimensions from the query replace reference dimensions, with interface tab counts adapting proportionally.
3. **Joint Re-keying**: Interface mechanisms (e.g. changing finger joints to sliding dovetails) are swapped parametrically based on target material and manufacturing constraints.
4. **Prompt Context Ingestion**: LLM prompts ingest `matchingFeatures` and `differences` as few-shot in-context exemplars, explicitly prompted: *"Use reference [ID] for joint styling, but modify piece count to 5 and width to 200mm as specified in differences."*
