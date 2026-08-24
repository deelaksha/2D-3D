/**
 * LeftToolbox — the metadata-driven tool palette.
 *
 * Renders a search box, Favorites + Recent rows, then every tool category from
 * CATEGORY_META as a collapsible section. Tools are filtered by the active
 * editor mode and activated through the tool runtime. Hovering a tool shows a
 * live ToolTooltip positioned to the right of the button.
 */
import { useMemo, useState } from "react";
import { registry } from "@/tools/registry";
import { activateTool } from "@/tools/runtime";
import { CATEGORY_META } from "@/tools/toolTypes";
import type { ToolCategory, ToolDefinition } from "@/tools/toolTypes";
import { useUI } from "@/core/store/store";
import { toggleFavoriteTool } from "@/core/store/actions";
import ToolTooltip from "@/ui/tooltip/ToolTooltip";

interface HoverState {
  tool: ToolDefinition;
  x: number;
  y: number;
}

/** A single activatable tool button with a favourite (star) toggle. */
function ToolButton(props: {
  tool: ToolDefinition;
  active: boolean;
  favorited: boolean;
  onHover: (h: HoverState | null) => void;
}): JSX.Element {
  const { tool, active, favorited, onHover } = props;

  const place = (e: React.SyntheticEvent<HTMLElement>): void => {
    const r = e.currentTarget.getBoundingClientRect();
    onHover({ tool, x: r.right + 10, y: r.top });
  };

  return (
    <div className="wk-tool-cell">
      <button
        type="button"
        className={active ? "wk-tool wk-tool--active" : "wk-tool"}
        title={tool.name}
        aria-label={tool.name}
        aria-pressed={active}
        onClick={() => activateTool(tool.id)}
        onMouseEnter={place}
        onMouseMove={place}
        onMouseLeave={() => onHover(null)}
        onFocus={place}
        onBlur={() => onHover(null)}
      >
        <span className="wk-tool__icon" aria-hidden="true">
          {tool.icon}
        </span>
        <span className="wk-tool__label">{tool.name}</span>
      </button>
      <button
        type="button"
        className={`wk-tool__fav${favorited ? " wk-tool__fav--on" : ""}`}
        title={favorited ? "Remove from favorites" : "Add to favorites"}
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorited}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavoriteTool(tool.id);
        }}
      >
        {favorited ? "★" : "☆"}
      </button>
    </div>
  );
}

/** A grid of tool buttons. */
function ToolGrid(props: {
  tools: ToolDefinition[];
  activeToolId: string | null;
  favorites: Set<string>;
  onHover: (h: HoverState | null) => void;
}): JSX.Element {
  return (
    <div className="wk-toolgrid">
      {props.tools.map((t) => (
        <ToolButton
          key={t.id}
          tool={t}
          active={t.id === props.activeToolId}
          favorited={props.favorites.has(t.id)}
          onHover={props.onHover}
        />
      ))}
    </div>
  );
}

export default function LeftToolbox(): JSX.Element {
  const ui = useUI();
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<HoverState | null>(null);
  const [collapsed, setCollapsed] = useState<Set<ToolCategory>>(new Set());

  const q = query.trim();

  // Only tools that work in the current editor mode are shown.
  const inMode = (t: ToolDefinition): boolean => t.supportedModes.includes(ui.mode);

  // Categories ordered by CATEGORY_META.order.
  const categories = useMemo(
    () =>
      (Object.keys(CATEGORY_META) as ToolCategory[]).sort(
        (a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order,
      ),
    [],
  );

  // Search results (mode-filtered).
  const results = useMemo(
    () => (q ? registry.search(q).filter(inMode) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, ui.mode],
  );

  // Favorites + Recent rows, mapped from ids, mode-filtered, de-duped.
  const favorites = useMemo(
    () =>
      ui.favoriteToolIds
        .map((id) => registry.get(id))
        .filter((t): t is ToolDefinition => !!t && inMode(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ui.favoriteToolIds, ui.mode],
  );

  const recent = useMemo(
    () =>
      ui.recentToolIds
        .map((id) => registry.get(id))
        .filter((t): t is ToolDefinition => !!t && inMode(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ui.recentToolIds, ui.mode],
  );

  const favSet = useMemo(() => new Set(ui.favoriteToolIds), [ui.favoriteToolIds]);

  const toggleCategory = (cat: ToolCategory): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <aside className="wk-panel wk-toolbox">
      <div className="wk-toolbox__search">
        <input
          className="wk-toolbox__searchinput"
          type="search"
          placeholder="Search tools…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search tools"
        />
      </div>

      <div className="wk-toolbox__body">
      {q ? (
        <div className="wk-toolcat">
          <div className="wk-toolcat__head">
            <span className="wk-toolcat__icon" aria-hidden="true">
              🔎
            </span>
            <span className="wk-toolcat__label">Results</span>
            <span className="wk-toolcat__count">{results.length}</span>
          </div>
          {results.length > 0 ? (
            <ToolGrid tools={results} activeToolId={ui.activeToolId} favorites={favSet} onHover={setHover} />
          ) : (
            <p className="wk-toolbox__empty">No tools match “{q}”.</p>
          )}
        </div>
      ) : (
        <>
          {favorites.length > 0 && (
            <div className="wk-toolcat">
              <div className="wk-toolcat__head">
                <span className="wk-toolcat__icon" aria-hidden="true">
                  ★
                </span>
                <span className="wk-toolcat__label">Favorites</span>
                <span className="wk-toolcat__count">{favorites.length}</span>
              </div>
              <ToolGrid tools={favorites} activeToolId={null} favorites={favSet} onHover={setHover} />
            </div>
          )}

          {recent.length > 0 && (
            <div className="wk-toolcat">
              <div className="wk-toolcat__head">
                <span className="wk-toolcat__icon" aria-hidden="true">
                  🕑
                </span>
                <span className="wk-toolcat__label">Recent</span>
                <span className="wk-toolcat__count">{recent.length}</span>
              </div>
              <ToolGrid tools={recent} activeToolId={null} favorites={favSet} onHover={setHover} />
            </div>
          )}

          {categories.map((cat) => {
            const tools = registry.byCategory(cat).filter(inMode);
            if (tools.length === 0) return null;
            const meta = CATEGORY_META[cat];
            const isCollapsed = collapsed.has(cat);
            return (
              <div className="wk-toolcat" key={cat}>
                <button
                  type="button"
                  className="wk-toolcat__head wk-toolcat__toggle"
                  onClick={() => toggleCategory(cat)}
                  aria-expanded={!isCollapsed}
                >
                  <span className="wk-toolcat__caret" aria-hidden="true">
                    {isCollapsed ? "▸" : "▾"}
                  </span>
                  <span className="wk-toolcat__icon" aria-hidden="true">
                    {meta.icon}
                  </span>
                  <span className="wk-toolcat__label">{meta.label}</span>
                  <span className="wk-toolcat__count">{tools.length}</span>
                </button>
                {!isCollapsed && (
                  <ToolGrid tools={tools} activeToolId={ui.activeToolId} favorites={favSet} onHover={setHover} />
                )}
              </div>
            );
          })}
        </>
      )}
      </div>

      {hover && <ToolTooltip tool={hover.tool} x={hover.x} y={hover.y} />}
    </aside>
  );
}
