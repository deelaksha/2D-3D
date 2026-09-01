# ML-Readiness Analysis & System Architecture Specification

This document presents the **ML-Readiness Analysis**, 10-Task System Classification Matrix, and strategic **ML Implementation Roadmap** based on real-data benchmark evaluation.

---

## 1. Executive Summary & Core Architectural Invariant

> [!IMPORTANT]
> **DETERMINISTIC GEOMETRIC & PHYSICAL INTEGRITY**:
> - **Zero Model Training**: This phase performs architectural analysis and specifies the roadmap. Zero model training is conducted.
> - **Exact Geometry & Physical Validity Remain Deterministic**: 2D/3D geometry generation, solid extrusions, unit scale conversions, and physical validation **must remain 100% deterministic code**.
> - **Targeted Machine Learning**: Machine learning is applied **only** where analytical rules suffer from high complexity or high variance (e.g. raster vision segmentation, complex GNN connection inference, natural language RAG retrieval).

---

## 2. 10-Task System Classification Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             10-TASK SYSTEM CLASSIFICATION MATRIX                       │
└────────────────────────────────────────────────────────────────────────────────────────┘

  Task                        Classification            Primary Technology / Rationale
  ──────────────────────────────────────────────────────────────────────────────────────
  1. Requirement Understanding LLM                      Prompt-engineered LLM translates prompt to Canonical IR parameters.
  2. Drawing Understanding     HYBRID (CLASSICAL+VISION) Vector = Classical; Raster = ViT / SAM 2 vectorizer.
  3. Piece Segmentation        HYBRID (CLASSICAL+VISION) Planar graph traversal for vector; SAM 2 for touching raster.
  4. Interface Detection       HYBRID (RULE+VISION)      Analytical fitting for rectangular; ViT for custom edge ports.
  5. Connection Inference      HYBRID (GNN / LLM)        Weakest Subsystem (82%). GNN ranks 3D assembly topologies.
  6. Parametric Feature Recog. CLASSICAL GEOMETRY       Exact analytical math. ML is unnecessary and adds noise.
  7. Design Retrieval          RAG                       Vector embeddings over Canonical IR graphs (Qdrant/FAISS).
  8. Design Generation         HYBRID (LLM+RAG+ENGINE)   LLM generates parametric variables -> Parametric Engine executes.
  9. Validation               DETERMINISTIC             Physics/geometry laws MUST remain 100% deterministic.
  10. Repair                   OPTIMIZATION              Constrained numerical solver (SQP) guided by LLM diagnostics.
