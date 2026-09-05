/**
 * Candidate Angle Generator (Phase 88).
 *
 * Generates discrete candidate joining angles for evaluation based on
 * connector type, interface frame, and constraint bounds.
 */

import type { ConnectorType } from "../connectorgeneration/types";
import type { AngleGenerationOptions } from "./types";

export class CandidateAngleGenerator {
  /**
   * Generates a sorted, unique list of candidate joining angles in degrees.
   */
  public static generateCandidates(
    connectorType: ConnectorType,
    options?: AngleGenerationOptions
  ): number[] {
    // 1. If explicit custom candidate angles are provided, use them directly
    if (options?.customCandidates && options.customCandidates.length > 0) {
      return Array.from(new Set(options.customCandidates)).sort((a, b) => a - b);
    }

    const step = options?.angleStepDeg ?? 15.0;
    const minAngle = options?.minAngleDeg ?? 0.0;
    const maxAngle = options?.maxAngleDeg ?? 180.0;

    const rawCandidates: number[] = [];

    switch (connectorType) {
      case "hinge": {
        // Continuous rotation range [0°, 180°] sampled in discrete increments (e.g. 15°)
        for (let a = minAngle; a <= maxAngle + 1e-4; a += step) {
          rawCandidates.push(Number(a.toFixed(1)));
        }
        break;
      }

      case "rotational": {
        // 360° continuous rotation sampled in discrete increments
        const rotMax = Math.min(360.0, options?.maxAngleDeg ?? 360.0);
        for (let a = minAngle; a < rotMax - 1e-4; a += step) {
          rawCandidates.push(Number(a.toFixed(1)));
        }
        break;
      }

      case "tab_slot": {
        // Tab-slot supports planar (180°) and orthogonal (90°), plus intermediate test candidates
        const standardAngles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];
        for (const a of standardAngles) {
          if (a >= minAngle - 1e-4 && a <= maxAngle + 1e-4) {
            rawCandidates.push(a);
          }
        }
        break;
      }

      case "notch": {
        // Half-lap crossing notch joints are perpendicular (90°), but include sample angles for validation
        const notchTestAngles = [0, 15, 30, 45, 60, 75, 90, 120, 135, 180];
        for (const a of notchTestAngles) {
          if (a >= minAngle - 1e-4 && a <= maxAngle + 1e-4) {
            rawCandidates.push(a);
          }
        }
        break;
      }

      case "interlock": {
        // Mechanical dovetail tension locks are planar (180°) or angled (90°)
        const interlockAngles = [0, 15, 30, 45, 60, 90, 120, 135, 180];
        for (const a of interlockAngles) {
          if (a >= minAngle - 1e-4 && a <= maxAngle + 1e-4) {
            rawCandidates.push(a);
          }
        }
        break;
      }

      case "keyed": {
        // Asymmetric key joints (180°, 90°, plus sample angles)
        const keyedAngles = [0, 15, 30, 45, 60, 90, 135, 180];
        for (const a of keyedAngles) {
          if (a >= minAngle - 1e-4 && a <= maxAngle + 1e-4) {
            rawCandidates.push(a);
          }
        }
        break;
      }

      case "custom":
      default: {
        for (let a = minAngle; a <= maxAngle + 1e-4; a += step) {
          rawCandidates.push(Number(a.toFixed(1)));
        }
        break;
      }
    }

    return Array.from(new Set(rawCandidates)).sort((a, b) => a - b);
  }
}

/**
 * Functional wrapper for CandidateAngleGenerator.generateCandidates.
 */
export function generateCandidateAngles(
  connectorType: ConnectorType,
  options?: AngleGenerationOptions
): number[] {
  return CandidateAngleGenerator.generateCandidates(connectorType, options);
}

/**
 * Helper to get the canonical operational angle range for a connector type.
 */
export function getConnectorAngleRange(connectorType: ConnectorType): {
  min: number;
  max: number;
  step: number;
} {
  switch (connectorType) {
    case "hinge":
      return { min: 0, max: 180, step: 15 };
    case "rotational":
      return { min: 0, max: 360, step: 15 };
    case "notch":
      return { min: 90, max: 90, step: 0 };
    case "interlock":
      return { min: 90, max: 180, step: 90 };
    case "tab_slot":
    case "keyed":
    case "custom":
    default:
      return { min: 0, max: 180, step: 15 };
  }
}
