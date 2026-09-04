import { describe, expect, it } from "vitest";
import {
  MultiAngleAssemblySolver,
  type SolvableAssemblyPiece,
  type DiscreteAngleSet,
  type ContinuousAngleRange,
} from "../core/puzzle/assembly";
import { ConnectionModelFactory } from "../core/puzzle/connection";
import type { CoordinateFrame3D } from "../core/puzzle/framesystem/types";
import { vec3 } from "../core/puzzle/geometry/math3d";

function makeFrame(origin = vec3(0, 0, 0), normal = vec3(0, 1, 0)): CoordinateFrame3D {
  return {
    origin,
    tangent: vec3(1, 0, 0),
    normal,
    binormal: vec3(0, 0, 1),
  };
}

function makePieces(): { pieceA: SolvableAssemblyPiece; pieceB: SolvableAssemblyPiece } {
  const pieceA: SolvableAssemblyPiece = {
    pieceId: "piece_A",
    name: "Base Board",
    dimensions: { width: 100, height: 80, thickness: 3.0 },
    interfaceFrame: makeFrame(vec3(50, 0, 0), vec3(0, 1, 0)),
    worldTransform: {
      position: vec3(0, 0, 0),
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: vec3(1, 1, 1),
    },
  };

  const pieceB: SolvableAssemblyPiece = {
    pieceId: "piece_B",
    name: "Upright Panel",
    dimensions: { width: 80, height: 60, thickness: 3.0 },
    interfaceFrame: makeFrame(vec3(0, 0, 0), vec3(0, -1, 0)),
  };

  return { pieceA, pieceB };
}

