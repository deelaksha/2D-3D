/**
 * Design Example Retrieval & Embedding Types (Phase 48).
 */
import type { CanonicalPuzzle } from "../canonical/types";

export interface DesignQueryFilters {
  targetPieceCount?: number;
  targetDimensions?: {
    widthMm: number;
    heightMm: number;
    depthMm?: number;
  };
  connectionTypes?: string[];
  difficulty?: "easy" | "medium" | "hard";
  symmetry?: "none" | "bilateral" | "radial";
  geometryStyle?: "box" | "curved" | "interlocking" | "modular";
  materialId?: string;
  assemblyType?: "rigid" | "articulated" | "multi_angle";
}

export interface DesignEmbedding {
  vectorId: string;
  dimensions: number; // 128-dim
  values: number[];   // Dense feature values
}

export interface DesignRetrievalSimilarity {
  overallScore: number;       // Cosine Similarity (0.0 to 1.0)
  topologyScore: number;      // Graph topology similarity
  dimensionScore: number;     // Physical dimensions similarity
  connectionTypeScore: number;// Joint types overlap
}

export interface RetrievedDesign {
  designId: string;
  canonicalPuzzle: CanonicalPuzzle;
  similarity: DesignRetrievalSimilarity;
  embedding: DesignEmbedding;
  isReferenceOnly: boolean;   // Invariant: MUST NOT be blindly copied by AI
}

export interface DesignRetrievalResult {
  queryId: string;
  retrievedDesigns: RetrievedDesign[];
  topMatch?: RetrievedDesign;
  processingDurationMs: number;
}
