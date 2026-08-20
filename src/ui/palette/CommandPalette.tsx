import { useEffect, useMemo, useRef, useState } from "react";
import { store, useUI } from "@/core/store/store";
import { registry } from "@/tools/registry";
import { activateTool } from "@/tools/runtime";
import { CATEGORY_META } from "@/tools/toolTypes";
import type { ToolCategory } from "@/tools/toolTypes";

/** Global fuzzy command palette: search + run any registered tool. Ctrl/Cmd+K.
 * When opened from a top menu, `paletteScope` limits it to one tool category. */
export default function CommandPalette() {
  const ui = useUI();
  const open = ui.commandPaletteOpen;
  const scope = ui.paletteScope as ToolCategory | null;
  const scopeMeta = scope ? CATEGORY_META[scope] : null;
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => {
    const q = query.trim();
    let list = q ? registry.search(q, 200) : scope ? registry.byCategory(scope) : registry.search("", 40);
    if (scope) list = list.filter((t) => t.category === scope);
    return list.slice(0, 80);
  }, [query, open, scope]);

  // Reset transient state whenever the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  // Autofocus the input on open.
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  // Keep the active index in range as results change.
  useEffect(() => {
    setActiveIndex((i) => {
      if (results.length === 0) return 0;
      return Math.min(i, results.length - 1);
    });
  }, [results]);

  // Scroll active item into view.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  function close() {
    store.setUI({ commandPaletteOpen: false, paletteScope: null });
  }

  function runItem(id: string) {
    activateTool(id);
    store.setUI({ commandPaletteOpen: false, paletteScope: null });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) runItem(item.id);
    }
  }

  return (
    <div
      className="wk-palette-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="wk-palette" role="dialog" aria-modal="true" aria-label="Search tools and commands">
        {scopeMeta && (
          <div className="wk-palette__scope">
            <span className="wk-palette__scopechip">
              <span aria-hidden="true">{scopeMeta.icon}</span>
              {scopeMeta.label}
              <button
                type="button"
                className="wk-palette__scopeclear"
                title="Show all tools"
                onClick={() => store.setUI({ paletteScope: null })}
              >
                ×
              </button>
            </span>
          </div>
        )}
        <input
          ref={inputRef}
          className="wk-palette__input"
          type="text"
          placeholder={scopeMeta ? `Search ${scopeMeta.label}…` : "Search tools & commands…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="wk-palette__list" ref={listRef}>
          {results.length === 0 && (
            <div className="wk-palette__item wk-palette__item--empty">
              <span className="wk-palette__meta">
                <div className="wk-palette__desc">No matching tools</div>
              </span>
            </div>
          )}
          {results.map((tool, i) => {
            const meta = CATEGORY_META[tool.category];
            return (
              <div
                key={tool.id}
                className={
                  "wk-palette__item" + (i === activeIndex ? " wk-palette__item--active" : "")
                }
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => runItem(tool.id)}
              >
                <span className="wk-palette__icon">{tool.icon}</span>
                <span className="wk-palette__meta">
                  <div className="wk-palette__name">{tool.name}</div>
                  <div className="wk-palette__desc">{tool.description}</div>
                </span>
                <span className="wk-palette__cat">{meta.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
