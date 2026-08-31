import { describe, expect, it } from "vitest";
import {
  ConstraintFrameworkEngine,
  evaluateDeclarativeConstraint,
  vec3,
} from "@/core/puzzle";

describe("Phase 7: Generic Constraint Framework", () => {
  it("enforces HARD constraints (never silently violated)", () => {
    const engine = new ConstraintFrameworkEngine([
      {
        id: "c_hard_angle",
        type: "angle",
        severity: "HARD",
        involvedEntityIds: ["conn_1"],
        parameters: { minAngleDeg: 90, maxAngleDeg: 90, targetValue: 90 },
      },
    ]);

    // Context with joining angle of 45deg (violates 90deg HARD constraint)
    const report = engine.evaluateAllConstraints({
      c_hard_angle: { joiningAngleDeg: 45.0 },
    });

    expect(report.overallSatisfied).toBe(false);
    expect(report.hardViolations).toHaveLength(1);
    expect(report.hardViolations[0].diagnosticInfo).toContain("violated");
  });

  it("evaluates SOFT constraints as penalty residuals without failing overall satisfaction", () => {
    const engine = new ConstraintFrameworkEngine([
      {
        id: "c_soft_symmetry",
        type: "symmetry",
        severity: "SOFT",
        involvedEntityIds: ["p1", "p2"],
        parameters: { tolerance: 0.1 },
      },
    ]);

    // Context with slight asymmetry error of 1.5mm
    const report = engine.evaluateAllConstraints({
      c_soft_symmetry: { symmetryErrorMm: 1.5 },
    });

    expect(report.overallSatisfied).toBe(true); // Soft violations do not fail overall hard satisfaction
    expect(report.softViolations).toHaveLength(1);
    expect(report.softViolations[0].residual).toBeCloseTo(1.5);
  });

  it("evaluates non-overlap collision constraints (HARD)", () => {
    const cNonOverlap = {
      id: "c_no_collision",
      type: "non_overlap" as const,
      severity: "HARD" as const,
      involvedEntityIds: ["p1", "p2"],
      parameters: {},
    };

    const passRes = evaluateDeclarativeConstraint(cNonOverlap, { isColliding: false, overlapDepth: 0.0 });
    expect(passRes.satisfied).toBe(true);

    const failRes = evaluateDeclarativeConstraint(cNonOverlap, { isColliding: true, overlapDepth: 2.5 });
    expect(failRes.satisfied).toBe(false);
    expect(failRes.residual).toBe(2.5);
    expect(failRes.diagnosticInfo).toContain("VIOLATED");
  });

  it("evaluates material cardboard constraints (HARD)", () => {
    const cMat = {
      id: "c_mat_1",
      type: "material_constraints" as const,
      severity: "HARD" as const,
      involvedEntityIds: ["p1"],
      parameters: {},
    };

    // Slot width 2.15mm >= thickness 2.0mm -> pass
    const passRes = evaluateDeclarativeConstraint(cMat, { thickness: 2.0, slotWidth: 2.15 });
    expect(passRes.satisfied).toBe(true);

    // Slot width 1.5mm < thickness 2.0mm -> fail
    const failRes = evaluateDeclarativeConstraint(cMat, { thickness: 2.0, slotWidth: 1.5 });
    expect(failRes.satisfied).toBe(false);
    expect(failRes.diagnosticInfo).toContain("VIOLATED");
  });

  it("evaluates all 12 constraint types cleanly", () => {
    const types = [
      "distance",
      "alignment",
      "angle",
      "contact",
      "clearance",
      "non_overlap",
      "interface_compatibility",
      "dimension",
      "position",
      "rotation",
      "symmetry",
      "material_constraints",
    ] as const;

    for (const t of types) {
      const res = evaluateDeclarativeConstraint({
        id: `c_${t}`,
        type: t,
        severity: "HARD",
        involvedEntityIds: ["e1"],
        parameters: { targetValue: 10, minValue: 0, maxValue: 100 },
      });
      expect(res.constraintId).toBe(`c_${t}`);
      expect(res.type).toBe(t);
    }
  });
});
