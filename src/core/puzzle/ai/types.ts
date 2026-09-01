/**
 * AI Natural Language Requirement & Structured Specification Types (Phase 41).
 */
import type { PuzzlePiece } from "../piece/types";
import type { PuzzleAssembly } from "../assembly/types";

export interface AIPredictionRequest {
  pieces: PuzzlePiece[];
}

export interface AIPredictionResponse {
  predictedAssembly: PuzzleAssembly;
  confidenceScore: number;
  explanation: string;
}

export interface PuzzleAssemblyAI {
  predictAssembly(request: AIPredictionRequest): Promise<AIPredictionResponse>;
  predictJoiningAngle(
    sourcePiece: unknown,
    sourceInterfaceId: string,
    targetPiece: unknown,
    targetInterfaceId: string
  ): Promise<number>;
}

export interface UserIntent {
  rawPrompt: string;
  summary: string;
  category: "puzzle" | "furniture" | "box" | "model" | "custom";
  primaryGoal: string;
}

export interface MaterialParameters {
  materialId: string;
  thicknessMm: number;
  allowableKerfMm: number;
  densityGramsPerCm3: number;
}

export interface OuterBoundaryDimensions {
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
}

export interface AISpecDesignParameters {
  outerBoundary: OuterBoundaryDimensions;
  pieceCount?: number;
  innerPieceComplexity?: "simple" | "medium" | "complex";
  connectionStyle?: "simple" | "complex" | "finger_joint" | "tab_slot";
}

export interface AISpecAssemblyParameters {
  allowedAssemblyAnglesDeg?: number[];
  assemblyType?: "rigid" | "articulated" | "multi_angle";
}

export interface HardConstraints {
  minThicknessMm?: number;
  maxDimensionsMm?: {
    widthMm: number;
    heightMm: number;
  };
  mandatoryPieceCount?: number;
}

export interface SoftPreferences {
  preferredMaterial?: string;
  preferredStyle?: string;
  complexityPreference?: string;
}

export interface MissingInformationField {
  fieldName: string;
  promptQuestion: string;
  isCritical: boolean;
}

export interface DesignSpecification {
  specId: string;
  userIntent: UserIntent;
  designParameters: AISpecDesignParameters;
  assemblyParameters: AISpecAssemblyParameters;
  materialParameters: MaterialParameters;
  hardConstraints: HardConstraints;
  softPreferences: SoftPreferences;
  missingInformation: MissingInformationField[];
  isValidSchema: boolean;
  schemaValidationErrors: string[];
}
