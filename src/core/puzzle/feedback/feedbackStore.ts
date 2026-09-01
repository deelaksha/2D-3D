/**
 * Feedback Store & Preference Dataset Exporter (Phase 55).
 * Stores human review feedback separately from canonical CAD geometry.
 */
import type { DesignFeedback, FeedbackRatingTag, FeedbackSummary } from "./types";

export class FeedbackStore {
  private feedbackMap = new Map<string, DesignFeedback[]>();

  /**
   * Records human review feedback for a given design ID.
   */
  async recordFeedback(
    feedbackInput: Omit<DesignFeedback, "feedbackId" | "timestampIso">
  ): Promise<DesignFeedback> {
    const feedbackId = `fb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const fullFeedback: DesignFeedback = {
      ...feedbackInput,
      feedbackId,
      timestampIso: new Date().toISOString(),
    };

    const existing = this.feedbackMap.get(fullFeedback.designId) || [];
    existing.push(fullFeedback);
    this.feedbackMap.set(fullFeedback.designId, existing);

    return fullFeedback;
  }

  /**
   * Retrieves feedback history for a specific design ID.
   */
  async getFeedbackForDesign(designId: string): Promise<DesignFeedback[]> {
    return this.feedbackMap.get(designId) || [];
  }

  /**
   * Calculates aggregated summary statistics for a design ID.
   */
  async getFeedbackSummary(designId: string): Promise<FeedbackSummary> {
    const list = await this.getFeedbackForDesign(designId);

    const tagDist: Record<FeedbackRatingTag, number> = {
      looks_good: 0,
      poor_geometry: 0,
      too_easy: 0,
      too_difficult: 0,
    };

    if (list.length === 0) {
      return {
        designId,
        totalFeedbackCount: 0,
        averageOverallPreference: 0,
        averageConnectionQuality: 0,
        averageAssemblyQuality: 0,
        averageManufacturability: 0,
        tagDistribution: tagDist,
        recentComments: [],
      };
    }

    let sumConn = 0, sumAssm = 0, sumMfg = 0, sumOverall = 0;
    const comments: string[] = [];

    list.forEach((fb) => {
      sumConn += fb.subMetrics.connectionQuality;
      sumAssm += fb.subMetrics.assemblyQuality;
      sumMfg += fb.subMetrics.manufacturability;
      sumOverall += fb.subMetrics.overallPreference;

      fb.ratingTags.forEach((tag) => {
        if (tagDist[tag] !== undefined) {
          tagDist[tag]++;
        }
      });

      if (fb.comments.trim().length > 0) {
        comments.push(fb.comments);
      }
    });

    const count = list.length;

    return {
      designId,
      totalFeedbackCount: count,
      averageOverallPreference: Number((sumOverall / count).toFixed(2)),
      averageConnectionQuality: Number((sumConn / count).toFixed(2)),
      averageAssemblyQuality: Number((sumAssm / count).toFixed(2)),
      averageManufacturability: Number((sumMfg / count).toFixed(2)),
      tagDistribution: tagDist,
      recentComments: comments.slice(-5),
    };
  }

  /**
   * Exports full feedback dataset for future RLHF / DPO preference fine-tuning.
   */
  async exportFeedbackDataset(): Promise<DesignFeedback[]> {
    const all: DesignFeedback[] = [];
    for (const list of this.feedbackMap.values()) {
      all.push(...list);
    }
    return all;
  }
}
