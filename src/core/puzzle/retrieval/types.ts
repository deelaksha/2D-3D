/**
 * Design Knowledge & Retrieval Subsystem Domain Types.
 *
 * Defines metadata schemas, queries, similarity search result containers, and retrieval interfaces.
 *
 * CRITICAL RULE:
 * The retrieved design MUST NEVER BE BLINDLY COPIED.
 * It is treated strictly as a structural reference for generating a new parametric design.
 */
import type { ID } from "@/core/model/types";
import type { ParametricDesignSpecification } from "../ailayer/types";

export interface DesignMetadata {
  pieceCount: number;
  connectionTypes: string[];
  difficulty: "easy" | "medium" | "hard" | "expert";
  geometryStyle: string;
  materialId: ID;
  dimensions: {
    widthMm: number;
    heightMm: number;
    depthMm: number;
  };
  assemblyCharacteristics: {
    maxJoiningAngleDeg: number;
    isNonPlanar: boolean;
    totalSteps: number;
  };
  topology: {
    connectedComponents: number;
    isTreeStructure: boolean;
    averageDegree: number;
  };
  interfacePatterns: string[];
  tags: string[];
}

export interface DesignExample {
  designId: ID;
  name: string;
  metadata: DesignMetadata;
  parametricSpec: ParametricDesignSpecification;
  canonicalModelSummary: string;
}

export interface DesignQuery {
  targetPieceCount?: number;
  preferredConnectionType?: string;
  difficulty?: string;
  geometryStyle?: string;
  materialId?: ID;
  targetDimensions?: {
    widthMm: number;
    heightMm: number;
    depthMm: number;
  };
  textQuery?: string;
}

export interface DesignSimilarity {
  design: DesignExample;
  /** Similarity score between 0.0 (unrelated) and 1.0 (exact match). */
  similarityScore: number;
  matchingCriteria: string[];
  /** Guidelines explicitly instructing how to adapt this reference without blind copying. */
  referenceAdaptationGuidelines: string;
}

export interface RetrievalInterface {
  findSimilarDesigns(query: DesignQuery, limit?: number): Promise<DesignSimilarity[]>;
  indexDesign(design: DesignExample): Promise<void>;
}
