/**
 * Joinery tools: classic woodworking joints, applied to the active part as a
 * real connector (or set of connectors) at a sensible edge position.
 */
import { addConnector, setPartShape } from "../core/store/actions";
import { store } from "../core/store/store";
import type { Part, PathPoint } from "../core/model/types";
import type { ToolContext, ToolDefinition } from "./toolTypes";

/**
 * Build a rectangle outline whose BOTTOM edge is cut into interlocking teeth
 * (a comb / finger joint). `phase` 0 keeps teeth at even segments, 1 at odd —
 * so two parts with opposite phase mesh: one part's teeth fill the other's
 * gaps. The teeth are cut INWARD so the part keeps its footprint. This single
 * toothed edge acts as BOTH the connector and the receiver.
 */
function toothedBottomEdge(p: Part, teeth: number, depth: number, phase: 0 | 1): PathPoint[] {
  const x0 = p.shape.x;
  const y0 = p.shape.y;
  const w = p.shape.width;
  const h = p.shape.height;
  const segs = Math.max(2, Math.round(teeth) * 2);
  const seg = w / segs;
  const d = Math.min(depth, h * 0.6);
  const nodes: PathPoint[] = [
    { x: x0, y: y0 }, //         top-left
    { x: x0 + w, y: y0 }, //     top-right
    { x: x0 + w, y: y0 + h }, // bottom-right (start of toothed edge)
  ];
  for (let i = segs - 1; i >= 0; i--) {
    const isFinger = i % 2 === phase;
    const yEdge = isFinger ? y0 + h : y0 + h - d; // gaps notch inward
    nodes.push({ x: x0 + (i + 1) * seg, y: yEdge });
    nodes.push({ x: x0 + i * seg, y: yEdge });
  }
  return nodes; // closes back up the left side to top-left
}

/** Reshape the active part's bottom edge into a toothed comb. */
function applyTeeth(ctx: ToolContext, teeth: number, phase: 0 | 1, label: string): void {
  const p = ctx.activePart;
  if (!p) {
    store.status("Select a part first, then cut teeth into its edge.", "warning");
    return;
  }
  // Square-ish teeth: finger depth ≈ finger width, clamped so it stays a sane
  // fraction of the part. For a perpendicular (L-shaped) join the finger length
  // represents how far it reaches into the mating part.
  const seg = p.shape.width / Math.max(2, Math.round(teeth) * 2);
  const depth = Math.min(seg, p.shape.height * 0.4);
  const nodes = toothedBottomEdge(p, teeth, depth, phase);
  setPartShape(p.id, { kind: "polygon", nodes, closed: true, rotation: 0 });
  store.status(
    `${label} cut into ${p.name}. Give the perpendicular part the ${
      phase === 0 ? '"Teeth Edge (Mate)"' : '"Teeth Edge"'
    } with the same tooth count so they interlock.`,
    "ok",
  );
}

/** Bottom-center edge point of the active part's local bounds, mm. */
function bottomCenter(ctx: ToolContext): { x: number; y: number } {
  const p = ctx.activePart;
  if (!p) return { x: 0, y: 0 };
  return { x: p.width / 2, y: p.height };
}

function rightCenter(ctx: ToolContext): { x: number; y: number } {
  const p = ctx.activePart;
  if (!p) return { x: 0, y: 0 };
  return { x: p.width, y: p.height / 2 };
}

function needsActivePart(ctx: ToolContext): boolean {
  if (!ctx.activePart) {
    store.status("Select a part first to add joinery.", "warning");
    return false;
  }
  return true;
}

