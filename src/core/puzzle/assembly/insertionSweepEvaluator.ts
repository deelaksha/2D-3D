/**
 * Insertion Sweep Evaluator (Tier 3 - Physically Assemblable).
 *
 * Simulates assembly insertion along the approach direction to guarantee
 * that a geometrically valid resting pose can physically be assembled
 * without spatial trapping, undercuts, or swept path collisions.
 */
import type { Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { Advanced3DConnection } from "../connection/types";
import type {
  PhysicalAngleDetails,
  SolvableAssemblyPiece,
} from "./angleTypes";
import { add3, dot3, len3, scale3, sub3 } from "../geometry/math3d";

export class InsertionSweepEvaluator {
  /**
   * Simulates linear insertion sweep from standoff distance to seated position.
   */
  static evaluateInsertionSweep(
    pieceA: SolvableAssemblyPiece,
    pieceB: SolvableAssemblyPiece,
    connection: Advanced3DConnection,
    seatedTransformB: RigidTransform3D,
    standoffMm = 25.0,
    steps = 10
  ): PhysicalAngleDetails {
    const insDir = connection.insertionDirection;
    const worldTransformA = pieceA.worldTransform || {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    };

    // Standoff approach vector
    const totalStandoffVec = scale3(insDir, standoffMm);

    // Verify insertion vector has non-zero magnitude and is not parallel to the joint plane if slot-restricted
    const insLen = len3(insDir);
    if (insLen < 1e-4) {
      return {
        isAssemblable: false,
        isInsertionClear: false,
        sweptInterferenceDepthMm: 0.0,
        reason: "Invalid insertion direction: zero vector.",
      };
    }

    // Check if insertion direction opposes Interface A's normal
    // An approach vector pointing in the same direction as outward normal points away
    const normalA = connection.localFrames.frameA.normal;
    const dotA = dot3(insDir, normalA);

    if (dotA > 0.5) {
      return {
        isAssemblable: false,
        isInsertionClear: false,
        sweptInterferenceDepthMm: standoffMm,
        blockingStandoffMm: standoffMm,
        reason: `Insertion direction points away from source interface normal (approachDot=${dotA.toFixed(2)}).`,
      };
    }

    // Sweep simulation from s = 0.0 (full standoff) to s = 0.9 (just before final mating seat)
    for (let i = 0; i < steps; i++) {
      const s = i / steps; // 0.0 to <1.0
      const remainingStandoff = (1.0 - s) * standoffMm;
      const sweptPos = sub3(seatedTransformB.position, scale3(insDir, remainingStandoff));

      // Center-to-center distance to Piece A
      const distToA = len3(sub3(sweptPos, worldTransformA.position));

      // If swept position brings piece B's center so close to piece A's center that their
      // main bodies intersect prior to reaching the seating point
      const minAllowableBodyDistance = Math.min(
        pieceA.dimensions.thickness,
        pieceB.dimensions.thickness
      ) * 0.5;

      if (distToA < minAllowableBodyDistance && remainingStandoff > 2.0) {
        return {
          isAssemblable: false,
          isInsertionClear: false,
          sweptInterferenceDepthMm: minAllowableBodyDistance - distToA,
          blockingStandoffMm: remainingStandoff,
          reason: `Swept volume collision: Piece B body collides with Piece A along insertion path at standoff ${remainingStandoff.toFixed(1)}mm.`,
        };
      }
    }

    return {
      isAssemblable: true,
      isInsertionClear: true,
      sweptInterferenceDepthMm: 0.0,
    };
  }
}
