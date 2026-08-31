import { describe, expect, it } from "vitest";
import { EndToEndPuzzlePipeline } from "@/core/puzzle";

describe("Phase 22: End-to-End Automated Puzzle Pipeline Integration", () => {
  it("executes the entire 15-stage pipeline with a 45.0° non-90-degree joint assembly successfully", async () => {
    const result = await EndToEndPuzzlePipeline.runPipeline({
      prompt: "Create an angled 2-piece cardboard roof joint assembled at a 45-degree angle",
      userPreferences: { defaultJoiningAngleDeg: 45.0 }, // Non-90-degree joint demonstration
    });

    // 1. Verify overall pipeline success
    expect(result.success).toBe(true);

    // 2. Verify non-90-degree joining angle
    expect(result.joiningAngleDeg).toBe(45.0);

    // 3. Verify all 15 stages logged success
    expect(result.stageLogs.length).toBe(15);
    for (const log of result.stageLogs) {
      expect(log.success).toBe(true);
    }

    // 4. Verify Final Validation Report
    expect(result.validationReport).toBeDefined();
    expect(result.validationReport!.isValid).toBe(true);
    expect(result.validationReport!.overallLevel).toBe("ok");
    expect(result.validationReport!.overallScore).toBeGreaterThan(0.9);

    // 5. Verify Dataset Export
    expect(result.datasetItem).toBeDefined();
    expect(result.datasetItem!.version).toBe("1.0.0");
    expect(result.datasetItem!.connections[0].joiningAngleDeg).toBe(45.0);
    expect(result.datasetItem!.pieces.length).toBe(2);
  });
});
