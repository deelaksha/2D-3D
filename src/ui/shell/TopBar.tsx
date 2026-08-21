import { useEffect, useRef, useState } from "react";
import { store, useProject, useUI } from "@/core/store/store";
import { makeProject } from "@/core/model/defaults";
import { downloadProject, openImportDialog } from "@/core/persist/io";
import {
  deleteParts,
  duplicateSelection,
  selectAll,
  setMode,
} from "@/core/store/actions";

import { CATEGORY_META, type ToolCategory } from "@/tools/toolTypes";

import { houseDemo } from "@/data/houseDemo";

/** Category launchers — each opens the command palette scoped to ONE category.
 * Labels are pulled from CATEGORY_META so the button matches the palette's scope chip. */
const CATEGORY_SCOPES: ToolCategory[] = ["geometry", "transform", "measure", "layout"];
const CATEGORY_MENUS = CATEGORY_SCOPES.map((scope) => ({ scope, label: CATEGORY_META[scope]?.label ?? scope }));

function openScoped(scope: string) {
  store.setUI({ commandPaletteOpen: true, paletteScope: scope });
}
function openSearch() {
  store.setUI({ commandPaletteOpen: true, paletteScope: null });
}

function handleNew() {
  const hasWork = store.getState().project.parts.length > 0;
  if (hasWork && !window.confirm("Start a new project? Your current design will be replaced. Export first if you want to keep it.")) {
    return;
  }
  store.loadProject(makeProject(), "New project");
}

type MenuItem =
  | { kind: "action"; label: string; shortcut?: string; disabled?: boolean; run: () => void }
  | { kind: "sep" };

/** A single dropdown menu (File / Edit). Closes on outside-click, Escape, or pick. */
function Dropdown(props: { label: string; open: boolean; onToggle: () => void; onClose: () => void; items: MenuItem[] }) {
  const { label, open, onToggle, onClose, items } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className="wk-dropdown" ref={ref}>
      <button
        type="button"
        className={`wk-menu__item${open ? " wk-menu__item--open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        {label} <span className="wk-menu__caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="wk-dropdown__menu" role="menu">
          {items.map((it, i) =>
            it.kind === "sep" ? (
              <div key={i} className="wk-dropdown__sep" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                className="wk-dropdown__item"
                disabled={it.disabled}
                onClick={() => {
                  onClose();
                  it.run();
                }}
              >
                <span>{it.label}</span>
                {it.shortcut && <span className="wk-dropdown__kbd">{it.shortcut}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Top bar: brand, File/Edit menus, category launchers, undo/redo, command palette. */
export default function TopBar() {
  // Re-render on both UI and project changes so undo/redo/selection-dependent
  // menu states (enabled/disabled, labels) always reflect the live store.
  useUI();
  useProject();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const close = () => setOpenMenu(null);
  const toggle = (m: string) => setOpenMenu((cur) => (cur === m ? null : m));

  const hasSelection = store.getState().ui.selection.length > 0;
  const mode = store.getState().ui.mode;

  const fileItems: MenuItem[] = [
    { kind: "action", label: "New project", run: handleNew },
    { kind: "action", label: "🏠 Load House Kit Template", run: () => store.loadProject(houseDemo(), "Loaded House Kit Template") },
    { kind: "sep" },
    { kind: "action", label: "Import…", run: () => openImportDialog() },
    { kind: "action", label: "Export…", run: () => downloadProject() },
  ];

  const editItems: MenuItem[] = [
    { kind: "action", label: "Undo", shortcut: "⌘Z", disabled: !store.canUndo(), run: () => store.undo() },
    { kind: "action", label: "Redo", shortcut: "⌘⇧Z", disabled: !store.canRedo(), run: () => store.redo() },
    { kind: "sep" },
    { kind: "action", label: "Duplicate", shortcut: "⌘D", disabled: !hasSelection, run: () => duplicateSelection() },
    { kind: "action", label: "Delete", shortcut: "⌦", disabled: !hasSelection, run: () => deleteParts(store.getState().ui.selection) },
    { kind: "sep" },
    { kind: "action", label: "Select all", shortcut: "⌘A", run: () => selectAll() },
  ];

  return (
    <div className="wk-topbar">
      <div className="wk-brand">
        <span className="wk-brand__logo">🪵</span>
        <span className="wk-brand__name">WoodKit Designer</span>
      </div>

      {/* All 2D editing chrome is hidden in the 3D preview — keep it clean. */}
      {mode !== "3d" && (
        <>
          <div className="wk-menu">
            <Dropdown label="File" open={openMenu === "File"} onToggle={() => toggle("File")} onClose={close} items={fileItems} />
            <Dropdown label="Edit" open={openMenu === "Edit"} onToggle={() => toggle("Edit")} onClose={close} items={editItems} />
            <span className="wk-menu__divider" />
            {CATEGORY_MENUS.map((m) => (
              <button
                type="button"
                key={m.label}
                className="wk-menu__item"
                onClick={() => openScoped(m.scope)}
                title={`Search ${m.label} tools`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="wk-icon-btn"
            onClick={() => store.undo()}
            disabled={!store.canUndo()}
            title={store.undoLabel() ? `Undo ${store.undoLabel()}` : "Undo"}
          >
            ↶
          </button>
          <button
            type="button"
            className="wk-icon-btn"
            onClick={() => store.redo()}
            disabled={!store.canRedo()}
            title={store.redoLabel() ? `Redo ${store.redoLabel()}` : "Redo"}
          >
            ↷
          </button>
        </>
      )}

      <div className="wk-spacer" />

      {/* Mode Switcher: 2D Design ⇄ 3D Assembly ⇄ Board Sheet Layout */}
      <div className="wk-modeswitch" role="tablist" aria-label="View mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "2d"}
          className={`wk-modeswitch__btn${mode === "2d" ? " wk-modeswitch__btn--active" : ""}`}
          onClick={() => setMode("2d")}
          title="Design in 2D"
        >
          2D
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "3d"}
          className={`wk-modeswitch__btn${mode === "3d" ? " wk-modeswitch__btn--active" : ""}`}
          onClick={() => setMode("3d")}
          title="View & join design in 3D"
        >
          3D
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "board"}
          className={`wk-modeswitch__btn${mode === "board" ? " wk-modeswitch__btn--active" : ""}`}
          onClick={() => setMode("board")}
          title="Printable board layout & nesting"
        >
          Board
        </button>
      </div>

      {mode !== "3d" && (
        <button
          type="button"
          className="wk-btn wk-btn--primary"
          onClick={openSearch}
          title="Search all tools (⌘K)"
        >
          ⌘K  Search tools
        </button>
      )}
    </div>
  );
}
