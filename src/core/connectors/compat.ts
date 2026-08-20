/**
 * Connector compatibility engine.
 *
 * Given two connectors (each with the part it lives on) this decides whether
 * they can join, how well, and WHY — in words a child could follow. The rules
 * are physical: an "insert" feature (a peg, a tab...) has to slide into a
 * matching "receive" feature (a hole, a slot...); the sizes have to fit within
 * tolerance; and the insert should suit the thickness of the panel it plugs
 * into. Everything here is a pure function — no store, no side effects.
 */
import type {
  Connector,
  ConnectionStatus,
  ConnectorType,
  Part,
} from "@/core/model/types";

/** The verdict for one connector pairing. */
export interface CompatResult {
  /** 'valid' (>=0.75) | 'possible' (0.4–0.75) | 'invalid' (<0.4) | 'unknown'. */
  status: ConnectionStatus;
  /** Fit quality in the range 0..1. */
  score: number;
  /** Friendly, human-readable explanation. */
  reason: string;
}

/** One side of a pairing: the connector and the part it belongs to. */
interface Side {
  part: Part;
  connector: Connector;
}

/* ------------------------------------------------------------------ */
/* Families                                                            */
/* ------------------------------------------------------------------ */

const INSERT_TYPES: readonly ConnectorType[] = [
  "peg",
  "dowel",
  "tab",
  "snap",
  "corner",
];

const RECEIVE_TYPES: readonly ConnectorType[] = [
  "hole",
  "slot",
  "notch",
  "edge",
];

/** Round insert features that mate by diameter into a hole. */
const ROUND_INSERTS: readonly ConnectorType[] = ["peg", "dowel"];

/**
 * Which family a connector type belongs to.
 * insert = something that pokes out; receive = something that takes it in;
 * neutral = features that mate face-to-face (magnets, hinges, plain surfaces).
 */
export function connectorFamily(
  t: ConnectorType,
): "insert" | "receive" | "neutral" {
  if (INSERT_TYPES.includes(t)) return "insert";
  if (RECEIVE_TYPES.includes(t)) return "receive";
  return "neutral";
}

/* ------------------------------------------------------------------ */
/* Complementary pairs                                                 */
/* ------------------------------------------------------------------ */

/** Unordered list of the connector types that are designed to join. */
const COMPLEMENTARY_PAIRS: ReadonlyArray<readonly [ConnectorType, ConnectorType]> =
  [
    ["tab", "slot"],
    ["peg", "hole"],
    ["dowel", "hole"],
    ["tab", "notch"],
    ["snap", "slot"],
    ["magnet", "magnet"],
    ["surface", "surface"],
    ["hinge", "hinge"],
    ["edge", "edge"],
    ["edge", "tab"],
  ];

/** True when the two types are meant to be joined together. */
export function areTypesComplementary(
  a: ConnectorType,
  b: ConnectorType,
): boolean {
  return COMPLEMENTARY_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  );
}

/**
 * The single best mating type for a connector — its "opposite". Turning a Tab
 * into its complement gives a Slot; a Hole gives a Peg; and so on. Neutral
 * features (magnet/hinge/surface) mate with their own kind.
 */
const COMPLEMENT: Record<ConnectorType, ConnectorType> = {
  tab: "slot",
  slot: "tab",
  peg: "hole",
  hole: "peg",
  dowel: "hole",
  notch: "tab",
  snap: "slot",
  edge: "edge",
  corner: "corner",
  magnet: "magnet",
  surface: "surface",
  hinge: "hinge",
};

export function complementType(t: ConnectorType): ConnectorType {
  return COMPLEMENT[t] ?? t;
}

