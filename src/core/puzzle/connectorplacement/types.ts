/**
 * Automatic Connector Placement Engine Types (Phase 84).
 *
 * Requirements:
 *  - Automatically determine optimized connector locations along compatible piece interfaces.
 *  - Evaluate edge length, corner proximity, minimum feature size, clearance, structural balance,
 *    manufacturability, and assembly accessibility.
 *  - Avoid thin geometry, overlapping tabs, intersecting slots, and corner violations.
 *  - Support single connector, multiple connectors, and asymmetric connector placement.
 *  - Return detailed placement report.
 *  - Strictly deterministic, No ML.
 */

import type { ID, Vec2 } from "@/core/model/types";
import type { ConnectorType } from "../connectorgeneration/types";

export interface PlacementPieceInput {
  id: ID;
  name?: string;
  vertices: Vec2[];
  thicknessMm: number;
  materialId?: ID;
}

export interface InterfaceEdgeInput {
  id: string;
  pieceAId: ID;
  pieceBId: ID;
  start: Vec2;
  end: Vec2;
  lengthMm: number;
  normal: Vec2;
  tangent: Vec2;
  preferredPlacementMode?: "auto" | "single" | "multiple" | "asymmetric";
  preferredType?: ConnectorType;
}

export interface MaterialPlacementConstraints {
  stockThicknessMm: number;
  minBridgeWidthMm: number;
  minCornerMarginMm: number;
  minInterConnectorGapMm: number;
  kerfMm: number;
}

export interface ConnectorPlacementRequest {
  pieces: PlacementPieceInput[];
  edges: InterfaceEdgeInput[];
  materialConstraints?: Partial<MaterialPlacementConstraints>;
  difficulty?: "easy" | "medium" | "hard" | "expert";
  forceAsymmetric?: boolean;
}

export interface PlacedConnectorLocation {
  connectorId: string;
  edgeId: string;
  pieceAId: ID;
  pieceBId: ID;
  /** Parametric offset t in (0, 1) along edge from start to end. */
  parametricOffsetT: number;
  worldPosition: Vec2;
  normal: Vec2;
  tangent: Vec2;
  widthMm: number;
  depthMm: number;
  clearanceMm: number;
  cornerMarginStartMm: number;
  cornerMarginEndMm: number;
  placementMode: "single" | "multiple" | "asymmetric";
}

export interface PlacementQualityMetrics {
  structuralBalanceScore: number; // 0.0 - 1.0
  manufacturabilityScore: number; // 0.0 - 1.0
  assemblyAccessibilityScore: number; // 0.0 - 1.0
  overallQualityScore: number; // 0.0 - 1.0
}

export type PlacementRejectionCode =
  | "REJECTED_EDGE_TOO_SHORT"
  | "REJECTED_CORNER_TOO_CLOSE"
  | "REJECTED_MATERIAL_TOO_THIN"
  | "REJECTED_SLOT_INTERSECTION"
  | "REJECTED_MANUFACTURING_LIMIT";

export interface PlacementRejection {
  edgeId: string;
  candidateLocationT?: number;
  reasonCode: PlacementRejectionCode;
  message: string;
}

export interface PlacementReport {
  totalEdgesEvaluated: number;
  totalConnectorsPlaced: number;
  singleConnectorEdgesCount: number;
  multiConnectorEdgesCount: number;
  asymmetricEdgesCount: number;
  qualityMetrics: PlacementQualityMetrics;
  rejections: PlacementRejection[];
  warnings: string[];
}

export interface EdgeConnectorPlacement {
  edgeId: string;
  pieceAId: ID;
  pieceBId: ID;
  edgeLengthMm: number;
  connectors: PlacedConnectorLocation[];
  status: "PLACED" | "SKIPPED" | "DEGRADED";
}

export interface ConnectorPlacementResult {
  success: boolean;
  placements: EdgeConnectorPlacement[];
  allPlacedConnectors: PlacedConnectorLocation[];
  report: PlacementReport;
  executionDurationMs: number;
}
