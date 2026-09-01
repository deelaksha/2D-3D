/**
 * Dimension Extractor.
 * Extracts linear, radial, and diameter dimension annotations from drawing text and geometry metadata.
 */
import type { Vec2 } from "@/core/model/types";
import type { ExtractedDimension } from "./types";
import type { RawVectorPath } from "../types";

export class DimensionExtractor {
  /**
   * Extracts linear and radial dimension annotations.
   */
  static extractDimensions(paths: RawVectorPath[], textElements: string[] = []): ExtractedDimension[] {
    const dimensions: ExtractedDimension[] = [];
    let dimCounter = 1;

    // Pattern matching for dimension values (e.g. "100mm", "T=3.0", "R=15", "D=20")
    const dimRegex = /(?:(\d+(?:\.\d+)?)\s*(?:mm|in)?)|(?:([TRD])\s*=\s*(\d+(?:\.\d+)?))/gi;

    for (const txt of textElements) {
      let match: RegExpExecArray | null;
      while ((match = dimRegex.exec(txt)) !== null) {
        if (match[1]) {
          const val = parseFloat(match[1]);
          if (val > 0 && val < 5000) {
            dimensions.push({
              id: `dim_${dimCounter++}`,
              type: "linear",
              valueMm: val,
              text: txt,
            });
          }
        } else if (match[2] && match[3]) {
          const prefix = match[2].toUpperCase();
          const val = parseFloat(match[3]);
          const dimType = prefix === "R" ? "radial" : prefix === "D" ? "diameter" : "linear";

          dimensions.push({
            id: `dim_${dimCounter++}`,
            type: dimType,
            valueMm: val,
            text: txt,
          });
        }
      }
    }

    return dimensions;
  }
}
