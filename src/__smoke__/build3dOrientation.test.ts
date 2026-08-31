/**
 * Regression test: the 3D extrusion must reproduce the SAME shape the 2D
 * canvas renders (partOutlineWorld), for every part transform — not just the
 * identity transform. build3d bakes flipX/flipY/scaleX/scaleY into the local
 * outline (applyPartOrientation) and leaves rotation + position to the 3D
 * placement; this checks that composition reconstructs the 2D world outline
 * exactly, for rect, triangle and other shape kinds, with and without
 * mirroring/rotation applied.
 */
import { describe, it, expect } from "vitest";
import { applyPartOrientation } from "@/ui/canvas3d/build3d";
import { shapeOutline } from "@/core/geometry/outline";
import { partOutlineWorld } from "@/core/geometry/world";
import { rotate } from "@/core/geometry/vec";
import { makePart } from "@/core/model/defaults";
import type { Part, ShapeKind, Transform2D } from "@/core/model/types";

function partWith(kind: ShapeKind, transform: Partial<Transform2D>): Part {
  const part = makePart("Test Part", "mat-plywood-12");
  part.shape = { kind, x: 10, y: 5, width: 60, height: 40, rotation: 0 };
  part.transform = {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    flipX: false,
    flipY: false,
    ...transform,
  };
  return part;
}

/** Reproduce the build3d composition: flip/scale locally, then rotate + translate. */
function reconstructWorld(part: Part): { x: number; y: number }[] {
  const local = shapeOutline(part.shape)[0];
  return local.map((p) => {
    const oriented = applyPartOrientation(part, p);
    const rotated = rotate(oriented, part.transform.rotation);
    return { x: rotated.x + part.transform.x, y: rotated.y + part.transform.y };
  });
}

describe("build3d orientation fidelity", () => {
  const cases: { label: string; kind: ShapeKind; transform: Partial<Transform2D> }[] = [
    { label: "identity", kind: "rect", transform: {} },
    { label: "identity triangle", kind: "triangle", transform: {} },
    { label: "flipped horizontally", kind: "triangle", transform: { flipX: true } },
    { label: "flipped vertically", kind: "triangle", transform: { flipY: true } },
    { label: "flipped both", kind: "triangle", transform: { flipX: true, flipY: true } },
    { label: "rotated + moved", kind: "triangle", transform: { rotation: 37, x: 120, y: -80 } },
    { label: "flipped + rotated + moved", kind: "triangle", transform: { flipX: true, rotation: 200, x: -50, y: 30 } },
    { label: "polygon kind", kind: "hexagon", transform: { flipY: true, rotation: 15 } },
  ];

  for (const { label, kind, transform } of cases) {
    it(`matches the 2D world outline: ${label}`, () => {
      const part = partWith(kind, transform);
      const world = partOutlineWorld(part)[0];
      const reconstructed = reconstructWorld(part);
      expect(reconstructed.length).toBe(world.length);
      for (let i = 0; i < world.length; i++) {
        expect(reconstructed[i].x).toBeCloseTo(world[i].x, 9);
        expect(reconstructed[i].y).toBeCloseTo(world[i].y, 9);
      }
    });
  }

  it("is a no-op for the default (unflipped, unscaled) transform", () => {
    const part = partWith("triangle", {});
    const local = shapeOutline(part.shape)[0];
    const oriented = local.map((p) => applyPartOrientation(part, p));
    expect(oriented).toEqual(local);
  });
});
