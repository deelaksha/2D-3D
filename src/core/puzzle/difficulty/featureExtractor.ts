/**
 * Feature Extractor for Puzzle Difficulty Representation (Phase 69)
 *
 * Deterministically extracts 11 measurable properties from a puzzle's geometry,
 * topology, kinematics, and assembly paths.
 */

import {
  DifficultyEvaluationContext,
  DifficultyFeatures,
} from "./types";
import { AdvancedConnectionModel } from "../connection/connectionModel";

export class DifficultyFeatureExtractor {
  /**
   * Extracts all 11 measurable features from the given puzzle context.
   */
  public static extractFeatures(context: DifficultyEvaluationContext): DifficultyFeatures {
    const pieces = context.pieces || [];
    const connections = context.connections || [];
    const N = Math.max(1, pieces.length);

    // 1. Piece Count
    const pieceCount = N;

    // 2. Connection Density
    const connectionDensity = this.computeConnectionDensity(pieces, connections);

    // 3. Possible Configurations Count
    const possibleConfigurationsCount = this.computePossibleConfigurations(context);

    // 4. Ambiguity
    const ambiguity = this.computeAmbiguity(context);

    // 5. Assembly Sequence Length
    const assemblySequenceLength = this.computeSequenceLength(context);

    // 6. Valid Angles Count
    const validAnglesCount = this.computeValidAnglesCount(connections);

    // 7. Constrained Interfaces Count
    const constrainedInterfacesCount = this.computeConstrainedInterfacesCount(connections);

    // 8. Symmetry Order
    const symmetryOrder = this.computeSymmetryOrder(context);

    // 9. Interlocking Complexity
    const interlockingComplexity = this.computeInterlockingComplexity(connections);

    // 10. Motion-Planning Difficulty
    const motionPlanningDifficulty = this.computeMotionPlanningDifficulty(context);

    // 11. Dead-End Paths Count
    const deadEndPathsCount = this.computeDeadEndPathsCount(context);

    return {
      pieceCount,
      connectionDensity: Number(connectionDensity.toFixed(4)),
      possibleConfigurationsCount,
      ambiguity: Number(ambiguity.toFixed(4)),
      assemblySequenceLength,
      validAnglesCount,
      constrainedInterfacesCount,
      symmetryOrder,
      interlockingComplexity: Number(interlockingComplexity.toFixed(4)),
      motionPlanningDifficulty: Number(motionPlanningDifficulty.toFixed(4)),
      deadEndPathsCount,
    };
  }

  /**
   * Connection density = unique connected piece pairs / (N * (N - 1) / 2)
   */
  private static computeConnectionDensity(
    pieces: DifficultyEvaluationContext["pieces"],
    connections: AdvancedConnectionModel[]
  ): number {
    const N = pieces.length;
    if (N <= 1) return 0.0;

    const maxPairs = (N * (N - 1)) / 2;
    const connectedPairs = new Set<string>();

    for (const conn of connections) {
      const pA = conn.interfaceA?.pieceId || (conn as any).pieceAId;
      const pB = conn.interfaceB?.pieceId || (conn as any).pieceBId;
      if (pA && pB && pA !== pB) {
        const key = pA < pB ? `${pA}::${pB}` : `${pB}::${pA}`;
        connectedPairs.add(key);
      }
    }

    return Math.min(1.0, connectedPairs.size / maxPairs);
  }

  /**
   * Computes number of possible distinct assembly configurations.
   */
  private static computePossibleConfigurations(context: DifficultyEvaluationContext): number {
    if (context.knownConfigurationsCount !== undefined) {
      return Math.max(1, context.knownConfigurationsCount);
    }

    let configMultiplier = 1;
    for (const conn of context.connections || []) {
      if (conn.behavior === "ROTATIONAL") {
        configMultiplier *= 4; // 4 orthogonal orientations
      } else if (conn.angleLimits) {
        const span = Math.abs(conn.angleLimits.maxAngleDeg - conn.angleLimits.minAngleDeg);
        if (span > 1.0) {
          const discreteSectors = Math.max(1, Math.floor(span / 45.0));
          configMultiplier *= discreteSectors;
        }
      }
    }

    // Bound combinatorial explosion to reasonable analytical range
    return Math.min(10000, Math.max(1, configMultiplier));
  }

  /**
   * Computes ambiguity: measures indistinguishable pieces and identical dimension slots.
   */
  private static computeAmbiguity(context: DifficultyEvaluationContext): number {
    if (context.ambiguityRatio !== undefined) {
      return Math.max(1.0, context.ambiguityRatio);
    }

    const pieces = context.pieces || [];
    if (pieces.length <= 1) return 1.0;

    // Group pieces by identical dimensions
    const dimBuckets = new Map<string, number>();
    for (const p of pieces) {
      if (p.dimensions) {
        const key = `${p.dimensions.width.toFixed(1)}x${p.dimensions.height.toFixed(1)}x${p.dimensions.thickness.toFixed(1)}`;
        dimBuckets.set(key, (dimBuckets.get(key) || 0) + 1);
      }
    }

    let duplicatePiecesCount = 0;
    for (const count of dimBuckets.values()) {
      if (count > 1) {
        duplicatePiecesCount += count - 1;
      }
    }

    // Ambiguity baseline is 1.0, scaled up by duplicate piece ratio
    return 1.0 + (duplicatePiecesCount / pieces.length) * 2.0;
  }

