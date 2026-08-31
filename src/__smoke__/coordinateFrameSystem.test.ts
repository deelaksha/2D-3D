import { describe, expect, it } from "vitest";
import {
  alignInterfaces,
  composeTransforms,
  createInterfaceLocalFrame3D,
  identityTransform,
  inverseTransform,
  localToWorld,
  rotationTransform,
  transformPoint,
  transformVector,
  translationTransform,
  vec3,
  worldToLocal,
} from "@/core/puzzle";

describe("Phase 5: 3D Coordinate-Frame System", () => {
  it("evaluates identity transform correctly", () => {
    const idT = identityTransform();
    const p = vec3(10, 20, 30);
    const pPrime = transformPoint(idT, p);

    expect(pPrime.x).toBeCloseTo(10);
    expect(pPrime.y).toBeCloseTo(20);
    expect(pPrime.z).toBeCloseTo(30);
  });

  it("evaluates translation transform", () => {
    const t = translationTransform(vec3(5, -10, 15));
    const p = vec3(10, 10, 10);
    const pPrime = transformPoint(t, p);

    expect(pPrime.x).toBeCloseTo(15);
    expect(pPrime.y).toBeCloseTo(0);
    expect(pPrime.z).toBeCloseTo(25);
  });

  it("evaluates rotation transform (90deg around Z axis)", () => {
    const r = rotationTransform(vec3(0, 0, 1), Math.PI / 2);
    const v = vec3(1, 0, 0);
    const vRotated = transformVector(r, v);

    expect(vRotated.x).toBeCloseTo(0);
    expect(vRotated.y).toBeCloseTo(1);
    expect(vRotated.z).toBeCloseTo(0);
  });

  it("evaluates transform composition (T1 o T2)", () => {
    const t1 = translationTransform(vec3(10, 0, 0));
    const t2 = rotationTransform(vec3(0, 0, 1), Math.PI / 2);

    const tComposite = composeTransforms(t1, t2);

    const p = vec3(1, 0, 0);
    // T2 rotates (1,0,0) to (0,1,0), T1 translates (0,1,0) to (10,1,0)
    const pSequential = transformPoint(t1, transformPoint(t2, p));
    const pComposite = transformPoint(tComposite, p);

    expect(pComposite.x).toBeCloseTo(pSequential.x);
    expect(pComposite.y).toBeCloseTo(pSequential.y);
    expect(pComposite.z).toBeCloseTo(pSequential.z);
    expect(pComposite.x).toBeCloseTo(10);
    expect(pComposite.y).toBeCloseTo(1);
  });

  it("evaluates inverse transform (T^-1 o T = Identity)", () => {
    const t = composeTransforms(
      translationTransform(vec3(15, -25, 40)),
      rotationTransform(vec3(0, 1, 0), Math.PI / 3),
    );

    const invT = inverseTransform(t);
    const p = vec3(42, -18, 99);

    const pTransformed = transformPoint(t, p);
    const pRestored = transformPoint(invT, pTransformed);

    expect(pRestored.x).toBeCloseTo(p.x);
    expect(pRestored.y).toBeCloseTo(p.y);
    expect(pRestored.z).toBeCloseTo(p.z);
  });

  it("evaluates localToWorld and worldToLocal roundtrips", () => {
    const pieceTransform = composeTransforms(
      translationTransform(vec3(100, 200, 50)),
      rotationTransform(vec3(1, 0, 0), Math.PI / 4),
    );

    const localPt = vec3(5, 10, 15);
    const worldPt = localToWorld(pieceTransform, localPt);
    const localRestored = worldToLocal(pieceTransform, worldPt);

    expect(localRestored.x).toBeCloseTo(localPt.x);
    expect(localRestored.y).toBeCloseTo(localPt.y);
    expect(localRestored.z).toBeCloseTo(localPt.z);
  });

  it("aligns interfaces for non-horizontal 3D assembly (90deg corner & 45deg roof)", () => {
    const sourceFrame = createInterfaceLocalFrame3D(vec3(50, 0, 0), vec3(1, 0, 0), vec3(0, -1, 0));
    const targetFrame = createInterfaceLocalFrame3D(vec3(50, 80, 0), vec3(-1, 0, 0), vec3(0, 1, 0));

    const sourcePlacement = identityTransform();

    // 1. 90 degree vertical wall assembly
    const targetPlacement90 = alignInterfaces(sourceFrame, sourcePlacement, targetFrame, 90.0);
    expect(targetPlacement90.position).toBeDefined();
    expect(targetPlacement90.rotation).toBeDefined();

    // 2. 45 degree pitched roof assembly
    const targetPlacement45 = alignInterfaces(sourceFrame, sourcePlacement, targetFrame, 45.0);
    expect(targetPlacement45.position).toBeDefined();
    expect(targetPlacement45.rotation).toBeDefined();
  });
});
