import { describe, expect, it } from "vitest";
import {
  convert2DTo3DSolid,
  createDefaultParametricPiece2D,
  extrude2DPieceTo3DSolidMesh,
  regenerateParametricPieceGeometry,
  validate3DSolidRepresentation,
} from "@/core/puzzle";

describe("Phase 10: Deterministic 2D-to-3D Conversion Layer", () => {
  it("extrudes 2D piece contour strictly into piece-LOCAL coordinate space", () => {
    const piece2D = createDefaultParametricPiece2D(100, 80, 3.0);
    const { solid, validationReport } = convert2DTo3DSolid(piece2D);

    expect(solid.pieceId).toBe(piece2D.id);
    expect(solid.thickness).toBe(3.0);

    // Verify z-bounds span [-1.5, +1.5] in local space
    expect(solid.localMesh.bounds.min.z).toBeCloseTo(-1.5);
    expect(solid.localMesh.bounds.max.z).toBeCloseTo(1.5);

    expect(validationReport.level).toBe("ok");
  });

  it("calculates physical volume, surface area, and mass deterministically", () => {
    const piece2D = createDefaultParametricPiece2D(100, 100, 2.0); // 100x100 rectangle, 2mm thick
    const { solid } = convert2DTo3DSolid(piece2D, {
      id: "cb_2mm",
      name: "Cardboard 2mm",
      thickness: 2.0,
      density: 0.70, // 0.70 g/cm^3
      grainDirectionDeg: 0,
      minBendRadius: 4.0,
      slotTolerance: 0.15,
      color: "#D2B48C",
    });

    // Volume = (100*100 + tabArea) * 2 ~ 20,100 mm^3
    expect(solid.volumeMm3).toBeGreaterThan(20000);
    expect(solid.volumeMm3).toBeLessThan(20500);

    // Mass = volume * (0.70 * 0.001 g/mm^3) ~ 14.07 grams
    expect(solid.massGrams).toBeGreaterThan(14.0);
    expect(solid.massGrams).toBeLessThan(14.5);
  });

  it("supports extrusion with inner hole cutouts", () => {
    const piece2D = createDefaultParametricPiece2D(100, 100, 2.0);
    const pieceWithHole = regenerateParametricPieceGeometry(piece2D, { hole_radius: 10 });

    const { solid } = convert2DTo3DSolid(pieceWithHole);
    // Hole area = pi * 10^2 ~ 314.16 mm^2
    // Expected volume ~ (10000 - 314.16) * 2 ~ 19371.68 mm^3
    expect(solid.volumeMm3).toBeLessThan(20000);
    expect(solid.volumeMm3).toBeGreaterThan(19000);
  });

  it("validates 3D solid representations and catches zero thickness or corrupt buffers", () => {
    const piece2D = createDefaultParametricPiece2D(100, 100, 2.0);
    const { solid } = convert2DTo3DSolid(piece2D);

    // 1. Zero thickness corrupt solid
    const badSolid = { ...solid, thickness: 0 };
    const reportBadThickness = validate3DSolidRepresentation(badSolid);
    expect(reportBadThickness.level).toBe("error");
    expect(reportBadThickness.issues.some((i) => i.code === "NON_ZERO_THICKNESS_VIOLATION")).toBe(true);

    // 2. Corrupt bounds
    const badBoundsSolid = {
      ...solid,
      localMesh: {
        ...solid.localMesh,
        bounds: {
          min: { x: 0, y: 0, z: -10 },
          max: { x: 100, y: 100, z: 10 },
        },
      },
    };
    const reportBadBounds = validate3DSolidRepresentation(badBoundsSolid);
    expect(reportBadBounds.level).toBe("error");
    expect(reportBadBounds.issues.some((i) => i.code === "INVALID_EXTRUSION_BOUNDS")).toBe(true);
  });
});
