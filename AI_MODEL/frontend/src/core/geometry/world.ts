/**
 * World-space geometry: applies a Part's Transform2D to local outlines and
 * connectors so canvas rendering, hit-testing, snapping and 3D placement all
 * agree on where things are.
 */
import type { Bounds, Connector, Part, Vec2 } from "../model/types";
import { rotate } from "./vec";
import { boundsOfPoints, pointInLoop, shapeOutline } from "./outline";

/** Transform a point from a part's local frame into world space (mm). */
export function partToWorld(part: Part, p: Vec2): Vec2 {
  const t = part.transform;
  let x = p.x * t.scaleX * (t.flipX ? -1 : 1);
  let y = p.y * t.scaleY * (t.flipY ? -1 : 1);
  const r = rotate({ x, y }, t.rotation);
  return { x: r.x + t.x, y: r.y + t.y };
}

/** Transform a world point back into a part's local frame. */
export function worldToPart(part: Part, p: Vec2): Vec2 {
  const t = part.transform;
  const dx = p.x - t.x;
  const dy = p.y - t.y;
  const r = rotate({ x: dx, y: dy }, -t.rotation);
  return {
    x: (r.x / (t.scaleX || 1)) * (t.flipX ? -1 : 1),
    y: (r.y / (t.scaleY || 1)) * (t.flipY ? -1 : 1),
  };
}

/** The part's base outline loops in world coordinates. */
export function partOutlineWorld(part: Part): Vec2[][] {
  return shapeOutline(part.shape).map((loop) => loop.map((p) => partToWorld(part, p)));
}

/** Modifier (hole/slot/tab) outlines in world coordinates. */
export function partModifiersWorld(part: Part): { op: string; loops: Vec2[][] }[] {
  return part.modifiers.map((m) => ({
    op: m.op,
    loops: shapeOutline(m.shape).map((loop) => loop.map((p) => partToWorld(part, p))),
  }));
}

export function partBoundsWorld(part: Part): Bounds {
  return boundsOfPoints(partOutlineWorld(part).flat());
}

export function partBoundsLocal(part: Part): Bounds {
  return boundsOfPoints(shapeOutline(part.shape).flat());
}

/** Hit-test a world point against a part's filled base outline. */
export function pointInPart(part: Part, world: Vec2): boolean {
  const loops = partOutlineWorld(part);
  if (loops.length === 0) return false;
  // Outer loop inclusion minus inner (ring) exclusion via even-odd toggling.
  let inside = false;
  for (const loop of loops) if (pointInLoop(world, loop)) inside = !inside;
  return inside;
}

/** Connector position in world space (mm). */
export function connectorWorld(part: Part, c: Connector): Vec2 {
  return partToWorld(part, c.position);
}

/** Connector facing direction in world space (degrees, CW, 0 = +X). */
export function connectorWorldOrientation(part: Part, c: Connector): number {
  return c.orientation + part.transform.rotation;
}
