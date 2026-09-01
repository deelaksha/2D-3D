/**
 * Design Example Retrieval Engine & In-Memory Vector Store Abstraction (Phase 48).
 */
import type { DesignEmbedding, DesignQueryFilters, DesignRetrievalResult, DesignRetrievalSimilarity, RetrievedDesign } from "./types";
import type { CanonicalPuzzle } from "../canonical/types";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../canonical/defaults";

export interface DesignRepository {
  storeDesign(puzzle: CanonicalPuzzle): Promise<void>;
  getDesign(designId: string): Promise<CanonicalPuzzle | undefined>;
  listDesigns(): Promise<CanonicalPuzzle[]>;
  queryByFilters(filters: DesignQueryFilters): Promise<CanonicalPuzzle[]>;
}

/**
 * Design Embedding Engine.
 * Computes 128-dimensional dense feature vectors and Cosine Similarity.
 */
export class DesignEmbeddingEngine {
  /**
   * Computes a 128-dimensional dense feature vector for a CanonicalPuzzle.
   */
  static computeEmbedding(puzzle: CanonicalPuzzle): DesignEmbedding {
    const values = new Array(128).fill(0.0);

    const pieceCount = puzzle.pieces.length;
    const connCount = puzzle.connections.length;

    // Feature normalization
    values[0] = Math.min(1.0, pieceCount / 20.0);
    values[1] = Math.min(1.0, connCount / 30.0);

    // Dimension features
    let avgW = 0, avgH = 0;
    puzzle.pieces.forEach((p) => {
      avgW += p.dimensions.width;
      avgH += p.dimensions.height;
    });
    values[2] = Math.min(1.0, (avgW / Math.max(1, pieceCount)) / 500.0);
    values[3] = Math.min(1.0, (avgH / Math.max(1, pieceCount)) / 500.0);

    // Populate remaining vector dimensions deterministically
    for (let i = 4; i < 128; i++) {
      values[i] = Math.abs(Math.sin((i + pieceCount * 7 + connCount * 13)));
    }

    return {
      vectorId: `emb_${puzzle.metadata.id || "design"}`,
      dimensions: 128,
      values,
    };
  }

  /**
   * Computes Cosine Similarity between two 128-dim dense embedding vectors.
   */
  static computeCosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;

    for (let i = 0; i < Math.min(vecA.length, vecB.length); i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dotProduct / denom : 0.0;
  }
}

/**
 * In-Memory Design Repository (Abstraction over Vector DBs like Qdrant / FAISS).
 */
export class InMemoryDesignRepository implements DesignRepository {
  private designs = new Map<string, CanonicalPuzzle>();

  constructor() {
    this.seedDefaultTemplates();
  }

  private seedDefaultTemplates(): void {
    // 1. Simple 3-Piece Box Template
    const boxPuz = createEmptyCanonicalPuzzle("3-Piece Interlocking Box");
    boxPuz.metadata.id = "tpl_box_3pc";
    boxPuz.pieces.push(
      createCanonicalPiece("Base Plate", { width: 150, height: 150, depth: 3.0 }, 3.0),
      createCanonicalPiece("Side Left", { width: 150, height: 100, depth: 3.0 }, 3.0),
      createCanonicalPiece("Side Right", { width: 150, height: 100, depth: 3.0 }, 3.0)
    );

    // 2. 5-Piece Desktop Chair Template
    const chairPuz = createEmptyCanonicalPuzzle("5-Piece Desktop Chair");
    chairPuz.metadata.id = "tpl_chair_5pc";
    chairPuz.pieces.push(
      createCanonicalPiece("Seat Plate", { width: 120, height: 120, depth: 3.0 }, 3.0),
      createCanonicalPiece("Back Rest", { width: 120, height: 180, depth: 3.0 }, 3.0),
      createCanonicalPiece("Leg Front", { width: 120, height: 100, depth: 3.0 }, 3.0),
      createCanonicalPiece("Leg Rear Left", { width: 40, height: 100, depth: 3.0 }, 3.0),
      createCanonicalPiece("Leg Rear Right", { width: 40, height: 100, depth: 3.0 }, 3.0)
    );

    this.designs.set(boxPuz.metadata.id, boxPuz);
    this.designs.set(chairPuz.metadata.id, chairPuz);
  }

  async storeDesign(puzzle: CanonicalPuzzle): Promise<void> {
    const id = puzzle.metadata.id || `puz_${Date.now()}`;
    this.designs.set(id, puzzle);
  }

  async getDesign(designId: string): Promise<CanonicalPuzzle | undefined> {
    return this.designs.get(designId);
  }

  async listDesigns(): Promise<CanonicalPuzzle[]> {
    return Array.from(this.designs.values());
  }

  async queryByFilters(filters: DesignQueryFilters): Promise<CanonicalPuzzle[]> {
    const all = await this.listDesigns();
    return all.filter((puz) => {
      if (filters.targetPieceCount && puz.pieces.length !== filters.targetPieceCount) {
        return false;
      }
      return true;
    });
  }
}

/**
 * Design Retriever Engine.
 */
export class DesignRetriever {
  private repository: DesignRepository;

  constructor(repository?: DesignRepository) {
    this.repository = repository || new InMemoryDesignRepository();
  }

  /**
   * Retrieves reference canonical puzzle designs matching query filters & vector similarity ranking.
   */
  async retrieveDesigns(filters: DesignQueryFilters, topK: number = 3): Promise<DesignRetrievalResult> {
    const startTime = Date.now();
    const queryId = `qry_${Date.now()}`;

    const candidates = await this.repository.listDesigns();
    const retrieved: RetrievedDesign[] = [];

    // Synthesize target query embedding from filters
    const queryPuzzle = createEmptyCanonicalPuzzle("Query Puzzle");
    const targetCount = filters.targetPieceCount || 3;
    for (let i = 0; i < targetCount; i++) {
      queryPuzzle.pieces.push(createCanonicalPiece(`Q${i}`, { width: 100, height: 100, depth: 3.0 }, 3.0));
    }
    const queryEmb = DesignEmbeddingEngine.computeEmbedding(queryPuzzle);

    candidates.forEach((cand) => {
      const candEmb = DesignEmbeddingEngine.computeEmbedding(cand);
      const similarityScore = DesignEmbeddingEngine.computeCosineSimilarity(queryEmb.values, candEmb.values);

      const sim: DesignRetrievalSimilarity = {
        overallScore: similarityScore,
        topologyScore: similarityScore,
        dimensionScore: similarityScore,
        connectionTypeScore: similarityScore,
      };

      retrieved.push({
        designId: cand.metadata.id,
        canonicalPuzzle: cand,
        similarity: sim,
        embedding: candEmb,
        isReferenceOnly: true, // Strict Invariant: MUST NOT be blindly copied
      });
    });

    // Rank by similarity score descending
    retrieved.sort((a, b) => b.similarity.overallScore - a.similarity.overallScore);
    const topRanked = retrieved.slice(0, topK);

    return {
      queryId,
      retrievedDesigns: topRanked,
      topMatch: topRanked[0],
      processingDurationMs: Date.now() - startTime,
    };
  }
}
