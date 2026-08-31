/**
 * AI Integration Layer Domain Types.
 *
 * CRITICAL REQUIREMENT:
 * The AI must NOT directly generate arbitrary CAD geometry or 3D mesh points.
 * The AI produces a structured ParametricDesignSpecification JSON payload.
 * The deterministic geometry/constraint engine remains authoritative.
 */
import type { ID } from "@/core/model/types";
import type { DeclarativeConstraint } from "../constraintsystem/types";

export interface AIDesignRequest {
  /** Natural language requirement string. */
  prompt: string;
  /** Optional base64 encoded 2D drawing or image input. */
  drawingImageBase64?: string;
  /** Optional reference design ID to draw parameters from. */
  referenceDesignId?: ID;
  /** Optional user preferences. */
  userPreferences?: {
    defaultJoiningAngleDeg?: number;
    preferredMaterialId?: ID;
  };
}

export interface ParametricDesignSpecification {
  specificationId: ID;
  overall_size: {
    widthMm: number;
    heightMm: number;
    depthMm: number;
  };
  piece_count: number;
  layers: number;
  material: {
    stockThicknessMm: number;
    stockWidthMm: number;
    stockHeightMm: number;
    materialId: ID;
  };
  connection_preferences: {
    defaultType: string;
    preferredJoiningAngleDeg: number;
    genderStyle: string;
  };
  difficulty: {
    level: "easy" | "medium" | "hard" | "expert";
    maxUniquePieces: number;
  };
  symmetry: {
    isSymmetrical: boolean;
    symmetryAxis: "x" | "y" | "z" | "radial";
  };
  constraints: DeclarativeConstraint[];
}

export interface AISpecificationValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AIGeneratorInterface {
  generateDesignSpecification(request: AIDesignRequest): Promise<ParametricDesignSpecification>;
}
