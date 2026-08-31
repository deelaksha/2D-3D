import { describe, it, expect } from "vitest";
import { createPart, addConnector, createPortPair, connectPortPair, findConnector, findPart, placePart } from "@/core/store/actions";
import { calculateMatingTransform } from "@/ui/canvas3d/build3d";
import { connectorFeature } from "@/core/connectors/feature";
import { mateRotationZ, mateTargetXY, oppositeOrientation, oppositeEdge } from "@/core/connectors/mate";
import { store } from "@/core/store/store";
import type { Vec2 } from "@/core/model/types";

/** Independent reference implementation of the 2D->3D connector-world-position
 * convention (local Y negated, then rotated CW by the part's own rotation) —
 * re-derived by hand here rather than imported, so it can catch a sign/axis
 * mistake in core/connectors/mate.ts instead of just restating it. */
function worldConnPos(partPos: Vec2, partRotZ: number, connLocalPos: Vec2): Vec2 {
  const rad = (partRotZ * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const lx = connLocalPos.x, ly = -connLocalPos.y;
  return { x: partPos.x + (lx * cos - ly * sin), y: partPos.y + (lx * sin + ly * cos) };
}

function worldOrientation(connOrientation: number, partRotZ: number): number {
  return ((connOrientation + partRotZ) % 360 + 360) % 360;
}

describe("Orientation-aware joint mating (mate.ts pure math)", () => {
  it("opposite-facing pair (connector right / receiver left) mates with 0 relative rotation", () => {
    const targetRotZ = mateRotationZ(0, 0, 180);
    expect(targetRotZ).toBe(0);
    expect(worldOrientation(180, targetRotZ)).toBe(worldOrientation(0, 0) + 180);
  });

  it("90 degree connection faces the two connectors toward each other", () => {
    const sourceRotZ = 0;
    const targetRotZ = mateRotationZ(sourceRotZ, 0, 90);
    const worldSource = worldOrientation(0, sourceRotZ);
    const worldTarget = worldOrientation(90, targetRotZ);
    expect(((worldTarget - worldSource + 360) % 360)).toBe(180);
  });

  it("180 degree connection holds even when the source part itself is rotated", () => {
    const sourceRotZ = 45; // a non-zero source rotation, the previously-untested case
    const targetRotZ = mateRotationZ(sourceRotZ, 0, 180);
    const worldSource = worldOrientation(0, sourceRotZ);
    const worldTarget = worldOrientation(180, targetRotZ);
    expect(((worldTarget - worldSource + 360) % 360)).toBe(180);
  });

  it("270 degree connection faces the two connectors toward each other", () => {
    const targetRotZ = mateRotationZ(0, 0, 270);
    const worldSource = worldOrientation(0, 0);
    const worldTarget = worldOrientation(270, targetRotZ);
    expect(((worldTarget - worldSource + 360) % 360)).toBe(180);
  });

  it("mateTargetXY places the target connector exactly on the source connector for a rotated mate", () => {
    const sourcePos = { x: 40, y: 10 };
    const sourceRotZ = 0;
    const sourceConnPos = { x: 25, y: 0 };
    const targetConnPos = { x: 12, y: 3 };
    for (const targetOrientation of [0, 90, 180, 270]) {
      const targetRotZ = mateRotationZ(sourceRotZ, 0, targetOrientation);
      const targetXY = mateTargetXY(sourcePos, sourceRotZ, sourceConnPos, targetRotZ, targetConnPos);
      const expectedWorldSourceConn = worldConnPos(sourcePos, sourceRotZ, sourceConnPos);
      const actualWorldTargetConn = worldConnPos(targetXY, targetRotZ, targetConnPos);
      expect(actualWorldTargetConn.x).toBeCloseTo(expectedWorldSourceConn.x, 6);
      expect(actualWorldTargetConn.y).toBeCloseTo(expectedWorldSourceConn.y, 6);
    }
  });

  it("oppositeOrientation/oppositeEdge round-trip (used for the panel's auto-facing default)", () => {
    expect(oppositeOrientation(0)).toBe(180);
    expect(oppositeOrientation(90)).toBe(270);
    expect(oppositeEdge("right")).toBe("left");
    expect(oppositeEdge("top")).toBe("bottom");
  });
});

describe("Orientation-aware joint mating (2D creation + 3D auto-mate agree)", () => {
  it("connector facing right + receiver facing left snaps with 0 relative rotation in 3D", () => {
    const a = createPart("Panel A", { width: 100, height: 100 });
    const b = createPart("Panel B", { width: 100, height: 100 });
    placePart(a, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

    const pair = createPortPair(a, b, "tab", { width: 12, height: 4, depth: 4 }, { edge: "right" }, { edge: "left" });
    expect(pair).toBeTruthy();
    if (!pair) return;
    expect(findConnector(pair.plugId)?.orientation).toBe(0);
    expect(findConnector(pair.receiverId)?.orientation).toBe(180);

    expect(connectPortPair(pair.plugId)).toBe(true);
    const placement = store.getState().project.assembly.placements.find((p) => p.partId === b);
    expect(placement?.rotation.z).toBe(0);

    // The 3D join path (build3d.calculateMatingTransform) must compute the
    // identical rotation for the same connector pair.
    const sourcePart = findPart(a)!, targetPart = findPart(b)!;
    const sourceConn = findConnector(pair.plugId)!, targetConn = findConnector(pair.receiverId)!;
    const sourcePlacement = store.getState().project.assembly.placements.find((p) => p.partId === a);
    const t = calculateMatingTransform(sourcePart, sourceConn, targetPart, targetConn, sourcePlacement);
    expect(t.rotation.z).toBe(placement?.rotation.z);
  });

  it("90 degree corner joint: explicit receiver orientation override matches the 3D mate", () => {
    const a = createPart("Panel A", { width: 100, height: 100 });
    const b = createPart("Panel B", { width: 100, height: 100 });
    placePart(a, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

    // Connector faces right (0deg); receiver explicitly forced to face 90deg,
    // the way the JointsPanel orientation control (0/90/180/270) would set it.
    const pair = createPortPair(a, b, "tab", { width: 12, height: 4, depth: 4 }, { edge: "right" }, { edge: "top", orientation: 90 });
    expect(pair).toBeTruthy();
    if (!pair) return;
    expect(findConnector(pair.receiverId)?.orientation).toBe(90);

    connectPortPair(pair.plugId);
    const placement = store.getState().project.assembly.placements.find((p) => p.partId === b)!;

    const sourcePart = findPart(a)!, targetPart = findPart(b)!;
    const sourceConn = findConnector(pair.plugId)!, targetConn = findConnector(pair.receiverId)!;
    const sourcePlacement = store.getState().project.assembly.placements.find((p) => p.partId === a);
    const t = calculateMatingTransform(sourcePart, sourceConn, targetPart, targetConn, sourcePlacement);

    expect(t.rotation.z).toBe(placement.rotation.z);
    expect(worldOrientation(targetConn.orientation, placement.rotation.z)).toBe((worldOrientation(sourceConn.orientation, 0) + 180) % 360);
  });

  it("180 degree connection: default opposite edges (bottom/top) mate flat with no relative rotation", () => {
    const a = createPart("Panel A", { width: 100, height: 100 });
    const b = createPart("Panel B", { width: 100, height: 100 });
    placePart(a, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

    const pair = createPortPair(a, b, "tab", { width: 12, height: 4, depth: 4 }, { edge: "bottom" }, { edge: "top" });
    if (!pair) throw new Error("pair not created");
    expect(findConnector(pair.plugId)?.orientation).toBe(90); // bottom -> outward normal 90deg
    expect(findConnector(pair.receiverId)?.orientation).toBe(270); // top -> outward normal 270deg, already opposite

    connectPortPair(pair.plugId);
    const placement = store.getState().project.assembly.placements.find((p) => p.partId === b)!;
    expect(placement.rotation.z).toBe(0);
  });

  it("270 degree connection: explicit receiver orientation override matches the 3D mate", () => {
    const a = createPart("Panel A", { width: 100, height: 100 });
    const b = createPart("Panel B", { width: 100, height: 100 });
    placePart(a, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

    const pair = createPortPair(a, b, "tab", { width: 12, height: 4, depth: 4 }, { edge: "right" }, { edge: "left", orientation: 270 });
    if (!pair) throw new Error("pair not created");
    expect(findConnector(pair.receiverId)?.orientation).toBe(270);

    connectPortPair(pair.plugId);
    const placement = store.getState().project.assembly.placements.find((p) => p.partId === b)!;

    const sourcePart = findPart(a)!, targetPart = findPart(b)!;
    const sourceConn = findConnector(pair.plugId)!, targetConn = findConnector(pair.receiverId)!;
    const sourcePlacement = store.getState().project.assembly.placements.find((p) => p.partId === a);
    const t = calculateMatingTransform(sourcePart, sourceConn, targetPart, targetConn, sourcePlacement);

    expect(t.rotation.z).toBe(placement.rotation.z);
    expect(worldOrientation(targetConn.orientation, placement.rotation.z)).toBe((worldOrientation(sourceConn.orientation, 0) + 180) % 360);
  });

  it("custom hand-drawn connectors on differently oriented edges mate the same as built-in types", () => {
    const a = createPart("Panel A", { width: 100, height: 100 });
    const b = createPart("Panel B", { width: 100, height: 100 });
    placePart(a, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

    const plugId = addConnector(a, "custom", { x: 0, y: 50 }, {
      role: "insert",
      orientation: 180, // left-facing
      profileShape: { kind: "polygon", x: -6, y: -6, width: 12, height: 12, rotation: 15, nodes: [{ x: -6, y: -6 }, { x: 6, y: -6 }, { x: 0, y: 6 }] },
    });
    const receiverId = addConnector(b, "custom", { x: 100, y: 50 }, {
      role: "receiver",
      orientation: 0, // right-facing — squarely opposite the plug
      referencedConnectorId: plugId,
      compatibleWith: [plugId],
    });

    // Orientation must rotate the custom outline itself (requirement: orientation
    // is derived from geometry, not hardcoded per connector type).
    const plugFeature = connectorFeature(findConnector(plugId)!);
    expect(plugFeature?.shape.rotation).toBe(15 + 180);

    connectPortPair(plugId, receiverId);
    const placement = store.getState().project.assembly.placements.find((p) => p.partId === b)!;

    const sourcePart = findPart(a)!, targetPart = findPart(b)!;
    const sourceConn = findConnector(plugId)!, targetConn = findConnector(receiverId)!;
    const sourcePlacement = store.getState().project.assembly.placements.find((p) => p.partId === a);
    const t = calculateMatingTransform(sourcePart, sourceConn, targetPart, targetConn, sourcePlacement);

    expect(t.rotation.z).toBe(placement.rotation.z);
    expect(worldOrientation(targetConn.orientation, placement.rotation.z)).toBe((worldOrientation(sourceConn.orientation, 0) + 180) % 360);
  });
});
