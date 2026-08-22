/**
 * Boolean (combine) tools: union, subtract ("Cut Shape"), intersect, divide.
 * These operate on the current selection (ctx.selection), treating the first
 * selected part as the target and the second as the tool shape.
 */
import { store } from "@/core/store/store";
import { addModifier, deletePart, selectOne } from "@/core/store/actions";
import type { Part } from "@/core/model/types";
import type { ToolContext, ToolDefinition } from "./toolTypes";

function findTargetAndTool(ctx: ToolContext): { target: Part; tool: Part } | null {
  if (ctx.selection.length < 2) return null;
  const target = ctx.project.parts.find((p) => p.id === ctx.selection[0]);
  const tool = ctx.project.parts.find((p) => p.id === ctx.selection[1]);
  if (!target || !tool) return null;
  return { target, tool };
}

/** A drawn tool part has its own world transform; modifiers live in the target
 * part's local coordinates. Rebase it so a profile stays exactly where it was
 * drawn before it is marked as a 2D connector or receiver. */
function shapeInTarget(target: Part, tool: Part) {
  const shape = structuredClone(tool.shape);
  const dx = tool.transform.x - target.transform.x;
  const dy = tool.transform.y - target.transform.y;
  shape.x += dx; shape.y += dy;
  shape.rotation += tool.transform.rotation - target.transform.rotation;
  if (shape.nodes) shape.nodes = shape.nodes.map((node) => ({ ...node, x: node.x + dx, y: node.y + dy, cIn: node.cIn && { x: node.cIn.x + dx, y: node.cIn.y + dy }, cOut: node.cOut && { x: node.cOut.x + dx, y: node.cOut.y + dy } }));
  return shape;
}

export const booleanTools: ToolDefinition[] = [
  {
    id: "boolean.union",
    name: "Union",
    category: "boolean",
    icon: "⬒",
    description: "Merge two shapes into one",
    hint: "Select two parts, then Union to visually merge them by adding the second as an overlay outline on the first.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["merge", "combine", "join shapes"],
    undoable: true,
    execute: (ctx) => {
      const pair = findTargetAndTool(ctx);
      if (!pair) {
        store.status("Select two parts to union.", "warning");
        return;
      }
      const { target, tool } = pair;
      addModifier(target.id, "union", shapeInTarget(target, tool), tool.name || "Drawn plug");
      deletePart(tool.id);
      selectOne(target.id);
      store.status(`Merged ${tool.name} into ${target.name}.`, "info");
    },
  },
  {
    id: "boolean.subtract",
    name: "Cut Shape",
    category: "boolean",
    icon: "⊖",
    description: "Cut one shape out of another",
    hint: "Select the part to keep first, then the shape to cut out — the second shape is removed and carved out of the first.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["subtract", "cutout", "hole", "carve"],
    undoable: true,
    execute: (ctx) => {
      const pair = findTargetAndTool(ctx);
      if (!pair) {
        store.status("Select a target part, then a cutting shape, to Cut Shape.", "warning");
        return;
      }
      const { target, tool } = pair;
      addModifier(target.id, "subtract", shapeInTarget(target, tool), tool.name || "Drawn cutout");
      deletePart(tool.id);
      selectOne(target.id);
      store.status(`Cut ${tool.name} out of ${target.name}.`, "info");
    },
  },
  {
    id: "boolean.intersect",
    name: "Intersect",
    category: "boolean",
    icon: "◈",
    description: "Keep only the overlapping area",
    hint: "Select two parts; the second part becomes an intersect modifier that keeps only the shared area with the first.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["overlap", "common area"],
    undoable: true,
    execute: (ctx) => {
      const pair = findTargetAndTool(ctx);
      if (!pair) {
        store.status("Select two parts to intersect.", "warning");
        return;
      }
      const { target, tool } = pair;
      addModifier(target.id, "intersect", shapeInTarget(target, tool), "intersect");
      deletePart(tool.id);
      store.status(`Intersected ${target.name} with ${tool.name}.`, "info");
    },
  },
  {
    id: "boolean.divide",
    name: "Divide",
    category: "boolean",
    icon: "⊘",
    description: "Split a shape along another shape's outline",
    hint: "Select two parts; the second shape's outline divides the first, recorded as a subtract modifier marking the split line.",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["split", "cut apart"],
    undoable: true,
    execute: (ctx) => {
      const pair = findTargetAndTool(ctx);
      if (!pair) {
        store.status("Select two parts to divide.", "warning");
        return;
      }
      const { target, tool } = pair;
      addModifier(target.id, "subtract", shapeInTarget(target, tool), "divide");
      deletePart(tool.id);
      store.status(`Divided ${target.name} using ${tool.name}.`, "info");
    },
  },
];
