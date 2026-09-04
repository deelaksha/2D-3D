/**
 * Preference Dataset Management Subsystem (Phase 76).
 *
 * Collects, validates, stores, and curates structured human and customer preference feedback.
 *
 * CRITICAL ARCHITECTURAL INVARIANT:
 *  - Preference data must remain strictly isolated from deterministic geometry ground truth.
 *  - Attempts to inject raw geometry or mutate canonical ground truth are rejected.
 */

import type {
  PreferenceDatasetStatistics,
  PreferenceExample,
  PreferenceQueryFilter,
} from "./types";
import { uid } from "@/core/model/ids";

export class PreferenceDataset {
  public readonly datasetId: string;
  public readonly name: string;
  public readonly version: string;
  public readonly createdAt: string;

  private examples: Map<string, PreferenceExample> = new Map();

  constructor(name: string = "puzzle_human_preferences", version: string = "1.0.0") {
    this.datasetId = uid("pref_ds_");
    this.name = name;
    this.version = version;
    this.createdAt = new Date().toISOString();
  }

  /**
   * Adds and validates a PreferenceExample record.
   * Enforces strict schema integrity and ground-truth isolation.
   */
  public addExample(
    exampleData: Omit<PreferenceExample, "example_id" | "is_ground_truth_isolated"> & {
      example_id?: string;
      is_ground_truth_isolated?: boolean;
    }
  ): PreferenceExample {
    // 1. Validate required fields
    if (!exampleData.design_id || typeof exampleData.design_id !== "string") {
      throw new Error("Validation Error: PreferenceExample must specify a valid 'design_id'.");
    }

    if (exampleData.design_version === undefined || exampleData.design_version === null) {
      throw new Error("Validation Error: PreferenceExample must specify a valid 'design_version'.");
    }

    if (
      typeof exampleData.rating !== "number" ||
      exampleData.rating < 1.0 ||
      exampleData.rating > 5.0
    ) {
      throw new Error(`Validation Error: 'rating' must be a number between 1.0 and 5.0 (got ${exampleData.rating}).`);
    }

    if (!exampleData.reason || typeof exampleData.reason !== "string") {
      throw new Error("Validation Error: PreferenceExample must provide a non-empty 'reason'.");
    }

    if (!exampleData.review_context || !exampleData.review_context.reviewerId) {
      throw new Error("Validation Error: PreferenceExample must specify valid 'review_context' with reviewerId.");
    }

    // 2. Validate all 6 required structured feedback dimensions
    const fb = exampleData.feedback;
    if (!fb) {
      throw new Error("Validation Error: PreferenceExample must contain structured feedback across all 6 dimensions.");
    }

    const requiredDimensions: Array<keyof typeof fb> = [
      "overall",
      "difficulty",
      "visual",
      "connection",
      "assembly",
      "manufacturing",
    ];

    for (const dim of requiredDimensions) {
      if (!fb[dim] || typeof fb[dim].rating !== "number") {
        throw new Error(`Validation Error: Missing or invalid structured feedback dimension '${dim}'.`);
      }
      if (fb[dim].rating < 1.0 || fb[dim].rating > 5.0) {
        throw new Error(`Validation Error: Dimension '${dim}' rating must be between 1.0 and 5.0 (got ${fb[dim].rating}).`);
      }
    }

    // 3. STRICT GROUND-TRUTH ISOLATION INVARIANT GUARD
    // Reject any attempt to pass raw CAD geometry meshes or override canonical models
    const snap = exampleData.parametric_features_snapshot;
    if (snap) {
      if (snap.raw_mesh_vertices || snap.triangle_normals || snap.cad_brep_solids) {
        throw new Error(
          "Security & Invariant Violation: Preference data must remain strictly isolated from deterministic geometry ground truth. Raw meshes and CAD solids cannot be stored in preference examples."
        );
      }
    }

    const exampleId = exampleData.example_id || uid("pref_ex_");
    const record: PreferenceExample = {
      ...exampleData,
      example_id: exampleId,
      timestamp: exampleData.timestamp || new Date().toISOString(),
      is_ground_truth_isolated: true,
    };

    this.examples.set(exampleId, record);
    return record;
  }

  /**
   * Adds multiple preference examples in batch.
   */
  public addBatch(
    batch: Array<
      Omit<PreferenceExample, "example_id" | "is_ground_truth_isolated"> & {
        example_id?: string;
        is_ground_truth_isolated?: boolean;
      }
    >
  ): PreferenceExample[] {
    return batch.map((item) => this.addExample(item));
  }

  /**
   * Retrieves an example by its unique ID.
   */
  public getExample(exampleId: string): PreferenceExample | undefined {
    return this.examples.get(exampleId);
  }

  /**
   * Retrieves all examples currently in the dataset.
   */
  public getAllExamples(): PreferenceExample[] {
    return Array.from(this.examples.values());
  }

