/**
 * Material tools: set the material of the selected/active part(s) to a
 * given MaterialKind, finding an existing project material of that kind or
 * creating one if none exists yet.
 */
import { addMaterial, setPartMaterial } from "@/core/store/actions";
import { makeMaterial } from "@/core/model/defaults";
import type { MaterialKind } from "@/core/model/types";
import type { ToolContext, ToolDefinition } from "./toolTypes";

function targetPartIds(ctx: ToolContext): string[] {
  if (ctx.selection.length > 0) return ctx.selection;
  if (ctx.activePartId) return [ctx.activePartId];
  return [];
}

function applyMaterialKind(ctx: ToolContext, kind: MaterialKind): void {
  const ids = targetPartIds(ctx);
  if (ids.length === 0) return;

  let material = ctx.project.materials.find((m) => m.kind === kind);
  if (!material) {
    material = makeMaterial(kind);
    addMaterial(material);
  }

  for (const id of ids) {
    setPartMaterial(id, material.id);
  }
}

function makeMaterialTool(
  name: string,
  kind: MaterialKind,
  icon: string,
  description: string,
  hint: string,
  keywords: string[],
): ToolDefinition {
  return {
    id: `material.${kind}`,
    name,
    category: "material",
    icon,
    description,
    hint,
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords,
    undoable: true,
    execute: (ctx) => applyMaterialKind(ctx, kind),
    isEnabled: (ctx) => targetPartIds(ctx).length > 0,
  };
}

export const materialTools: ToolDefinition[] = [
  makeMaterialTool(
    "Plywood",
    "plywood",
    "🪵",
    "Make it out of sturdy plywood",
    "Sets the selected part(s) material to plywood — strong layered wood, great for panels.",
    ["wood", "ply", "panel", "sturdy"],
  ),
  makeMaterialTool(
    "MDF",
    "mdf",
    "🟫",
    "Make it out of smooth MDF board",
    "Sets the selected part(s) material to MDF — smooth, easy to cut, and paint-friendly.",
    ["board", "fiberboard", "smooth"],
  ),
  makeMaterialTool(
    "Cardboard",
    "cardboard",
    "📦",
    "Make it out of light cardboard",
    "Sets the selected part(s) material to cardboard — light, cheap, perfect for prototypes.",
    ["box", "paper", "prototype", "light"],
  ),
  makeMaterialTool(
    "Acrylic",
    "acrylic",
    "🟦",
    "Make it out of clear acrylic",
    "Sets the selected part(s) material to acrylic — smooth, glossy, and see-through plastic.",
    ["plastic", "clear", "glossy", "glass"],
  ),
  makeMaterialTool(
    "Solid Wood",
    "solidwood",
    "🌳",
    "Make it out of solid natural wood",
    "Sets the selected part(s) material to solid wood — a natural, classic, hardy build material.",
    ["timber", "natural", "hardwood", "tree"],
  ),
  makeMaterialTool(
    "Foam",
    "foamboard",
    "⬜",
    "Make it out of soft foam board",
    "Sets the selected part(s) material to foam — soft, lightweight, and easy to shape.",
    ["soft", "board", "lightweight", "styrofoam"],
  ),
];
