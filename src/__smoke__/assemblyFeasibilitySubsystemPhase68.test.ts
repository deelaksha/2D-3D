import { describe, expect, it } from "vitest";
import {
  AssemblyFeasibilityValidator,
  type FeasibilityPieceGeometry,
} from "../core/puzzle/feasibility";
import { ConnectionModelFactory } from "../core/puzzle/connection";
import type { CoordinateFrame3D, RigidTransform3D } from "../core/puzzle/framesystem/types";
import { quatIdentity, vec3 } from "../core/puzzle/geometry/math3d";

function makeFrame(origin = vec3(0, 0, 0), normal = vec3(0, 1, 0)): CoordinateFrame3D {
  return {
    origin,
    tangent: vec3(1, 0, 0),
    normal,
    binormal: vec3(0, 0, 1),
  };
}

describe("Phase 68: Assembly-Feasibility Validation Subsystem", () => {
  describe("1. Valid Simple 3D Assemblies", () => {
    it("evaluates a valid 2-piece perpendicular corner assembly as FEASIBLE", () => {
      const pieceA: FeasibilityPieceGeometry = {
        pieceId: "piece_A",
        name: "Base Board",
        dimensions: { width: 100, height: 60, thickness: 3.0 },
      };

      const pieceB: FeasibilityPieceGeometry = {
        pieceId: "piece_B",
        name: "Right Wall",
        dimensions: { width: 60, height: 40, thickness: 3.0 },
      };

      // Target poses: Piece A at origin flat; Piece B at x=100 upright
      const targetConfiguration: Record<string, RigidTransform3D> = {
        piece_A: {
          position: vec3(0, 0, 0),
          rotation: quatIdentity(),
          scale: vec3(1, 1, 1),
        },
        piece_B: {
          position: vec3(100, 0, 0),
          rotation: quatIdentity(),
          scale: vec3(1, 1, 1),
        },
      };

      const frameA = makeFrame(vec3(100, 30, 0), vec3(1, 0, 0));
      const frameB = makeFrame(vec3(0, 30, 0), vec3(-1, 0, 0));

      const connection = ConnectionModelFactory.createFixedConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        pieceAId: "piece_A",
        pieceBId: "piece_B",
        frameA,
        frameB,
        joiningAngleDeg: 90.0,
        insertionDirection: vec3(-1, 0, 0), // Moves towards Piece A
      });

      const res = AssemblyFeasibilityValidator.evaluateFeasibility({
        pieces: [pieceA, pieceB],
        targetConfiguration,
        connections: [connection],
      });

      expect(res.isFeasible).toBe(true);
      expect(res.status).toBe("FEASIBLE");
      expect(res.failureReasons).toHaveLength(0);
      expect(res.assembledPieces).toEqual(["piece_A", "piece_B"]);
      expect(res.remainingPieces).toHaveLength(0);

      expect(res.path).toBeDefined();
      expect(res.path?.steps.length).toBeGreaterThanOrEqual(2);
      expect(res.path?.totalLengthMm).toBeGreaterThan(0);
    });

    it("evaluates a valid 3-piece U-channel assembly as FEASIBLE", () => {
      const pieceA: FeasibilityPieceGeometry = {
        pieceId: "base",
        dimensions: { width: 100, height: 60, thickness: 3.0 },
      };
      const pieceB: FeasibilityPieceGeometry = {
        pieceId: "left_wall",
        dimensions: { width: 3.0, height: 60, thickness: 40.0 },
      };
      const pieceC: FeasibilityPieceGeometry = {
        pieceId: "right_wall",
        dimensions: { width: 3.0, height: 60, thickness: 40.0 },
      };

      const targetConfiguration: Record<string, RigidTransform3D> = {
        base: { position: vec3(0, 0, 0), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
        left_wall: { position: vec3(0, 0, 3), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
        right_wall: { position: vec3(97, 0, 3), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
      };

      const conn1 = ConnectionModelFactory.createFixedConnection({
        interfaceAId: "if_base_left",
        interfaceBId: "if_left_base",
        pieceAId: "base",
        pieceBId: "left_wall",
        frameA: makeFrame(vec3(0, 30, 3), vec3(0, 0, 1)),
        frameB: makeFrame(vec3(0, 30, 0), vec3(0, 0, -1)),
        insertionDirection: vec3(0, 0, -1),
      });

      const conn2 = ConnectionModelFactory.createFixedConnection({
        interfaceAId: "if_base_right",
        interfaceBId: "if_right_base",
        pieceAId: "base",
        pieceBId: "right_wall",
        frameA: makeFrame(vec3(97, 30, 3), vec3(0, 0, 1)),
        frameB: makeFrame(vec3(0, 30, 0), vec3(0, 0, -1)),
        insertionDirection: vec3(0, 0, -1),
      });

      const res = AssemblyFeasibilityValidator.evaluateFeasibility({
        pieces: [pieceA, pieceB, pieceC],
        targetConfiguration,
        connections: [conn1, conn2],
      });

      expect(res.isFeasible).toBe(true);
      expect(res.status).toBe("FEASIBLE");
      expect(res.assembledPieces).toEqual(["base", "left_wall", "right_wall"]);
      expect(res.path?.steps).toHaveLength(3);
    });
  });

  describe("2. Detection of INVALID_FINAL_CONFIGURATION", () => {
    it("detects severe interpenetration in target configuration poses", () => {
      const pieceA: FeasibilityPieceGeometry = {
        pieceId: "piece_A",
        dimensions: { width: 80, height: 60, thickness: 3.0 },
      };
      const pieceB: FeasibilityPieceGeometry = {
        pieceId: "piece_B",
        dimensions: { width: 80, height: 60, thickness: 3.0 },
      };

      // Both pieces placed directly at the same position (complete body overlap)
      const targetConfiguration: Record<string, RigidTransform3D> = {
        piece_A: { position: vec3(0, 0, 0), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
        piece_B: { position: vec3(5, 5, 0), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
      };

      const res = AssemblyFeasibilityValidator.evaluateFeasibility({
        pieces: [pieceA, pieceB],
        targetConfiguration,
        connections: [],
      });

      expect(res.isFeasible).toBe(false);
      expect(res.status).toBe("INFEASIBLE");
      expect(res.failureReasons.some((r) => r.code === "INVALID_FINAL_CONFIGURATION")).toBe(true);
      expect(res.failureReasons[0].message).toContain("penetrate each other");
    });
  });

  describe("3. Detection of IMPOSSIBLE_INSERTION_DIRECTION", () => {
    it("detects when insertion direction points away from receiving normal", () => {
      const pieceA: FeasibilityPieceGeometry = {
        pieceId: "piece_A",
        dimensions: { width: 100, height: 60, thickness: 3.0 },
      };
      const pieceB: FeasibilityPieceGeometry = {
        pieceId: "piece_B",
        dimensions: { width: 60, height: 40, thickness: 3.0 },
      };

      const targetConfiguration: Record<string, RigidTransform3D> = {
        piece_A: { position: vec3(0, 0, 0), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
        piece_B: { position: vec3(100, 0, 0), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
      };

      // Interface A normal is (1, 0, 0).
      // Insertion direction pointing in (1, 0, 0) moves AWAY from Interface A
      const frameA = makeFrame(vec3(100, 30, 0), vec3(1, 0, 0));
      const frameB = makeFrame(vec3(0, 30, 0), vec3(-1, 0, 0));

      const connection = ConnectionModelFactory.createFixedConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        pieceAId: "piece_A",
        pieceBId: "piece_B",
        frameA,
        frameB,
        insertionDirection: vec3(1, 0, 0), // Points away from normal (dot=1.0)
      });

      const res = AssemblyFeasibilityValidator.evaluateFeasibility({
        pieces: [pieceA, pieceB],
        targetConfiguration,
        connections: [connection],
      });

      expect(res.isFeasible).toBe(false);
      expect(res.status).toBe("INFEASIBLE");
      expect(res.failureReasons.some((r) => r.code === "IMPOSSIBLE_INSERTION_DIRECTION")).toBe(true);
      expect(res.failureReasons[0].message).toContain("points away from receiver normal");
    });
  });

  describe("4. Detection of IMPOSSIBLE_ROTATION", () => {
    it("detects when connection joining angle violates angle limits", () => {
      const pieceA: FeasibilityPieceGeometry = {
        pieceId: "piece_A",
        dimensions: { width: 100, height: 60, thickness: 3.0 },
      };
      const pieceB: FeasibilityPieceGeometry = {
        pieceId: "piece_B",
        dimensions: { width: 60, height: 40, thickness: 3.0 },
      };

      const targetConfiguration: Record<string, RigidTransform3D> = {
        piece_A: { position: vec3(0, 0, 0), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
        piece_B: { position: vec3(100, 0, 0), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
      };

      const frameA = makeFrame(vec3(100, 30, 0), vec3(1, 0, 0));
      const frameB = makeFrame(vec3(0, 30, 0), vec3(-1, 0, 0));

      // Hinge connection constrained to [0°, 60°], but nominal joining angle is 90°
      const connection = ConnectionModelFactory.createHingeConnection({
        interfaceAId: "if_a",
        interfaceBId: "if_b",
        pieceAId: "piece_A",
        pieceBId: "piece_B",
        frameA,
        frameB,
        minAngleDeg: 0.0,
        maxAngleDeg: 60.0,
        joiningAngleDeg: 90.0,
        insertionDirection: vec3(-1, 0, 0),
      });

      const res = AssemblyFeasibilityValidator.evaluateFeasibility({
        pieces: [pieceA, pieceB],
        targetConfiguration,
        connections: [connection],
      });

      expect(res.isFeasible).toBe(false);
      expect(res.status).toBe("INFEASIBLE");
      expect(res.failureReasons.some((r) => r.code === "IMPOSSIBLE_ROTATION")).toBe(true);
      expect(res.failureReasons[0].message).toContain("outside allowable range");
    });
  });

  describe("5. Detection of INTERFERENCE_FROM_ASSEMBLED_PIECES / COLLISION_DURING_MOVEMENT", () => {
    it("detects when an incoming piece collides with already assembled geometry during movement", () => {
      // Piece A: Base
      const pieceA: FeasibilityPieceGeometry = {
        pieceId: "base",
        dimensions: { width: 100, height: 60, thickness: 3.0 },
      };
      // Piece B: Middle barrier placed at x=50
      const pieceB: FeasibilityPieceGeometry = {
        pieceId: "barrier",
        dimensions: { width: 20, height: 60, thickness: 30.0 }, // Tall obstacle
      };
      // Piece C: Target is at x=0, but its insertion standoff sweeps through x=50!
      const pieceC: FeasibilityPieceGeometry = {
        pieceId: "sliding_part",
        dimensions: { width: 30, height: 40, thickness: 10.0 },
      };

      const targetConfiguration: Record<string, RigidTransform3D> = {
        base: { position: vec3(0, 0, 0), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
        barrier: { position: vec3(50, 0, 3), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
        sliding_part: { position: vec3(0, 0, 3), rotation: quatIdentity(), scale: vec3(1, 1, 1) },
      };

      const conn1 = ConnectionModelFactory.createFixedConnection({
        interfaceAId: "if_base_b",
        interfaceBId: "if_b_base",
        pieceAId: "base",
        pieceBId: "barrier",
        frameA: makeFrame(vec3(50, 0, 3)),
        frameB: makeFrame(vec3(0, 0, 0)),
        insertionDirection: vec3(0, 0, -1),
      });

      // Piece C inserts along +X (towards x=0 from x=80, directly through the barrier at x=50!)
      const conn2 = ConnectionModelFactory.createFixedConnection({
        interfaceAId: "if_base_c",
        interfaceBId: "if_c_base",
        pieceAId: "base",
        pieceBId: "sliding_part",
        frameA: makeFrame(vec3(0, 0, 3), vec3(1, 0, 0)),
        frameB: makeFrame(vec3(0, 0, 0), vec3(-1, 0, 0)),
        insertionDirection: vec3(-1, 0, 0), // Moves from +X towards 0
      });

      const res = AssemblyFeasibilityValidator.evaluateFeasibility({
        pieces: [pieceA, pieceB, pieceC],
        targetConfiguration,
        connections: [conn1, conn2],
        prescribedOrder: ["base", "barrier", "sliding_part"],
        options: {
          standoffDistanceMm: 80.0, // Starts at x = 0 - (-1)*80 = +80mm, moves through x=50 barrier!
        },
      });

      expect(res.isFeasible).toBe(false);
      expect(res.status).toBe("INFEASIBLE");
      const hasMotionCollision = res.failureReasons.some(
        (r) =>
          r.code === "INTERFERENCE_FROM_ASSEMBLED_PIECES" ||
          r.code === "COLLISION_DURING_MOVEMENT"
      );
      expect(hasMotionCollision).toBe(true);
      expect(res.failureReasons[0].conflictingPieceId).toBe("barrier");
    });
  });
});
