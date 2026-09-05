/**
 * Parameter Fault Localizer (Phase 91).
 *
 * Analyzes validation failure diagnostics from Phase 90 to identify the responsible
 * parametric variable and generate deterministic, safe parametric modification proposals.
 *
 * STRICT RULE: Modifies ONLY approved parametric variables. No raw mesh point edits.
 */

import type { ConvertedPuzzle3D, RetainedConnection3D, GeneratedPiece3D } from "../piece3d/types";
import type { ValidationFailureItem } from "../assemblyvalidation/types";
import type { ParameterModification } from "./types";

export class ParameterFaultLocalizer {
  /**
   * Identifies the responsible parameter for a given failure item and generates modification proposals.
   */
  public static localizeAndPropose(
    failure: ValidationFailureItem,
    puzzle: ConvertedPuzzle3D,
    currentAppliedAngles: Record<string, number>,
    defaultClearanceMm = 0.15
  ): ParameterModification[] {
    const modifications: ParameterModification[] = [];

    // ─────────────────────────────────────────────────────────────
    // 1. Connection-Level Failures
    // ─────────────────────────────────────────────────────────────
    if (failure.connectionId) {
      const conn = puzzle.connections?.find((c) => c.connectionId === failure.connectionId);
      if (conn) {
        switch (failure.category) {
          case "clearance": {
            const oldClearance = conn.clearanceMm ?? conn.parameters?.clearance ?? 0.0;
            const newClearance = Math.max(defaultClearanceMm, 0.15);

            modifications.push({
              parameterName: "clearanceMm",
              entityId: conn.connectionId,
              oldValue: oldClearance,
              newValue: newClearance,
              reason: `Increased clearance from ${oldClearance}mm to compliant manufacturing clearance ${newClearance}mm.`,
            });

            // If slot width needs expansion to accommodate new clearance
            const tabWidth = conn.parameters?.tabWidth ?? 24.0;
            const currentSlotWidth = conn.parameters?.slotWidth ?? 24.0;
            const requiredSlotWidth = Number((tabWidth + newClearance).toFixed(3));
            if (currentSlotWidth < requiredSlotWidth) {
              modifications.push({
                parameterName: "slotWidth",
                entityId: conn.connectionId,
                oldValue: currentSlotWidth,
                newValue: requiredSlotWidth,
                reason: `Expanded slot width to ${requiredSlotWidth}mm to accommodate clearance of ${newClearance}mm.`,
              });
            }
            break;
          }

          case "geometry": {
            const params = conn.parameters ?? {};
            const tabWidth = params.tabWidth ?? 24.0;
            const slotWidth = params.slotWidth ?? 24.0;
            const clearance = conn.clearanceMm ?? params.clearance ?? defaultClearanceMm;

            if (tabWidth > slotWidth || failure.failureReason.includes("exceeds slot width")) {
              // Adjust slot width to accommodate tab width + clearance
              const newSlotWidth = Number((tabWidth + clearance).toFixed(3));
              modifications.push({
                parameterName: "slotWidth",
                entityId: conn.connectionId,
                oldValue: slotWidth,
                newValue: newSlotWidth,
                reason: `Expanded slot width from ${slotWidth}mm to ${newSlotWidth}mm to eliminate tab interference.`,
              });
            } else if (tabWidth <= 0 || slotWidth <= 0) {
              const standardWidth = 24.0;
              modifications.push({
                parameterName: "tabWidth",
                entityId: conn.connectionId,
                oldValue: tabWidth,
                newValue: standardWidth,
                reason: `Reset non-positive tab width to standard ${standardWidth}mm.`,
              });
              modifications.push({
                parameterName: "slotWidth",
                entityId: conn.connectionId,
                oldValue: slotWidth,
                newValue: standardWidth + clearance,
                reason: `Reset non-positive slot width to ${standardWidth + clearance}mm.`,
              });
            }

            const tabDepth = params.tabDepth ?? 4.5;
            const slotDepth = params.slotDepth ?? 4.65;
            if (tabDepth <= 0 || slotDepth <= 0) {
              modifications.push({
                parameterName: "tabDepth",
                entityId: conn.connectionId,
                oldValue: tabDepth,
                newValue: 4.5,
                reason: "Reset non-positive tab depth to standard 4.5mm.",
              });
              modifications.push({
                parameterName: "slotDepth",
                entityId: conn.connectionId,
                oldValue: slotDepth,
                newValue: 4.65,
                reason: "Reset non-positive slot depth to standard 4.65mm.",
              });
            }
            break;
          }

          case "joining_angle":
          case "penetration":
          case "insertion": {
            const currentAngle =
              currentAppliedAngles[conn.connectionId] ??
              conn.parameters?.joiningAngleDeg ??
              conn.allowedAngleDeg ??
              180.0;

            let targetAngle = 180.0;
            if (conn.connectorType === "notch") {
              targetAngle = 90.0;
            } else if (conn.allowedAngleDeg !== undefined && conn.allowedAngleDeg >= 15.0) {
              targetAngle = conn.allowedAngleDeg;
            } else if (conn.parameters?.nominalAngleDeg !== undefined) {
              targetAngle = conn.parameters.nominalAngleDeg;
            }

            modifications.push({
              parameterName: "joiningAngleDeg",
              entityId: conn.connectionId,
              oldValue: currentAngle,
              newValue: targetAngle,
              reason: `Adjusted joining angle from non-viable ${currentAngle}° to kinematically valid ${targetAngle}°.`,
            });
            break;
          }

          case "connector_type": {
            const oldType = conn.connectorType;
            modifications.push({
              parameterName: "connectorType",
              entityId: conn.connectionId,
              oldValue: oldType,
              newValue: "tab_slot",
              reason: `Replaced invalid or unsupported connector type '${oldType}' with standard 'tab_slot'.`,
            });
            break;
          }

          case "interface_pairing": {
            // Check piece A and B
            const pA = puzzle.pieces.find((p) => p.pieceId === conn.pieceAId);
            const pB = puzzle.pieces.find((p) => p.pieceId === conn.pieceBId);
            if (pA && pB && pA.interfaces.length > 0 && pB.interfaces.length > 0) {
              // Ensure interface IDs match existing interfaces on pieces
              const validIfaceAId = pA.interfaces[0].id;
              const validIfaceBId = pB.interfaces[0].id;

              if (conn.interfaceAId !== validIfaceAId) {
                modifications.push({
                  parameterName: "interfaceAId",
                  entityId: conn.connectionId,
                  oldValue: conn.interfaceAId,
                  newValue: validIfaceAId,
                  reason: `Realigned interface port A to valid existing interface '${validIfaceAId}' on piece '${pA.pieceId}'.`,
                });
              }

              if (conn.interfaceBId !== validIfaceBId) {
                modifications.push({
                  parameterName: "interfaceBId",
                  entityId: conn.connectionId,
                  oldValue: conn.interfaceBId,
                  newValue: validIfaceBId,
                  reason: `Realigned interface port B to valid existing interface '${validIfaceBId}' on piece '${pB.pieceId}'.`,
                });
              }
            }
            break;
          }

          case "alignment": {
            // Realignment: if interface port has local offset or tolerance issue, reset alignment
            const currentAngle = currentAppliedAngles[conn.connectionId] ?? 180.0;
            modifications.push({
              parameterName: "joiningAngleDeg",
              entityId: conn.connectionId,
              oldValue: currentAngle,
              newValue: conn.allowedAngleDeg ?? 180.0,
              reason: `Reset connection joining angle to ${conn.allowedAngleDeg ?? 180.0}° to re-align interface origins.`,
            });
            break;
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Piece-Level Failures
    // ─────────────────────────────────────────────────────────────
    if (failure.pieceId && modifications.length === 0) {
      const piece = puzzle.pieces?.find((p) => p.pieceId === failure.pieceId);
      if (piece) {
        if (failure.category === "thickness") {
          const stockThickness =
            puzzle.specification?.material?.stockThicknessMm ?? 3.0;
          modifications.push({
            parameterName: "thickness",
            entityId: piece.pieceId,
            oldValue: piece.thickness,
            newValue: stockThickness,
            reason: `Corrected piece thickness from ${piece.thickness}mm to material stock specification ${stockThickness}mm.`,
          });
        } else if (failure.category === "geometry") {
          if (piece.profile && !piece.profile.isClosed) {
            modifications.push({
              parameterName: "isClosed",
              entityId: piece.pieceId,
              oldValue: false,
              newValue: true,
              reason: `Closed degenerate open contour profile on piece '${piece.pieceId}'.`,
            });
          }
        }
      }
    }

    return modifications;
  }
}
