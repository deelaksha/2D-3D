/**
 * 3D Assembly Transformation System Domain Types.
 *
 * Models spatial placement, relative/absolute rigid motion transforms,
 * and interface mating alignments without mutating original piece geometry.
 */
import type { ID } from "@/core/model/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";

export interface AssemblyPlacement {
  pieceId: ID;
  /** Spatial pose transform mapping piece-local space to assembly world space. */
  transform: RigidTransform3D;
  /** Optional flag marking piece fixed in world space (e.g. base plate). */
  isFixed?: boolean;
}

export interface MatingTransformRequest {
  sourcePieceId: ID;
  /** Local coordinate frame of source connection interface port. */
  sourceInterfaceFrame: CoordinateFrame3D;
  targetPieceId: ID;
  /** Local coordinate frame of target connection interface port. */
  targetInterfaceFrame: CoordinateFrame3D;
  /** Desired joining angle in degrees (0, 30, 45, 60, 90, etc.). */
  joiningAngleDeg: number;
  /** Optional allowed angle range constraint. */
  allowedAngleRange?: {
    minAngleDeg: number;
    maxAngleDeg: number;
  };
}

export interface MatingTransformResult {
  success: boolean;
  /** Target piece world transform aligning its interface to the source interface. */
  targetPieceTransform?: RigidTransform3D;
  /** Relative transform mapping source piece frame to target piece frame. */
  relativeTransform?: RigidTransform3D;
  errorReason?: string;
}

export interface AssemblyConfigurationState {
  configurationId: ID;
  placements: Record<ID, AssemblyPlacement>;
}
