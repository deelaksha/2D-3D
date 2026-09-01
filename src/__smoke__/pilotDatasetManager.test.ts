import { describe, expect, it } from "vitest";
import { PilotDatasetManager } from "../core/puzzle/dataset/pilotDatasetManager";

describe("Small Pilot Dataset Subsystem (Step 39)", () => {
  const sampleBoxSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" units="mm">
      <path d="M 0 0 L 30 0 L 30 -10 L 50 -10 L 50 0 L 100 0 L 100 80 L 0 80 Z" />
      <path d="M 150 0 L 250 0 L 250 80 L 150 80 Z" />
      <rect x="180" y="30" width="20" height="3" />
    </svg>
  `;

  it("processes representative sample item through 11-step curation pipeline and generates summary report", () => {
    const manager = new PilotDatasetManager();

    const record = manager.processSampleItem({
      id: "pilot_box_1",
      name: "Simple Box Assembly",
      category: "simple_box",
      payload: {
        filename: "pilot_box_1.svg",
        content: sampleBoxSvg,
      },
    });

    expect(record.id).toBe("pilot_box_1");
    expect(record.processingStatus).toBe("SUCCESS");
    expect(record.puzzle).toBeDefined();

    const summary = manager.generateSummaryReport();

    expect(summary.totalExamples).toBe(1);
    expect(summary.successfulImports).toBe(1);
    expect(summary.failedImports).toBe(0);
    expect(summary.ambiguousCases).toBe(0);
    expect(summary.validationFailures).toBe(0);
  });
});
