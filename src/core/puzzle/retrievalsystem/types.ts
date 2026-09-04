/**
 * Upgraded Design Example Retrieval & Normalized Feature Types (Phase 70).
 *
 * CRITICAL RULE:
 * Retrieved designs are strictly references for parametric adaptation.
 * Never automatically clone or blindly duplicate a retrieved design.
 */
import type { CanonicalPuzzle } from "../canonical/types";

/**
 * Normalized multidimensional design feature representation.
 * Encapsulates all 8 searchable design dimensions in structured and vector forms.
 */
export interface NormalizedDesignFeature {
  /** 1. Natural-language tokens and semantic keywords extracted from title, description, and tags */
  keywords: string[];

  /** 2. Total piece count */
  pieceCount: number;

  /** 3. 3D bounding dimensions and geometric proportions */
  dimensions: {
    widthMm: number;
    heightMm: number;
    depthMm: number;
    boundingVolumeMm3: number;
    aspectRatio: number;
  };

  /** 4. Connection graph topology metrics */
  connectionTopology: {
    connectionCount: number;
    density: number;
    averageDegree: number;
    isTreeStructure: boolean;
    cycleCount: number;
  };

  /** 5. Distinct interface joint mechanism types present */
  interfaceTypes: string[];

  /** 6. Formal difficulty classification and continuous score (Phase 69 alignment) */
  difficulty: {
    level: "easy" | "medium" | "hard" | "expert";
    score: number; // 0.0 to 100.0
  };

  /** 7. Assembly characteristics and kinematic degrees of freedom */
  assemblyCharacteristics: {
    sequenceLength: number;
    isNonPlanar: boolean;
    maxJoiningAngleDeg: number;
    dofCount: number;
  };

  /** 8. Fine geometric features */
  geometryFeatures: {
    averageThicknessMm: number;
    totalSurfaceAreaMm2: number;
    symmetryOrder: number;
    style: string;
  };

  /** Dense normalized embedding vector for vector space / cosine similarity */
  embeddingVector: number[];
}

/**
 * Searchable query encompassing all 8 dimensions.
 */
export interface AdvancedDesignQuery {
  /** Natural-language text description or design prompt */
  naturalLanguagePrompt?: string;

  /** Target piece count or acceptable range */
  pieceCount?: number | { min?: number; max?: number; target?: number };

  /** Desired bounding dimensions */
  dimensions?: {
    widthMm?: number;
    heightMm?: number;
    depthMm?: number;
    tolerancePercent?: number;
  };

  /** Desired connection topology preferences */
  connectionTopology?: {
    preferredDensity?: number;
    requireTree?: boolean;
  };

  /** Required or preferred interface types (e.g. ["tab_slot", "sliding", "interlock", "hinge"]) */
  interfaceTypes?: string[];

  /** Target difficulty level or continuous score */
  difficulty?: "easy" | "medium" | "hard" | "expert" | { targetScore?: number };

  /** Desired assembly characteristics */
  assemblyCharacteristics?: {
    maxSteps?: number;
    allowNonPlanar?: boolean;
  };

  /** Geometric features and symmetry constraints */
  geometryFeatures?: {
    preferredThicknessMm?: number;
    symmetry?: number;
    style?: string;
  };

  /** Custom weight distribution across the 8 dimensions */
  weights?: {
    naturalLanguage?: number;
    pieceCount?: number;
    dimensions?: number;
    topology?: number;
    interfaceTypes?: number;
    difficulty?: number;
    assemblyCharacteristics?: number;
    geometryFeatures?: number;
  };

  /** Balance between structured similarity and dense embedding similarity (alpha in [0.0, 1.0], default: 0.6) */
  structuredEmbeddingAlpha?: number;

  /** Maximum candidate results to return */
  topK?: number;

  /** Minimum overall similarity threshold (0.0 to 1.0) */
  minSimilarity?: number;
}

/**
 * Legacy query filters (maintained for backwards compatibility with Phase 48).
 */
export interface DesignQueryFilters {
  targetPieceCount?: number;
  targetDimensions?: {
    widthMm: number;
    heightMm: number;
    depthMm?: number;
  };
  connectionTypes?: string[];
  difficulty?: "easy" | "medium" | "hard" | "expert";
  symmetry?: "none" | "bilateral" | "radial";
  geometryStyle?: "box" | "curved" | "interlocking" | "modular";
  materialId?: string;
  assemblyType?: "rigid" | "articulated" | "multi_angle";
  textQuery?: string;
}

export interface DesignEmbedding {
  vectorId: string;
  dimensions: number;
  values: number[];
}

export interface DesignRetrievalSimilarity {
  overallScore: number;       // Composite Similarity (0.0 to 1.0)
  structuredScore: number;    // Structured multi-attribute similarity
  embeddingScore: number;     // Dense vector cosine similarity
  topologyScore: number;      // Graph topology similarity
  dimensionScore: number;     // Physical dimensions similarity
  connectionTypeScore: number;// Joint types overlap
  keywordScore?: number;      // Natural language / keyword overlap
  difficultyScore?: number;   // Difficulty alignment
}

/**
 * Explicit matching feature summary explaining why a design was retrieved.
 */
export interface MatchingFeatureSummary {
  dimension: string;
  description: string;
  similarity: number; // 0.0 to 1.0
}

/**
 * Explicit difference indicating where the reference design deviates from the query.
 */
export interface FeatureDifference {
  dimension: string;
  queryTarget: string | number;
  designValue: string | number;
  deltaDescription: string;
}

/**
 * Enriched retrieved design record with reference protection and explanation telemetry.
 */
export interface RetrievedDesign {
  designId: string;
  name: string;
  canonicalPuzzle: CanonicalPuzzle;
  features: NormalizedDesignFeature;
  similarity: DesignRetrievalSimilarity;
  embedding: DesignEmbedding;

  /** Features that strongly matched the query */
  matchingFeatures: MatchingFeatureSummary[];

  /** Differences where the design deviates from the query */
  differences: FeatureDifference[];

  /**
   * STRICT INVARIANT:
   * Retrieved designs are references only. Never automatically clone or duplicate.
   */
  isReferenceOnly: true;

  /** Concrete parametric guidelines detailing how downstream AI should adapt this design */
  referenceAdaptationGuidance: string;
}

export interface DesignRetrievalResult {
  queryId: string;
  retrievedDesigns: RetrievedDesign[];
  topMatch?: RetrievedDesign;
  totalCandidateCount: number;
  processingDurationMs: number;
}
