/**
 * Transform tools: move/rotate/scale/mirror gestures the canvas drives
 * interactively (kind "transform"), plus one-shot commands (rotate90,
 * mirror, align, distribute, reorder) that act on the current selection via
 * the semantic actions in core/store/actions.
 */
import { store } from "../core/store/store";
import { updatePart, updatePartTransform } from "../core/store/actions";
import { partBoundsWorld } from "../core/geometry";
import type { Bounds, Part } from "../core/model/types";
import type { ToolContext, ToolDefinition } from "./toolTypes";

/** Selected parts if any, else the active part (as a single-item list). */
function targetIds(ctx: ToolContext): string[] {
  if (ctx.selection.length) return ctx.selection;
  return ctx.activePartId ? [ctx.activePartId] : [];
}

function targetParts(ctx: ToolContext): Part[] {
  const ids = new Set(targetIds(ctx));
  return ctx.project.parts.filter((p) => ids.has(p.id));
}

function unionBounds(bounds: Bounds[]): Bounds {
  return bounds.reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX),
    minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX),
    maxY: Math.max(acc.maxY, b.maxY),
  }));
}

/** Shift a part's world position by (dx, dy) — translation commutes with the
 * rest of the transform, so nudging transform.x/y moves the world bounds by
 * exactly the same delta. */
function nudge(part: Part, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  updatePartTransform(part.id, { x: part.transform.x + dx, y: part.transform.y + dy }, "Align");
}

function alignParts(
  ctx: ToolContext,
  axis: "x" | "y",
  edge: "min" | "center" | "max",
  label: string,
): void {
  const parts = targetParts(ctx);
  if (parts.length < 2) {
    store.status(`${label}: select at least 2 parts`, "warning");
    return;
  }
  const boundsByPart = parts.map((p) => ({ part: p, bounds: partBoundsWorld(p) }));
  const union = unionBounds(boundsByPart.map((b) => b.bounds));
  const target =
    edge === "min"
      ? axis === "x"
        ? union.minX
        : union.minY
      : edge === "max"
        ? axis === "x"
          ? union.maxX
          : union.maxY
        : axis === "x"
          ? (union.minX + union.maxX) / 2
          : (union.minY + union.maxY) / 2;
  for (const { part, bounds } of boundsByPart) {
    const current =
      edge === "min"
        ? axis === "x"
          ? bounds.minX
          : bounds.minY
        : edge === "max"
          ? axis === "x"
            ? bounds.maxX
            : bounds.maxY
          : axis === "x"
            ? (bounds.minX + bounds.maxX) / 2
            : (bounds.minY + bounds.maxY) / 2;
    const delta = target - current;
    if (axis === "x") nudge(part, delta, 0);
    else nudge(part, 0, delta);
  }
  store.status(label, "info");
}

function distributeParts(ctx: ToolContext, axis: "x" | "y", label: string): void {
  const parts = targetParts(ctx);
  if (parts.length < 3) {
    store.status(`${label}: select at least 3 parts`, "warning");
    return;
  }
  const items = parts
    .map((p) => ({ part: p, bounds: partBoundsWorld(p) }))
    .sort((a, b) =>
      axis === "x" ? a.bounds.minX - b.bounds.minX : a.bounds.minY - b.bounds.minY,
    );
  const first = items[0];
  const last = items[items.length - 1];
  const spanStart = axis === "x" ? first.bounds.minX : first.bounds.minY;
  const spanEnd = axis === "x" ? last.bounds.maxX : last.bounds.maxY;
  const totalSize = items.reduce(
    (sum, it) =>
      sum + (axis === "x" ? it.bounds.maxX - it.bounds.minX : it.bounds.maxY - it.bounds.minY),
    0,
  );
  const gap = (spanEnd - spanStart - totalSize) / (items.length - 1);
  let cursor = spanStart;
  for (const it of items) {
    const size = axis === "x" ? it.bounds.maxX - it.bounds.minX : it.bounds.maxY - it.bounds.minY;
    const currentStart = axis === "x" ? it.bounds.minX : it.bounds.minY;
    const delta = cursor - currentStart;
    if (axis === "x") nudge(it.part, delta, 0);
    else nudge(it.part, 0, delta);
    cursor += size + gap;
  }
  store.status(label, "info");
}