export const joineryTools: ToolDefinition[] = [
  {
    id: "joinery.fingerJoint",
    name: "Teeth Edge",
    category: "joinery",
    icon: "⊔",
    description: "Cut interlocking teeth into the edge — acts as connector AND receiver.",
    hint: "Carves a comb of teeth into the part's bottom edge. Another part with the matching 'Teeth Edge (Mate)' slots straight in — the teeth fill the gaps. Rotate the part to put teeth on a different edge.",
    tooltipAnimation: "tab-slot",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["teeth", "comb", "finger joint", "cutter", "edge", "interlock", "connector"],
    undoable: true,
    parameters: [
      { id: "teeth", label: "Teeth", type: "number", default: 5, min: 2, max: 24, step: 1 },
    ],
    execute: (ctx) => {
      const teeth = Number(ctx.params.teeth ?? 5);
      applyTeeth(ctx, teeth, 0, "Teeth edge");
    },
  },
  {
    id: "joinery.boxJoint",
    name: "Teeth Edge (Mate)",
    category: "joinery",
    icon: "⊓",
    description: "The matching comb — its teeth line up with the other part's gaps.",
    hint: "Cuts the complementary teeth pattern (opposite phase) into the bottom edge, so it meshes with a 'Teeth Edge' part.",
    tooltipAnimation: "tab-slot",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["teeth", "comb", "mate", "receiver", "cutter", "edge", "interlock"],
    undoable: true,
    parameters: [
      { id: "teeth", label: "Teeth", type: "number", default: 5, min: 2, max: 24, step: 1 },
    ],
    execute: (ctx) => {
      const teeth = Number(ctx.params.teeth ?? 5);
      applyTeeth(ctx, teeth, 1, "Mating teeth edge");
    },
  },
  {
    id: "joinery.dovetail",
    name: "Dovetail",
    category: "joinery",
    icon: "⊟",
    description: "Fan-shaped tabs that lock and resist pulling apart.",
    hint: "Adds an angled tab (pin) shaped like a fan, so the joint can't slide back out.",
    tooltipAnimation: "tab-slot",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["dovetail", "tail", "pin"],
    undoable: true,
    execute: (ctx) => {
      if (!needsActivePart(ctx)) return;
      const p = ctx.activePart!;
      const pos = bottomCenter(ctx);
      addConnector(p.id, "tab", pos, {
        name: "Dovetail Tail",
        width: p.width * 0.3,
        height: p.thickness,
        depth: p.thickness * 1.2,
        orientation: 90,
        tolerance: 0.15,
      });
      store.status(`Added a dovetail tab to ${p.name}.`, "ok");
    },
  },
  {
    id: "joinery.mortise",
    name: "Mortise",
    category: "joinery",
    icon: "⊟",
    description: "A pocket cut to receive a matching tenon.",
    hint: "Adds a rectangular slot (the socket) that a tenon peg fits snugly into.",
    tooltipAnimation: "cut-hole",
    supportedModes: ["2d"],
    kind: "command",
    createsConnector: "slot",
    keywords: ["mortise", "socket", "pocket"],
    undoable: true,
    execute: (ctx) => {
      if (!needsActivePart(ctx)) return;
      const p = ctx.activePart!;
      const pos = { x: p.width / 2, y: p.height / 2 };
      addConnector(p.id, "slot", pos, {
        name: "Mortise",
        width: Math.min(p.width * 0.2, 20),
        height: Math.min(p.height * 0.2, 20),
        depth: p.thickness * 0.75,
        orientation: 0,
        tolerance: 0.1,
      });
      store.status(`Added a mortise pocket to ${p.name}.`, "ok");
    },
  },
  {
    id: "joinery.tenon",
    name: "Tenon",
    category: "joinery",
    icon: "⊟",
    description: "A tongue that plugs into a matching mortise.",
    hint: "Adds a tab (the tongue) sized to slide into a mortise pocket on another part.",
    tooltipAnimation: "tab-slot",
    supportedModes: ["2d"],
    kind: "command",
    createsConnector: "tab",
    keywords: ["tenon", "tongue", "peg"],
    undoable: true,
    execute: (ctx) => {
      if (!needsActivePart(ctx)) return;
      const p = ctx.activePart!;
      const pos = bottomCenter(ctx);
      addConnector(p.id, "tab", pos, {
        name: "Tenon",
        width: Math.min(p.width * 0.2, 20),
        height: p.thickness,
        depth: p.thickness * 0.75,
        orientation: 90,
        tolerance: 0.1,
      });
      store.status(`Added a tenon tab to ${p.name}.`, "ok");
    },
  },
  {
    id: "joinery.rabbet",
    name: "Rabbet",
    category: "joinery",
    icon: "⊟",
    description: "A stepped groove along an edge for a panel to sit in.",
    hint: "Adds a notch running along the edge so another panel can rest flush inside it.",
    tooltipAnimation: "cut-hole",
    supportedModes: ["2d"],
    kind: "command",
    createsConnector: "notch",
    keywords: ["rabbet", "rebate", "groove"],
    undoable: true,
    execute: (ctx) => {
      if (!needsActivePart(ctx)) return;
      const p = ctx.activePart!;
      const pos = rightCenter(ctx);
      addConnector(p.id, "notch", pos, {
        name: "Rabbet",
        width: p.thickness,
        height: p.height * 0.8,
        depth: p.thickness * 0.5,
        orientation: 0,
        tolerance: 0.1,
      });
      store.status(`Added a rabbet notch to ${p.name}.`, "ok");
    },
  },
  {
    id: "joinery.lapJoint",
    name: "Lap Joint",
    category: "joinery",
    icon: "⊟",
    description: "Overlapping half-thickness notches that sit flush together.",
    hint: "Adds a wide, shallow notch so a matching part can overlap and sit flush.",
    tooltipAnimation: "cut-hole",
    supportedModes: ["2d"],
    kind: "command",
    createsConnector: "notch",
    keywords: ["lap", "half-lap", "overlap"],
    undoable: true,
    execute: (ctx) => {
      if (!needsActivePart(ctx)) return;
      const p = ctx.activePart!;
      const pos = { x: p.width / 2, y: 0 };
      addConnector(p.id, "notch", pos, {
        name: "Lap Joint",
        width: p.width * 0.4,
        height: p.thickness,
        depth: p.thickness * 0.5,
        orientation: 270,
        tolerance: 0.1,
      });
      store.status(`Added a lap joint notch to ${p.name}.`, "ok");
    },
  },
];
