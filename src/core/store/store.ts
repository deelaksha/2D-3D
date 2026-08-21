/**
 * The single source-of-truth store.
 *
 * - `project` is the persistent document (parts, connectors, assembly...).
 * - `ui` is ephemeral editor state (selection, mode, camera, tool...).
 *
 * The store is a plain framework-independent observable so the core stays
 * decoupled from React (see the useStore hook in ./hooks). Undo/redo snapshots
 * ONLY the project via structuredClone — robust and inverse-free, which keeps
 * the many independently-authored mutation helpers simple.
 */
import { useSyncExternalStore } from "react";
import type { IssueLevel, Project } from "../model/types";
import { makeProject } from "../model/defaults";

export type EditorMode = "2d" | "3d" | "board";
export type PanelTab = "layers" | "parts";
export type StatusLevel = IssueLevel | "info";

export interface Camera2D {
  x: number;
  y: number;
  zoom: number;
}

export interface GridState {
  size: number; // mm
  snap: boolean;
  visible: boolean;
}

export interface UIState {
  mode: EditorMode;
  activeToolId: string;
  /** Selected part ids in the 2D canvas / layer panel. */
  selection: string[];
  /** Primary/active part (drives the inspector + connector editing). */
  activePartId: string | null;
  hoverConnectorId: string | null;
  selectedConnectorId: string | null;
  panelTab: PanelTab;
  camera2d: Camera2D;
  grid: GridState;
  showConnectorLabels: boolean;
  showDimensions: boolean;
  commandPaletteOpen: boolean;
  /** When the palette is opened from a menu, restrict it to this tool category. */
  paletteScope: string | null;
  /** Part currently being dragged from the parts list into the 3D scene. */
  draggingPartId: string | null;
  statusMessage: string;
  statusLevel: StatusLevel;
  /** Ids of tools recently used, most-recent first (for the palette). */
  recentToolIds: string[];
  favoriteToolIds: string[];
}

export interface StoreState {
  project: Project;
  ui: UIState;
}

interface HistoryEntry {
  label: string;
  project: Project;
}

type Listener = () => void;

function initialUI(): UIState {
  return {
    mode: "2d",
    activeToolId: "transform.move",
    selection: [],
    activePartId: null,
    hoverConnectorId: null,
    selectedConnectorId: null,
    panelTab: "parts",
    camera2d: { x: 0, y: 0, zoom: 1 },
    grid: { size: 10, snap: true, visible: true },
    showConnectorLabels: false, // labels are contextual by default; toggle shows all
    showDimensions: true,
    commandPaletteOpen: false,
    paletteScope: null,
    draggingPartId: null,
    statusMessage: "Ready",
    statusLevel: "info",
    recentToolIds: [],
    favoriteToolIds: [],
  };
}

const clone = <T,>(o: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(o)
    : (JSON.parse(JSON.stringify(o)) as T);

class Store {
  private state: StoreState;
  private listeners = new Set<Listener>();
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private readonly limit = 200;
  /** When a gesture is active, project snapshot taken at its start. All commits
   * made during the gesture coalesce into ONE history entry pushed on end. */
  private gestureBase: Project | null = null;

  constructor() {
    this.state = { project: makeProject(), ui: initialUI() };
  }

  getState = (): StoreState => this.state;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    this.state = { ...this.state }; // new top ref so useSyncExternalStore fires
    for (const l of this.listeners) l();
  }

  /* ---- UI (non-undoable) ---- */

  setUI(patch: Partial<UIState> | ((ui: UIState) => Partial<UIState>)) {
    const delta = typeof patch === "function" ? patch(this.state.ui) : patch;
    this.state.ui = { ...this.state.ui, ...delta };
    this.emit();
  }

  status(message: string, level: StatusLevel = "info") {
    this.state.ui = { ...this.state.ui, statusMessage: message, statusLevel: level };
    this.emit();
  }

  /* ---- Project mutations (undoable) ---- */

  /**
   * Apply a mutation to a cloned project draft and push it onto the undo stack.
   * The recipe MUST mutate the draft in place (it is a private clone).
   */
  commit(label: string, recipe: (draft: Project) => void) {
    const draft = clone(this.state.project);
    recipe(draft);
    // During a gesture, don't push per-step history — the gesture pushes one
    // combined entry on end. This keeps a drag / multi-step action = one undo.
    if (this.gestureBase === null) {
      this.past.push({ label, project: this.state.project });
      if (this.past.length > this.limit) this.past.shift();
      this.future = [];
    }
    this.state.project = draft;
    this.emit();
  }

  /**
   * Mutate the document WITHOUT recording history (e.g. changing the display
   * unit — a view preference that shouldn't clutter undo). Still autosaves.
   */
  patchSilent(recipe: (draft: Project) => void) {
    const draft = clone(this.state.project);
    recipe(draft);
    this.state.project = draft;
    this.emit();
  }

  /* ---- Gestures: coalesce many commits into one undo step ---- */

  /**
   * Reference-counted so interleaved gestures (e.g. a keyboard action fired
   * mid-drag) nest instead of prematurely closing the outer gesture. Only the
   * outermost begin snapshots the base and only the outermost end pushes history.
   */
  private gestureDepth = 0;

  /** Begin (or nest into) a gesture — a drag or compound multi-commit action. */
  beginGesture() {
    if (this.gestureDepth === 0) this.gestureBase = this.state.project;
    this.gestureDepth++;
  }

  /** End a gesture; when the outermost one closes, push ONE history entry. */
  endGesture(label: string) {
    if (this.gestureDepth === 0) return; // unbalanced end — ignore
    this.gestureDepth--;
    if (this.gestureDepth > 0) return; // still inside an outer gesture
    const base = this.gestureBase;
    this.gestureBase = null;
    if (base && base !== this.state.project) {
      this.past.push({ label, project: base });
      if (this.past.length > this.limit) this.past.shift();
      this.future = [];
    }
    this.emit(); // refresh canUndo/redo affordances (they read past/future)
  }

  /** Abort the entire gesture stack, restoring the pre-gesture snapshot. */
  cancelGesture() {
    const base = this.gestureBase;
    this.gestureBase = null;
    this.gestureDepth = 0;
    if (base && base !== this.state.project) {
      this.state.project = base;
    }
    this.emit();
  }

  /** Replace the whole document (import / new project). Clears history. */
  loadProject(project: Project, label = "Load project") {
    this.past = [];
    this.future = [];
    this.gestureBase = null;
    this.gestureDepth = 0;
    this.state = { project: clone(project), ui: { ...this.state.ui, selection: [], activePartId: null } };
    this.status(label, "info");
    this.emit();
  }

  canUndo = () => this.past.length > 0;
  canRedo = () => this.future.length > 0;
  undoLabel = () => this.past.at(-1)?.label ?? null;
  redoLabel = () => this.future.at(-1)?.label ?? null;

  undo() {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push({ label: prev.label, project: this.state.project });
    this.state.project = prev.project;
    this.status(`Undo: ${prev.label}`, "info");
    this.emit();
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push({ label: next.label, project: this.state.project });
    this.state.project = next.project;
    this.status(`Redo: ${next.label}`, "info");
    this.emit();
  }
}

/** The application-wide singleton store. */
export const store = new Store();

/* ------------------------------------------------------------------ */
/* React binding                                                       */
/* ------------------------------------------------------------------ */

/** Subscribe a component to a derived slice of the store. */
export function useStore<T>(selector: (s: StoreState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

export const useProject = () => useStore((s) => s.project);
export const useUI = () => useStore((s) => s.ui);
