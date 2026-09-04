/**
 * Sampling Feature Classifier (Phase 64).
 *
 * Deterministically extracts and classifies the 7 stratification dimensions
 * from any puzzle dataset example:
 *   1. piece count
 *   2. connection type
 *   3. difficulty
 *   4. geometry complexity
 *   5. assembly angle
 *   6. material
 *   7. failure type
 */
import type { RealDatasetExample } from "../realdata/types";
import type { GeometryComplexityTier, SamplingDimensions } from "./types";

export class FeatureClassifier {
  /**
   * Classifies an example across all 7 stratification dimensions.
   */
  static classify(example: RealDatasetExample): SamplingDimensions {
    // 1. Piece Count
    const pieces = example.pieces || [];
    const pieceCount = pieces.length;

    // 2. Connection Type
    let connectionType = "none";
    if (example.connections && example.connections.length > 0) {
      const rawType = example.connections[0].connectionType;
      if (rawType && rawType !== "rigid") {
        connectionType = rawType;
      } else {
        const conn0 = example.connections[0];
        const ifA = example.interfaces?.find(
          (i) => i.interfaceId === conn0.interfaceAId || (i as any).id === conn0.interfaceAId
        );
        const ifB = example.interfaces?.find(
          (i) => i.interfaceId === conn0.interfaceBId || (i as any).id === conn0.interfaceBId
        );
        if (
          (ifA?.interfaceType === "tab" && ifB?.interfaceType === "slot") ||
          (ifA?.interfaceType === "slot" && ifB?.interfaceType === "tab")
        ) {
          connectionType = "tab_slot";
        } else if (ifA?.interfaceType || ifB?.interfaceType) {
          connectionType = `${ifA?.interfaceType || ifB?.interfaceType}_joint`;
        } else {
          connectionType = rawType || "tab_slot";
        }
      }
    } else if (example.interfaces && example.interfaces.length > 0) {
      connectionType = `${example.interfaces[0].interfaceType}_joint`;
    }

    // 3. Difficulty
    const difficulty = example.userRequirement?.targetDifficulty || "medium";

    // 4. Geometry Complexity Tier
    const geometryComplexity = this.classifyGeometryComplexity(pieces);

    // 5. Dominant Assembly Angle
    let assemblyAngle = 90;
    if (example.connections && example.connections.length > 0) {
      assemblyAngle = example.connections[0].joiningAngleDeg ?? 90;
    }

    // 6. Material
    const material = example.puzzle?.materialSpecification?.materialId || "cardboard_3mm";

    // 7. Failure Type
    let failureType = "none";
    if (example.qualityStatus === "FAIL" || !example.validation?.isValid) {
      if (example.failureReasons && example.failureReasons.length > 0) {
        failureType = this.normalizeFailureCode(example.failureReasons[0]);
      } else {
        failureType = "unspecified_failure";
      }
    }

    return {
      pieceCount,
      connectionType,
      difficulty,
      geometryComplexity,
      assemblyAngle,
      material,
      failureType,
    };
  }

  /**
   * Classifies geometric complexity based on vertex density and contour features.
   */
  private static classifyGeometryComplexity(
    pieces: RealDatasetExample["pieces"]
  ): GeometryComplexityTier {
    if (!pieces || pieces.length === 0) return "simple";

    let totalVertices = 0;
    for (const p of pieces) {
      totalVertices += p.localPolygon2D ? p.localPolygon2D.length : 4;
    }
    const avgVertices = totalVertices / pieces.length;

    if (avgVertices <= 4) {
      return "simple";
    } else if (avgVertices <= 10) {
      return "medium";
    } else {
      return "complex";
    }
  }

  private static normalizeFailureCode(rawReason: string): string {
    const lower = rawReason.toLowerCase();
    if (lower.includes("interface") || lower.includes("gender")) return "incompatible_interfaces";
    if (lower.includes("collision")) return "collision";
    if (lower.includes("clearance")) return "insufficient_clearance";
    if (lower.includes("disconnect") || lower.includes("graph")) return "disconnected_assembly";
    if (lower.includes("angle")) return "impossible_angle";
    if (lower.includes("zero_area") || lower.includes("degenerate") || lower.includes("boundary")) {
      return "invalid_geometry";
    }
    if (lower.includes("thickness") || lower.includes("dimension")) return "invalid_dimensions";
    return "general_failure";
  }
}