describe("Phase 67: Multi-Angle 3D Assembly Solver", () => {
  describe("1. Continuous Angle Ranges & Discrete Angle Sets", () => {
    it("evaluates continuous angle range [0°, 120°]", () => {
      const { pieceA, pieceB } = makePieces();
      const connection = ConnectionModelFactory.createHingeConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        frameA: pieceA.interfaceFrame,
        frameB: pieceB.interfaceFrame,
        minAngleDeg: 0.0,
        maxAngleDeg: 120.0,
        joiningAngleDeg: 90.0,
      });

      const rangeSpec: ContinuousAngleRange = {
        kind: "continuous_range",
        minAngleDeg: 0.0,
        maxAngleDeg: 120.0,
        nominalAngleDeg: 90.0,
      };

      // Valid angles in range
      const res45 = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB,
        connection,
        desiredAngleDeg: 45.0,
        angleSpecification: rangeSpec,
      });
      expect(res45.isTheoreticallyAllowed).toBe(true);
      expect(res45.overallStatus).toBe("FULLY_VALID");

      const res90 = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB,
        connection,
        desiredAngleDeg: 90.0,
        angleSpecification: rangeSpec,
      });
      expect(res90.isTheoreticallyAllowed).toBe(true);
      expect(res90.overallStatus).toBe("FULLY_VALID");

      // Invalid angle outside range
      const res150 = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB,
        connection,
        desiredAngleDeg: 150.0,
        angleSpecification: rangeSpec,
      });
      expect(res150.isTheoreticallyAllowed).toBe(false);
      expect(res150.overallStatus).toBe("THEORETICALLY_DISALLOWED");
      expect(res150.theoreticalDetails.reason).toContain("outside permitted continuous range");
    });

    it("evaluates discrete angle set [0°, 45°, 90°, 135°]", () => {
      const { pieceA, pieceB } = makePieces();
      const connection = ConnectionModelFactory.createHingeConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        frameA: pieceA.interfaceFrame,
        frameB: pieceB.interfaceFrame,
        minAngleDeg: 0.0,
        maxAngleDeg: 180.0,
        joiningAngleDeg: 90.0,
      });

      const discreteSpec: DiscreteAngleSet = {
        kind: "discrete_set",
        allowedAnglesDeg: [0, 45, 90, 135],
        nominalAngleDeg: 90,
      };

      // Exactly matches discrete set
      const res45 = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB,
        connection,
        desiredAngleDeg: 45.0,
        angleSpecification: discreteSpec,
      });
      expect(res45.isTheoreticallyAllowed).toBe(true);

      // Desired angle 60° does not match discrete set
      const res60 = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB,
        connection,
        desiredAngleDeg: 60.0,
        angleSpecification: discreteSpec,
      });
      expect(res60.isTheoreticallyAllowed).toBe(false);
      expect(res60.overallStatus).toBe("THEORETICALLY_DISALLOWED");
      expect(res60.theoreticalDetails.reason).toContain("does not match any discrete permitted angle");
    });
  });

  describe("2. Axis-Constrained vs Multi-Axis Rotations", () => {
    it("enforces single-axis constraints for HINGE connections", () => {
      const { pieceA, pieceB } = makePieces();
      const hingeAxis = vec3(0, 0, 1); // Binormal
      const connection = ConnectionModelFactory.createHingeConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        frameA: pieceA.interfaceFrame,
        frameB: pieceB.interfaceFrame,
        hingeAxis,
        minAngleDeg: 0,
        maxAngleDeg: 180,
      });

      // Correct axis (binormal Z)
      const resCorrectAxis = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB,
        connection,
        desiredAngleDeg: 45.0,
        rotationAxis: vec3(0, 0, 1),
      });
      expect(resCorrectAxis.isTheoreticallyAllowed).toBe(true);

      // Wrong axis (trying to rotate around Y instead of hinge axis Z)
      const resWrongAxis = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB,
        connection,
        desiredAngleDeg: 45.0,
        rotationAxis: vec3(0, 1, 0),
      });
      expect(resWrongAxis.isTheoreticallyAllowed).toBe(false);
      expect(resWrongAxis.overallStatus).toBe("THEORETICALLY_DISALLOWED");
      expect(resWrongAxis.theoreticalDetails.reason).toContain("not aligned with hinge axis");
    });

    it("supports multiple rotational axes on ROTATIONAL connections", () => {
      const { pieceA, pieceB } = makePieces();
      const connection = ConnectionModelFactory.createRotationalConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        frameA: pieceA.interfaceFrame,
        frameB: pieceB.interfaceFrame,
        rotationAxes: [vec3(1, 0, 0), vec3(0, 0, 1)],
      });

      // Rotating around axis 1 (X)
      const resX = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB,
        connection,
        desiredAngleDeg: 30.0,
        rotationAxis: vec3(1, 0, 0),
      });
      expect(resX.isTheoreticallyAllowed).toBe(true);

      // Rotating around axis 2 (Z)
      const resZ = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB,
        connection,
        desiredAngleDeg: 60.0,
        rotationAxis: vec3(0, 0, 1),
      });
      expect(resZ.isTheoreticallyAllowed).toBe(true);
    });
  });

  describe("3. Three-Tier Distinction: Theoretical vs Geometric vs Physical", () => {
    it("distinguishes FULLY_VALID angle (all 3 tiers pass)", () => {
      const { pieceA, pieceB } = makePieces();
      const connection = ConnectionModelFactory.createHingeConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        frameA: pieceA.interfaceFrame,
        frameB: pieceB.interfaceFrame,
        minAngleDeg: 0,
        maxAngleDeg: 180,
      });

      const res = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB,
        connection,
        desiredAngleDeg: 90.0,
      });

      expect(res.isTheoreticallyAllowed).toBe(true);
      expect(res.isGeometricallyValid).toBe(true);
      expect(res.isPhysicallyAssemblable).toBe(true);
      expect(res.overallStatus).toBe("FULLY_VALID");
      expect(res.resultingPlacement).toBeDefined();
    });

    it("distinguishes GEOMETRIC_SELF_COLLISION (Tier 1 passes, Tier 2 fails)", () => {
      // Overlapping configuration: pieces with large dimensions where folding
      // back into collinear acute position causes severe body interpenetration
      const { pieceA } = makePieces();
      const collidingPieceB: SolvableAssemblyPiece = {
        pieceId: "piece_B_colliding",
        name: "Colliding Panel",
        dimensions: { width: 100, height: 80, thickness: 3.0 },
        interfaceFrame: makeFrame(vec3(50, 0, 0)), // Same local origin as A
      };

      const connection = ConnectionModelFactory.createHingeConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        frameA: pieceA.interfaceFrame,
        frameB: collidingPieceB.interfaceFrame,
        minAngleDeg: 0,
        maxAngleDeg: 180,
      });

      // Acute 5° fold causes thickness interpenetration
      const res = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB: collidingPieceB,
        connection,
        desiredAngleDeg: 5.0,
      });

      expect(res.isTheoreticallyAllowed).toBe(true);
      expect(res.isGeometricallyValid).toBe(false);
      expect(res.isPhysicallyAssemblable).toBe(false);
      expect(res.overallStatus).toBe("GEOMETRIC_SELF_COLLISION");
      expect(res.geometricDetails.reason).toContain("interpenetration");
    });

    it("distinguishes BLOCKED_ASSEMBLY_PATH (Tiers 1 & 2 pass, Tier 3 fails)", () => {
      const { pieceA, pieceB } = makePieces();

      // Connection configured with an insertion direction that points away from receiver normal
      // (e.g. attempting to insert from the locked reverse side)
      const blockedConnection = ConnectionModelFactory.createConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        frameA: pieceA.interfaceFrame,
        frameB: pieceB.interfaceFrame,
        behavior: "CUSTOM",
        joiningAngleDeg: 90.0,
        allowedRotationAxes: [vec3(0, 0, 1)],
        insertionDirection: vec3(0, 1, 0), // Points in same direction as normal -> reverse pull-out
        angleLimits: { minAngleDeg: 0, maxAngleDeg: 180, nominalAngleDeg: 90 },
      });

      const res = MultiAngleAssemblySolver.evaluateAngle({
        pieceA,
        pieceB,
        connection: blockedConnection,
        desiredAngleDeg: 90.0,
      });

      expect(res.isTheoreticallyAllowed).toBe(true);
      expect(res.isGeometricallyValid).toBe(true);
      // Fails physical sweep!
      expect(res.isPhysicallyAssemblable).toBe(false);
      expect(res.overallStatus).toBe("BLOCKED_ASSEMBLY_PATH");
      expect(res.physicalDetails.reason).toContain("Insertion direction");
    });
  });

  describe("4. Batch Candidate Angle Search", () => {
    it("finds all valid angles among candidate set", () => {
      const { pieceA, pieceB } = makePieces();
      const connection = ConnectionModelFactory.createHingeConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        frameA: pieceA.interfaceFrame,
        frameB: pieceB.interfaceFrame,
        minAngleDeg: 30.0,
        maxAngleDeg: 90.0,
      });

      const candidates = [0, 30, 45, 60, 90, 120, 180];
      const results = MultiAngleAssemblySolver.findValidAngles(
        pieceA,
        pieceB,
        connection,
        candidates
      );

      expect(results).toHaveLength(7);

      const fullyValid = results.filter((r) => r.overallStatus === "FULLY_VALID");
      const disallowed = results.filter((r) => r.overallStatus === "THEORETICALLY_DISALLOWED");

      // 30°, 45°, 60°, 90° should be fully valid
      expect(fullyValid.map((r) => r.desiredAngleDeg)).toEqual([30, 45, 60, 90]);

      // 0°, 120°, 180° should be disallowed (outside [30°, 90°])
      expect(disallowed.map((r) => r.desiredAngleDeg)).toEqual([0, 120, 180]);
    });
  });
});