```

---

## 3. Detailed Task Classifications & Rationale

### Task 1: Requirement Understanding
- **Classification**: `LLM`
- **Rationale**: Translates human natural language user prompts (*"build a 3-tier cardboard bookshelf with finger joints"*) into structured parametric constraints (`width`, `height`, `thickness`, `tierCount`, `jointStyle`).
- **Baseline**: Rule-based regex and keyword template parser.
- **Future Model**: Prompt-engineered or fine-tuned LLM emitting Canonical Puzzle IR JSON.

### Task 2: Drawing Understanding
- **Classification**: `HYBRID` (`CLASSICAL GEOMETRY` + `VISION MODEL`)
- **Rationale**: Vector files (SVG/DXF) are parsed deterministically using classical vector importers (`PrimitiveExtractor`). Raster drawings (PNG/JPG) or damaged vector blueprints require a Vision Model (ViT / SAM 2) to segment line primitives and detect text labels/dimensions.
- **Baseline**: `DrawingNormalizer` + `PrimitiveExtractor`.
- **Future Model**: ViT / SAM 2 contour vectorizer.

### Task 3: Piece Segmentation
- **Classification**: `HYBRID` (`CLASSICAL GEOMETRY` + `VISION MODEL`)
- **Rationale**: Clean closed vector boundaries are segmented deterministically using planar graph face traversal (`PieceSegmenter`). Nested, touching, or unclosed raster pieces require a Vision Model for instance segmentation.
- **Baseline**: `PieceSegmenter` closed contour finder.
- **Future Model**: YOLOv8-Seg or SAM 2 for complex touching piece layout sheets.

### Task 4: Interface Detection
- **Classification**: `HYBRID` (`RULE-BASED` + `CLASSICAL GEOMETRY` + `VISION MODEL`)
- **Rationale**: Standard rectangular tabs and slots are detected analytically via edge profile geometry (`InterfaceDetector2D`). Custom non-standard shapes, worn cardboard contours, or freeform interlocking joints benefit from a Vision Model classifier.
- **Baseline**: `InterfaceDetector2D` profile analyzer.
- **Future Model**: Edge-level CNN/ViT port classifier.

### Task 5: Connection Inference (Weakest Subsystem)
- **Classification**: `HYBRID` (`RULE-BASED` + `OPTIMIZATION` + `GRAPH NEURAL NETWORK` / `LLM`)
- **Rationale**: Identified in our benchmark as the **WEAKEST SUBSYSTEM** (82% automated accuracy). While gender complementarity and dimensional tolerances are rule-based, predicting complex non-planar 3D assembly graphs for 10+ piece puzzles requires a Graph Neural Network (GNN) or specialized LLM to rank candidate connection topologies.
- **Baseline**: `ConnectionInferencer2D` pairwise port matching.
- **Future Model**: Edge-conditioned Graph Neural Network (GNN) / PyTorch Geometric.

### Task 6: Parametric Feature Recognition
- **Classification**: `CLASSICAL GEOMETRY`
- **Rationale**: Fitting width, depth, position, and radius from analytical 2D geometry is exact and fast ($O(N)$ math). ML is unnecessary and adds non-deterministic noise. Unrecognized freeform curves fall back to preserved raw geometry.
- **Baseline**: `FeatureExtractor` bounding box & circle fitter.
- **Future Model**: Maintained as deterministic `CLASSICAL GEOMETRY`.

### Task 7: Design Retrieval
- **Classification**: `RAG` (Retrieval-Augmented Generation)
- **Rationale**: Searching past validated puzzle designs by natural language description, parametric query, or geometric topology similarity. Uses vector embeddings (Qdrant / FAISS) over canonical puzzle IR graphs.
- **Baseline**: Structural graph matching & exact keyword search.
- **Future Model**: Vector RAG over Canonical IR graph embeddings.

### Task 8: Design Generation
- **Classification**: `HYBRID` (`LLM` + `RAG` + `PARAMETRIC ENGINE`)
- **Rationale**: Synthesizes new 2D cardboard puzzle designs from high-level user specifications by retrieving similar canonical templates via RAG, prompting an LLM for parametric variable assignment, and instantiating the design via the deterministic parametric engine.
- **Baseline**: Template-based parametric generator (`createDefaultParametricPiece2D`).
- **Future Model**: LLM-driven parametric code generation + CAD solver.

### Task 9: Validation
- **Classification**: `DETERMINISTIC` (`RULE-BASED` + `CLASSICAL GEOMETRY`)
- **Rationale**: Physical validity (no rigid body interpenetration, watertight mesh extrusions, structural integrity, material kerf clearances) MUST remain 100% deterministic. ML models cannot guarantee physical or geometric laws.
- **Baseline**: `DatasetQualityValidator` + `validatePuzzleAssembly`.
- **Future Model**: Retained strictly `DETERMINISTIC`.

### Task 10: Repair
- **Classification**: `OPTIMIZATION` (HYBRID: `RULE-BASED OPTIMIZATION` + `LLM` GUIDANCE)
- **Rationale**: Fixing geometric gaps, profile width mismatches, or colliding pieces requires numerical constraint optimization (SQP / Gradient Descent / Nelder-Mead) guided by LLM diagnostics.
- **Baseline**: Analytical gap closing & kerf adjustment.
- **Future Model**: Constrained optimization solver with LLM diagnostic repair loop.

---

## 4. ML Roadmap Specifications for Targeted Tasks

### 1. Connection Inference (Targeted Task for ML)
- **Required Dataset Size**: ~2,500 annotated canonical puzzle graphs (500 pilot + 2,000 synthetic variants).
- **Required Labels**: Ground-truth connection pairs $(i_A, i_B)$ and nominal 3D joining angle $\theta \in \{90^\circ, 180^\circ\}$.
- **Input Format**: Feature graph $G = (V_I, E_C)$ where $V_I$ are interface port node features.
- **Target Output**: Connection adjacency matrix $A_{ij} \in [0, 1]$ and target angle $\theta_{ij}$.
- **Evaluation Metric**: Topological F1 score & Connection Precision/Recall.
- **Baseline Approach**: `ConnectionInferencer2D` (pairwise profile tolerance & gender role check).
- **Future Model Approach**: Edge-conditioned Graph Neural Network (GNN) / PyTorch Geometric.

### 2. Requirement Understanding & Design Generation
- **Required Dataset Size**: 1,000 prompt-to-canonical puzzle JSON pairs.
- **Required Labels**: Valid Canonical Puzzle IR JSON schemas matching natural language prompts.
- **Input Format**: Natural language string (e.g. *"3-piece cardboard desktop phone stand with tab-slot joints"*).
- **Target Output**: Structured Canonical Puzzle IR JSON configuration.
- **Evaluation Metric**: JSON Schema Validity Rate & Parametric Reconstruction IoU.
- **Baseline Approach**: Keyword template lookup (`createDefaultParametricPiece2D`).
- **Future Model Approach**: Qwen-2.5-Coder / Llama-3-70B fine-tuned via LoRA.

### 3. Design Retrieval (RAG)
- **Required Dataset Size**: 5,000 canonical puzzle IR graphs.
- **Required Labels**: Vector embeddings of canonical graph topology and piece bounding properties.
- **Input Format**: Text query or partial 2D sketch features.
- **Target Output**: Top-K nearest matching canonical puzzle designs.
- **Evaluation Metric**: Mean Reciprocal Rank (MRR@K) & Recall@K.
- **Baseline Approach**: Exact structural keyword search.
- **Future Model Approach**: Graph Neural Network Embedding + Qdrant Vector Store.
