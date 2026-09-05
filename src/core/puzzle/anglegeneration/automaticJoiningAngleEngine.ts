/**
 * Automatic Joining-Angle Generation Engine (Phase 88).
 *
 * Deterministically generates and validates candidate joining angles for
 * connections across:
 *   1. Mathematically possible
 *   2. Geometrically valid
 *   3. Physically assemblable
 *
 * Removes angles causing collision, invalid alignment, insufficient clearance,
 * impossible insertion, or invalid geometry.
 */

import type { ConvertedPuzzle3D } from "../piece3d/types";
import { CandidateAngleGenerator } from "./candidateAngleGenerator";
import { CandidateAngleValidator } from "./candidateAngleValidator";
import type {
  AngleGenerationOptions,
  AngleGenerationRequest,
  CandidateAngleEvaluation,
  PuzzleJoiningAnglesResult,
  RejectedAngleInfo,
  ValidAngleCandidates,
} from "./types";

export class AutomaticJoiningAngleEngine {
  /**
   * Evaluates a single connection and generates all valid candidate joining angles.
   */
  public static generateValidAngles(request: AngleGenerationRequest): ValidAngleCandidates {
    const { pieceA, pieceB, connection, options } = request;
    const connectorType = connection.connectorType;

    // 1. Generate candidate angles based on connector type and configuration
    const candidateAngles = CandidateAngleGenerator.generateCandidates(connectorType, options);

    // Helper to extract dimensions from either GeneratedPiece3D or raw subject
    const getPieceDimensions = (p: any): { width: number; height: number; thickness: number } => {
      if (p.dimensions && typeof p.dimensions.width === "number") {
        return p.dimensions;
      }
      if (p.profile?.localBounds) {
        return {
          width: Math.max(1.0, p.profile.localBounds.maxX - p.profile.localBounds.minX),
          height: Math.max(1.0, p.profile.localBounds.maxY - p.profile.localBounds.minY),
          thickness: p.thickness ?? 3.0,
        };
      }
      return { width: 50, height: 40, thickness: p.thickness ?? 3.0 };
    };

    // Helper to extract interface frame
    const getPieceFrame = (p: any, targetInterfaceId?: string) => {
      if (p.interfaceFrame) return p.interfaceFrame;
      if (p.interfaces && p.interfaces.length > 0) {
        const found = targetInterfaceId
          ? p.interfaces.find((iface: any) => iface.id === targetInterfaceId)
          : p.interfaces[0];
        return found?.localFrame ?? p.interfaces[0].localFrame ?? p.localCoordinateFrame;
      }
      return p.localCoordinateFrame;
    };

    // 2. Prepare evaluation subjects
    const subPieceA = {
      pieceId: "pieceId" in pieceA ? (pieceA as any).pieceId : (pieceA as any).id,
      dimensions: getPieceDimensions(pieceA),
      interfaceFrame: getPieceFrame(pieceA, (connection as any).interfaceAId),
    };

    const subPieceB = {
      pieceId: "pieceId" in pieceB ? (pieceB as any).pieceId : (pieceB as any).id,
      dimensions: getPieceDimensions(pieceB),
      interfaceFrame: getPieceFrame(pieceB, (connection as any).interfaceBId),
    };

    const subConn = {
      connectionId: connection.connectionId,
      connectorType,
      clearanceMm: connection.clearanceMm,
      allowedAngleDeg: connection.allowedAngleDeg,
      parameters: "parameters" in connection ? connection.parameters : undefined,
    };

    // 3. Evaluate each candidate across the 3 tiers
    const allCandidates: CandidateAngleEvaluation[] = [];
    const validAngles: number[] = [];
    const mathematicallyPossibleAngles: number[] = [];
    const geometricallyValidAngles: number[] = [];
    const physicallyAssemblableAngles: number[] = [];
    const rejectedAngles: RejectedAngleInfo[] = [];

    for (const angle of candidateAngles) {
      const evaluation = CandidateAngleValidator.evaluateCandidate(
        angle,
        subPieceA,
        subPieceB,
        subConn,
        options
      );

      allCandidates.push(evaluation);

      if (evaluation.mathematicallyPossible) {
        mathematicallyPossibleAngles.push(angle);
      }

      if (evaluation.geometricallyValid) {
        geometricallyValidAngles.push(angle);
      }

      if (evaluation.physicallyAssemblable) {
        physicallyAssemblableAngles.push(angle);
      }

      if (evaluation.isValid) {
        validAngles.push(angle);
      } else if (evaluation.rejectionReason) {
        rejectedAngles.push({
          angleDeg: angle,
          reason: evaluation.rejectionReason,
          details: evaluation.diagnosticMessage,
        });
      }
    }

    // 4. Select recommended angle (honor connection's allowed angle or closest standard angle)
    const preferredAngle = connection.allowedAngleDeg ?? (connectorType === "notch" ? 90.0 : 180.0);
    const recommendedAngle =
      validAngles.includes(preferredAngle)
        ? preferredAngle
        : validAngles.length > 0
        ? validAngles[0]
        : 180.0;

    return {
      connectionId: connection.connectionId,
      pieceAId: String(subPieceA.pieceId),
      pieceBId: String(subPieceB.pieceId),
      connectorType,
      allCandidates,
      validAngles,
      mathematicallyPossibleAngles,
      geometricallyValidAngles,
      physicallyAssemblableAngles,
      rejectedAngles,
      recommendedAngle,
    };
  }

  /**
   * Evaluates all connections in a converted 3D puzzle.
   */
  public static evaluatePuzzleConnections(
    puzzle: ConvertedPuzzle3D,
    options?: AngleGenerationOptions
  ): PuzzleJoiningAnglesResult {
    const startTime = performance.now();
    const connectionAngles: Record<string, ValidAngleCandidates> = {};

    const pieceMap = new Map<string, any>();
    for (const p of puzzle.pieces) {
      pieceMap.set(p.pieceId, p);
    }

    let allValid = true;

    for (const conn of puzzle.connections) {
      const pA = pieceMap.get(conn.pieceAId);
      const pB = pieceMap.get(conn.pieceBId);

      if (!pA || !pB) continue;

      const candidates = this.generateValidAngles({
        pieceA: pA,
        pieceB: pB,
        connection: conn as any,
        options,
      });

      connectionAngles[conn.connectionId] = candidates;

      if (candidates.validAngles.length === 0) {
        allValid = false;
      }
    }

    const duration = Number((performance.now() - startTime).toFixed(2));

    return {
      puzzleId: puzzle.puzzleId,
      connectionAngles,
      totalConnectionsEvaluated: Object.keys(connectionAngles).length,
      allConnectionsHaveValidAngle: allValid,
      executionDurationMs: duration,
    };
  }
}

/**
 * Functional wrapper for AutomaticJoiningAngleEngine.generateValidAngles.
 */
export function evaluateConnectionAngles(request: AngleGenerationRequest): ValidAngleCandidates {
  return AutomaticJoiningAngleEngine.generateValidAngles(request);
}

/**
 * Functional wrapper for AutomaticJoiningAngleEngine.evaluatePuzzleConnections.
 */
export function evaluatePuzzleJoiningAngles(
  puzzle: ConvertedPuzzle3D,
  options?: AngleGenerationOptions
): PuzzleJoiningAnglesResult {
  return AutomaticJoiningAngleEngine.evaluatePuzzleConnections(puzzle, options);
}
