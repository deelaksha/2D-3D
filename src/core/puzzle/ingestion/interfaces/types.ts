/**
 * Automatic 2D Interface Detection Types.
 */
import type { Vec2 } from "@/core/model/types";
import type { CanonicalInterface, CanonicalInterfaceType, InterfaceGenderRole } from "../../canonical/types";
import type { DetectionDiagnostics } from "./diagnostics";

export type DetectedFeatureKind =
  | "tab"
  | "slot"
  | "notch"
  | "interlock"
  | "mating_profile"
  | "special_edge"
  | "flat_contact"
  | "custom"
  | "uncertain";

export interface Local2DFrame {
  origin: Vec2;
  normal: Vec2;
  tangent: Vec2;
}

export interface InterfaceEdgeGeometry2D {
  edgeIndex: number;
  parametricStart: number;
  parametricEnd: number;
  length: number;
}

export interface Detected2DInterface {
  id: string;
  owningPieceId: string;
  name: string;
  featureKind: DetectedFeatureKind;
  canonicalType: CanonicalInterfaceType;
  local2DFrame: Local2DFrame;
  edgeGeometry: InterfaceEdgeGeometry2D;
  profile: {
    kind: string;
    width: number;
    depth: number;
    height: number;
    clearance: number;
  };
  genderRole: InterfaceGenderRole;
  toleranceMm: number;
  clearanceMm: number;
  confidence: number;
  uncertain: boolean;
  diagnosticReason?: string;
}

export interface InterfaceDetectionResult {
  owningPieceId: string;
  interfaces: Detected2DInterface[];
  canonicalInterfaces: CanonicalInterface[];
  diagnostics: DetectionDiagnostics;
  uncertainCount: number;
}
