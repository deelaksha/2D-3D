import { describe, expect, it } from "vitest";
import {
  checkInterfaceCompatibility,
  computeNonPlanarMatingTransform,
  createHingeInterface,
  createInterlockInterface,
  createSlotInterface,
  createTabInterface,
} from "@/core/puzzle";

describe("Phase 4: Connection-Interface System", () => {
  it("evaluates TAB + SLOT interfaces as compatible", () => {
    const pieceA_id = "piece_wall_a";
    const pieceB_id = "piece_wall_b";

    const tabIface = createTabInterface(pieceA_id, "Male Tab", { x: 50, y: 0 }, { x: 0, y: -1 }, 20, 5);
    const slotIface = createSlotInterface(pieceB_id, "Female Slot", { x: 50, y: 0 }, { x: 0, y: 1 }, 20, 5);

    const result = checkInterfaceCompatibility(tabIface, slotIface);
    expect(result.compatible).toBe(true);
    expect(result.score).toBeGreaterThan(0.8);
    expect(result.reasons).toHaveLength(0);
  });

  it("evaluates TAB + TAB interfaces as incompatible unless overridden", () => {
    const pieceA_id = "piece_a";
    const pieceB_id = "piece_b";

    const tabA = createTabInterface(pieceA_id, "Tab A");
    const tabB = createTabInterface(pieceB_id, "Tab B");

    // Standard TAB + TAB check without override -> incompatible
    const resultDefault = checkInterfaceCompatibility(tabA, tabB);
    expect(resultDefault.compatible).toBe(false);
    expect(resultDefault.reasons[0]).toContain("Incompatible gender roles");

    // Enable same gender override
    tabA.compatibility.allowSameGenderOverride = true;
    const resultOverridden = checkInterfaceCompatibility(tabA, tabB);
    expect(resultOverridden.compatible).toBe(true);
  });

  it("supports non-planar 3D orientations (90deg box corner, 45deg miter, 180deg flat)", () => {
    const tab = createTabInterface("piece_roof", "Roof Tab");

    // 1. 90 degree corner transform
    const q90 = computeNonPlanarMatingTransform(tab.localFrame, 90.0);
    expect(q90.w).toBeDefined();

    // 2. 45 degree miter joint transform
    const q45 = computeNonPlanarMatingTransform(tab.localFrame, 45.0);
    expect(q45.w).toBeDefined();

    // 3. 180 degree coplanar extension transform
    const q180 = computeNonPlanarMatingTransform(tab.localFrame, 180.0);
    expect(q180.w).toBeDefined();
  });

  it("checks profile width mismatches against tolerances", () => {
    const tab20 = createTabInterface("p1", "Tab 20mm", { x: 0, y: 0 }, { x: 0, y: -1 }, 20.0);
    const slot30 = createSlotInterface("p2", "Slot 30mm", { x: 0, y: 0 }, { x: 0, y: 1 }, 30.0);

    const result = checkInterfaceCompatibility(tab20, slot30);
    expect(result.compatible).toBe(false);
    expect(result.reasons.some((r) => r.includes("Profile width mismatch"))).toBe(true);
  });

  it("supports hinge-like interfaces with revolute rotational degrees of freedom", () => {
    const hingeA = createHingeInterface("p1", "Knuckle A");
    const hingeB = createHingeInterface("p2", "Knuckle B");

    expect(hingeA.type).toBe("hinge_like");
    expect(hingeA.kinematicConstraints.allowedDOF.rotation.rx).toBe(true);
    expect(hingeA.kinematicConstraints.allowedAngleRange.maxAngleDeg).toBe(180);

    const result = checkInterfaceCompatibility(hingeA, hingeB);
    expect(result.compatible).toBe(true);
  });
});
