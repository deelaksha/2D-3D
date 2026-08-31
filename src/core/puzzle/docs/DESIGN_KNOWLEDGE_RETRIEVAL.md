# Design Knowledge & Retrieval Architecture Specification (Phase 19)

This document specifies the **Design Knowledge & Retrieval Subsystem** for the Parametric 2D-to-3D Cardboard Puzzle System.

---

## 1. Core Mandates & Non-Blind-Copy Policy

> [!IMPORTANT]
> **NO REAL VECTOR DB & NO LIVE EMBEDDINGS YET**:
> This phase defines domain types, query interfaces, similarity scoring logic, indexing guidelines, documentation, and a `MockDesignRetrievalSystem` with synthetic mock data. No real vector databases (e.g. Pinecone, ChromaDB) are populated in this phase.

> [!CAUTION]
> **THE NON-BLIND-COPY MANDATE**:
> Retrieved designs **MUST NEVER BE BLINDLY COPIED**. They are treated strictly as structural and parametric reference inspiration for generating a new design. All final piece dimensions, interface frames, and 3D joining angles must be re-evaluated and validated by the authoritative deterministic geometry/constraint engine.

---

## 2. Multi-Attribute Metadata Indexing

Future real puzzle designs are indexed using 9 multi-attribute criteria:

1. **`pieceCount`**: Integer count of pieces in puzzle.
2. **`connectionTypes`**: Joint types (`"tab_slot"`, `"interlock"`, `"finger"`, `"dovetail"`).
3. **`difficulty`**: `"easy" | "medium" | "hard" | "expert"`.
4. **`geometryStyle`**: Architectural style (`"castle"`, `"box"`, `"bridge"`, `"organic"`).
5. **`materialId`**: Cardboard stock specification (`"cardboard-2mm"`).
6. **`dimensions`**: Outer bounding envelope (`widthMm`, `heightMm`, `depthMm`).
7. **`assemblyCharacteristics`**: Max joining angle (e.g. 90°, 45°), non-planar status, assembly steps.
8. **`topology`**: Component count, tree structure flag, average vertex degree.
9. **`interfacePatterns`**: Gender roles and joint patterns (`"male_tab_female_slot"`).

---

## 3. Reference Adaptation Guidelines

Every search result (`DesignSimilarity`) returns explicit adaptation instructions:

```json
{
  "similarityScore": 0.85,
  "matchingCriteria": ["Piece count (20)", "Connection type ('tab_slot')", "Geometry style ('castle')"],
  "referenceAdaptationGuidelines": "DO NOT BLINDLY COPY THIS DESIGN. Treat strictly as a structural & parametric reference. Re-evaluate piece dimensions, interface positions, and 3D joining angles using the authoritative deterministic engine."
}
```
