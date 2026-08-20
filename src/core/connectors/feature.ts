/**
 * Connector → geometry. A connector is not just a marker: it changes the board.
 *  - a RECEIVER (female) cuts an opening   → a `subtract` modifier
 *  - an INSERT   (male)   adds a plug that pokes out → a `union` modifier
 *  - a NEUTRAL feature (magnet/hinge/surface) changes nothing
 *
 * The insert's plug and the receiver's socket use the SAME footprint (round for
 * peg/dowel/hole, rectangular otherwise) so a male plug exactly fills the female
 * socket it mates with. The plug is pushed OUT along the connector's orientation
 * so it visibly protrudes past the board edge; the socket is centred on the edge.
 */
import type { BooleanOp, Connector, ConnectorRole, ConnectorType, Shape } from "../model/types";
import { makeShape } from "../model/defaults";
import { connectorFamily } from "./compat";

/** Round features mate by diameter; everything else uses a rectangular footprint. */
const ROUND_TYPES: readonly ConnectorType[] = ["peg", "dowel", "hole"];

/** The default role for a freshly-placed connector, from its type's family. */
export function defaultRole(type: ConnectorType): ConnectorRole {
  const fam = connectorFamily(type);
  return fam === "receive" ? "receiver" : fam === "insert" ? "insert" : "neutral";
}

/** The effective role of a connector (explicit `role`, else derived from type). */
export function connectorRole(c: Connector): ConnectorRole {
  return c.role ?? defaultRole(c.type);
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

  const { w, h, round } = footprint(c);
  const kind = round ? "circle" : c.type === "slot" ? "slot" : "rect";

  // For an insert, push the plug outward along the connector's facing direction
  // so it pokes out past the edge instead of sitting inside the board.
  let cx = c.position.x;
  let cy = c.position.y;
  if (role === "insert") {
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
  });
  return { op: role === "receiver" ? "subtract" : "union", shape };
}
