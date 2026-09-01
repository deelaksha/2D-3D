/**
 * AI Design Planner Subsystem Types (Phase 49).
 */
import type { Extracted2DGeometryResult } from "../ingestion/geometry/types";
import type { RetrievedDesign } from "../retrievalsystem/types";

export interface PlannerInput {
  userRequirement: string;
  optionalDrawing?: Extracted2DGeometryResult | string;
  retrievedExamples?: RetrievedDesign[];
  context?: Record<string, unknown>;
}

export interface DesignIntent {
  goalSummary: string;
  targetCategory: "puzzle" | "furniture" | "box" | "model" | "custom";
  difficulty: "easy" | "medium" | "hard";
  symmetry: "none" | "bilateral" | "radial";
}

export interface PieceStrategy {
  targetPieceCount: number;
  geometryComplexity: "simple" | "medium" | "complex";
  layerCount: number;
  outerBoundaryStrategy: string;
}

export interface ConnectionStrategy {
  primaryConnectionType: "tab_slot" | "finger_joint" | "interlock" | "flat_contact";
  connectionDensity: "sparse" | "moderate" | "dense";
  jointClearanceMm: number;
}

export interface MaterialStrategy {
  materialId: string;
  thicknessMm: number;
  allowableKerfMm: number;
  manufacturingConstraints: string[];
}

export interface AssemblyStrategy {
  assemblyType: "rigid" | "articulated" | "multi_angle";
  allowedJoiningAnglesDeg: number[];
  sequencePlanningRequired: boolean;
}

export interface ConstraintStrategy {
  mandatoryPieceCount?: number;
  maxFootprintMm: {
    widthMm: number;
    heightMm: number;
  };
  nonNegotiableRules: string[];
}

export interface DesignPlan {
  planId: string;
  intent: DesignIntent;
  pieceStrategy: PieceStrategy;
  connectionStrategy: ConnectionStrategy;
  materialStrategy: MaterialStrategy;
  assemblyStrategy: AssemblyStrategy;
  constraintStrategy: ConstraintStrategy;
  createdIso: string;
}
