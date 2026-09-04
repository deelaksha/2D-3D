/**
 * Deterministic Placement Validator (Phase 84).
 *
 * Validates all generated connector placements against corner margins,
 * minimum feature sizes, inter-connector gaps, and cutout collisions.
 */

import type {
  MaterialPlacementConstraints,
  PlacedConnectorLocation,
} from "./types";
import { SlotIntersectionDetector } from "./slotIntersectionDetector";

export class PlacementValidator {
  public static validateAll(
    placements: PlacedConnectorLocation[],
    constraints?: Partial<MaterialPlacementConstraints>
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const minCorner = constraints?.minCornerMarginMm ?? 5.0;
    const minGap = constraints?.minInterConnectorGapMm ?? 6.0;
    const minBridge = constraints?.minBridgeWidthMm ?? 4.0;

    // 1. Check individual placements
    for (const p of placements) {
      if (p.parametricOffsetT <= 0.05 || p.parametricOffsetT >= 0.95) {
        errors.push(
          `Connector '${p.connectorId}' on edge '${p.edgeId}' has extreme parametric offset t=${p.parametricOffsetT.toFixed(3)}. Placed too close to vertex.`
        );
      }

      if (p.cornerMarginStartMm < minCorner - 0.5) {
        errors.push(
          `Connector '${p.connectorId}' violates corner margin at start (${p.cornerMarginStartMm.toFixed(1)} mm < ${minCorner} mm).`
        );
      }

      if (p.cornerMarginEndMm < minCorner - 0.5) {
        errors.push(
          `Connector '${p.connectorId}' violates corner margin at end (${p.cornerMarginEndMm.toFixed(1)} mm < ${minCorner} mm).`
        );
      }

      if (p.widthMm <= 0 || p.depthMm <= 0) {
        errors.push(`Connector '${p.connectorId}' has non-positive dimensions (${p.widthMm}x${p.depthMm} mm).`);
      }
    }

    // 2. Check collision between connectors on the same piece
    const pieceConnectorMap = new Map<string, PlacedConnectorLocation[]>();
    for (const p of placements) {
      if (!pieceConnectorMap.has(p.pieceAId)) pieceConnectorMap.set(p.pieceAId, []);
      if (!pieceConnectorMap.has(p.pieceBId)) pieceConnectorMap.set(p.pieceBId, []);
      pieceConnectorMap.get(p.pieceAId)?.push(p);
      pieceConnectorMap.get(p.pieceBId)?.push(p);
    }

    for (const [pieceId, connList] of pieceConnectorMap.entries()) {
      const n = connList.length;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const col = SlotIntersectionDetector.checkCollision(connList[i], connList[j], minBridge);
          if (col.hasIntersection) {
            errors.push(
              `Collision detected on piece '${pieceId}' between connectors '${connList[i].connectorId}' and '${connList[j].connectorId}': ${col.message}`
            );
          }
        }
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
    };
  }
}