/** A short phrase naming what a given feature is looking for. */
function partnerWanted(t: ConnectorType): string {
  switch (t) {
    case "peg":
    case "dowel":
      return "a hole to slot into";
    case "tab":
      return "a slot or a notch to slide into";
    case "snap":
      return "a slot to snap into";
    case "slot":
      return "a tab or a snap to hold";
    case "notch":
      return "a tab to grab";
    case "hole":
      return "a peg or dowel to fill it";
    case "edge":
      return "another edge (or a tab) to meet";
    case "corner":
      return "a matching corner joint";
    case "magnet":
      return "another magnet to stick to";
    case "surface":
      return "another flat surface to press against";
    case "hinge":
      return "another hinge to swing with";
    default:
      return "a matching partner";
  }
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/** Effective round diameter of a connector (explicit, else its smaller side). */
function roundDiameter(c: Connector): number {
  if (typeof c.diameter === "number" && c.diameter > 0) return c.diameter;
  const w = c.width > 0 ? c.width : Infinity;
  const h = c.height > 0 ? c.height : Infinity;
  const d = Math.min(w, h);
  return Number.isFinite(d) ? d : 0;
}

/** Combined slack the two features allow, with a small practical floor. */
function combinedTolerance(a: Connector, b: Connector): number {
  const t = (a.tolerance || 0) + (b.tolerance || 0);
  return Math.max(0.5, t);
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * How well an insert of size `insert` sits inside a receiver of size `receive`.
 * Returns 0 for a physical impossibility (insert too big to ever fit).
 */
function fitScore(insert: number, receive: number, tol: number): number {
  const clearance = receive - insert;
  if (clearance < -tol) return 0; // insert is genuinely too big — it will not go in
  if (clearance < 0) return 0.55; // a touch oversize: a very tight press fit
  if (clearance <= tol) return 1; // snug, ideal
  const looseness = (clearance - tol) / receive; // how sloppy beyond tolerance
  return clamp01(1 - looseness);
}

/** How closely two like sizes agree (for magnet/surface/hinge/edge joins). */
function similarityScore(a: number, b: number, tol: number): number {
  const diff = Math.abs(a - b);
  if (diff <= tol) return 1;
  const rel = diff / Math.max(a, b);
  return clamp01(1 - rel);
}

interface SizeEval {
  score: number;
  /** True when there simply isn't enough size data to judge the fit. */
  noData: boolean;
  /** True for a hard physical impossibility (won't fit at all). */
  hardFail: boolean;
  note: string;
}

/** Score the geometric fit of a complementary pairing. */
function evaluateSize(a: Side, b: Side): SizeEval {
  const ca = a.connector;
  const cb = b.connector;
  const tol = combinedTolerance(ca, cb);

  const roundPair =
    (ROUND_INSERTS.includes(ca.type) && cb.type === "hole") ||
    (ROUND_INSERTS.includes(cb.type) && ca.type === "hole");

  if (roundPair) {
    const peg = ROUND_INSERTS.includes(ca.type) ? ca : cb;
    const hole = peg === ca ? cb : ca;
    const pegD = roundDiameter(peg);
    const holeD = roundDiameter(hole);
    if (pegD <= 0 || holeD <= 0) {
      return { score: 0.5, noData: true, hardFail: false, note: "" };
    }
    const s = fitScore(pegD, holeD, tol);
    if (s === 0) {
      return {
        score: 0,
        noData: false,
        hardFail: true,
        note: `the ${peg.type} is too fat (${pegD}mm) for this ${holeD}mm hole`,
      };
    }
    if (s >= 0.99) {
      return { score: s, noData: false, hardFail: false, note: "the round fit is snug" };
    }
    return { score: s, noData: false, hardFail: false, note: "the round fit is a little loose" };
  }

  const sameFamily = ca.type === cb.type || (ca.type === "edge" && cb.type === "edge");
  const neutralMatch = connectorFamily(ca.type) === "neutral" && sameFamily;

  if (neutralMatch || (ca.type === "edge" && cb.type === "edge")) {
    // Face-to-face join: the two footprints should be about the same size.
    const wa = ca.width;
    const wb = cb.width;
    const ha = ca.height;
    const hb = cb.height;
    if (wa <= 0 && wb <= 0 && ha <= 0 && hb <= 0) {
      return { score: 0.5, noData: true, hardFail: false, note: "" };
    }
    const sw = wa > 0 && wb > 0 ? similarityScore(wa, wb, tol) : 1;
    const sh = ha > 0 && hb > 0 ? similarityScore(ha, hb, tol) : 1;
    const s = Math.min(sw, sh);
    return {
      score: s,
      noData: false,
      hardFail: false,
      note: s >= 0.9 ? "the faces line up nicely" : "the faces are a bit different in size",
    };
  }

  // Rectangular insert-into-receive (tab↔slot, tab↔notch, snap↔slot, edge↔tab).
  const insert = connectorFamily(ca.type) === "insert" ? ca : cb;
  const receive = insert === ca ? cb : ca;
  const iw = insert.width;
  const ih = insert.height;
  const rw = receive.width;
  const rh = receive.height;
  if ((iw <= 0 && ih <= 0) || (rw <= 0 && rh <= 0)) {
    return { score: 0.5, noData: true, hardFail: false, note: "" };
  }
  const sw = iw > 0 && rw > 0 ? fitScore(iw, rw, tol) : 1;
  const sh = ih > 0 && rh > 0 ? fitScore(ih, rh, tol) : 1;
  const s = Math.min(sw, sh);
  if (s === 0) {
    return {
      score: 0,
      noData: false,
      hardFail: true,
      note: `the ${insert.type} is too big for this ${receive.type}`,
    };
  }
  return {
    score: s,
    noData: false,
    hardFail: false,
    note: s >= 0.9 ? "the fit is snug" : "the fit is a little loose",
  };
}

interface ThickEval {
  score: number;
  note: string;
}

/**
 * Compare how far the insert reaches to the thickness of the panel it plugs
 * into (its slot/hole is cut through that panel). A tab that matches the panel
 * thickness sits flush; too long pokes out the back; too short barely grips.
 */
function evaluateThickness(a: Side, b: Side): ThickEval {
  const ca = a.connector;
  const cb = b.connector;

  // Neutral face joins don't care about insertion depth vs thickness.
  if (
    connectorFamily(ca.type) === "neutral" ||
    connectorFamily(cb.type) === "neutral" ||
    (ca.type === "edge" && cb.type === "edge")
  ) {
    return { score: 0.7, note: "" };
  }

  const insertSide = connectorFamily(ca.type) === "insert" ? a : b;
  const receiveSide = insertSide === a ? b : a;
  const depth = insertSide.connector.depth;
  const thickness = receiveSide.part.thickness;
  if (depth <= 0 || thickness <= 0) {
    return { score: 0.6, note: "" };
  }

  const tol = combinedTolerance(ca, cb);
  const diff = depth - thickness;
  if (Math.abs(diff) <= tol) {
    return { score: 1, note: "the joint sits flush with the panel" };
  }
  if (diff > tol) {
    // Pokes out the far side — usable, but not tidy.
    const over = (diff - tol) / thickness;
    return {
      score: clamp01(0.8 - over),
      note: `the ${insertSide.connector.type} pokes past the ${Math.round(thickness)}mm panel`,
    };
  }
  // Too shallow — it won't grip the full thickness.
  const under = (-diff - tol) / thickness;
  return {
    score: clamp01(0.8 - under),
    note: `the ${insertSide.connector.type} is shorter than the ${Math.round(thickness)}mm panel`,
  };
}

/* ------------------------------------------------------------------ */
/* Status mapping                                                      */
/* ------------------------------------------------------------------ */

function statusFromScore(score: number): ConnectionStatus {
  if (score >= 0.75) return "valid";
  if (score >= 0.4) return "possible";
  return "invalid";
}

/** Does either side explicitly whitelist the other (by id or name)? */
function explicitlyAllowed(a: Side, b: Side): boolean {
  const list = (c: Connector): string[] => c.compatibleWith ?? [];
  const la = list(a.connector);
  const lb = list(b.connector);
  return (
    la.includes(b.connector.id) ||
    la.includes(b.connector.name) ||
    la.includes(b.connector.type) ||
    lb.includes(a.connector.id) ||
    lb.includes(a.connector.name) ||
    lb.includes(a.connector.type)
  );
}

/* ------------------------------------------------------------------ */
/* Public check                                                        */
/* ------------------------------------------------------------------ */

/**
 * Decide whether connector `a` and connector `b` can join, and explain why.
 */
export function checkCompatibility(a: Side, b: Side): CompatResult {
  // Missing data → we honestly can't tell.
  if (!a || !b || !a.connector || !b.connector || !a.part || !b.part) {
    return {
      status: "unknown",
      score: 0,
      reason: "I don't have enough information about one of these connectors yet.",
    };
  }

  const ca = a.connector;
  const cb = b.connector;

  // A connector cannot join itself.
  if (ca.id && ca.id === cb.id) {
    return {
      status: "invalid",
      score: 0,
      reason: "A connector can't join to itself — pick two different ones.",
    };
  }

  // An explicit allow-list beats the automatic rules.
  const whitelisted = explicitlyAllowed(a, b);

  // Complementary type check.
  if (!areTypesComplementary(ca.type, cb.type) && !whitelisted) {
    return {
      status: "invalid",
      score: 0.1,
      reason: `A ${ca.type} needs ${partnerWanted(ca.type)}, but a ${cb.type} isn't that. These don't match.`,
    };
  }

  const size = evaluateSize(a, b);
  const thick = evaluateThickness(a, b);

  // Not enough size data to be confident.
  if (size.noData && !whitelisted) {
    return {
      status: "unknown",
      score: 0.5,
      reason: `A ${ca.type} and a ${cb.type} are made to join, but I need their sizes to be sure they fit.`,
    };
  }

  // Physical impossibility overrides everything.
  if (size.hardFail) {
    return {
      status: "invalid",
      score: 0.25,
      reason: `These are the right kinds, but ${size.note} — it won't go together.`,
    };
  }

  // Weighted score: being complementary is the foundation, then fit, then depth.
  let score = 0.4 + 0.4 * clamp01(size.score) + 0.2 * clamp01(thick.score);
  if (whitelisted) score = Math.max(score, 0.85);
  score = clamp01(score);

  const status = statusFromScore(score);

  const parts: string[] = [];
  if (whitelisted) parts.push("these are marked to work together");
  if (size.note) parts.push(size.note);
  if (thick.note) parts.push(thick.note);
  const detail = parts.length ? " (" + parts.join(", ") + ")" : "";

  let reason: string;
  if (status === "valid") {
    reason = `Yes! A ${ca.type} joins a ${cb.type} beautifully${detail}.`;
  } else if (status === "possible") {
    reason = `A ${ca.type} and a ${cb.type} can join, but the fit isn't perfect${detail}.`;
  } else {
    reason = `A ${ca.type} and a ${cb.type} are meant to match, but the fit is poor${detail}.`;
  }

  return { status, score, reason };
}
