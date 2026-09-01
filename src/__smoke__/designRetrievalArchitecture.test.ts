import { describe, expect, it } from "vitest";
import { DesignEmbeddingEngine, DesignRetriever, InMemoryDesignRepository } from "../core/puzzle/retrievalsystem/designRetriever";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../core/puzzle/canonical/defaults";

describe("Design Example Retrieval Architecture (Phase 48)", () => {
  it("1. InMemoryDesignRepository stores and lists canonical design templates", async () => {
    const repo = new InMemoryDesignRepository();
    const list = await repo.listDesigns();

    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.some((p) => p.metadata.id === "tpl_box_3pc")).toBe(true);
    expect(list.some((p) => p.metadata.id === "tpl_chair_5pc")).toBe(true);
  });

  it("2. DesignEmbeddingEngine computes 128-dim dense embeddings and cosine similarity math", () => {
    const puz1 = createEmptyCanonicalPuzzle("Box Design");
    puz1.pieces.push(createCanonicalPiece("Base", { width: 100, height: 100, depth: 3.0 }, 3.0));

    const emb1 = DesignEmbeddingEngine.computeEmbedding(puz1);
    expect(emb1.dimensions).toBe(128);
    expect(emb1.values.length).toBe(128);

    const simSelf = DesignEmbeddingEngine.computeCosineSimilarity(emb1.values, emb1.values);
    expect(simSelf).toBeCloseTo(1.0, 5); // Self-similarity must be 1.0
  });

  it("3. DesignRetriever retrieves top matching reference designs ranked by similarity score", async () => {
    const retriever = new DesignRetriever();
    const result = await retriever.retrieveDesigns({ targetPieceCount: 3 }, 2);

    expect(result.retrievedDesigns.length).toBeGreaterThan(0);
    expect(result.topMatch).toBeDefined();
    expect(result.topMatch?.similarity.overallScore).toBeGreaterThan(0.0);
  });

  it("4. verifies isReferenceOnly: true invariant flag on all retrieved reference designs", async () => {
    const retriever = new DesignRetriever();
    const result = await retriever.retrieveDesigns({ targetPieceCount: 3 });

    result.retrievedDesigns.forEach((item) => {
      expect(item.isReferenceOnly).toBe(true); // MUST NOT be blindly copied
    });
  });

  it("5. stores a new custom design and retrieves it by filter query", async () => {
    const repo = new InMemoryDesignRepository();
    const customPuz = createEmptyCanonicalPuzzle("8-Piece Modular Stand");
    customPuz.metadata.id = "custom_stand_8pc";
    for (let i = 0; i < 8; i++) {
      customPuz.pieces.push(createCanonicalPiece(`Part ${i}`, { width: 80, height: 80, depth: 3.0 }, 3.0));
    }
    await repo.storeDesign(customPuz);

    const retriever = new DesignRetriever(repo);
    const result = await retriever.retrieveDesigns({ targetPieceCount: 8 }, 1);

    expect(result.topMatch?.designId).toBe("custom_stand_8pc");
  });
});
