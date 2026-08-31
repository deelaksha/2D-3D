/**
 * 3D Assembly Transformation System Engine.
 *
 * Provides mathematically exact rigid motion placement, interface alignment,
 * relative/absolute transform calculations, and angle constraint checks.
 */
import type { ID } from "@/core/model/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import type {
  AssemblyConfigurationState,
  AssemblyPlacement,
  MatingTransformRequest,
  MatingTransformResult,
} from "./types";
import {
  alignInterfaces,
  composeTransforms,
  identityTransform,
  inverseTransform,
  localToWorld,
  transformVector,
} from "../framesystem/transformEngine";

export class AssemblyTransformationSystem {
  private placements: Map<ID, AssemblyPlacement> = new Map();
  public configurationId: ID;

  constructor(configurationId: ID = "config_default") {
    this.configurationId = configurationId;
  }

  placePiece(pieceId: ID, transform: RigidTransform3D, isFixed = false): AssemblyPlacement {
    const placement: AssemblyPlacement = { pieceId, transform: { ...transform }, isFixed };
    this.placements.set(pieceId, placement);
    return placement;
  }

  hasPiece(pieceId: ID): boolean {
    return this.placements.has(pieceId);
  }

  getPieceTransform(pieceId: ID): RigidTransform3D {
    return this.placements.get(pieceId)?.transform ?? identityTransform();
  }

  removePiece(pieceId: ID): boolean {
    return this.placements.delete(pieceId);
  }

  getAllPlacements(): AssemblyPlacement[] {
    return Array.from(this.placements.values());
  }

  /* ------------------------------------------------------------------ */
  /* Relative & Absolute Transform Calculations                         */
  /* ------------------------------------------------------------------ */

  computeRelativeTransform(pieceIdA: ID, pieceIdB: ID): RigidTransform3D {
    const tA = this.getPieceTransform(pieceIdA);
    const tB = this.getPieceTransform(pieceIdB);
    const invA = inverseTransform(tA);
    return composeTransforms(invA, tB);
  }

  computeAbsoluteTransform(
    parentTransform: RigidTransform3D,
    relativeTransform: RigidTransform3D,
  ): RigidTransform3D {
    return composeTransforms(parentTransform, relativeTransform);
  }

  getTransformedInterfaceFrame(
    pieceId: ID,
    localInterfaceFrame: CoordinateFrame3D,
  ): CoordinateFrame3D {
    const pieceT = this.getPieceTransform(pieceId);
    return {
      origin: localToWorld(pieceT, localInterfaceFrame.origin),
      tangent: transformVector(pieceT, localInterfaceFrame.tangent),
      normal: transformVector(pieceT, localInterfaceFrame.normal),
      binormal: transformVector(pieceT, localInterfaceFrame.binormal),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Interface Mating Alignment Solver                                   */
  /* ------------------------------------------------------------------ */

  calculateInterfaceMatingTransform(request: MatingTransformRequest): MatingTransformResult {
    const {
      sourcePieceId,
      sourceInterfaceFrame,
      targetPieceId,
      targetInterfaceFrame,
      joiningAngleDeg,
      allowedAngleRange,
    } = request;

    // 1. Angle constraint validation check
    if (allowedAngleRange) {
      const { minAngleDeg, maxAngleDeg } = allowedAngleRange;
      if (joiningAngleDeg < minAngleDeg - 0.5 || joiningAngleDeg > maxAngleDeg + 0.5) {
        return {
          success: false,
          errorReason: `Joining angle (${joiningAngleDeg}°) is outside allowed angle range [${minAngleDeg}°, ${maxAngleDeg}°].`,
        };
      }
    }

    // 2. Get source piece world transform
    const sourcePieceTransform = this.getPieceTransform(sourcePieceId);

    // 3. Compute target piece world transform aligning target interface to source interface
    const targetPieceTransform = alignInterfaces(
      sourceInterfaceFrame,
      sourcePieceTransform,
      targetInterfaceFrame,
      joiningAngleDeg,
    );

    // 4. Compute relative transform mapping source piece to target piece
    const invSource = inverseTransform(sourcePieceTransform);
    const relativeTransform = composeTransforms(invSource, targetPieceTransform);

    return {
      success: true,
      targetPieceTransform,
      relativeTransform,
    };
  }

  getState(): AssemblyConfigurationState {
    const statePlacements: Record<ID, AssemblyPlacement> = {};
    for (const [id, placement] of this.placements.entries()) {
      statePlacements[id] = { ...placement };
    }
    return {
      configurationId: this.configurationId,
      placements: statePlacements,
    };
  }
}
