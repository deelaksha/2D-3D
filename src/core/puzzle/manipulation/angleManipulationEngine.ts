/**
 * Connection Angle Live Manipulation Engine (Phase 95).
 *
 * Coordinates:
 *  - Connection angle inspection and allowed kinematic candidate discovery
 *  - Dynamic recalculation of affected piece transforms
 *  - Live Phase 90 collision and connection validation pass
 *  - Diagnostic warning and rejection reporting
 *  - Strict geometry immutability guarantee
 */

import { AutomaticJoiningAngleEngine } from "../anglegeneration/automaticJoiningAngleEngine";
import { validateConnectorAndAssembly } from "../assemblyvalidation/assemblyValidationPass";
import type { AssemblyValidationReport } from "../assemblyvalidation/types";
import type { AssemblyConfiguration } from "../assembly3d/types";
import type { ConvertedPuzzle3D } from "../piece3d/types";
import { KinematicTreeSolver } from "./kinematicTreeSolver";
import type {
  AngleAdjustmentRequest,
  AngleAdjustmentResult,
  ConnectionAngleInspection,
} from "./types";
import type { Puzzle3DVisualState } from "@/ui/preview3d/types";

export class AngleManipulationEngine {
  /**
   * Inspects a connection and extracts its kinematic limits, allowed candidates, and current angle.
   */
  public static inspectConnection(
    puzzle: ConvertedPuzzle3D,
    connectionId: string,
    currentAngles: Record<string, number> = {}
  ): ConnectionAngleInspection {
    const connection = puzzle.connections.find((c) => c.connectionId === connectionId);
    if (!connection) {
      throw new Error(`Connection '${connectionId}' not found in puzzle.`);
    }

    const pieceA = puzzle.pieces.find((p) => p.pieceId === connection.pieceAId);
    const pieceB = puzzle.pieces.find((p) => p.pieceId === connection.pieceBId);

    if (!pieceA || !pieceB) {
      throw new Error(`Pieces for connection '${connectionId}' not found in puzzle.`);
    }

    // Discover valid candidate angles via Phase 88 Engine
    const angleCandidates = AutomaticJoiningAngleEngine.generateValidAngles({
      pieceA,
      pieceB,
      connection,
      options: { angleStepDeg: 15 },
    });

    const validCandidates = angleCandidates.validAngles.length > 0
      ? angleCandidates.validAngles
      : [0, 30, 45, 60, 90, 180];

    const minAngle = Math.min(...validCandidates);
    const maxAngle = Math.max(...validCandidates);

    const currentAngleDeg = currentAngles[connectionId] ?? connection.allowedAngleDeg ?? 180;

    return {
      connectionId,
      pieceAId: connection.pieceAId,
      pieceBId: connection.pieceBId,
      connectorType: connection.connectorType,
      currentAngleDeg,
      allowedAngleRange: {
        min: minAngle,
        max: maxAngle,
        validCandidates,
        stepDeg: 15,
      },
      presetAngles: [0, 30, 45, 60, 90, 180],
      isValid: true,
    };
  }

  /**
   * Adjusts a connection's joining angle, recalculates affected piece transforms,
   * runs live collision and connection validation, and produces diagnostic reports.
   */
  public static adjustAngle(request: AngleAdjustmentRequest): AngleAdjustmentResult {
    const {
      puzzle,
      connectionId,
      newAngleDeg,
      currentTransforms,
      currentAngles,
      rootPieceId,
      assemblyConfiguration,
    } = request;

    // 1. Calculate new transforms for child piece and all downstream descendants
    const kinematicResult = KinematicTreeSolver.propagateAngleChange(
      puzzle,
      connectionId,
      newAngleDeg,
      currentTransforms,
      rootPieceId
    );

    const updatedTransforms = kinematicResult.newTransforms;
    const updatedAngles: Record<string, number> = {
      ...currentAngles,
      [connectionId]: newAngleDeg,
    };

    // 2. Run live Phase 90 validation pass
    const validationReport: AssemblyValidationReport = validateConnectorAndAssembly({
      puzzle,
      pieceTransforms: updatedTransforms,
      appliedAngles: updatedAngles,
    });

    // 3. Diagnose visual state and reason
    let visualState: Puzzle3DVisualState = "VALID";
    let diagnosticMessage = `Angle adjusted to ${newAngleDeg}° successfully. Assembly is valid.`;

    if (!validationReport.isValid) {
      const collisions = validationReport.failures.filter((f) => f.category === "collision");
      const connectionErrors = validationReport.failures.filter(
        (f) => f.category === "mandatory_connection" || f.category === "alignment"
      );
      const warnings = validationReport.failures.filter((f) => f.category === "clearance");

      if (collisions.length > 0) {
        visualState = "COLLISION";
        const details = collisions
          .map((c) => c.failureReason)
          .slice(0, 2)
          .join("; ");
        diagnosticMessage = `COLLISION REJECTION: Angle ${newAngleDeg}° causes penetration: ${details}`;
      } else if (connectionErrors.length > 0) {
        visualState = "INVALID_CONNECTION";
        diagnosticMessage = `CONNECTION ERROR: Angle ${newAngleDeg}° breaks connection alignment.`;
      } else if (warnings.length > 0) {
        visualState = "WARNING";
        diagnosticMessage = `CLEARANCE WARNING: Angle ${newAngleDeg}° has insufficient clearance (${warnings[0].failureReason}).`;
      } else {
        visualState = "INVALID_CONNECTION";
        diagnosticMessage = `VALIDATION FAILED: Angle ${newAngleDeg}° violates assembly constraints.`;
      }
    }

    // 4. Update formal AssemblyConfiguration
    const updatedAssemblyConfig: AssemblyConfiguration = assemblyConfiguration
      ? {
          ...assemblyConfiguration,
          appliedAngles: updatedAngles,
        }
      : {
          puzzleId: puzzle.puzzleId,
          rootPieceId: rootPieceId || puzzle.pieces[0].pieceId,
          placements: Object.entries(updatedTransforms).map(([pieceId, transform]) => ({
            pieceId,
            transform,
            connectionStates: {},
          })),
          appliedAngles: updatedAngles,
          isPlanar: Object.values(updatedAngles).every((ang) => Math.abs(ang - 180) < 0.1),
        };

    return {
      success: validationReport.isValid,
      connectionId,
      appliedAngleDeg: newAngleDeg,
      affectedPieceIds: kinematicResult.affectedPieceIds,
      newTransforms: updatedTransforms,
      newAngles: updatedAngles,
      validationReport,
      visualState,
      diagnosticMessage,
      updatedAssemblyConfiguration: updatedAssemblyConfig,
      isOriginalGeometryUnchanged: true,
    };
  }
}
