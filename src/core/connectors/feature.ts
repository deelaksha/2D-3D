/**
 * Connector → geometry. A connector is not just a marker: it changes the board.
 *  - a RECEIVER (female) cuts an opening   → a `subtract` modifier
 *  - an INSERT   (male)   adds a plug that pokes out → a `union` modifier
 *  - a NEUTRAL feature (magnet/hinge/surface) changes nothing
 *
 * The insert's plug and the receiver's socket use the SAME footprint (round for
 * peg/dowel/hole, rectangular or custom pattern for dovetail/puzzle/tslot/teeth)
 * so a male plug exactly fills the female socket it mates with.
 */
import type { BooleanOp, Connector, ConnectorRole, ConnectorType, Shape, ShapeKind } from "../model/types";
import { makeShape } from "../model/defaults";
import { connectorFamily } from "./compat";

/** Round features mate by diameter; everything else uses a rectangular or custom pattern footprint. */
const ROUND_TYPES: readonly ConnectorType[] = ["peg", "dowel", "hole"];

/** The default role for a freshly-placed connector, from its type's family. */
export function defaultRole(type: ConnectorType): ConnectorRole {
  if (type === "custom") return "custom";
  const fam = connectorFamily(type);
  return fam === "receive" ? "receiver" : fam === "insert" ? "insert" : "neutral";
}

/** The effective role of a connector (explicit `role`, derived from type, respecting inverted polarity). */
export function connectorRole(c: Connector): ConnectorRole {
  let role = c.role ?? defaultRole(c.type);
  if (c.inverted) {
    if (role === "insert") role = "receiver";
    else if (role === "receiver") role = "insert";
  }
  return role;
}

/** Footprint size of a connector's plug/socket in mm: { w, h, round }. */
function footprint(c: Connector): { w: number; h: number; round: boolean } {
  const round = ROUND_TYPES.includes(c.type);
  if (round) {
    const d = c.diameter && c.diameter > 0 ? c.diameter : Math.max(4, Math.min(c.width || 8, c.height || 8));
    return { w: d, h: d, round: true };
  }
  return { w: Math.max(2, c.width || 10), h: Math.max(2, c.height || 6), round: false };
}

/**
 * The board-geometry a connector contributes, or null for neutral connectors.
 * `op` is "subtract" for a receiver socket, "union" for an insert plug.
 * Shape coordinates are in the part's LOCAL frame (same frame as c.position).
 */
export function connectorFeature(c: Connector): { op: BooleanOp; shape: Shape } | null {
  const role = connectorRole(c);
  if (role === "neutral") return null;

  const pattern = c.pattern ?? "standard";
  const round = pattern === "peg_hole" || ROUND_TYPES.includes(c.type);
  const { w, h } = footprint(c);

  let kind: ShapeKind = round ? "circle" : c.type === "slot" ? "slot" : "rect";
  let radius: number | undefined = undefined;

  // Pattern & Type Shape Mapping for 2D wooden joints
  if (pattern === "dovetail" || c.type === "custom") {
    kind = "trapezoid";
  } else if (pattern === "shoulder") {
    kind = "trapezoid";
  } else if (pattern === "halflap") {
    kind = "rect";
  } else if (pattern === "finger" || pattern === "teeth") {
    kind = "rect";
  } else if (pattern === "peg_hole") {
    kind = "circle";
  } else if (pattern === "puzzle") {
    kind = "capsule";
    radius = Math.min(w, h) / 2;
  } else if (pattern === "tslot") {
    kind = "slot";
  } else if (pattern === "wave") {
    kind = "roundedRect";
    radius = Math.min(w, h) / 3;
  }

  const isInsert = role === "insert";

  // For an insert plug, push outward along the facing direction
  let cx = c.position.x;
  let cy = c.position.y;
  if (isInsert) {
    const rad = (c.orientation * Math.PI) / 180;
    const reach = (round ? w : h) / 2; // half the depth in the facing direction
    cx += Math.cos(rad) * reach;
    cy += Math.sin(rad) * reach;
  }

  const shape = makeShape(kind, {
    x: cx - w / 2,
    y: cy - h / 2,
    width: w,
    height: h,
    rotation: round ? 0 : c.orientation,
    radius,
  });

  const op: BooleanOp = isInsert ? "union" : "subtract";

  return { op, shape };
}
