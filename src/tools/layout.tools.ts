/**
 * Layout / view tools: grid, snap, zoom, and display toggles. All are
 * "command" tools that flip flags on the store's UI state directly.
 */
import { store } from "../core/store/store";
import type { ToolDefinition } from "./toolTypes";

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 20;

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function gridPresetTool(size: number): ToolDefinition {
  return {
    id: `layout.grid${size}`,
    name: `Grid ${size} mm`,
    category: "layout",
    icon: "▦",
    description: `Set grid spacing to ${size} mm`,
    hint: `Snaps drawing points to a ${size} mm grid.`,
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["grid", "spacing", "snap", String(size)],
    undoable: false,
    execute: () => {
      store.setUI((ui) => ({ grid: { ...ui.grid, size } }));
      store.status(`Grid size set to ${size} mm`, "info");
    },
    isEnabled: () => true,
  };
}

export const layoutTools: ToolDefinition[] = [
  {
    id: "layout.toggleGrid",
    name: "Toggle Grid",
    category: "layout",
    icon: "▦",
    description: "Show or hide the background grid",
    hint: "Toggles the visible reference grid on the 2D canvas.",
    shortcut: "G",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["grid", "show", "hide", "background"],
    undoable: false,
    execute: () => {
      const visible = !store.getState().ui.grid.visible;
      store.setUI((ui) => ({ grid: { ...ui.grid, visible } }));
      store.status(visible ? "Grid shown" : "Grid hidden", "info");
    },
    isEnabled: () => true,
  },
  {
    id: "layout.toggleSnap",
    name: "Toggle Snap",
    category: "layout",
    icon: "◇",
    description: "Snap drawing and moving to the grid",
    hint: "When on, new points and moves lock to the nearest grid intersection.",
    shortcut: "Shift+G",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["snap", "grid", "magnet"],
    undoable: false,
    execute: () => {
      const snap = !store.getState().ui.grid.snap;
      store.setUI((ui) => ({ grid: { ...ui.grid, snap } }));
      store.status(snap ? "Snap to grid on" : "Snap to grid off", "info");
    },
    isEnabled: () => true,
  },
  gridPresetTool(1),
  gridPresetTool(2),
  gridPresetTool(5),
  gridPresetTool(10),
  gridPresetTool(20),
  {
    id: "layout.toggleConnectorLabels",
    name: "Toggle Connector Labels",
    category: "layout",
    icon: "🏷",
    description: "Show or hide connector name labels",
    hint: "Labels each connector glyph with its name on the canvas.",
    tooltipAnimation: "tab-slot",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["connector", "labels", "names", "tags"],
    undoable: false,
    execute: () => {
      const showConnectorLabels = !store.getState().ui.showConnectorLabels;
      store.setUI({ showConnectorLabels });
      store.status(showConnectorLabels ? "Connector labels shown" : "Connector labels hidden", "info");
    },
    isEnabled: () => true,
  },
  {
    id: "layout.toggleDimensions",
    name: "Toggle Dimensions",
    category: "layout",
    icon: "📏",
    description: "Show or hide measurement dimensions",
    hint: "Toggles the visibility of dimension lines drawn on parts.",
    tooltipAnimation: "move",
    supportedModes: ["2d", "3d"],
    kind: "command",
    keywords: ["dimensions", "measurements", "measure"],
    undoable: false,
    execute: () => {
      const showDimensions = !store.getState().ui.showDimensions;
      store.setUI({ showDimensions });
      store.status(showDimensions ? "Dimensions shown" : "Dimensions hidden", "info");
    },
    isEnabled: () => true,
  },
  {
    id: "layout.zoomIn",
    name: "Zoom In",
    category: "layout",
    icon: "🔍+",
    description: "Zoom the canvas in",
    hint: "Increases the 2D camera zoom level.",
    shortcut: "+",
    tooltipAnimation: "move",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["zoom", "in", "magnify"],
    undoable: false,
    execute: () => {
      const zoom = clampZoom(store.getState().ui.camera2d.zoom * 1.25);
      store.setUI((ui) => ({ camera2d: { ...ui.camera2d, zoom } }));
      store.status("Zoomed in", "info");
    },
    isEnabled: () => true,
  },
  {
    id: "layout.zoomOut",
    name: "Zoom Out",
    category: "layout",
    icon: "🔍-",
    description: "Zoom the canvas out",
    hint: "Decreases the 2D camera zoom level.",
    shortcut: "-",
    tooltipAnimation: "move",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["zoom", "out", "shrink"],
    undoable: false,
    execute: () => {
      const zoom = clampZoom(store.getState().ui.camera2d.zoom / 1.25);
      store.setUI((ui) => ({ camera2d: { ...ui.camera2d, zoom } }));
      store.status("Zoomed out", "info");
    },
    isEnabled: () => true,
  },
  {
    id: "layout.zoomFit",
    name: "Zoom to Fit",
    category: "layout",
    icon: "⛶",
    description: "Fit all parts in the view",
    hint: "Resets pan and picks a zoom level that fits the whole project.",
    shortcut: "Shift+1",
    tooltipAnimation: "move",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["zoom", "fit", "frame", "all"],
    undoable: false,
    execute: (ctx) => {
      const parts = ctx.project.parts;
      if (parts.length === 0) {
        store.setUI({ camera2d: { x: 0, y: 0, zoom: 1 } });
        store.status("Nothing to fit — view reset", "info");
        return;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const part of parts) {
        const t = part.transform;
        const half = Math.max(part.shape.width ?? 0, part.shape.height ?? 0);
        minX = Math.min(minX, t.x - half);
        minY = Math.min(minY, t.y - half);
        maxX = Math.max(maxX, t.x + half);
        maxY = Math.max(maxY, t.y + half);
      }
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const span = Math.max(maxX - minX, maxY - minY, 100);
      const zoom = clampZoom(600 / span);
      store.setUI({ camera2d: { x: cx, y: cy, zoom } });
      store.status("Zoomed to fit", "info");
    },
    isEnabled: (ctx) => ctx.project.parts.length >= 0,
  },
  {
    id: "layout.resetView",
    name: "Reset View",
    category: "layout",
    icon: "⟲",
    description: "Reset pan and zoom to default",
    hint: "Returns the 2D camera to its starting position and zoom.",
    shortcut: "Shift+0",
    tooltipAnimation: "move",
    supportedModes: ["2d"],
    kind: "command",
    keywords: ["reset", "view", "camera", "home"],
    undoable: false,
    execute: () => {
      store.setUI({ camera2d: { x: 0, y: 0, zoom: 1 } });
      store.status("View reset", "info");
    },
    isEnabled: () => true,
  },
];
