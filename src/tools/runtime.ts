/**
 * Tool runtime: the single path by which any UI surface (toolbox, command
 * palette, shortcut) invokes a tool. It builds a ToolContext from the live
 * store and either runs the tool immediately (kind "command") or arms it as
 * the active canvas tool (kind "draw"/"transform"/"connector"/"mode").
 */
import { registry } from "./registry";
import { store } from "../core/store/store";
import { findPart, setActiveTool } from "../core/store/actions";
import type { Vec2 } from "../core/model/types";
import type { ToolContext, ToolDefinition } from "./toolTypes";

/** Default parameter values declared by a tool. */
export function defaultParams(tool: ToolDefinition): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of tool.parameters ?? []) out[p.id] = p.default;
  return out;
}

/** Build a fresh ToolContext snapshot from the store. */
export function buildContext(point?: Vec2, params?: Record<string, unknown>): ToolContext {
  const { project, ui } = store.getState();
  return {
    project,
    ui,
    point,
    activePartId: ui.activePartId,
    activePart: ui.activePartId ? findPart(ui.activePartId) : undefined,
    selection: ui.selection,
    params: params ?? {},
  };
}

/**
 * Activate a tool by id. Command tools execute at once; interactive tools are
 * armed so the canvas can drive them. Returns true if handled.
 */
export function activateTool(toolId: string, point?: Vec2, params?: Record<string, unknown>): boolean {
  const tool = registry.get(toolId);
  if (!tool) return false;

  const ctx = buildContext(point, { ...defaultParams(tool), ...(params ?? {}) });
  if (tool.isEnabled && !tool.isEnabled(ctx)) {
    store.status(`${tool.name} is not available right now`, "warning");
    return false;
  }

  // Record usage regardless of kind.
  store.setUI((ui) => ({
    recentToolIds: [toolId, ...ui.recentToolIds.filter((t) => t !== toolId)].slice(0, 12),
  }));

  if (tool.kind === "command") {
    tool.execute?.(ctx);
    return true;
  }
  // Interactive tool → make it the active canvas tool.
  setActiveTool(toolId);
  store.status(`${tool.name}: ${tool.description}`, "info");
  return true;
}
