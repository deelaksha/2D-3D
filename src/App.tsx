import { Component, lazy, Suspense, useEffect, useState, type PointerEvent, type ReactNode } from "react";
import { makeProject } from "./core/model/defaults";
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
import CanvasBoard from "./ui/board/CanvasBoard";
import CommandPalette from "./ui/palette/CommandPalette";
import JointsPanel from "./ui/panels/JointsPanel";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("App Error Boundary caught error:", error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem("woodkit.project");
    } catch {}
    store.loadProject(makeProject(), "Reset project");
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--wk-bg, #0f1117)", color: "var(--wk-ink, #f1f5f9)", fontFamily: "sans-serif", padding: 20, textAlign: "center" }}>
          <h2 style={{ fontSize: 22, color: "#ef4444", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ maxWidth: 500, opacity: 0.8, fontSize: 14, marginBottom: 12 }}>
            An unexpected UI error occurred. You can attempt to recover your workspace session or start fresh.
          </p>
          {this.state.error?.message && (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: 10, borderRadius: 6, fontSize: 11, color: "#f87171", maxWidth: 550, marginBottom: 16, textAlign: "left", fontFamily: "monospace" }}>
              {this.state.error.message}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{ padding: "10px 18px", background: "#3b82f6", color: "#ffffff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
            >
              🔄 Recover Session
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              style={{ padding: "10px 18px", background: "#ef8c3b", color: "#ffffff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
            >
              Reset & Start Fresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** The right-hand column: parts, layers, and joint authoring + inspector. */
function RightColumn(props: { onResizeStart: (event: PointerEvent<HTMLDivElement>) => void }) {
  const { onResizeStart } = props;
  const ui = useUI();
  return (
    <div className="wk-panel" style={{ display: "flex", flexDirection: "column" }}>
      <div
        className="wk-panel-resize-grip"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize side panel"
        onPointerDown={onResizeStart}
      />
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
        <button
          className={"wk-tab" + (ui.panelTab === "joints" ? " wk-tab--active" : "")}
          onClick={() => store.setUI({ panelTab: "joints" })}
        >
          Joints
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {ui.panelTab === "layers" ? <LayersPanel /> : ui.panelTab === "joints" ? <JointsPanel /> : <PartsPanel />}
      </div>
      <div style={{ borderTop: "1px solid var(--wk-border)", maxHeight: "48%", overflow: "auto" }}>
        <Inspector />
      </div>
    </div>
  );
}

function AppContent() {
  const ui = useUI();
  const [leftPanelOpen, setLeftPanelOpen] = useState(() => window.innerWidth >= 900);
  const [leftPanelWidth, setLeftPanelWidth] = useState(236);
  const [rightPanelOpen, setRightPanelOpen] = useState(() => window.innerWidth >= 900);
  const [rightPanelWidth, setRightPanelWidth] = useState(304);

  const startRightPanelResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    const onMove = (moveEvent: globalThis.PointerEvent) => {
      setRightPanelWidth(Math.max(260, Math.min(640, window.innerWidth - moveEvent.clientX)));
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };
  const toggleRightPanel = () => setRightPanelOpen((open) => !open);
  const toggleLeftPanel = () => setLeftPanelOpen((open) => !open);

  const startLeftPanelResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    const onMove = (moveEvent: globalThis.PointerEvent) => {
      setLeftPanelWidth(Math.max(180, Math.min(420, moveEvent.clientX)));
    };
    const onEnd = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

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

  // 3D is a clean preview: top bar + 3D canvas.
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

  // Board is the dedicated printable sheet layout & nesting page.
  if (ui.mode === "board") {
    return (
      <div className="wk-app wk-app--board">
        <TopBar />
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <CanvasBoard />
        </div>
      </div>
    );
  }

  return (
    <div
      className="wk-app"
      style={{ gridTemplateColumns: `${leftPanelOpen ? leftPanelWidth : 0}px minmax(0, 1fr) ${rightPanelOpen ? rightPanelWidth : 0}px` }}
    >
      <TopBar
        onToggleLeftPanel={toggleLeftPanel}
        isLeftPanelOpen={leftPanelOpen}
        onToggleRightPanel={toggleRightPanel}
        isRightPanelOpen={rightPanelOpen}
      />
      <div className={`wk-left${leftPanelOpen ? "" : " wk-left--collapsed"}`}>
        <LeftToolbox />
        <div
          className="wk-panel-resize-grip wk-panel-resize-grip--right"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize tool panel"
          onPointerDown={startLeftPanelResize}
        />
      </div>
      <div className="wk-canvas">
        <Canvas2D />
      </div>
      <div
        className={`wk-right${rightPanelOpen ? "" : " wk-right--collapsed"}`}
      >
        <RightColumn onResizeStart={startRightPanelResize} />
      </div>
      <StatusBar />
      {ui.commandPaletteOpen && <CommandPalette />}
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