function reorderRelative(ctx: ToolContext, direction: "forward" | "backward", label: string): void {
  const ids = targetIds(ctx);
  if (!ids.length) {
    store.status(`${label}: nothing selected`, "warning");
    return;
  }
  const sorted = [...ctx.project.parts].sort((a, b) => a.order - b.order);
  for (const id of ids) {
    const idx = sorted.findIndex((p) => p.id === id);
    if (idx < 0) continue;
    const neighborIdx = direction === "forward" ? idx + 1 : idx - 1;
    if (neighborIdx < 0 || neighborIdx >= sorted.length) continue;
    const self = sorted[idx];
    const neighbor = sorted[neighborIdx];
    const selfOrder = self.order;
    const neighborOrder = neighbor.order;
    updatePart(self.id, { order: neighborOrder }, label);
    updatePart(neighbor.id, { order: selfOrder }, label);
    // Keep the local snapshot consistent in case of multi-id passes.
    self.order = neighborOrder;
    neighbor.order = selfOrder;
    sorted.sort((a, b) => a.order - b.order);
  }
}

export const transformTools: ToolDefinition[] = [
  {
    id: "transform.move",
    name: "Move",
    category: "transform",
    icon: "✥",
    description: "Drag a part to move it around",
    hint: "Click and drag a selected part on the canvas to reposition it. Hold nothing extra — snapping follows the grid setting.",
    shortcut: "V",
    tooltipAnimation: "move",
    supportedModes: ["2d"],
    kind: "transform",
    transformMode: "move",
    keywords: ["drag", "position", "translate"],
    undoable: true,
  },
  {
    id: "transform.rotate90",
    name: "Rotate 90°",
    category: "transform",
    icon: "↻",
    description: "Spin the selected parts a quarter turn",
    hint: "Rotates every selected part 90° clockwise around its own origin.",
    tooltipAnimation: "rotate",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["turn", "quarter turn", "spin"],
    undoable: true,
    execute: (ctx) => {
      const ids = targetIds(ctx);
      if (!ids.length) {
        store.status("Rotate 90°: nothing selected", "warning");
        return;
      }
      for (const id of ids) {
        const part = ctx.project.parts.find((p) => p.id === id);
        if (!part) continue;
        const rotation = (part.transform.rotation + 90) % 360;
        updatePartTransform(id, { rotation }, "Rotate 90°");
      }
      store.status("Rotated 90°", "info");
    },
  },
  {
    id: "transform.rotate",
    name: "Rotate",
    category: "transform",
    icon: "🔄",
    description: "Freely spin a part to any angle",
    hint: "Drag near a selected part's handle to rotate it to any angle. Angles are degrees, clockwise, 0° = pointing right.",
    shortcut: "T",
    tooltipAnimation: "rotate",
    supportedModes: ["2d"],
    kind: "transform",
    transformMode: "rotate",
    keywords: ["spin", "angle", "turn"],
    undoable: true,
  },
  {
    id: "transform.scale",
    name: "Scale",
    category: "transform",
    icon: "⤢",
    description: "Grow or shrink a part by dragging",
    hint: "Drag a selected part's corner handle to resize it proportionally.",
    tooltipAnimation: "scale",
    supportedModes: ["2d"],
    kind: "transform",
    transformMode: "scale",
    keywords: ["resize", "grow", "shrink", "size"],
    undoable: true,
  },
  {
    id: "transform.mirrorX",
    name: "Flip Left/Right",
    category: "transform",
    icon: "⇋",
    description: "Mirror the selected parts left-to-right",
    hint: "Flips every selected part horizontally in place, like a mirror image.",
    tooltipAnimation: "flip",
    supportedModes: ["2d"],
    kind: "command",
    transformMode: "mirrorX",
    keywords: ["mirror", "flip horizontal"],
    undoable: true,
    execute: (ctx) => {
      const ids = targetIds(ctx);
      if (!ids.length) {
        store.status("Flip Left/Right: nothing selected", "warning");
        return;
      }
      for (const id of ids) {
        const part = ctx.project.parts.find((p) => p.id === id);
        if (!part) continue;
        updatePartTransform(id, { flipX: !part.transform.flipX }, "Flip Left/Right");
      }
      store.status("Flipped left/right", "info");
    },
  },
  {
    id: "transform.mirrorY",
    name: "Flip Up/Down",
    category: "transform",
    icon: "⇅",
    description: "Mirror the selected parts top-to-bottom",
    hint: "Flips every selected part vertically in place, like a mirror image.",
    tooltipAnimation: "flip",
    supportedModes: ["2d"],
    kind: "command",
    transformMode: "mirrorY",
    keywords: ["mirror", "flip vertical"],
    undoable: true,
    execute: (ctx) => {
      const ids = targetIds(ctx);
      if (!ids.length) {
        store.status("Flip Up/Down: nothing selected", "warning");
        return;
      }
      for (const id of ids) {
        const part = ctx.project.parts.find((p) => p.id === id);
        if (!part) continue;
        updatePartTransform(id, { flipY: !part.transform.flipY }, "Flip Up/Down");
      }
      store.status("Flipped up/down", "info");
    },
  },
  {
    id: "transform.alignLeft",
    name: "Align Left",
    category: "transform",
    icon: "⫷",
    description: "Line up parts to their leftmost edge",
    hint: "Moves the selected parts so their left edges all touch the leftmost edge of the selection.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["align", "left edge"],
    undoable: true,
    execute: (ctx) => alignParts(ctx, "x", "min", "Align Left"),
  },
  {
    id: "transform.alignCenterH",
    name: "Align Center (Horizontal)",
    category: "transform",
    icon: "⫶",
    description: "Line up parts on a shared vertical centerline",
    hint: "Moves the selected parts so their horizontal centers all line up.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["align", "center", "middle horizontal"],
    undoable: true,
    execute: (ctx) => alignParts(ctx, "x", "center", "Align Center (Horizontal)"),
  },
  {
    id: "transform.alignRight",
    name: "Align Right",
    category: "transform",
    icon: "⫸",
    description: "Line up parts to their rightmost edge",
    hint: "Moves the selected parts so their right edges all touch the rightmost edge of the selection.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["align", "right edge"],
    undoable: true,
    execute: (ctx) => alignParts(ctx, "x", "max", "Align Right"),
  },
  {
    id: "transform.alignTop",
    name: "Align Top",
    category: "transform",
    icon: "⫹",
    description: "Line up parts to their topmost edge",
    hint: "Moves the selected parts so their top edges all touch the topmost edge of the selection.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["align", "top edge"],
    undoable: true,
    execute: (ctx) => alignParts(ctx, "y", "min", "Align Top"),
  },
  {
    id: "transform.alignCenterV",
    name: "Align Middle (Vertical)",
    category: "transform",
    icon: "⫴",
    description: "Line up parts on a shared horizontal centerline",
    hint: "Moves the selected parts so their vertical centers all line up.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["align", "center", "middle vertical"],
    undoable: true,
    execute: (ctx) => alignParts(ctx, "y", "center", "Align Middle (Vertical)"),
  },
  {
    id: "transform.alignBottom",
    name: "Align Bottom",
    category: "transform",
    icon: "⫺",
    description: "Line up parts to their bottommost edge",
    hint: "Moves the selected parts so their bottom edges all touch the bottommost edge of the selection.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["align", "bottom edge"],
    undoable: true,
    execute: (ctx) => alignParts(ctx, "y", "max", "Align Bottom"),
  },
  {
    id: "transform.distributeH",
    name: "Distribute Horizontally",
    category: "transform",
    icon: "⇹",
    description: "Space parts out evenly left to right",
    hint: "Keeps the leftmost and rightmost parts in place and spaces the rest so the gaps between them are equal.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["distribute", "space evenly", "horizontal"],
    undoable: true,
    execute: (ctx) => distributeParts(ctx, "x", "Distribute Horizontally"),
  },
  {
    id: "transform.distributeV",
    name: "Distribute Vertically",
    category: "transform",
    icon: "⇳",
    description: "Space parts out evenly top to bottom",
    hint: "Keeps the topmost and bottommost parts in place and spaces the rest so the gaps between them are equal.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["distribute", "space evenly", "vertical"],
    undoable: true,
    execute: (ctx) => distributeParts(ctx, "y", "Distribute Vertically"),
  },
  {
    id: "transform.bringForward",
    name: "Bring Forward",
    category: "transform",
    icon: "⬆",
    description: "Move a part one step up in the stack",
    hint: "Swaps the selected part's stacking order with the part directly above it.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["stacking order", "z-order", "front"],
    undoable: true,
    execute: (ctx) => reorderRelative(ctx, "forward", "Bring Forward"),
  },
  {
    id: "transform.sendBackward",
    name: "Send Backward",
    category: "transform",
    icon: "⬇",
    description: "Move a part one step down in the stack",
    hint: "Swaps the selected part's stacking order with the part directly below it.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["stacking order", "z-order", "back"],
    undoable: true,
    execute: (ctx) => reorderRelative(ctx, "backward", "Send Backward"),
  },
];
