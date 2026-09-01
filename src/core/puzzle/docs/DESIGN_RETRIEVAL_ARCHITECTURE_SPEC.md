# Design-Example Retrieval Architecture Specification (Phase 48)

This document specifies the **Design-Example Retrieval Architecture & In-Memory Vector Store Abstraction** for retrieving reference canonical puzzle designs based on piece count, dimensions, connection topology, connection types, difficulty, symmetry, geometry style, material, and assembly characteristics.

---

## 1. Architectural Mandate & Reference-Only Usage Invariant

> [!IMPORTANT]
> **RETRIEVED DESIGNS ARE REFERENCE-ONLY**:
> - **Reference-Only Flag (`isReferenceOnly: true`)**: Every retrieved design explicitly sets `isReferenceOnly: true`. **The AI layer must NOT blindly copy retrieved geometry**.
> - **Informative Context Only**: Retrieved designs serve strictly to inform new `DesignSpecification` objects, parametric variable assignments, and joint layout strategies.
> - **In-Memory Repository Abstraction**: Implements `DesignRepository` interface with `InMemoryDesignRepository` and `DesignEmbeddingEngine` computing 128-dim dense feature vectors and Cosine Similarity, designed to cleanly connect to a production Vector DB (Qdrant / FAISS / Pinecone) in future phases.
> - **Zero Vector DB Installation**: Zero external vector database dependencies are installed in this phase.

---

## 2. Embedding Vector Formulation & Cosine Similarity Math

The system maps every canonical puzzle IR object into a 128-dimensional dense feature vector $v \in \mathbb{R}^{128}$:

$$v = \begin{bmatrix} \text{norm}(N_{\text{pieces}}), & \text{norm}(N_{\text{connections}}), & \text{norm}(\text{width}_{\text{avg}}), & \text{norm}(\text{height}_{\text{avg}}), & \dots & f_{127} \end{bmatrix}^T$$

Vector similarity between query vector $\vec{u}$ and candidate design vector $\vec{v}$ is calculated using Cosine Similarity:

$$\text{CosineSimilarity}(\vec{u}, \vec{v}) = \frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\| \|\vec{v}\|} = \frac{\sum_{i=1}^{128} u_i v_i}{\sqrt{\sum_{i=1}^{128} u_i^2} \sqrt{\sum_{i=1}^{128} v_i^2}}$$

---

## 3. Future Production Vector Database Integration Roadmap

When scaling design retrieval for production:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        VECTOR DATABASE INTEGRATION ROADMAP                             │
└────────────────────────────────────────────────────────────────────────────────────────┘

  1. Vector Engine Options   • Qdrant (Rust-based, local or cloud vector search)
                             • FAISS (Facebook AI Similarity Search for dense GPU vectors)
                             • Pinecone / Milvus / Weaviate

  2. Graph Embeddings        • Train Graph Convolutional Network (GCN / GraphSAGE) over
                               Canonical Puzzle IR graphs G = (V, E) to produce 512-dim embeddings.

  3. RAG Retrieval Pipeline  • Natural Language Query -> LLM -> Graph Vector Search ->
                               Top-K Reference Designs (isReferenceOnly: true) ->
                               Parametric Specification Synthesizer -> Deterministic CAD Solver.
```

---

## 4. Programmatic API Usage

```typescript
import { DesignRetriever, InMemoryDesignRepository } from "@/core/puzzle/retrievalsystem";

// 1. Instantiating retriever with repository
const repo = new InMemoryDesignRepository();
const retriever = new DesignRetriever(repo);

// 2. Querying reference designs for a 3-piece puzzle
const result = await retriever.retrieveDesigns({ targetPieceCount: 3 }, 3);

console.log(`Top Match: ${result.topMatch?.designId} (Similarity: ${(result.topMatch?.similarity.overallScore * 100).toFixed(1)}%)`);
console.log(`Is Reference Only: ${result.topMatch?.isReferenceOnly}`); // true
```
