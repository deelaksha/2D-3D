# Strategic Roadmap for Future ML Implementation

> **Platform**: Parametric 2D-to-3D Cardboard Puzzle System  
> **Target Timeline**: Future Model Training Phases (Post-Architecture Phase 24)  

---

## Executive Overview

This roadmap details the phased transition from the authoritative **Deterministic Geometry Engine** to an **AI-Assisted Parametric Design & Optimization Ecosystem**.

### Ground Rule & Core Safeguard
> [!IMPORTANT]
> The machine learning models introduced in this roadmap **will NEVER directly generate raw 3D meshes or uncontrolled CAD geometry**. All ML predictions must output structured `ParametricDesignSpecification` JSON payloads or parameter adjustment vectors (`ParameterAdjustment[]`), which are strictly re-generated and validated by the deterministic core engine.

---

## Phase A: Synthetic Dataset Generation & Validation (Data Preparation)

### Goal
Populate `training_data/splits/` with 100,000+ verified synthetic `CompleteDatasetItem` JSON examples generated deterministically from valid puzzle configurations.

### Key Milestones
1. **Multi-Format Ingestion**: Implement production file adapters in `FormatAdapterRegistry` for SVG contour extraction, DXF polyline ingestion, and STEP CAD boundary parsing.
2. **Automated Data Synthesizer**: Run parallel batch jobs invoking `PuzzleDatasetExporter` across randomized parameter distributions.
3. **Automated Quality Filtering**: Filter out any synthetic items that fail 5-domain validation (`PuzzleValidationEngine.validatePuzzle`).
4. **Data Partitioning**: Split validated items into `train/` (80%), `validation/` (10%), and `test/` (10%) splits under `training_data/splits/`.

---

## Phase B: Parametric CAD Encoder & Spec Predictor Training (Model Training)

### Goal
Train a Transformer-based neural network model to predict valid `ParametricDesignSpecification` structured JSON payloads from user prompts, 2D sketch images, or reference DXF files.

### Key Milestones
1. **Multi-Modal Encoder Architecture**: Combine a Vision Transformer (ViT) image encoder with a text LLM backbone (e.g. Gemini / Llama derivative).
2. **Structured JSON Output Head**: Train constrained decoding heads enforcing schema adherence to `dataset_schema.json`.
3. **Loss Function Design**:
   - $\mathcal{L}_{\text{schema}}$: Token cross-entropy for valid JSON syntax.
   - $\mathcal{L}_{\text{param}}$: Mean Squared Error (MSE) loss on continuous parameters (piece count, thickness, dimensions).
   - $\mathcal{L}_{\text{validity}}$: Differentiable penalty derived from deterministic validator feedback.
4. **Offline Evaluation**: Benchmark prediction accuracy and schema validity rate ($\ge 98\%$).

---

## Phase C: RAG Vector Database & Neural Retrieval (Knowledge Retrieval)

### Goal
Build a vector retrieval pipeline replacing `MockDesignRetrievalSystem` with a dense vector database (e.g. ChromaDB / Pinecone / Qdrant).

### Key Milestones
1. **Dense Parametric Embeddings**: Train a dual-encoder embedding model mapping 9-attribute `DesignMetadata` and 2D topology graphs into a shared metric embedding space $\mathbb{R}^{512}$.
2. **Vector DB Indexing**: Index 100,000+ reference designs into vector database collections with multi-attribute payload filtering.
3. **Non-Blind-Copy Constraint Enforcement**: Attach automated prompt wrappers and adaptation guidelines (`referenceAdaptationGuidelines`) instructing LLMs to use retrieved vectors purely as structural references.

---

## Phase D: Reinforcement Learning & Diffusion Optimization (Design Search)

### Goal
Implement RL policy agents and Diffusion models to replace `DeterministicGridOptimizer` for high-dimensional parameter search spaces.

### Key Milestones
1. **RL Environment Setup**: Formulate puzzle parameter tuning as a Markov Decision Process (MDP):
   - **State $S$**: Current canonical puzzle parameters + `UnifiedValidationReport`.
   - **Action $A$**: Parameter delta vector $\Delta \mathbf{P} \in \mathbb{R}^K$.
   - **Reward $R$**: Multi-objective fitness score from `evaluateDesignScore` (with heavy negative penalties for HARD constraint violations).
2. **Policy Gradient / PPO Training**: Train PPO agents to maximize reward while guaranteeing $0.0$ hard constraint violations.
3. **Diffusion Parameter Sampler**: Train a Denoising Diffusion Probabilistic Model (DDPM) to sample optimal 2D contour parameter vectors.

---

## Phase E: Autonomous Closed-Loop AI Design & Repair (End-to-End Autonomy)

### Goal
Achieve fully autonomous, self-correcting design generation where AI proposals and deterministic validation iterate seamlessly in real-time.

### Key Milestones
1. **Closed-Loop Repair Engine**: Connect LLM repair agents with `DesignRepairEngine`. When validation fails, the agent consumes diagnostic `AIRepairDirective` items, generates `ParameterAdjustment[]`, and re-evaluates until `isValid === true`.
2. **Human-in-the-Loop Oversight UI**: Provide visual 3D preview, collision highlight overlays, and step-by-step assembly animation controls in the web interface.
3. **Production Deployment**: Package end-to-end pipeline into containerized microservices.
