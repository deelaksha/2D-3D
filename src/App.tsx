import { lazy, Suspense, useEffect } from "react";
import { store, useUI } from "./core/store/store";
import {
  clearSelection,
  copySelection,
  cutSelection,
  deleteParts,
  duplicateSelection,
  nudgeSelection,
  pasteClipboard,
  selectAll,
} from "./core/store/actions";
import { registry } from "./tools/registry";
import { activateTool } from "./tools/runtime";
import TopBar from "./ui/shell/TopBar";
import StatusBar from "./ui/shell/StatusBar";
import LeftToolbox from "./ui/toolbox/LeftToolbox";
import Canvas2D from "./ui/canvas2d/Canvas2D";
// 3D is loaded on demand so 2D users don't pay for three.js.
const Canvas3D = lazy(() => import("./ui/canvas3d/Canvas3D"));
import LayersPanel from "./ui/panels/LayersPanel";
import PartsPanel from "./ui/panels/PartsPanel";
import Inspector from "./ui/panels/Inspector";
import CommandPalette from "./ui/palette/CommandPalette";

/** The right-hand column: Parts/Layers tabs + inspector below. */
function RightColumn() {
  const ui = useUI();
  return (
    <div className="wk-panel" style={{ display: "flex", flexDirection: "column" }}>
      <div className="wk-tabs">
        <button
          className={"wk-tab" + (ui.panelTab === "parts" ? " wk-tab--active" : "")}
          onClick={() => store.setUI({ panelTab: "parts" })}
        >
          Parts
        </button>
        <button
          className={"wk-tab" + (ui.panelTab === "layers" ? " wk-tab--active" : "")}
          onClick={() => store.setUI({ panelTab: "layers" })}
        >
          Layers
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {ui.panelTab === "layers" ? <LayersPanel /> : <PartsPanel />}
      </div>
      <div style={{ borderTop: "1px solid var(--wk-border)", maxHeight: "48%", overflow: "auto" }}>
        <Inspector />
      </div>
    </div>
  );
}

export function App() {
  const ui = useUI();

  // Global keyboard: palette, undo/redo, delete, and single-key tool shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        store.setUI((s) => ({ commandPaletteOpen: !s.commandPaletteOpen }));
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        store.redo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && store.getState().ui.selection.length) {
        e.preventDefault();
        deleteParts(store.getState().ui.selection);
        return;
      }
      // Clipboard + selection commands.
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "x") {
        e.preventDefault();
        cutSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      // Arrow-key nudge (1 mm, or 10 mm with Shift) for the current selection.
      if (
        !mod &&
        (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        store.getState().ui.selection.length
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        nudgeSelection(dx, dy);
        return;
      }
      if (e.key === "Escape") {
        // Close the palette if open, otherwise clear the current selection.
        if (store.getState().ui.commandPaletteOpen) {
          store.setUI({ commandPaletteOpen: false });
        } else if (store.getState().ui.selection.length) {
          clearSelection();
        }
        return;
      }
      // Single-key tool shortcuts (only when no modifier).
      if (!mod && e.key.length === 1) {
        const key = e.key.toUpperCase();
        const tool = registry.all().find((t) => t.shortcut?.toUpperCase() === key);
        if (tool) {
          e.preventDefault();
          activateTool(tool.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 3D is a clean, read-only preview: only the top bar (to switch back) + the
  // 3D canvas. All 2D chrome (toolbox, panels, status, palette) is hidden.
  if (ui.mode === "3d") {
    return (
      <div className="wk-app wk-app--3d">
        <TopBar />
        <div className="wk-canvas">
          <Suspense
            fallback={
              <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--wk-ink-faint)" }}>
                Loading 3D preview…
              </div>
            }
          >
            <Canvas3D />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="wk-app">
      <TopBar />
      <div className="wk-left">
        <LeftToolbox />
      </div>
      <div className="wk-canvas">
        <Canvas2D />
      </div>
      <div className="wk-right">
        <RightColumn />
      </div>
      <StatusBar />
      {ui.commandPaletteOpen && <CommandPalette />}
    </div>
  );
}
