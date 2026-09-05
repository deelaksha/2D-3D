/**
 * 3D Placement Validator (Phase 87).
 *
 * Validates every 3D piece placement for mathematical and geometric integrity.
 */

import type { ID } from "@/core/model/types";
import type { AssemblyPlacement, AssemblyValidationReport, PlacementValidationResult } from "./types";
import type { ConnectionState3D } from "./types";

export class PlacementValidator {
  /**
   * Validates a single piece placement.
   */
  public static validatePlacement(
    placement: AssemblyPlacement,
    alignmentErrorMm = 0.0,
    allowedLimits?: { minAngleDeg: number; maxAngleDeg: number }
  ): PlacementValidationResult {
    const issues: string[] = [];
    const t = placement.transform;

    // 1. Finite Coordinates Check
    const hasFinitePos =
      Number.isFinite(t.position.x) &&
      Number.isFinite(t.position.y) &&
      Number.isFinite(t.position.z);

    const hasFiniteRot =
      Number.isFinite(t.rotation.x) &&
      Number.isFinite(t.rotation.y) &&
      Number.isFinite(t.rotation.z) &&
      Number.isFinite(t.rotation.w);

    const hasFiniteCoordinates = hasFinitePos && hasFiniteRot;
    if (!hasFiniteCoordinates) {
      issues.push(`Placement for piece '${placement.pieceId}' has NaN or non-finite transform coordinates.`);
    }

    // 2. Unit Quaternion Check
    const qLenSq =
      t.rotation.x * t.rotation.x +
      t.rotation.y * t.rotation.y +
      t.rotation.z * t.rotation.z +
      t.rotation.w * t.rotation.w;
    const qLen = Math.sqrt(qLenSq);
    const isUnitQuaternion = Math.abs(qLen - 1.0) < 1e-3;

    if (!isUnitQuaternion) {
      issues.push(`Piece '${placement.pieceId}' rotation quaternion norm is non-unit (${qLen.toFixed(4)}).`);
    }

    // 3. Alignment Error Check
    if (alignmentErrorMm > 0.5) {
      issues.push(`Piece '${placement.pieceId}' interface alignment error is high (${alignmentErrorMm.toFixed(3)} mm).`);
    }

    // 4. Angle Limits Check
    let angleWithinLimits = true;
    if (allowedLimits) {
      const angle = placement.appliedJoiningAngleDeg;
      if (angle < allowedLimits.minAngleDeg - 1e-3 || angle > allowedLimits.maxAngleDeg + 1e-3) {
        issues.push(
          `Piece '${placement.pieceId}' applied angle (${angle}°) exceeds allowed range [${allowedLimits.minAngleDeg}°, ${allowedLimits.maxAngleDeg}°].`
        );
        angleWithinLimits = false;
      }
    }

    const isValid = hasFiniteCoordinates && isUnitQuaternion && alignmentErrorMm <= 0.5 && angleWithinLimits;

    return {
      pieceId: placement.pieceId,
      isValid,
      alignmentErrorMm,
      hasFiniteCoordinates,
      isUnitQuaternion,
      angleWithinLimits,
      issues,
    };
  }

  /**
   * Builds the comprehensive assembly validation report across all placements and connections.
   */
  public static compileAssemblyReport(
    totalPieces: number,
    placements: AssemblyPlacement[],
    placementResults: Record<ID, PlacementValidationResult>,
    connectionStates: Record<ID, ConnectionState3D>
  ): AssemblyValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    const placedPiecesCount = placements.length;
    if (placedPiecesCount < totalPieces) {
      errors.push(`Not all pieces were placed: ${placedPiecesCount} of ${totalPieces} placed.`);
    }

    let totalAlignmentError = 0;
    let maxAlignmentErrorMm = 0;

    for (const pr of Object.values(placementResults)) {
      if (!pr.isValid) {
        errors.push(...pr.issues);
      }
      totalAlignmentError += pr.alignmentErrorMm;
      if (pr.alignmentErrorMm > maxAlignmentErrorMm) {
        maxAlignmentErrorMm = pr.alignmentErrorMm;
      }
    }

    let matedConnectionsCount = 0;
    const conns = Object.values(connectionStates);
    for (const conn of conns) {
      if (conn.status === "MATED" && conn.isValid) {
        matedConnectionsCount++;
      } else if (!conn.isValid) {
        warnings.push(`Connection '${conn.connectionId}' has validation warnings (alignment error: ${conn.alignmentErrorMm} mm).`);
      }
    }

    const averageAlignmentErrorMm =
      placedPiecesCount > 1 ? Number((totalAlignmentError / (placedPiecesCount - 1)).toFixed(4)) : 0.0;

    const isValid = errors.length === 0 && placedPiecesCount === totalPieces;

    return {
      isValid,
      totalPieces,
      placedPiecesCount,
      totalConnections: conns.length,
      matedConnectionsCount,
      averageAlignmentErrorMm,
      maxAlignmentErrorMm,
      placementResults,
      errors,
      warnings,
    };
  }
}
