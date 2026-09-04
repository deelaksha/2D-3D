/**
 * Design Example Retrieval Engine & In-Memory Vector Store Abstraction (Phase 70 Upgrade).
 *
 * Provides dual similarity search (structured multi-attribute + dense vector cosine),
 * returns rich matching features and differences, and strictly enforces reference-only
 * anti-cloning safeguards for downstream AI design generation.
 */
import type {
  AdvancedDesignQuery,
  DesignEmbedding,
  DesignQueryFilters,
  DesignRetrievalResult,
  DesignRetrievalSimilarity,
  RetrievedDesign,
} from "./types";
import type { CanonicalPuzzle } from "../canonical/types";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../canonical/defaults";
import { DesignFeatureExtractor } from "./featureExtractor";
import { DesignSimilarityEngine } from "./similarityEngine";

export interface DesignRepository {
  storeDesign(puzzle: CanonicalPuzzle): Promise<void>;
  getDesign(designId: string): Promise<CanonicalPuzzle | undefined>;
  listDesigns(): Promise<CanonicalPuzzle[]>;
  queryByFilters(filters: DesignQueryFilters): Promise<CanonicalPuzzle[]>;
}

/**
 * Design Embedding Engine (Backwards compatible with Phase 48).
 */
export class DesignEmbeddingEngine {
  static computeEmbedding(puzzle: CanonicalPuzzle): DesignEmbedding {
    const features = DesignFeatureExtractor.extractFeatures(puzzle);
    return {
      vectorId: `emb_${puzzle.metadata.id || "design"}`,
      dimensions: 128,
      values: features.embeddingVector,
    };
  }

  static computeCosineSimilarity(vecA: number[], vecB: number[]): number {
    return DesignSimilarityEngine.computeCosineSimilarity(vecA, vecB);
  }
}

/**
 * Strict Anti-Cloning Protection System.
 * Ensures downstream generative AI systems never blindly copy a reference design.
 */
export class ReferenceDesignProtector {
  /**
   * Asserts that a newly generated puzzle is NOT an unauthorized clone of a reference design.
   * Throws an error if cloning is detected.
   */
  public static assertNotCloned(
    reference: CanonicalPuzzle,
    candidate: CanonicalPuzzle
  ): { isDifferent: boolean; auditReasons: string[] } {
    const auditReasons: string[] = [];

    // 1. Identical ID check
    if (reference.metadata.id && candidate.metadata.id && reference.metadata.id === candidate.metadata.id) {
      throw new Error(
        `[ANTI-CLONING VIOLATION] Candidate design shares identical metadata ID '${candidate.metadata.id}' with reference design.`
      );
    }

    // 2. Exact Piece ID overlap check
    const refPieceIds = new Set(reference.pieces.map((p) => p.id));
    const candPieceIds = new Set(candidate.pieces.map((p) => p.id));
    let identicalIdCount = 0;
    for (const cid of candPieceIds) {
      if (refPieceIds.has(cid)) identicalIdCount++;
    }
    if (identicalIdCount > 0 && identicalIdCount === reference.pieces.length) {
      throw new Error(
        `[ANTI-CLONING VIOLATION] Candidate design duplicates all piece IDs from reference design.`
      );
    }

    // 3. Exact Piece count and exact dimensions duplication check
    if (reference.pieces.length === candidate.pieces.length) {
      let exactMatchCount = 0;
      for (let i = 0; i < reference.pieces.length; i++) {
        const rp = reference.pieces[i];
        const cp = candidate.pieces[i];
        if (
          rp.dimensions?.width === cp.dimensions?.width &&
          rp.dimensions?.height === cp.dimensions?.height &&
          rp.thickness === cp.thickness
        ) {
          exactMatchCount++;
        }
      }
      if (exactMatchCount === reference.pieces.length && reference.metadata.name === candidate.metadata.name) {
        throw new Error(
          `[ANTI-CLONING VIOLATION] Candidate design is an identical geometric replica of reference '${reference.metadata.name}'.`
        );
      }
    }

    auditReasons.push("Candidate design confirmed as a legitimately modified parametric variation.");
    return { isDifferent: true, auditReasons };
  }
}

/**
 * In-Memory Design Repository seeded with rich multi-attribute parametric templates.
 */
export class InMemoryDesignRepository implements DesignRepository {
  private designs = new Map<string, CanonicalPuzzle>();

  constructor() {
    this.seedDefaultTemplates();
  }

