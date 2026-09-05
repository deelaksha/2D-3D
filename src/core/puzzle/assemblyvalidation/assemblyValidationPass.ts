/**
 * Assembly Validation Pass Master Orchestrator (Phase 90).
 *
 * Coordinates Pass 1 (Connection Validation) and Pass 2 (Assembly-Level Validation)
 * to evaluate full mechanical, geometric, and topological integrity.
 *
 * Strictly enforces: Do not return success if any mandatory validation fails.
 */

import type { ConvertedPuzzle3D, GeneratedPiece3D } from "../piece3d/types";
import { ConnectionValidator } from "./connectionValidator";
import { AssemblyLevelValidator } from "./assemblyLevelValidator";
import type {
  AssemblyValidationInput,
  AssemblyValidationOptions,
  AssemblyValidationReport,
  ConnectionValidationDetail,
  ValidationFailureItem,
} from "./types";

export class AssemblyValidationPass {
  /**
   * Executes the complete connector-and-assembly validation pass.
   */
  public static validate(input: AssemblyValidationInput): AssemblyValidationReport {
    const startTime = performance.now();
    const { puzzle, pieceTransforms, appliedAngles = {}, options = {} } = input;

    const pieces = puzzle.pieces ?? [];
    const connections = puzzle.connections ?? [];

    const pieceMap = new Map<string, GeneratedPiece3D>();
    for (const p of pieces) {
      pieceMap.set(p.pieceId, p);
    }

    const allFailures: ValidationFailureItem[] = [];
    const connectionDetails: Record<string, ConnectionValidationDetail> = {};

    // ─────────────────────────────────────────────────────────────
    // PASS 1: Connection Validation (Every Connection)
    // ─────────────────────────────────────────────────────────────
    let validConnectionsCount = 0;

    for (const conn of connections) {
      const pieceA = pieceMap.get(conn.pieceAId);
      const pieceB = pieceMap.get(conn.pieceBId);
      const transformA = pieceTransforms[conn.pieceAId];
      const transformB = pieceTransforms[conn.pieceBId];

      const appliedAngle =
        appliedAngles[conn.connectionId] ??
        conn.parameters?.joiningAngleDeg ??
        conn.allowedAngleDeg ??
        180.0;

      if (!pieceA || !pieceB) {
        const missingId = !pieceA ? conn.pieceAId : conn.pieceBId;
        const msg = `Connection '${conn.connectionId}' references non-existent piece '${missingId}'.`;
        allFailures.push({
          connectionId: conn.connectionId,
          pieceId: missingId,
          angleDeg: appliedAngle,
          failureReason: msg,
          severity: "error",
          category: "interface_pairing",
        });
        continue;
      }

      const { detail, failures } = ConnectionValidator.validateConnection(
        conn,
        pieceA,
        transformA,
        pieceB,
        transformB,
        appliedAngle,
        options
      );

      connectionDetails[conn.connectionId] = detail;
      if (detail.isValid) {
        validConnectionsCount++;
      }
      allFailures.push(...failures);
    }

    // ─────────────────────────────────────────────────────────────
    // PASS 2: Assembly-Level Validation (Entire Assembly)
    // ─────────────────────────────────────────────────────────────
    const assemblyLevel = AssemblyLevelValidator.validateAssembly(
      puzzle,
      pieceTransforms,
      connectionDetails,
      appliedAngles,
      options
    );

    allFailures.push(...assemblyLevel.failures);

    // ─────────────────────────────────────────────────────────────
    // Master Validation Decision
    // ─────────────────────────────────────────────────────────────
    const errorFailures = allFailures.filter((f) => f.severity === "error");
    const warningFailures = allFailures.filter((f) => f.severity === "warning");

    const isAssemblyValid =
      errorFailures.length === 0 &&
      assemblyLevel.allPiecesIncluded &&
      assemblyLevel.noUnintendedCollisions &&
      assemblyLevel.noDisconnectedPieces &&
      assemblyLevel.allMandatoryConnectionsSatisfied &&
      assemblyLevel.validTransforms &&
      assemblyLevel.validMaterialDimensions &&
      assemblyLevel.validThickness &&
      assemblyLevel.validGeometry;

    const placedPiecesCount = Object.keys(pieceTransforms).filter((id) =>
      pieceMap.has(id)
    ).length;

    const durationMs = Number((performance.now() - startTime).toFixed(2));

    const message = isAssemblyValid
      ? `Assembly validation PASSED: ${pieces.length} pieces, ${connections.length} connections validated without errors.`
      : `Assembly validation FAILED: ${errorFailures.length} error(s) detected across connector and assembly checks.`;

    return {
      isValid: isAssemblyValid,
      totalPieces: pieces.length,
      placedPiecesCount,
      allPiecesIncluded: assemblyLevel.allPiecesIncluded,
      noUnintendedCollisions: assemblyLevel.noUnintendedCollisions,
      noDisconnectedPieces: assemblyLevel.noDisconnectedPieces,
      allMandatoryConnectionsSatisfied: assemblyLevel.allMandatoryConnectionsSatisfied,
      validTransforms: assemblyLevel.validTransforms,
      validMaterialDimensions: assemblyLevel.validMaterialDimensions,
      validThickness: assemblyLevel.validThickness,
      validGeometry: assemblyLevel.validGeometry,
      totalConnections: connections.length,
      validConnectionsCount,
      failures: allFailures,
      failureCount: errorFailures.length,
      assemblyLevelValidation: {
        allPiecesIncluded: assemblyLevel.allPiecesIncluded,
        noUnintendedCollisions: assemblyLevel.noUnintendedCollisions,
        noDisconnectedPieces: assemblyLevel.noDisconnectedPieces,
        allMandatoryConnectionsSatisfied: assemblyLevel.allMandatoryConnectionsSatisfied,
        validTransforms: assemblyLevel.validTransforms,
        validMaterialDimensions: assemblyLevel.validMaterialDimensions,
        validThickness: assemblyLevel.validThickness,
        validGeometry: assemblyLevel.validGeometry,
      },
      connectionDetails,
      pieceDetails: assemblyLevel.pieceDetails,
      summary: {
        errorCount: errorFailures.length,
        warningCount: warningFailures.length,
        message,
        executionDurationMs: durationMs,
      },
    };
  }
}

/**
 * Convenience entry point function.
 */
export function validateConnectorAndAssembly(
  input: AssemblyValidationInput
): AssemblyValidationReport {
  return AssemblyValidationPass.validate(input);
}
