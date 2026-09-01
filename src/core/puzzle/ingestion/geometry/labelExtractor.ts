/**
 * Label Extractor.
 * Extracts piece labels, part names, CAD layer names, and text annotations from vector drawings.
 */
import type { Vec2 } from "@/core/model/types";
import type { ExtractedLabel } from "./types";
import type { RawVectorPath } from "../types";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class LabelExtractor {
  /**
   * Extracts text labels and layer annotations.
   */
  static extractLabels(paths: RawVectorPath[], textStrings: string[] = []): ExtractedLabel[] {
    const labels: ExtractedLabel[] = [];
    let lblCounter = 1;

    for (let i = 0; i < textStrings.length; i++) {
      const text = textStrings[i].trim();
      if (!text) continue;

      labels.push({
        id: `label_${lblCounter++}`,
        text,
        position: vec2(0, 0),
      });
    }

    // Collect unique layer names from paths
    const layers = new Set<string>();
    for (const p of paths) {
      if (p.layerName) layers.add(p.layerName);
    }

    for (const layer of layers) {
      labels.push({
        id: `label_layer_${lblCounter++}`,
        text: `Layer: ${layer}`,
        position: vec2(0, 0),
        layerName: layer,
      });
    }

    return labels;
  }
}
