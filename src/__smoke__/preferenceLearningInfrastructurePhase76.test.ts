/**
 * Smoke & Integration Tests for Phase 76:
 * Preference Learning Infrastructure Subsystem
 */

import { describe, it, expect } from "vitest";
import {
  PreferenceDataset,
  BaselinePreferenceModel,
  type StructuredFeedback,
  type ReviewContext,
  type PreferenceExample,
  type PreferenceModel,
} from "../core/puzzle/preference";

describe("Phase 76: Preference Learning Infrastructure Subsystem", () => {
  const sampleFeedback: StructuredFeedback = {
    overall: {
      rating: 4.5,
      tags: ["sturdy", "satisfying_interlock"],
      notes: "High quality desktop organizer puzzle.",
    },
    difficulty: {
      rating: 4.0,
      perceivedDifficulty: "just_right",
      preferredTier: "medium",
      notes: "Engaging 4-piece sequence without being frustrating.",
    },
    visual: {
      rating: 4.8,
      aestheticBalanceRating: 5,
      symmetryAppreciation: true,
      notes: "Proportions match desktop accessories well.",
    },
    connection: {
      rating: 4.7,
      fitPerception: "ideal",
      preferredJointType: "tab_slot",
      notes: "0.15mm clearance provides reliable friction fit without jamming.",
    },
    assembly: {
      rating: 4.5,
      sequenceIntuitiveness: 5,
      ergonomicRating: 4,
      notes: "Pieces slip together smoothly without bending cardboard tabs.",
    },
    manufacturing: {
      rating: 4.6,
      materialQualityRating: 5,
      wasteAcceptabilityRating: 4,
      notes: "Compact sheet layout minimizes corrugated board waste.",
    },
  };

  const sampleReviewContext: ReviewContext = {
    reviewerId: "cust_annotator_789",
    reviewerRole: "customer",
    reviewEnvironment: "physical_assembled_prototype",
    deviceOrChannel: "in_store_test_bench",
    sessionId: "sess_review_101",
  };

  describe("1. 6-Dimension Structured Feedback Collection", () => {
    it("creates, validates, and stores feedback covering all 6 required preference dimensions", () => {
      const dataset = new PreferenceDataset("test_preferences_v1");

      const example = dataset.addExample({
        design_id: "puzzle_desk_organizer_v1",
        design_version: 1,
        feedback: sampleFeedback,
        rating: 4.5,
        reason: "Excellent friction fit and balanced aesthetic proportions.",
        review_context: sampleReviewContext,
        parametric_features_snapshot: {
          pieceCount: 4,
          clearance: 0.15,
          aspectRatio: 1.5,
          sheetPackingDensityPct: 52.4,
        },
      });

      expect(example.example_id).toBeDefined();
      expect(example.design_id).toBe("puzzle_desk_organizer_v1");
      expect(example.design_version).toBe(1);
      expect(example.rating).toBe(4.5);
      expect(example.is_ground_truth_isolated).toBe(true);

      // Verify all 6 dimensions
      expect(example.feedback.overall.rating).toBe(4.5);
      expect(example.feedback.difficulty.rating).toBe(4.0);
      expect(example.feedback.difficulty.perceivedDifficulty).toBe("just_right");
      expect(example.feedback.visual.rating).toBe(4.8);
      expect(example.feedback.connection.rating).toBe(4.7);
      expect(example.feedback.connection.fitPerception).toBe("ideal");
      expect(example.feedback.assembly.rating).toBe(4.5);
      expect(example.feedback.manufacturing.rating).toBe(4.6);
    });
  });

  describe("2. Strict Ground-Truth Isolation Invariant", () => {
    it("strictly isolates preference data and rejects raw CAD geometry / mesh contamination", () => {
      const dataset = new PreferenceDataset();

      // Attempt to contaminate with raw mesh vertices
      expect(() => {
        dataset.addExample({
          design_id: "puzzle_desk_organizer_v1",
          design_version: 1,
          feedback: sampleFeedback,
          rating: 4.0,
          reason: "Attempting raw geometry injection",
          review_context: sampleReviewContext,
          parametric_features_snapshot: {
            pieceCount: 4,
            raw_mesh_vertices: [[0, 0, 0], [10, 0, 0]], // FORBIDDEN: Raw geometry mesh
          },
        });
      }).toThrow(/Security & Invariant Violation.*ground truth/i);

      // Attempt to contaminate with CAD B-Rep solids
      expect(() => {
        dataset.addExample({
          design_id: "puzzle_desk_organizer_v1",
          design_version: 1,
          feedback: sampleFeedback,
          rating: 4.0,
          reason: "Attempting CAD brep injection",
          review_context: sampleReviewContext,
          parametric_features_snapshot: {
            pieceCount: 4,
            cad_brep_solids: { faces: 6, edges: 12 }, // FORBIDDEN
          },
        });
      }).toThrow(/Security & Invariant Violation.*ground truth/i);
    });

    it("rejects examples missing required fields or with out-of-bounds ratings", () => {
      const dataset = new PreferenceDataset();

      // Missing design_id
      expect(() => {
        dataset.addExample({
          design_id: "",
          design_version: 1,
          feedback: sampleFeedback,
          rating: 4.0,
          reason: "Missing design id",
          review_context: sampleReviewContext,
        });
      }).toThrow(/valid 'design_id'/i);

      // Rating > 5.0
      expect(() => {
        dataset.addExample({
          design_id: "puz_1",
          design_version: 1,
          feedback: sampleFeedback,
          rating: 5.5, // Invalid: > 5.0
          reason: "Out of bounds rating",
          review_context: sampleReviewContext,
        });
      }).toThrow(/number between 1.0 and 5.0/i);
    });
  });

  describe("3. PreferenceDataset Queries, Filtering & Aggregated Statistics", () => {
    it("aggregates multi-dimensional statistics and supports query filtering", () => {
      const dataset = new PreferenceDataset();

      // Add 3 diverse examples
      dataset.addExample({
        design_id: "puz_desk_A",
        design_version: 1,
        feedback: sampleFeedback,
        rating: 4.5,
        reason: "Great friction fit",
        review_context: sampleReviewContext,
      });

      dataset.addExample({
        design_id: "puz_desk_A",
        design_version: 2,
        feedback: {
          ...sampleFeedback,
          overall: { rating: 5.0 },
          connection: { ...sampleFeedback.connection, rating: 5.0 },
        },
        rating: 5.0,
        reason: "Improved clearance in v2",
        review_context: { ...sampleReviewContext, reviewerId: "cust_2" },
      });

      dataset.addExample({
        design_id: "puz_desk_B",
        design_version: 1,
        feedback: {
          ...sampleFeedback,
          overall: { rating: 3.0 },
          connection: { ...sampleFeedback.connection, rating: 2.5, fitPerception: "too_tight" },
        },
        rating: 3.0,
        reason: "A bit too tight for cardboard",
        review_context: {
          reviewerId: "eng_1",
          reviewerRole: "engineer",
          reviewEnvironment: "3d_interactive_preview",
        },
      });

      expect(dataset.count).toBe(3);

      // Filter by design ID
      const filteredA = dataset.filter({ designId: "puz_desk_A" });
      expect(filteredA.length).toBe(2);

      // Filter by reviewer role
      const filteredEng = dataset.filter({ reviewerRole: "engineer" });
      expect(filteredEng.length).toBe(1);
      expect(filteredEng[0].design_id).toBe("puz_desk_B");

      // Filter by minimum rating
      const filteredHigh = dataset.filter({ minRating: 4.0 });
      expect(filteredHigh.length).toBe(2);

      // Aggregated statistics
      const stats = dataset.getStatistics();
      expect(stats.totalExamples).toBe(3);
      expect(stats.uniqueDesignsCount).toBe(2);
      expect(stats.uniqueReviewersCount).toBe(3);
      expect(stats.averageOverallRating).toBeCloseTo(4.17, 1);
      expect(stats.averageDimensionRatings.overall).toBeGreaterThan(4.0);
      expect(stats.reviewEnvironmentDistribution["physical_assembled_prototype"]).toBe(2);
      expect(stats.reviewEnvironmentDistribution["3d_interactive_preview"]).toBe(1);
    });

    it("serializes to JSON and safely restores dataset without loss of integrity", () => {
      const dataset = new PreferenceDataset("export_test", "1.2.0");
      dataset.addExample({
        design_id: "puz_export_1",
        design_version: 1,
        feedback: sampleFeedback,
        rating: 4.2,
        reason: "Sturdy construction",
        review_context: sampleReviewContext,
      });

      const json = dataset.exportToJson();
      expect(json).toContain("export_test");
      expect(json).toContain("puz_export_1");
      expect(json).toContain("groundTruthIsolated");

      const restored = PreferenceDataset.importFromJson(json);
      expect(restored.count).toBe(1);
      expect(restored.name).toBe("export_test");
      expect(restored.getAllExamples()[0].design_id).toBe("puz_export_1");
      expect(restored.getAllExamples()[0].is_ground_truth_isolated).toBe(true);
    });
  });

  describe("4. Pairwise Preference Comparison Support", () => {
    it("records and analyzes pairwise preference rankings (Design A vs Design B)", () => {
      const dataset = new PreferenceDataset();

      const example = dataset.addExample({
        design_id: "puz_candidate_A",
        design_version: 1,
        feedback: sampleFeedback,
        rating: 4.6,
        reason: "Preferred Candidate A over Candidate B due to superior friction fit.",
        review_context: sampleReviewContext,
        comparison_target: {
          targetDesignId: "puz_candidate_B",
          targetDesignVersion: 1,
          preferredDesign: "this", // A was preferred over B
          winMargin: 2,
        },
      });

      expect(example.comparison_target).toBeDefined();
      expect(example.comparison_target?.preferredDesign).toBe("this");
      expect(example.comparison_target?.targetDesignId).toBe("puz_candidate_B");

      const stats = dataset.getStatistics();
      expect(stats.pairwiseComparisonCount).toBe(1);
    });
  });

  describe("5. PreferenceModel Interface Compliance & Future Model Calibration", () => {
    it("conforms to PreferenceModel interface, predicting pointwise and pairwise ratings", async () => {
      const model: PreferenceModel = new BaselinePreferenceModel();

      expect(model.modelId).toBe("baseline_heuristic_preference_model_v1");
      expect(model.modelVersion).toBe("1.0.0");

      // Pointwise prediction
      const prediction = await model.predictPreference({
        pieceCount: 4,
        clearance: 0.15,
        aspectRatio: 1.5,
        sheetPackingDensityPct: 55.0,
      });

      expect(prediction.predictedRating).toBeGreaterThanOrEqual(1.0);
      expect(prediction.predictedRating).toBeLessThanOrEqual(5.0);
      expect(prediction.confidenceScore).toBeGreaterThan(0.0);
      expect(prediction.dimensionScores.connection).toBeGreaterThanOrEqual(4.0); // 0.15mm clearance is optimal
      expect(prediction.predictedAcceptanceLikelihood).toBeGreaterThan(0.7);

      // Pairwise prediction: Candidate A (optimal 0.15mm) vs Candidate B (wobbly 0.35mm)
      const pairwise = await model.predictPairwisePreference(
        { pieceCount: 4, clearance: 0.15, sheetPackingDensityPct: 55.0 },
        { pieceCount: 4, clearance: 0.35, sheetPackingDensityPct: 25.0 }
      );

      expect(pairwise.preferredCandidate).toBe("A");
      expect(pairwise.probAWin).toBeGreaterThan(0.5);
      expect(pairwise.dimensionAdvantages.connection).toBe("A");
      expect(pairwise.dimensionAdvantages.manufacturing).toBe("A");

      // Model calibration evaluation
      const dataset = new PreferenceDataset();
      dataset.addExample({
        design_id: "cal_1",
        design_version: 1,
        feedback: sampleFeedback,
        rating: 4.5,
        reason: "Optimal fit",
        review_context: sampleReviewContext,
        parametric_features_snapshot: { pieceCount: 4, clearance: 0.15, sheetPackingDensityPct: 55.0 },
      });

      const calMetrics = await model.evaluateCalibration(dataset.getAllExamples());
      expect(calMetrics.evaluatedExamplesCount).toBe(1);
      expect(calMetrics.meanAbsoluteError).toBeLessThan(1.0);
      expect(calMetrics.rootMeanSquaredError).toBeLessThan(1.0);
    });
  });
});