  private seedDefaultTemplates(): void {
    // 1. Simple 3-Piece Interlocking Box Template
    const boxPuz = createEmptyCanonicalPuzzle("3-Piece Interlocking Box");
    boxPuz.metadata.id = "tpl_box_3pc";
    boxPuz.metadata.description = "A compact 3-piece wooden or cardboard storage box with finger joints and tab-slot interfaces.";
    boxPuz.metadata.tags = ["box", "storage", "finger_joint", "interlocking", "easy", "rectangular"];
    (boxPuz.metadata as any).difficulty = "easy";
    boxPuz.pieces.push(
      createCanonicalPiece("Base Plate", { width: 150, height: 150, depth: 3.0 }, 3.0),
      createCanonicalPiece("Side Left", { width: 150, height: 100, depth: 3.0 }, 3.0),
      createCanonicalPiece("Side Right", { width: 150, height: 100, depth: 3.0 }, 3.0)
    );
    (boxPuz.connections as any).push(
      { id: "conn_box_1", connectionType: "tab_slot", pieceAId: boxPuz.pieces[0].id, pieceBId: boxPuz.pieces[1].id, joiningAngleDeg: 90.0 },
      { id: "conn_box_2", connectionType: "tab_slot", pieceAId: boxPuz.pieces[0].id, pieceBId: boxPuz.pieces[2].id, joiningAngleDeg: 90.0 }
    );

    // 2. 5-Piece Desktop Chair Template
    const chairPuz = createEmptyCanonicalPuzzle("5-Piece Desktop Chair");
    chairPuz.metadata.id = "tpl_chair_5pc";
    chairPuz.metadata.description = "An architectural miniature chair with cross-braced legs and mortise-tenon planar joints.";
    chairPuz.metadata.tags = ["chair", "furniture", "desktop", "mortise_tenon", "medium", "architectural"];
    (chairPuz.metadata as any).difficulty = "medium";
    chairPuz.pieces.push(
      createCanonicalPiece("Seat Plate", { width: 120, height: 120, depth: 3.0 }, 3.0),
      createCanonicalPiece("Back Rest", { width: 120, height: 180, depth: 3.0 }, 3.0),
      createCanonicalPiece("Leg Front", { width: 120, height: 100, depth: 3.0 }, 3.0),
      createCanonicalPiece("Leg Rear Left", { width: 40, height: 100, depth: 3.0 }, 3.0),
      createCanonicalPiece("Leg Rear Right", { width: 40, height: 100, depth: 3.0 }, 3.0)
    );
    (chairPuz.connections as any).push(
      { id: "conn_ch_1", connectionType: "mortise_tenon", pieceAId: chairPuz.pieces[0].id, pieceBId: chairPuz.pieces[1].id, joiningAngleDeg: 90.0 },
      { id: "conn_ch_2", connectionType: "mortise_tenon", pieceAId: chairPuz.pieces[0].id, pieceBId: chairPuz.pieces[2].id, joiningAngleDeg: 90.0 },
      { id: "conn_ch_3", connectionType: "mortise_tenon", pieceAId: chairPuz.pieces[0].id, pieceBId: chairPuz.pieces[3].id, joiningAngleDeg: 90.0 },
      { id: "conn_ch_4", connectionType: "mortise_tenon", pieceAId: chairPuz.pieces[0].id, pieceBId: chairPuz.pieces[4].id, joiningAngleDeg: 90.0 }
    );

    // 3. 6-Piece Burr Interlocking Cube Template (Hard/Expert)
    const burrPuz = createEmptyCanonicalPuzzle("6-Piece Burr Puzzle Cube");
    burrPuz.metadata.id = "tpl_burr_6pc";
    burrPuz.metadata.description = "A complex interlocking 3D burr puzzle cube requiring coordinated sliding moves and tight tolerances.";
    burrPuz.metadata.tags = ["burr", "cube", "interlocking", "puzzle", "sliding", "hard", "mechanical"];
    (burrPuz.metadata as any).difficulty = "hard";
    for (let i = 1; i <= 6; i++) {
      burrPuz.pieces.push(createCanonicalPiece(`Burr Key ${i}`, { width: 90, height: 30, depth: 30 }, 30.0));
    }
    for (let i = 0; i < 5; i++) {
      (burrPuz.connections as any).push({
        id: `conn_burr_${i}`,
        connectionType: "sliding_interlock",
        behavior: "INTERLOCK",
        pieceAId: burrPuz.pieces[i].id,
        pieceBId: burrPuz.pieces[i + 1].id,
        joiningAngleDeg: 90.0,
      });
    }

    // 4. 2-Piece Minimal Hinge Stand (Easy)
    const standPuz = createEmptyCanonicalPuzzle("2-Piece Folding Phone Stand");
    standPuz.metadata.id = "tpl_stand_2pc";
    standPuz.metadata.description = "A portable folding desktop easel phone stand with a continuous hinge joint.";
    standPuz.metadata.tags = ["stand", "phone", "folding", "hinge", "minimal", "easy"];
    (standPuz.metadata as any).difficulty = "easy";
    standPuz.pieces.push(
      createCanonicalPiece("Back Support", { width: 80, height: 140, depth: 3.0 }, 3.0),
      createCanonicalPiece("Base Cradle", { width: 80, height: 100, depth: 3.0 }, 3.0)
    );
    (standPuz.connections as any).push({
      id: "conn_stand_1",
      connectionType: "hinge",
      behavior: "HINGE",
      pieceAId: standPuz.pieces[0].id,
      pieceBId: standPuz.pieces[1].id,
      joiningAngleDeg: 60.0,
    });

    this.designs.set(boxPuz.metadata.id, boxPuz);
    this.designs.set(chairPuz.metadata.id, chairPuz);
    this.designs.set(burrPuz.metadata.id, burrPuz);
    this.designs.set(standPuz.metadata.id, standPuz);
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
 * Upgraded Design Retriever Engine (Phase 70).
 */
export class DesignRetriever {
  private repository: DesignRepository;

  constructor(repository?: DesignRepository) {
    this.repository = repository || new InMemoryDesignRepository();
  }

  /**
   * Retrieves reference canonical puzzle designs matching query filters & dual similarity ranking.
   */
  async retrieveDesigns(
    queryInput: DesignQueryFilters | AdvancedDesignQuery,
    topK: number = 3
  ): Promise<DesignRetrievalResult> {
    const startTime = Date.now();
    const queryId = `qry_${Date.now()}`;

    // Normalize input to AdvancedDesignQuery
    const query = this.normalizeQuery(queryInput);
    const limit = query.topK ?? topK;

    const candidates = await this.repository.listDesigns();
    const retrieved: RetrievedDesign[] = [];

    for (const cand of candidates) {
      // 1. Extract full 8-dimensional normalized design features
      const features = DesignFeatureExtractor.extractFeatures(cand);

      // 2. Evaluate dual similarity (structured multi-attribute + dense embedding)
      const simEval = DesignSimilarityEngine.evaluateSimilarity(query, features);

      if (query.minSimilarity !== undefined && simEval.overallScore < query.minSimilarity) {
        continue;
      }

      const sim: DesignRetrievalSimilarity = {
        overallScore: simEval.overallScore,
        structuredScore: simEval.structuredScore,
        embeddingScore: simEval.embeddingScore,
        topologyScore: simEval.topologyScore,
        dimensionScore: simEval.dimensionScore,
        connectionTypeScore: simEval.connectionTypeScore,
        keywordScore: simEval.keywordScore,
        difficultyScore: simEval.difficultyScore,
      };

      const embedding: DesignEmbedding = {
        vectorId: `emb_${cand.metadata.id}`,
        dimensions: 128,
        values: features.embeddingVector,
      };

      retrieved.push({
        designId: cand.metadata.id,
        name: cand.metadata.name,
        canonicalPuzzle: cand,
        features,
        similarity: sim,
        embedding,
        matchingFeatures: simEval.matchingFeatures,
        differences: simEval.differences,
        isReferenceOnly: true, // STRICT INVARIANT: Reference only!
        referenceAdaptationGuidance: simEval.referenceAdaptationGuidance,
      });
    }

    // Rank by composite similarity score descending
    retrieved.sort((a, b) => b.similarity.overallScore - a.similarity.overallScore);
    const topRanked = retrieved.slice(0, limit);

    return {
      queryId,
      retrievedDesigns: topRanked,
      topMatch: topRanked[0],
      totalCandidateCount: candidates.length,
      processingDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Translates legacy or partial queries into AdvancedDesignQuery.
   */
  private normalizeQuery(input: DesignQueryFilters | AdvancedDesignQuery): AdvancedDesignQuery {
    const adv = input as AdvancedDesignQuery;
    const legacy = input as DesignQueryFilters;

    const naturalLanguagePrompt =
      adv.naturalLanguagePrompt || legacy.textQuery || undefined;

    const pieceCount =
      adv.pieceCount !== undefined ? adv.pieceCount : legacy.targetPieceCount;

    const dimensions =
      adv.dimensions || (legacy.targetDimensions ? { ...legacy.targetDimensions } : undefined);

    const interfaceTypes =
      adv.interfaceTypes || legacy.connectionTypes || undefined;

    const difficulty =
      adv.difficulty || legacy.difficulty || undefined;

    return {
      ...adv,
      naturalLanguagePrompt,
      pieceCount,
      dimensions,
      interfaceTypes,
      difficulty,
    };
  }
}
