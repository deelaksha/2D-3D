/**
 * Constraint domain models for geometric & kinematic assembly relationships.
 */
import type { ID } from "@/core/model/types";

export type PuzzleConstraintKind =
  | "fixedJoiningAngle"
  | "angleRange"
  | "coplanar"
  | "perpendicular"
  | "fixedDistance"
  | "nonInterpenetration";

export interface PuzzleConstraint {
  id: ID;
  kind: PuzzleConstraintKind;
  targetPieceIds: ID[];
  targetInterfaceIds?: ID[];
  /** Target value (degrees or mm). */
  targetValue?: number;
  minValue?: number;
  maxValue?: number;
  label?: string;
}
