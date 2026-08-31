/**
 * Orientation-aware mating math shared by every auto-mate path:
 *  - actions.ts connectPortPair (2D/3D snap on "Connect pair")
 *  - build3d.ts calculateMatingTransform (3D join)
 *  - assembly/validate.ts expectedMateCandidates (drift check)
 *
 * Purely geometric — driven only by each connector's own `.orientation`
 * (world facing direction, degrees CW, 0 = +X) and the source part's
 * placed rotation, so it works identically for every connector type/pattern,
 * including hand-drawn custom connectors.
 */
import type { Vec2 } from "../model/types";

/** A named placement edge — kept here (not model/types.ts) since it's a
 * builder/preview concept, not part of the persisted connector schema. */
export type Edge = "top" | "right" | "bottom" | "left" | "center";

/** Wrap a degree value into [0, 360). */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** The direction a receiver must face to directly oppose a connector's
 * facing direction (e.g. right/0° -> left/180°). */
export function oppositeOrientation(deg: number): number {
  return normalizeDeg(deg + 180);
}

/** Outward-normal default for each named placement edge (matches
 * actions.ts calcEdgePosition — kept here so the 2D preview can render the
 * same convention without re-deriving it). */
export const EDGE_ORIENTATION: Record<Edge, number> = {
  top: 270,
  right: 0,
  bottom: 90,
  left: 180,
  center: 0,
};

export function edgeOrientation(edge: Edge): number {
  return EDGE_ORIENTATION[edge] ?? 0;
}

/** The named edge geometrically opposite `edge` (top<->bottom, left<->right). */
export function oppositeEdge(edge: Edge): Edge {
  switch (edge) {
    case "top": return "bottom";
    case "bottom": return "top";
    case "left": return "right";
    case "right": return "left";
    default: return "center";
  }
}

/** Rotate a 2D vector by `deg` degrees CW (matches THREE's rotation.z
 * convention used for part Placements, and the 2D orientation convention). */
function rotateCW(v: Vec2, deg: number): Vec2 {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/**
 * The relative part rotation (world Z, degrees) a target part must adopt so
 * its connector's world-space facing direction is anti-parallel to the
 * source connector's — i.e. the two features actually face each other
 * instead of merely lining up in parallel. Generalizes to any relative
 * orientation (0/90/180/270/arbitrary), not just a fixed direction.
 */
export function mateRotationZ(sourceRotZ: number, sourceOrientation: number, targetOrientation: number): number {
  return normalizeDeg(sourceRotZ + (sourceOrientation - targetOrientation) + 180);
}

/**
 * World-space XY position a target part must be placed at so its connector
 * coincides with the (already placed) source connector, given the target's
 * own rotation (from mateRotationZ). Connector-local Y is negated to match
 * the Y-down 2D canvas vs Y-up placement convention used everywhere else in
 * the codebase (e.g. `sourcePos.y - sourceConn.position.y`).
 */
export function mateTargetXY(
  sourcePos: Vec2,
  sourceRotZ: number,
  sourceConnPos: Vec2,
  targetRotZ: number,
  targetConnPos: Vec2,
): Vec2 {
  const worldSourceConnOffset = rotateCW({ x: sourceConnPos.x, y: -sourceConnPos.y }, sourceRotZ);
  const worldSourceConn = { x: sourcePos.x + worldSourceConnOffset.x, y: sourcePos.y + worldSourceConnOffset.y };
  const targetConnOffset = rotateCW({ x: targetConnPos.x, y: -targetConnPos.y }, targetRotZ);
  return { x: worldSourceConn.x - targetConnOffset.x, y: worldSourceConn.y - targetConnOffset.y };
}