  /**
   * Assembly sequence length: steps required to reach final state.
   */
  private static computeSequenceLength(context: DifficultyEvaluationContext): number {
    if (context.assemblyPath && context.assemblyPath.totalSteps > 0) {
      return context.assemblyPath.totalSteps;
    }
    return Math.max(1, (context.pieces || []).length - 1);
  }

  /**
   * Total count of valid discrete angles / angle sectors across all connections.
   */
  private static computeValidAnglesCount(connections: AdvancedConnectionModel[]): number {
    if (!connections || connections.length === 0) return 1;

    let totalValidAngles = 0;
    for (const conn of connections) {
      if (conn.angleLimits) {
        const span = Math.abs(conn.angleLimits.maxAngleDeg - conn.angleLimits.minAngleDeg);
        if (span < 1.0) {
          totalValidAngles += 1; // Rigid fixed angle
        } else {
          totalValidAngles += Math.max(1, Math.round(span / 30.0));
        }
      } else if (conn.behavior === "ROTATIONAL") {
        totalValidAngles += 4;
      } else if (conn.behavior === "HINGE") {
        totalValidAngles += 6; // Default 180° / 30°
      } else {
        totalValidAngles += 1;
      }
    }

    return Math.max(1, totalValidAngles);
  }

  /**
   * Count of constrained interfaces (tight tolerance <= 0.2mm, non-planar, interlocks).
   */
  private static computeConstrainedInterfacesCount(connections: AdvancedConnectionModel[]): number {
    let constrained = 0;
    for (const conn of connections || []) {
      const isTightTol = conn.tolerance !== undefined && conn.tolerance <= 0.2;
      const isInterlock = conn.behavior === "INTERLOCK" || conn.behavior === "SNAP";
      const hasNonPlanarContact = conn.contactRegions && conn.contactRegions.length > 1;

      if (isTightTol || isInterlock || hasNonPlanarContact) {
        constrained += 1;
      }
    }
    return constrained;
  }

  /**
   * Global or piece-level symmetry order.
   */
  private static computeSymmetryOrder(context: DifficultyEvaluationContext): number {
    if (context.assemblySymmetryOrder !== undefined) {
      return Math.max(1, context.assemblySymmetryOrder);
    }

    let maxPieceSym = 1;
    for (const piece of context.pieces || []) {
      if (piece.symmetryOrder && piece.symmetryOrder > maxPieceSym) {
        maxPieceSym = piece.symmetryOrder;
      }
    }
    return maxPieceSym;
  }

  /**
   * Interlocking complexity metric.
   */
  private static computeInterlockingComplexity(connections: AdvancedConnectionModel[]): number {
    if (!connections || connections.length === 0) return 0.0;

    let score = 0.0;
    for (const conn of connections) {
      switch (conn.behavior) {
        case "INTERLOCK":
          score += 2.5;
          break;
        case "SNAP":
          score += 2.0;
          break;
        case "SLIDING":
          score += 1.5;
          break;
        case "HINGE":
        case "ROTATIONAL":
          score += 1.0;
          break;
        case "FIXED":
        default:
          score += 0.5;
          break;
      }

      // Constrained translation axes add complexity
      if (conn.allowedTranslationAxes && conn.allowedTranslationAxes.length === 0) {
        score += 0.5;
      }
    }

    return Math.min(10.0, score);
  }

  /**
   * Motion planning difficulty [0.0, 1.0].
   */
  private static computeMotionPlanningDifficulty(context: DifficultyEvaluationContext): number {
    const connections = context.connections || [];
    if (connections.length === 0) return 0.1;

    let difficulty = 0.1;

    // High clearance sensitivity
    let tightToleranceCount = 0;
    let directionalInsertionCount = 0;

    for (const conn of connections) {
      if (conn.tolerance !== undefined && conn.tolerance <= 0.15) {
        tightToleranceCount++;
      }
      if (conn.insertionDirection) {
        directionalInsertionCount++;
      }
    }

    if (connections.length > 0) {
      difficulty += (tightToleranceCount / connections.length) * 0.4;
      difficulty += (directionalInsertionCount / connections.length) * 0.3;
    }

    if (context.assemblyPath && context.assemblyPath.steps.length > 0) {
      const avgWaypoints =
        context.assemblyPath.steps.reduce((sum, s) => sum + s.waypoints.length, 0) /
        context.assemblyPath.steps.length;
      if (avgWaypoints > 10) {
        difficulty += 0.2;
      }
    }

    return Math.min(1.0, Number(difficulty.toFixed(4)));
  }

  /**
   * Dead-end assembly paths count.
   */
  private static computeDeadEndPathsCount(context: DifficultyEvaluationContext): number {
    if (context.deadEndPathsCount !== undefined) {
      return Math.max(0, context.deadEndPathsCount);
    }

    // In a puzzle with interlocking joints and cycle connections, estimate dead ends
    const interlockCount = (context.connections || []).filter(
      (c) => c.behavior === "INTERLOCK" || c.behavior === "SLIDING"
    ).length;

    const pieceCount = (context.pieces || []).length;
    if (interlockCount >= 2 && pieceCount >= 4) {
      return (interlockCount - 1) * 2;
    }

    return 0;
  }
}
