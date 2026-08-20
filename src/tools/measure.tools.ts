/**
 * Measure tools: dimensions, angle, distance, and area reporting.
 */
import type { ToolDefinition } from "./toolTypes";
import { addDimension } from "@/core/store/actions";
import { store } from "@/core/store/store";
import { partBoundsWorld } from "@/core/geometry";
import { formatLength } from "@/core/units";
import type { Bounds } from "@/core/model/types";

function activeBounds(ctx: { activePart?: import("@/core/model/types").Part }): Bounds | null {
  if (!ctx.activePart) return null;
  return partBoundsWorld(ctx.activePart);
}

function unit(): import("@/core/model/types").Unit {
  return store.getState().project.meta.displayUnit;
}

export const measureTools: ToolDefinition[] = [
  {
    id: "measure.dimHorizontal",
    name: "Horizontal Dimension",
    category: "measure",
    icon: "↔",
    description: "Show the width of the selected part",
    hint: "Draws a dimension line across the active part's horizontal extent.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["width", "measure", "dimension"],
    undoable: true,
    isEnabled: (ctx) => !!ctx.activePart,
    execute: (ctx) => {
      const b = activeBounds(ctx);
      if (!b) {
        store.status("Pick a part first to measure it", "warning");
        return;
      }
      addDimension({
        kind: "horizontal",
        a: { x: b.minX, y: b.maxY },
        b: { x: b.maxX, y: b.maxY },
        offset: 20,
      });
      store.status(`Width: ${formatLength(b.maxX - b.minX, unit())}`, "info");
    },
  },
  {
    id: "measure.dimVertical",
    name: "Vertical Dimension",
    category: "measure",
    icon: "↕",
    description: "Show the height of the selected part",
    hint: "Draws a dimension line across the active part's vertical extent.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["height", "measure", "dimension"],
    undoable: true,
    isEnabled: (ctx) => !!ctx.activePart,
    execute: (ctx) => {
      const b = activeBounds(ctx);
      if (!b) {
        store.status("Pick a part first to measure it", "warning");
        return;
      }
      addDimension({
        kind: "vertical",
        a: { x: b.maxX, y: b.minY },
        b: { x: b.maxX, y: b.maxY },
        offset: 20,
      });
      store.status(`Height: ${formatLength(b.maxY - b.minY, unit())}`, "info");
    },
  },
  {
    id: "measure.dimAligned",
    name: "Aligned Dimension",
    category: "measure",
    icon: "⤢",
    description: "Show the diagonal span of the selected part",
    hint: "Draws a dimension line along the diagonal of the active part's bounds.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["diagonal", "measure", "dimension"],
    undoable: true,
    isEnabled: (ctx) => !!ctx.activePart,
    execute: (ctx) => {
      const b = activeBounds(ctx);
      if (!b) {
        store.status("Pick a part first to measure it", "warning");
        return;
      }
      const a = { x: b.minX, y: b.minY };
      const c = { x: b.maxX, y: b.maxY };
      const dist = Math.hypot(c.x - a.x, c.y - a.y);
      addDimension({ kind: "aligned", a, b: c, offset: 15 });
      store.status(`Diagonal: ${formatLength(dist, unit())}`, "info");
    },
  },
  {
    id: "measure.radial",
    name: "Radial Dimension",
    category: "measure",
    icon: "↗",
    description: "Show the radius of a round part",
    hint: "Draws a radial dimension from the part center to its edge.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["radius", "circle", "round"],
    undoable: true,
    isEnabled: (ctx) => !!ctx.activePart,
    execute: (ctx) => {
      const b = activeBounds(ctx);
      if (!b) {
        store.status("Pick a part first to measure it", "warning");
        return;
      }
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const r = Math.min(b.maxX - b.minX, b.maxY - b.minY) / 2;
      addDimension({
        kind: "radial",
        a: { x: cx, y: cy },
        b: { x: cx + r, y: cy },
        offset: 10,
      });
      store.status(`Radius: ${formatLength(r, unit())}`, "info");
    },
  },
  {
    id: "measure.diameter",
    name: "Diameter Dimension",
    category: "measure",
    icon: "⊘",
    description: "Show the diameter of a round part",
    hint: "Draws a diameter dimension across the part's bounds.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["diameter", "circle", "round"],
    undoable: true,
    isEnabled: (ctx) => !!ctx.activePart,
    execute: (ctx) => {
      const b = activeBounds(ctx);
      if (!b) {
        store.status("Pick a part first to measure it", "warning");
        return;
      }
      const cy = (b.minY + b.maxY) / 2;
      const d = Math.min(b.maxX - b.minX, b.maxY - b.minY);
      addDimension({
        kind: "diameter",
        a: { x: b.minX, y: cy },
        b: { x: b.maxX, y: cy },
        offset: 10,
      });
      store.status(`Diameter: ${formatLength(d, unit())}`, "info");
    },
  },
  {
    id: "measure.angle",
    name: "Angle",
    category: "measure",
    icon: "∠",
    description: "Show the rotation angle of the selected part",
    hint: "Reports the active part's rotation in degrees.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["angle", "rotation", "degrees"],
    undoable: true,
    isEnabled: (ctx) => !!ctx.activePart,
    execute: (ctx) => {
      if (!ctx.activePart) {
        store.status("Pick a part first to measure its angle", "warning");
        return;
      }
      const rot = ctx.activePart.transform.rotation;
      const b = activeBounds(ctx)!;
      addDimension({
        kind: "angle",
        a: { x: b.minX, y: b.minY },
        b: { x: b.maxX, y: b.minY },
        offset: 15,
        label: `${rot.toFixed(1)}°`,
      });
      store.status(`Angle: ${rot.toFixed(1)}°`, "info");
    },
  },
  {
    id: "measure.distance",
    name: "Distance",
    category: "measure",
    icon: "📐",
    description: "Measure the distance between two selected parts",
    hint: "Reports the distance between the centers of the first two selected parts.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["distance", "measure", "gap"],
    undoable: true,
    isEnabled: (ctx) => ctx.selection.length >= 2,
    execute: (ctx) => {
      const project = ctx.project;
      const parts = ctx.selection
        .map((id) => project.parts.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p);
      if (parts.length < 2) {
        store.status("Select two parts to measure the distance between them", "warning");
        return;
      }
      const bA = partBoundsWorld(parts[0]);
      const bB = partBoundsWorld(parts[1]);
      const aCenter = { x: (bA.minX + bA.maxX) / 2, y: (bA.minY + bA.maxY) / 2 };
      const bCenter = { x: (bB.minX + bB.maxX) / 2, y: (bB.minY + bB.maxY) / 2 };
      const dist = Math.hypot(bCenter.x - aCenter.x, bCenter.y - aCenter.y);
      addDimension({ kind: "distance", a: aCenter, b: bCenter, offset: 0 });
      store.status(`Distance: ${formatLength(dist, unit())}`, "info");
    },
  },
  {
    id: "measure.area",
    name: "Area",
    category: "measure",
    icon: "▦",
    description: "Show the area of the selected part",
    hint: "Computes the bounding-box area of the active part and reports it in the status bar.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["area", "square", "surface"],
    undoable: false,
    isEnabled: (ctx) => !!ctx.activePart,
    execute: (ctx) => {
      const b = activeBounds(ctx);
      if (!b) {
        store.status("Pick a part first to measure its area", "warning");
        return;
      }
      const u = unit();
      const w = b.maxX - b.minX;
      const h = b.maxY - b.minY;
      const areaMm2 = w * h;
      const areaDisplay = areaMm2 / (u === "mm" ? 1 : u === "cm" ? 100 : 645.16);
      store.status(
        `Area: ${areaDisplay.toFixed(2)} ${u}² (${formatLength(w, u)} × ${formatLength(h, u)})`,
        "info",
      );
    },
  },
];
