import { describe, expect, it } from "vitest";
import {
  checkMinimumClearance,
  checkMinimumFeatureSize,
  MaterialConstraintEngine,
  preventSilentParameterMutation,
} from "@/core/puzzle";

describe("Phase 8: Material/Cardboard Constraint Subsystem", () => {
  it("computes usable sheet area considering manufacturing margins", () => {
    const engine = new MaterialConstraintEngine(
      { stockWidth: 600, stockHeight: 400 },
      { manufacturingMargin: 10 },
    );

    // usable width = 600 - 20 = 580, usable height = 400 - 20 = 380
    expect(engine.usableAreaWidth).toBe(580);
    expect(engine.usableAreaHeight).toBe(380);
  });

  it("validates piece dimensions, thickness match, and usable area bounds", () => {
    const engine = new MaterialConstraintEngine(
      { stockWidth: 200, stockHeight: 200, stockThickness: 2.0 },
      { manufacturingMargin: 10 }, // usable area = 180 x 180
    );

    // 1. Valid piece (100 x 100 x 2.0)
    const validPiece = {
      pieceId: "p_valid",
      name: "Valid Plate",
      width: 100,
      height: 100,
      thickness: 2.0,
      materialId: "cardboard-2mm",
    };
    const reportValid = engine.validateAll([validPiece]);
    expect(reportValid.level).toBe("ok");

    // 2. Oversized piece (250 x 100 x 2.0) exceeding usable width
    const oversizedPiece = {
      pieceId: "p_over",
      name: "Oversized Plate",
      width: 250,
      height: 100,
      thickness: 2.0,
      materialId: "cardboard-2mm",
    };
    const reportOversized = engine.validateAll([oversizedPiece]);
    expect(reportOversized.level).toBe("error");
    expect(reportOversized.results.some((r) => r.code === "PIECE_WIDTH_BOUNDS" && !r.satisfied)).toBe(true);

    // 3. Thickness mismatch (100 x 100 x 3.0 on 2.0mm stock)
    const mismatchedPiece = {
      pieceId: "p_thick",
      name: "Mismatched Thickness Plate",
      width: 100,
      height: 100,
      thickness: 3.0,
      materialId: "cardboard-2mm",
    };
    const reportMismatched = engine.validateAll([mismatchedPiece]);
    expect(reportMismatched.level).toBe("error");
    expect(reportMismatched.results.some((r) => r.code === "PIECE_THICKNESS_MATCH" && !r.satisfied)).toBe(true);
  });

  it("checks minimum clearance and minimum feature size bounds", () => {
    // Clearance check (gap 1.5mm < minClearance 3.0mm)
    const clearanceRes = checkMinimumClearance(1.5, 3.0);
    expect(clearanceRes.satisfied).toBe(false);
    expect(clearanceRes.level).toBe("warning");

    // Feature size check (slot width 0.8mm < minFeatureSize 1.5mm)
    const featureRes = checkMinimumFeatureSize(0.8, 1.5, "Slot feature");
    expect(featureRes.satisfied).toBe(false);
    expect(featureRes.level).toBe("error");
  });

  it("prevents unsanctioned silent AI parameter mutations on locked material parameters", () => {
    const engine = new MaterialConstraintEngine(
      { stockWidth: 600, stockThickness: 2.0 },
      { isLockedByDesign: true },
    );

    // AI attempts to silently alter stockThickness from 2.0 to 3.0
    const mutationResult = engine.proposeParameterUpdate({ stockThickness: 3.0 });
    expect(mutationResult.satisfied).toBe(false);
    expect(mutationResult.level).toBe("error");
    expect(mutationResult.message).toContain("UNSANCTIONED AI PARAMETER MUTATION PREVENTED");

    // Parameter remains unchanged
    expect(engine.globalParams.stockThickness).toBe(2.0);
  });
});
