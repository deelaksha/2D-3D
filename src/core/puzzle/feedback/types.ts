/**
 * Human Feedback & Preference Data Types (Phase 55).
 */

export type FeedbackRatingTag = "looks_good" | "poor_geometry" | "too_easy" | "too_difficult";

export interface FeedbackSubMetric {
  connectionQuality: number;   // 1 to 5 stars
  assemblyQuality: number;     // 1 to 5 stars
  manufacturability: number;   // 1 to 5 stars
  overallPreference: number;   // 1 to 5 stars
}

export interface DesignFeedback {
  feedbackId: string;
  designId: string;
  reviewerId: string;
  timestampIso: string;
  ratingTags: FeedbackRatingTag[];
  subMetrics: FeedbackSubMetric;
  comments: string;
  version: number;
}

export interface FeedbackSummary {
  designId: string;
  totalFeedbackCount: number;
  averageOverallPreference: number;
  averageConnectionQuality: number;
  averageAssemblyQuality: number;
  averageManufacturability: number;
  tagDistribution: Record<FeedbackRatingTag, number>;
  recentComments: string[];
}
