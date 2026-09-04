/**
 * Smoke and Integration Tests for Phase 69:
 * Formal Puzzle Difficulty Representation & Deterministic Scoring Engine
 */

import { describe, it, expect } from "vitest";
import {
  DifficultyFeatures,
  DifficultyScore,
  DifficultyEvaluationContext,
  DifficultyPieceInput,
  DeterministicDifficultyModel,
  DEFAULT_DIFFICULTY_FEATURE_WEIGHTS,
} from "../core/puzzle/difficulty";
import { ConnectionModelFactory, CoordinateFrame3D } from "../core/puzzle/connection/connectionModel";
import { vec3 } from "../core/puzzle/geometry/math3d";

function makeFrame(origin = vec3(0, 0, 0), normal = vec3(0, 1, 0)): CoordinateFrame3D {
  return {
    origin,
    tangent: vec3(1, 0, 0),
    normal,
    binormal: vec3(0, 0, 1),
  };
}

describe("Phase 69: Formal Puzzle Difficulty Representation Subsystem", () => {
  const model = new DeterministicDifficultyModel();

  describe("1. Low-Complexity Puzzle Scoring (Easy Tier)", () => {
    it("evaluates a simple 2-piece puzzle with a single fixed connection as 'easy'", () => {
      const pieceA: DifficultyPieceInput = {
        id: "piece_1",
        dimensions: { width: 100, height: 50, thickness: 3.0 },
        symmetryOrder: 1,
      };
      const pieceB: DifficultyPieceInput = {
        id: "piece_2",
        dimensions: { width: 60, height: 30, thickness: 3.0 },
        symmetryOrder: 1,
      };

      const conn = ConnectionModelFactory.createFixedConnection({
        interfaceAId: "if_1",
        interfaceBId: "if_2",
        pieceAId: "piece_1",
        pieceBId: "piece_2",
        frameA: makeFrame(vec3(50, 25, 0)),
        frameB: makeFrame(vec3(0, 0, 0)),
        insertionDirection: vec3(0, 0, -1),
      });

      const context: DifficultyEvaluationContext = {
        pieces: [pieceA, pieceB],
        connections: [conn],
        knownConfigurationsCount: 1,
        deadEndPathsCount: 0,
      };

      const result: DifficultyScore = model.scorePuzzle(context);

      // Verify baseline metadata
      expect(result.modelId).toBe("deterministic_difficulty_v1");
      expect(result.level).toBe("easy");
      expect(result.overallScore).toBeLessThan(25.0);

      // Verify raw feature extraction
      expect(result.features.pieceCount).toBe(2);
      expect(result.features.connectionDensity).toBe(1.0); // 1 pair out of 1 possible = 1.0
      expect(result.features.deadEndPathsCount).toBe(0);
      expect(result.features.possibleConfigurationsCount).toBe(1);

      // Verify component scores
      expect(result.componentScores.structuralComplexity).toBeGreaterThan(0);
      expect(result.componentScores.combinatorialSearchComplexity).toBeLessThan(15);
    });
  });

  describe("2. Medium-Complexity Puzzle Scoring (Medium Tier)", () => {
    it("evaluates a 6-piece planar puzzle with sliding joints and modest configuration space", () => {
      const pieces: DifficultyPieceInput[] = Array.from({ length: 6 }, (_, i) => ({
        id: `piece_${i + 1}`,
        dimensions: { width: 40 + i * 5, height: 30, thickness: 3.0 },
        symmetryOrder: (i % 2 === 0) ? 2 : 1,
      }));

      // Create 5 sliding connections forming an assembly chain
      const connections = [];
      for (let i = 0; i < 5; i++) {
        connections.push(
          ConnectionModelFactory.createSlidingConnection({
            interfaceAId: `if_${i}_a`,
            interfaceBId: `if_${i + 1}_b`,
            pieceAId: `piece_${i + 1}`,
            pieceBId: `piece_${i + 2}`,
            frameA: makeFrame(vec3(20, 15, 0)),
            frameB: makeFrame(vec3(0, 0, 0)),
            minTravelMm: 0,
            maxTravelMm: 50,
            slidingAxis: vec3(1, 0, 0),
          })
        );
      }

      const context: DifficultyEvaluationContext = {
        pieces,
        connections,
        knownConfigurationsCount: 4,
        deadEndPathsCount: 2,
      };

      const result = model.scorePuzzle(context);

      expect(result.overallScore).toBeGreaterThanOrEqual(25.0);
      expect(result.overallScore).toBeLessThan(55.0);
      expect(result.level).toBe("medium");
      expect(result.features.pieceCount).toBe(6);
      expect(result.features.assemblySequenceLength).toBe(5);
    });
  });

  describe("3. High-Complexity Puzzle Scoring (Hard / Expert Tier)", () => {
    it("evaluates a 16-piece burr puzzle with interlocking joints and high dead-ends as 'hard' or 'expert'", () => {
      // 16 identical or highly ambiguous burr sticks
      const pieces: DifficultyPieceInput[] = Array.from({ length: 16 }, (_, i) => ({
        id: `burr_stick_${i + 1}`,
        dimensions: { width: 80, height: 20, thickness: 20 }, // High ambiguity: all identical!
        symmetryOrder: 4,
      }));

      // High density interlocking connections with tight tolerances
      const connections = [];
      for (let i = 0; i < 15; i++) {
        connections.push(
          ConnectionModelFactory.createInterlockConnection({
            interfaceAId: `notch_${i}_a`,
            interfaceBId: `notch_${i + 1}_b`,
            pieceAId: `burr_stick_${i + 1}`,
            pieceBId: `burr_stick_${((i + 2) % 16) + 1}`,
            frameA: makeFrame(vec3(40, 10, 10)),
            frameB: makeFrame(vec3(40, 10, 10)),
            clearance: 0.05,
            tolerance: 0.05,
            insertionDirection: vec3(0, 1, 0),
          })
        );
      }

      const context: DifficultyEvaluationContext = {
        pieces,
        connections,
        knownConfigurationsCount: 64,
        deadEndPathsCount: 8,
        ambiguityRatio: 4.5,
        assemblySymmetryOrder: 4,
      };

      const result = model.scorePuzzle(context);

      expect(result.overallScore).toBeGreaterThanOrEqual(55.0);
      expect(["hard", "expert"]).toContain(result.level);
      expect(result.features.interlockingComplexity).toBeGreaterThan(5.0);
      expect(result.features.ambiguity).toBeGreaterThanOrEqual(4.0);
      expect(result.componentScores.geometricKinematicComplexity).toBeGreaterThan(50.0);
      expect(result.componentScores.combinatorialSearchComplexity).toBeGreaterThan(40.0);
    });
  });

  describe("4. Mathematical Monotonicity and Feature Sensitivity", () => {
    it("guarantees that strictly increasing piece count strictly increases structural complexity score", () => {
      const basePieces = (count: number): DifficultyPieceInput[] =>
        Array.from({ length: count }, (_, i) => ({
          id: `p_${i}`,
          dimensions: { width: 50, height: 50, thickness: 3 },
        }));

      const context4: DifficultyEvaluationContext = {
        pieces: basePieces(4),
        connections: [],
      };
      const context12: DifficultyEvaluationContext = {
        pieces: basePieces(12),
        connections: [],
      };

      const score4 = model.scorePuzzle(context4);
      const score12 = model.scorePuzzle(context12);

      expect(score12.features.pieceCount).toBeGreaterThan(score4.features.pieceCount);
      expect(score12.normalizedFeatures.pieceCount).toBeGreaterThan(score4.normalizedFeatures.pieceCount);
      expect(score12.componentScores.structuralComplexity).toBeGreaterThan(
        score4.componentScores.structuralComplexity
      );
      expect(score12.overallScore).toBeGreaterThan(score4.overallScore);
    });

    it("guarantees that adding dead-end paths strictly increases combinatorial complexity score", () => {
      const pieces: DifficultyPieceInput[] = [
        { id: "p1", dimensions: { width: 50, height: 50, thickness: 3 } },
        { id: "p2", dimensions: { width: 50, height: 50, thickness: 3 } },
      ];

      const zeroDeadEnds = model.scorePuzzle({ pieces, connections: [], deadEndPathsCount: 0 });
      const multipleDeadEnds = model.scorePuzzle({ pieces, connections: [], deadEndPathsCount: 6 });

      expect(multipleDeadEnds.features.deadEndPathsCount).toBe(6);
      expect(multipleDeadEnds.normalizedFeatures.deadEndPathsCount).toBeGreaterThan(
        zeroDeadEnds.normalizedFeatures.deadEndPathsCount
      );
      expect(multipleDeadEnds.componentScores.combinatorialSearchComplexity).toBeGreaterThan(
        zeroDeadEnds.componentScores.combinatorialSearchComplexity
      );
      expect(multipleDeadEnds.overallScore).toBeGreaterThan(zeroDeadEnds.overallScore);
    });
  });

  describe("5. Feature Breakdown Preservation for Future ML Models", () => {
    it("produces an exhaustive, mathematically consistent feature breakdown vector", () => {
      const pieces: DifficultyPieceInput[] = [
        { id: "p1", dimensions: { width: 40, height: 40, thickness: 3 } },
        { id: "p2", dimensions: { width: 40, height: 40, thickness: 3 } },
        { id: "p3", dimensions: { width: 40, height: 40, thickness: 3 } },
      ];

      const res = model.scorePuzzle({ pieces, connections: [] });

      const featureKeys: Array<keyof DifficultyFeatures> = [
        "pieceCount",
        "connectionDensity",
        "possibleConfigurationsCount",
        "ambiguity",
        "assemblySequenceLength",
        "validAnglesCount",
        "constrainedInterfacesCount",
        "symmetryOrder",
        "interlockingComplexity",
        "motionPlanningDifficulty",
        "deadEndPathsCount",
      ];

      let sumOfContributions = 0;

      for (const key of featureKeys) {
        const item = res.featureBreakdown[key];
        expect(item).toBeDefined();
        expect(item.featureName).toBe(key);
        expect(item.rawValue).toBe(res.features[key]);
        expect(item.normalizedValue).toBe(res.normalizedFeatures[key]);
        expect(item.normalizedValue).toBeGreaterThanOrEqual(0.0);
        expect(item.normalizedValue).toBeLessThanOrEqual(1.0);
        expect(item.weight).toBe(DEFAULT_DIFFICULTY_FEATURE_WEIGHTS[key]);
        sumOfContributions += item.weightedContribution;
      }

      // Sum of weighted contributions should match overallScore within rounding
      expect(Math.abs(sumOfContributions - res.overallScore)).toBeLessThan(0.05);
    });
  });

  describe("6. Custom Model Configuration & Threshold Overrides", () => {
    it("supports custom weights and threshold adjustments", () => {
      // Create a custom model that heavily penalizes motion planning
      const customModel = new DeterministicDifficultyModel({
        weights: {
          motionPlanningDifficulty: 0.50,
          pieceCount: 0.05,
        },
        thresholds: {
          easyMax: 15.0,
          mediumMax: 40.0,
          hardMax: 70.0,
        },
      });

      const pieces: DifficultyPieceInput[] = [
        { id: "p1", dimensions: { width: 20, height: 20, thickness: 2 } },
      ];

      const res = customModel.scorePuzzle({ pieces, connections: [] });
      expect(res.featureBreakdown.motionPlanningDifficulty.weight).toBe(0.50);
      expect(res.featureBreakdown.pieceCount.weight).toBe(0.05);
    });
  });
});
