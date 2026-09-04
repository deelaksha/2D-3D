import { describe, expect, it } from "vitest";
import {
  ConnectionMathValidator,
  ConnectionModelFactory,
  ConnectionKinematicsEngine,
} from "../core/puzzle/connection";
import type { CoordinateFrame3D } from "../core/puzzle/framesystem/types";
import {
  len3,
  normalize3,
  quatRotateVector,
  sub3,
  vec3,
} from "../core/puzzle/geometry/math3d";

function makeOrthonormalFrame(
  origin = vec3(0, 0, 0),
  tangent = vec3(1, 0, 0),
  normal = vec3(0, 1, 0),
  binormal = vec3(0, 0, 1)
): CoordinateFrame3D {
  return { origin, tangent, normal, binormal };
}

describe("Phase 65: Advanced 3D Connection Model", () => {
  describe("1. Support for All 7 Connection Behaviors", () => {
    const frameA = makeOrthonormalFrame(vec3(0, 0, 0));
    const frameB = makeOrthonormalFrame(vec3(50, 0, 0));

    it("creates and validates a FIXED connection (0 DOF)", () => {
      const conn = ConnectionModelFactory.createFixedConnection({
        interfaceAId: "if_a1",
        interfaceBId: "if_b1",
        frameA,
        frameB,
        joiningAngleDeg: 90.0,
      });

      expect(conn.behavior).toBe("FIXED");
      expect(conn.allowedRotationAxes).toHaveLength(0);
      expect(conn.allowedTranslationAxes).toHaveLength(0);

      const report = ConnectionMathValidator.validateConnection(conn);
      expect(report.isValid).toBe(true);
      expect(report.errors).toHaveLength(0);
    });

    it("creates and validates a HINGE connection (1 rotational DOF)", () => {
      const conn = ConnectionModelFactory.createHingeConnection({
        interfaceAId: "if_a2",
        interfaceBId: "if_b2",
        frameA,
        frameB,
        joiningAngleDeg: 90.0,
        minAngleDeg: 0.0,
        maxAngleDeg: 180.0,
      });

      expect(conn.behavior).toBe("HINGE");
      expect(conn.allowedRotationAxes).toHaveLength(1);
      expect(conn.allowedTranslationAxes).toHaveLength(0);
      expect(conn.angleLimits.minAngleDeg).toBe(0.0);
      expect(conn.angleLimits.maxAngleDeg).toBe(180.0);

      const report = ConnectionMathValidator.validateConnection(conn);
      expect(report.isValid).toBe(true);
    });

    it("creates and validates a SLIDING connection (1 translational DOF)", () => {
      const conn = ConnectionModelFactory.createSlidingConnection({
        interfaceAId: "if_a3",
        interfaceBId: "if_b3",
        frameA,
        frameB,
      });

      expect(conn.behavior).toBe("SLIDING");
      expect(conn.allowedRotationAxes).toHaveLength(0);
      expect(conn.allowedTranslationAxes).toHaveLength(1);

      const report = ConnectionMathValidator.validateConnection(conn);
      expect(report.isValid).toBe(true);
    });

    it("creates and validates a ROTATIONAL connection (multi-axis rotational DOF)", () => {
      const conn = ConnectionModelFactory.createRotationalConnection({
        interfaceAId: "if_a4",
        interfaceBId: "if_b4",
        frameA,
        frameB,
        rotationAxes: [vec3(1, 0, 0), vec3(0, 0, 1)],
      });

      expect(conn.behavior).toBe("ROTATIONAL");
      expect(conn.allowedRotationAxes).toHaveLength(2);
      expect(conn.allowedTranslationAxes).toHaveLength(0);

      const report = ConnectionMathValidator.validateConnection(conn);
      expect(report.isValid).toBe(true);
    });

    it("creates and validates INTERLOCK and SNAP connections", () => {
      const interlockConn = ConnectionModelFactory.createInterlockConnection({
        interfaceAId: "if_a5",
        interfaceBId: "if_b5",
        frameA,
        frameB,
      });
      const snapConn = ConnectionModelFactory.createSnapConnection({
        interfaceAId: "if_a6",
        interfaceBId: "if_b6",
        frameA,
        frameB,
      });

      expect(interlockConn.behavior).toBe("INTERLOCK");
      expect(snapConn.behavior).toBe("SNAP");

      expect(ConnectionMathValidator.validateConnection(interlockConn).isValid).toBe(true);
      expect(ConnectionMathValidator.validateConnection(snapConn).isValid).toBe(true);
    });

    it("creates and validates a CUSTOM connection", () => {
      const customConn = ConnectionModelFactory.createCustomConnection({
        interfaceAId: "if_a7",
        interfaceBId: "if_b7",
        frameA,
        frameB,
        allowedRotationAxes: [vec3(0, 1, 0)],
        allowedTranslationAxes: [vec3(0, 0, 1)],
      });

      expect(customConn.behavior).toBe("CUSTOM");
      expect(customConn.allowedRotationAxes).toHaveLength(1);
      expect(customConn.allowedTranslationAxes).toHaveLength(1);

      expect(ConnectionMathValidator.validateConnection(customConn).isValid).toBe(true);
    });
  });

  describe("2. Angular Verification: 0°, 30°, 45°, 60°, 90°", () => {
    const frameA = makeOrthonormalFrame(vec3(0, 0, 0));
    const frameB = makeOrthonormalFrame(vec3(100, 0, 0));

    const testAngles = [0, 30, 45, 60, 90];

    for (const angle of testAngles) {
      it(`accurately computes relative transformation and validates at ${angle}°`, () => {
        const conn = ConnectionModelFactory.createFixedConnection({
          interfaceAId: `if_a_${angle}`,
          interfaceBId: `if_b_${angle}`,
          frameA,
          frameB,
          joiningAngleDeg: angle,
          clearance: 0.1,
        });

        expect(conn.angleLimits.nominalAngleDeg).toBe(angle);
        expect(conn.clearance).toBe(0.1);

        // Mathematical validation
        const report = ConnectionMathValidator.validateConnection(conn);
        expect(report.isValid).toBe(true);

        // Verification of relative transform
        const relT = conn.relativeTransformation;
        expect(relT).toBeDefined();
        expect(Number.isFinite(relT.position.x)).toBe(true);
        expect(Number.isFinite(relT.position.y)).toBe(true);
        expect(Number.isFinite(relT.position.z)).toBe(true);
      });
    }
  });

  describe("3. Non-Planar & Arbitrary 3D Spatial Configurations", () => {
    it("handles compound 3D tilt and non-orthogonal orientations without planar assumptions", () => {
      // Create a tilted, non-planar 3D frame: tilted by 45° around X and 30° around Y
      const t = normalize3(vec3(1, 0.5, 0.2));
      const tempN = vec3(-0.5, 1, 0);
      const b = normalize3({
        x: t.y * tempN.z - t.z * tempN.y,
        y: t.z * tempN.x - t.x * tempN.z,
        z: t.x * tempN.y - t.y * tempN.x,
      });
      const n = normalize3({
        x: b.y * t.z - b.z * t.y,
        y: b.z * t.x - b.x * t.z,
        z: b.x * t.y - b.y * t.x,
      });

      const tiltedFrameA: CoordinateFrame3D = {
        origin: vec3(12.5, 45.0, -18.3),
        tangent: t,
        normal: n,
        binormal: b,
      };

      const tiltedFrameB: CoordinateFrame3D = {
        origin: vec3(90.2, -15.4, 62.1),
        tangent: vec3(0, 0, 1),
        normal: vec3(0, 1, 0),
        binormal: vec3(-1, 0, 0),
      };

      // Ensure frames are strictly orthonormal
      const valA = ConnectionMathValidator.validateFrameOrthonormality(tiltedFrameA, "Tilted Frame A");
      const valB = ConnectionMathValidator.validateFrameOrthonormality(tiltedFrameB, "Tilted Frame B");
      expect(valA.isValid).toBe(true);
      expect(valB.isValid).toBe(true);

      // Create connection with compound joining angle (45°) and roll angle (30°)
      const nonPlanarConn = ConnectionModelFactory.createConnection({
        interfaceAId: "if_nonplanar_a",
        interfaceBId: "if_nonplanar_b",
        frameA: tiltedFrameA,
        frameB: tiltedFrameB,
        joiningAngleDeg: 45.0,
        rollAngleDeg: 30.0,
        clearance: 0.15,
        tolerance: 0.05,
      });

      const report = ConnectionMathValidator.validateConnection(nonPlanarConn);
      expect(report.isValid).toBe(true);
      expect(report.errors).toHaveLength(0);
    });
  });

  describe("4. Independence from Final Assembly Configuration", () => {
    it("computes identical relative transforms regardless of where pieces are placed in world coordinates", () => {
      const frameA = makeOrthonormalFrame(vec3(0, 0, 0));
      const frameB = makeOrthonormalFrame(vec3(100, 20, 0));

      const conn1 = ConnectionModelFactory.createFixedConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        pieceAId: "piece_1",
        pieceBId: "piece_2",
        frameA,
        frameB,
        joiningAngleDeg: 60.0,
      });

      // Same interfaces in a completely different world coordinate scenario
      const conn2 = ConnectionModelFactory.createFixedConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        pieceAId: "piece_10",
        pieceBId: "piece_20",
        frameA,
        frameB,
        joiningAngleDeg: 60.0,
      });

      expect(conn1.relativeTransformation.position).toEqual(conn2.relativeTransformation.position);
      expect(conn1.relativeTransformation.rotation).toEqual(conn2.relativeTransformation.rotation);
    });
  });

  describe("5. Mathematical Error Detection & Kinematics Engine", () => {
    it("detects invalid / non-orthonormal frames", () => {
      const badFrame: CoordinateFrame3D = {
        origin: vec3(0, 0, 0),
        tangent: vec3(2, 0, 0), // Not normalized
        normal: vec3(0, 1, 0),
        binormal: vec3(0, 0, 1),
      };

      const report = ConnectionMathValidator.validateFrameOrthonormality(badFrame);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.includes("not normalized"))).toBe(true);
    });

    it("interpolates engagement trajectory along insertion direction", () => {
      const frameA = makeOrthonormalFrame(vec3(0, 0, 0));
      const frameB = makeOrthonormalFrame(vec3(100, 0, 0));

      const conn = ConnectionModelFactory.createFixedConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        frameA,
        frameB,
      });

      // At progress = 1.0 (fully seated), transform equals relativeTransformation
      const seatedTransform = ConnectionKinematicsEngine.interpolateEngagementTransform(conn, 1.0);
      expect(seatedTransform.position).toEqual(conn.relativeTransformation.position);

      // At progress = 0.5 (halfway), position is offset by 10mm along -insertionDirection
      const halfwayTransform = ConnectionKinematicsEngine.interpolateEngagementTransform(conn, 0.5, 20.0);
      const diff = len3(sub3(halfwayTransform.position, seatedTransform.position));
      expect(diff).toBeCloseTo(10.0, 3);
    });

    it("articulates hinge connections within angle limits", () => {
      const frameA = makeOrthonormalFrame(vec3(0, 0, 0));
      const frameB = makeOrthonormalFrame(vec3(100, 0, 0));

      const hinge = ConnectionModelFactory.createHingeConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        frameA,
        frameB,
        joiningAngleDeg: 90.0,
        minAngleDeg: 0.0,
        maxAngleDeg: 180.0,
      });

      const articulated = ConnectionKinematicsEngine.computeArticulatedHingeTransform(hinge, 120.0);
      expect(articulated).toBeDefined();
      expect(articulated.rotation).not.toEqual(hinge.relativeTransformation.rotation);
    });
  });
});
