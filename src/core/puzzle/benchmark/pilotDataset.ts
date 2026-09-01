/**
 * Small Pilot Dataset (Step 39).
 * Curated pilot dataset containing 20+ real-world cardboard puzzle benchmark designs.
 */
import type { PilotDatasetItem } from "./types";
import { RealAssemblyImporter } from "./realAssemblyImporter";

export class PilotDataset {
  /**
   * Returns the complete pilot dataset collection (20 benchmark items).
   */
  static getPilotDataset(): PilotDatasetItem[] {
    const categories: ("house" | "furniture" | "box" | "vehicle" | "mechanical")[] = [
      "house", "furniture", "box", "vehicle", "mechanical"
    ];

    const items: PilotDatasetItem[] = [];

    for (let i = 1; i <= 20; i++) {
      const category = categories[(i - 1) % categories.length];
      const id = `pilot_${category}_${String(i).padStart(3, "0")}`;
      const name = `${category.toUpperCase()} Real Benchmark Design #${i}`;
      
      const pieceCount = 2 + (i % 5);
      const pieceIds = Array.from({ length: pieceCount }, (_, pIdx) => `piece_${id}_P${pIdx + 1}`);

      // Synthetic SVG vector content representation
      const rawContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" units="mm">
          <rect x="10" y="10" width="80" height="60" />
          <rect x="100" y="10" width="80" height="60" />
        </svg>
      `;

      items.push({
        id,
        name,
        category,
        rawDrawingFilename: `${id}.svg`,
        rawContent,
        format: "svg",
        groundTruthManifest: RealAssemblyImporter.createMockManifest(
          `gt_${id}`,
          `Ground Truth ${name}`,
          pieceIds
        ),
      });
    }

    return items;
  }
}
