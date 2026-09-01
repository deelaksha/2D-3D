import { describe, expect, it } from "vitest";
import { FeedbackStore } from "../core/puzzle/feedback/feedbackStore";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../core/puzzle/canonical/defaults";

describe("Human-Feedback Architecture & Preference Data Collection (Phase 55)", () => {
  const puzzle = createEmptyCanonicalPuzzle("Feedback Test Box");
  puzzle.metadata.id = "puz_fb_test_101";
  puzzle.pieces.push(createCanonicalPiece("Base", { width: 100, height: 100, depth: 3.0 }, 3.0));

  it("1. FeedbackStore records human review feedback separately from canonical CAD geometry", async () => {
    const store = new FeedbackStore();

    const recorded = await store.recordFeedback({
      designId: puzzle.metadata.id,
      reviewerId: "reviewer_alice",
      ratingTags: ["looks_good"],
      subMetrics: {
        connectionQuality: 5,
        assemblyQuality: 4,
        manufacturability: 5,
        overallPreference: 5,
      },
      comments: "Great interlock fit!",
      version: 1,
    });

    expect(recorded.feedbackId).toBeDefined();
    expect(recorded.timestampIso).toBeDefined();
    expect(recorded.designId).toBe("puz_fb_test_101");

    // Invariant: Canonical puzzle remains untouched
    expect(puzzle.metadata.id).toBe("puz_fb_test_101");
    const puzObj = puzzle as unknown as Record<string, unknown>;
    expect(puzObj.embeddedFeedback).toBeUndefined();
  });

  it("2. rates designs across qualitative tags and 1-5 star sub-metrics", async () => {
    const store = new FeedbackStore();

    await store.recordFeedback({
      designId: "design_202",
      reviewerId: "reviewer_bob",
      ratingTags: ["too_difficult"],
      subMetrics: {
        connectionQuality: 3,
        assemblyQuality: 2,
        manufacturability: 4,
        overallPreference: 3,
      },
      comments: "Hard to assemble without instructions.",
      version: 1,
    });

    const list = await store.getFeedbackForDesign("design_202");
    expect(list.length).toBe(1);
    expect(list[0].ratingTags).toContain("too_difficult");
    expect(list[0].subMetrics.assemblyQuality).toBe(2);
  });

  it("3. computes FeedbackSummary with accurate averages and tag distributions", async () => {
    const store = new FeedbackStore();

    await store.recordFeedback({
      designId: "design_303",
      reviewerId: "reviewer_1",
      ratingTags: ["looks_good"],
      subMetrics: { connectionQuality: 5, assemblyQuality: 5, manufacturability: 5, overallPreference: 5 },
      comments: "Perfect!",
      version: 1,
    });

    await store.recordFeedback({
      designId: "design_303",
      reviewerId: "reviewer_2",
      ratingTags: ["too_easy"],
      subMetrics: { connectionQuality: 3, assemblyQuality: 3, manufacturability: 5, overallPreference: 3 },
      comments: "A bit trivial.",
      version: 1,
    });

    const summary = await store.getFeedbackSummary("design_303");

    expect(summary.totalFeedbackCount).toBe(2);
    expect(summary.averageOverallPreference).toBe(4.0); // (5+3)/2
    expect(summary.averageManufacturability).toBe(5.0);  // (5+5)/2
    expect(summary.tagDistribution.looks_good).toBe(1);
    expect(summary.tagDistribution.too_easy).toBe(1);
    expect(summary.recentComments.length).toBe(2);
  });

  it("4. exports structured preference dataset for future RLHF / DPO model training", async () => {
    const store = new FeedbackStore();

    await store.recordFeedback({
      designId: "d1",
      reviewerId: "r1",
      ratingTags: ["looks_good"],
      subMetrics: { connectionQuality: 5, assemblyQuality: 5, manufacturability: 5, overallPreference: 5 },
      comments: "Top tier",
      version: 1,
    });

    const dataset = await store.exportFeedbackDataset();
    expect(dataset.length).toBe(1);
    expect(dataset[0].designId).toBe("d1");
  });

  it("5. verifies strict invariant: zero AI model training is performed during feedback collection", async () => {
    const store = new FeedbackStore();
    await store.recordFeedback({
      designId: "d1",
      reviewerId: "r1",
      ratingTags: ["looks_good"],
      subMetrics: { connectionQuality: 5, assemblyQuality: 5, manufacturability: 5, overallPreference: 5 },
      comments: "Clean",
      version: 1,
    });

    const storeObj = store as unknown as Record<string, unknown>;
    expect(storeObj.trainedModelWeights).toBeUndefined();
    expect(storeObj.activeGradients).toBeUndefined();
  });
});
