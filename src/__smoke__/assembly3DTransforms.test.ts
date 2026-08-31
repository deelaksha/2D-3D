import { describe, expect, it } from "vitest";
import {
  AssemblyTransformationSystem,
  createDefaultParametricPiece2D,
  identityTransform,
  rotationTransform,
  translationTransform,
  vec3,
} from "@/core/puzzle";

describe("Phase 11: 3D Assembly Transformation System", () => {
  it("places pieces and computes relative and absolute transforms", () => {
    const sys = new AssemblyTransformationSystem("config_test_1");

    const tBase = identityTransform();
    const tWall = translationTransform(vec3(100, 0, 0));

    sys.placePiece("piece_base", tBase, true);
    sys.placePiece("piece_wall", tWall, false);

    expect(sys.hasPiece("piece_base")).toBe(true);
    expect(sys.hasPiece("piece_wall")).toBe(true);

    const rel = sys.computeRelativeTransform("piece_base", "piece_wall");
    expect(rel.position.x).toBeCloseTo(100);

    const abs = sys.computeAbsoluteTransform(tBase, rel);
    expect(abs.position.x).toBeCloseTo(100);
  });

  it("aligns interfaces at 0, 30, 45, 60, and 90 degree joining angles", () => {
    const sys = new AssemblyTransformationSystem();

    const srcFrame = {
      origin: { x: 100, y: 50, z: 0 },
      tangent: { x: 0, y: 1, z: 0 },
      normal: { x: 1, y: 0, z: 0 },
      binormal: { x: 0, y: 0, z: 1 },
    };

    const tgtFrame = {
      origin: { x: 0, y: 0, z: 0 },
      tangent: { x: 0, y: 1, z: 0 },
      normal: { x: 1, y: 0, z: 0 },
      binormal: { x: 0, y: 0, z: 1 },
    };

    const angles = [0, 30, 45, 60, 90];

    for (const angle of angles) {
      const res = sys.calculateInterfaceMatingTransform({
        sourcePieceId: "p_base",
        sourceInterfaceFrame: srcFrame,
        targetPieceId: "p_wall",
        targetInterfaceFrame: tgtFrame,
        joiningAngleDeg: angle,
      });

      expect(res.success).toBe(true);
      expect(res.targetPieceTransform).toBeDefined();
      expect(res.relativeTransform).toBeDefined();
    }
  });

  it("aligns non-planar 3D compound joint configurations", () => {
    const sys = new AssemblyTransformationSystem();

    // Source piece already rotated by 45 deg in world space
    sys.placePiece("p_source", rotationTransform(vec3(1, 0, 0), Math.PI / 4));

    const srcFrame = {
      origin: { x: 50, y: 50, z: 50 },
      tangent: { x: 0, y: 0, z: 1 },
      normal: { x: 1, y: 0, z: 0 },
      binormal: { x: 0, y: 1, z: 0 },
    };

    const tgtFrame = {
      origin: { x: 0, y: 0, z: 0 },
      tangent: { x: 0, y: 0, z: 1 },
      normal: { x: 1, y: 0, z: 0 },
      binormal: { x: 0, y: 1, z: 0 },
    };

    const res = sys.calculateInterfaceMatingTransform({
      sourcePieceId: "p_source",
      sourceInterfaceFrame: srcFrame,
      targetPieceId: "p_target",
      targetInterfaceFrame: tgtFrame,
      joiningAngleDeg: 90.0,
    });

    expect(res.success).toBe(true);
    expect(res.targetPieceTransform).toBeDefined();
  });

  it("enforces joining angle range constraints", () => {
    const sys = new AssemblyTransformationSystem();

    const srcFrame = {
      origin: { x: 0, y: 0, z: 0 },
      tangent: { x: 0, y: 1, z: 0 },
      normal: { x: 1, y: 0, z: 0 },
      binormal: { x: 0, y: 0, z: 1 },
    };

    const resFail = sys.calculateInterfaceMatingTransform({
      sourcePieceId: "p1",
      sourceInterfaceFrame: srcFrame,
      targetPieceId: "p2",
      targetInterfaceFrame: srcFrame,
      joiningAngleDeg: 120.0,
      allowedAngleRange: { minAngleDeg: 0, maxAngleDeg: 90 },
    });

    expect(resFail.success).toBe(false);
    expect(resFail.errorReason).toContain("outside allowed angle range");
  });

  it("allows the same piece template to be reused across multiple assembly configurations", () => {
    // 1. Single piece template
    const templatePiece = createDefaultParametricPiece2D(100, 100, 2.0);

    // 2. Configuration A (Flat 0deg extension)
    const sysA = new AssemblyTransformationSystem("config_A");
    sysA.placePiece(templatePiece.id, identityTransform());

    // 3. Configuration B (Perpendicular 90deg corner)
    const sysB = new AssemblyTransformationSystem("config_B");
    sysB.placePiece(templatePiece.id, rotationTransform(vec3(1, 0, 0), Math.PI / 2));

    expect(sysA.getPieceTransform(templatePiece.id).rotation.w).toBeCloseTo(1.0);
    expect(sysB.getPieceTransform(templatePiece.id).rotation.x).toBeCloseTo(Math.SQRT1_2);

    // Base template geometry thickness remains unchanged at 2.0
    expect(templatePiece.thickness).toBe(2.0);
  });
});