  /**
   * Queries and filters preference examples.
   */
  public filter(query: PreferenceQueryFilter): PreferenceExample[] {
    return this.getAllExamples().filter((ex) => {
      if (query.designId && ex.design_id !== query.designId) return false;
      if (query.designVersion !== undefined && ex.design_version !== query.designVersion) return false;
      if (query.minRating !== undefined && ex.rating < query.minRating) return false;
      if (query.maxRating !== undefined && ex.rating > query.maxRating) return false;
      if (query.reviewerRole && ex.review_context.reviewerRole !== query.reviewerRole) return false;
      if (query.reviewEnvironment && ex.review_context.reviewEnvironment !== query.reviewEnvironment) return false;
      if (query.hasPairwiseComparison !== undefined) {
        const hasPair = !!ex.comparison_target;
        if (hasPair !== query.hasPairwiseComparison) return false;
      }
      return true;
    });
  }

  /**
   * Computes aggregated statistical metrics across all 6 dimensions and metadata.
   */
  public getStatistics(): PreferenceDatasetStatistics {
    const list = this.getAllExamples();
    const count = list.length;

    if (count === 0) {
      return {
        totalExamples: 0,
        uniqueDesignsCount: 0,
        uniqueReviewersCount: 0,
        averageOverallRating: 0.0,
        averageDimensionRatings: {
          overall: 0.0,
          difficulty: 0.0,
          visual: 0.0,
          connection: 0.0,
          assembly: 0.0,
          manufacturing: 0.0,
        },
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        reviewEnvironmentDistribution: {},
        pairwiseComparisonCount: 0,
      };
    }

    const uniqueDesigns = new Set<string>();
    const uniqueReviewers = new Set<string>();
    let totalOverallRating = 0;
    const dimensionSums = {
      overall: 0,
      difficulty: 0,
      visual: 0,
      connection: 0,
      assembly: 0,
      manufacturing: 0,
    };
    const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const envDist: Record<string, number> = {};
    let pairwiseCount = 0;

    for (const ex of list) {
      uniqueDesigns.add(ex.design_id);
      uniqueReviewers.add(ex.review_context.reviewerId);

      totalOverallRating += ex.rating;
      const roundedRating = Math.min(5, Math.max(1, Math.round(ex.rating)));
      ratingDist[roundedRating] = (ratingDist[roundedRating] || 0) + 1;

      const env = ex.review_context.reviewEnvironment;
      envDist[env] = (envDist[env] || 0) + 1;

      if (ex.comparison_target) {
        pairwiseCount++;
      }

      dimensionSums.overall += ex.feedback.overall.rating;
      dimensionSums.difficulty += ex.feedback.difficulty.rating;
      dimensionSums.visual += ex.feedback.visual.rating;
      dimensionSums.connection += ex.feedback.connection.rating;
      dimensionSums.assembly += ex.feedback.assembly.rating;
      dimensionSums.manufacturing += ex.feedback.manufacturing.rating;
    }

    return {
      totalExamples: count,
      uniqueDesignsCount: uniqueDesigns.size,
      uniqueReviewersCount: uniqueReviewers.size,
      averageOverallRating: Number((totalOverallRating / count).toFixed(2)),
      averageDimensionRatings: {
        overall: Number((dimensionSums.overall / count).toFixed(2)),
        difficulty: Number((dimensionSums.difficulty / count).toFixed(2)),
        visual: Number((dimensionSums.visual / count).toFixed(2)),
        connection: Number((dimensionSums.connection / count).toFixed(2)),
        assembly: Number((dimensionSums.assembly / count).toFixed(2)),
        manufacturing: Number((dimensionSums.manufacturing / count).toFixed(2)),
      },
      ratingDistribution: ratingDist,
      reviewEnvironmentDistribution: envDist,
      pairwiseComparisonCount: pairwiseCount,
    };
  }

  /**
   * Serializes the dataset to a structured JSON string.
   */
  public exportToJson(): string {
    return JSON.stringify(
      {
        datasetId: this.datasetId,
        name: this.name,
        version: this.version,
        createdAt: this.createdAt,
        exportedAt: new Date().toISOString(),
        exampleCount: this.examples.size,
        groundTruthIsolated: true,
        statistics: this.getStatistics(),
        examples: this.getAllExamples(),
      },
      null,
      2
    );
  }

  /**
   * Recreates a PreferenceDataset from an exported JSON string.
   */
  public static importFromJson(jsonString: string): PreferenceDataset {
    const data = JSON.parse(jsonString);
    const ds = new PreferenceDataset(data.name || "imported_preferences", data.version || "1.0.0");

    if (Array.isArray(data.examples)) {
      for (const item of data.examples) {
        ds.addExample(item);
      }
    }

    return ds;
  }

  /**
   * Clears all examples from the dataset.
   */
  public clear(): void {
    this.examples.clear();
  }

  /**
   * Total count of examples in dataset.
   */
  public get count(): number {
    return this.examples.size;
  }
}
