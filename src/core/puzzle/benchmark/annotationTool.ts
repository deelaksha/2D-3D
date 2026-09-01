/**
 * Dataset Annotation Tool (Step 37).
 * Programmatic annotation suite to inspect, tag, and annotate ground-truth puzzle metadata.
 */
import type { GroundTruthAssemblyManifest, PilotDatasetItem } from "./types";

export class DatasetAnnotationTool {
  /**
   * Annotates a dataset item with ground-truth metadata.
   */
  static annotateItem(
    item: PilotDatasetItem,
    annotations: Record<string, unknown>
  ): PilotDatasetItem {
    return {
      ...item,
      groundTruthManifest: {
        ...item.groundTruthManifest,
        annotations: {
          ...item.groundTruthManifest.annotations,
          ...annotations,
          annotatedAt: new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Generates annotation metadata template.
   */
  static createDefaultAnnotationTemplate(category: string): Record<string, unknown> {
    return {
      category,
      cardboardGrade: "EB-Flute 3mm",
      targetAssemblyAngleDeg: 45.0,
      verifiedByHuman: true,
      difficultyRating: "medium",
    };
  }
}
