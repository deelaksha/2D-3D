/**
 * Connection Inference Subsystem Types.
 */
import type { Vec2, Vec3 } from "@/core/model/types";
import type { CanonicalConnection } from "../../canonical/types";
import type { Detected2DInterface } from "../interfaces/types";
import type { InferenceDiagnostics } from "./diagnostics";

export type InferredConnectionType =
  | "tab_slot"
  | "interlock"
  | "edge_contact"
  | "hinge_like"
  | "custom";

export interface ProfileCompatibility {
  widthDeltaMm: number;
  depthDeltaMm: number;
  fitQuality: "exact" | "tight" | "loose" | "incompatible";
}

export interface OrientationConstraint {
  allowedRotationAxis: Vec3;
  allowedAngleRange: {
    minAngleDeg: number;
    maxAngleDeg: number;
    targetAngleDeg: number;
  };
}

export interface ConnectionCandidate {
  candidateId: string;
  interfaceAId: string;
  interfaceBId: string;
  pieceAId: string;
  pieceBId: string;
  compatible: boolean;
  connectionType: InferredConnectionType;
  profileCompatibility: ProfileCompatibility;
  matingGeometry: {
    contactCenter: Vec2;
    contactNormal: Vec2;
  };
  requiredClearanceMm: number;
  orientationConstraint: OrientationConstraint;
  confidence: number;
  reason: string;
  warnings: string[];
}

export interface InferenceResult {
  candidates: ConnectionCandidate[];
  canonicalConnections: CanonicalConnection[];
  diagnostics: InferenceDiagnostics;
  compatibleCount: number;
  incompatibleCount: number;
}
