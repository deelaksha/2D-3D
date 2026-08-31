import { describe, expect, it } from "vitest";
import {
  CanonicalInterface,
  ConnectionCompatibilityEngine,
  vec3,
} from "@/core/puzzle";

describe("Phase 13: Connection Compatibility Engine", () => {
  const engine = new ConnectionCompatibilityEngine();

  const ifMale: CanonicalInterface = {
    id: "if_tab_1",
    owningPieceId: "p1",
    name: "Tab Interface 1",
    edgeGeometry: { edgeIndex: 0, parametricStart: 0.3, parametricEnd: 0.7, length: 20 },
    interfaceType: "tab",
    profile: { profileKind: "tab", width: 20, depth: 5, clearance: 0.15 },
    compatibility: {
      allowedTypes: ["slot"],
      genderRole: "insert",
      complementaryPatterns: [],
    },
    localFrame: {
      origin: vec3(0, 0, 0),
      tangent: vec3(0, 1, 0),
      normal: vec3(1, 0, 0),
      binormal: vec3(0, 0, 1),
    },
    tolerance: 0.15,
    allowedDOF: {
      translation: { x: false, y: false, z: false },
      rotation: { rx: false, ry: false, rz: false },
    },
    metadata: {
      minAngleDeg: 0,
      maxAngleDeg: 90,
      allowedAngleRange: JSON.stringify({ minAngleDeg: 0, maxAngleDeg: 90 }),
    },
  };

  const ifFemale: CanonicalInterface = {
    id: "if_slot_1",
    owningPieceId: "p2",
    name: "Slot Interface 1",
    edgeGeometry: { edgeIndex: 2, parametricStart: 0.3, parametricEnd: 0.7, length: 20 },
    interfaceType: "slot",
    profile: { profileKind: "slot", width: 20, depth: 5, clearance: 0.15 },
    compatibility: {
      allowedTypes: ["tab"],
      genderRole: "receiver",
      complementaryPatterns: [],
    },
    localFrame: {
      origin: vec3(0, 0, 0),
      tangent: vec3(0, 1, 0),
      normal: vec3(1, 0, 0),
      binormal: vec3(0, 0, 1),
    },
    tolerance: 0.15,
    allowedDOF: {
      translation: { x: false, y: false, z: false },
      rotation: { rx: false, ry: false, rz: false },
    },
    metadata: {
      minAngleDeg: 0,
      maxAngleDeg: 90,
      allowedAngleRange: JSON.stringify({ minAngleDeg: 0, maxAngleDeg: 90 }),
    },
  };

  it("validates compatible male-female (insert-receiver) tab-slot interfaces across all 7 criteria", () => {
    const report = engine.evaluateCompatibility({
      interfaceA: ifMale,
      interfaceB: ifFemale,
      joiningAngleDeg: 90.0,
      clearanceMm: 0.15,
    });

    expect(report.isCompatible).toBe(true);
    expect(report.overallScore).toBeGreaterThan(0.9);
    expect(report.checks.type.satisfied).toBe(true);
    expect(report.checks.profile.satisfied).toBe(true);
    expect(report.checks.angle.satisfied).toBe(true);
  });

  it("rejects incompatible male-male (insert-insert) interface gender pairing", () => {
    const report = engine.evaluateCompatibility({
      interfaceA: ifMale,
      interfaceB: ifMale, // Insert + Insert
      joiningAngleDeg: 90.0,
    });

    expect(report.isCompatible).toBe(false);
    expect(report.checks.type.satisfied).toBe(false);
    expect(report.checks.type.message).toContain("insert-insert");
  });

  it("rejects out-of-range joining angles", () => {
    const report = engine.evaluateCompatibility({
      interfaceA: ifMale,
      interfaceB: ifFemale,
      joiningAngleDeg: 135.0, // Outside [0, 90]
    });

    expect(report.isCompatible).toBe(false);
    expect(report.checks.angle.satisfied).toBe(false);
    expect(report.checks.angle.message).toContain("outside allowed angle range");
  });

  it("detects profile width mismatch beyond tolerance", () => {
    const ifWideSlot: CanonicalInterface = {
      ...ifFemale,
      profile: { profileKind: "slot", width: 40, depth: 5, clearance: 0.15 }, // 40mm vs 20mm
    };

    const report = engine.evaluateCompatibility({
      interfaceA: ifMale,
      interfaceB: ifWideSlot,
    });

    expect(report.isCompatible).toBe(false);
    expect(report.checks.profile.satisfied).toBe(false);
    expect(report.checks.profile.message).toContain("Profile width mismatch");
  });

  it("enforces degrees of freedom (DOF) constraints", () => {
    const ifRestricted: CanonicalInterface = {
      ...ifMale,
      allowedDOF: {
        translation: { x: true, y: false, z: false }, // 1 translation DOF
        rotation: { rx: false, ry: false, rz: false }, // 0 rotation DOF
      },
    };

    const report = engine.evaluateCompatibility({
      interfaceA: ifRestricted,
      interfaceB: ifFemale,
      proposedTranslationDOF: 3, // Exceeds 1
      proposedRotationDOF: 1, // Exceeds 0
    });

    expect(report.isCompatible).toBe(false);
    expect(report.checks.dof.satisfied).toBe(false);
  });

  it("supports extensible custom compatibility rules", () => {
    const customEngine = new ConnectionCompatibilityEngine();

    customEngine.registerCustomRule({
      name: "Custom_Snap_Rule",
      description: "Custom rule checking snap force",
      evaluate: (ctx) => {
        if (ctx.interfaceA.interfaceType === "tab") {
          return {
            checkKind: "type",
            satisfied: true,
            score: 1.0,
            message: "Custom snap force rule verified.",
          };
        }
        return null;
      },
    });

    const report = customEngine.evaluateCompatibility({
      interfaceA: ifMale,
      interfaceB: ifFemale,
    });

    expect(report.isCompatible).toBe(true);
    expect(report.diagnostics.some((d) => d.includes("Custom snap force rule verified"))).toBe(true);
  });
});
