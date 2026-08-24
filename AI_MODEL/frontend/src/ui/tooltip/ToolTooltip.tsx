/**
 * ToolTooltip — a rich, animated tooltip shown when hovering a tool button.
 * It is fixed-positioned at the given {x, y} and renders the tool's title,
 * icon, a looping animated demo of the action, the description, an optional
 * hint, and the keyboard shortcut.
 */
import type { ToolDefinition } from "@/tools/toolTypes";
import { ToolAnimation } from "./animations";

export interface ToolTooltipProps {
  tool: ToolDefinition;
  /** Fixed viewport x (px) for the tooltip's left edge. */
  x: number;
  /** Fixed viewport y (px) for the tooltip's top edge. */
  y: number;
}

/** Render each key of a shortcut string ("Ctrl+D") as its own .wk-kbd chip. */
function renderShortcut(shortcut: string): JSX.Element {
  const keys = shortcut.split("+").map((k) => k.trim()).filter(Boolean);
  return (
    <span>
      {keys.map((key, i) => (
        <span key={i}>
          {i > 0 ? " + " : null}
          <kbd className="wk-kbd">{key}</kbd>
        </span>
      ))}
    </span>
  );
}

/**
 * ToolTooltip — floating card describing a tool. Non-interactive
 * (`pointer-events: none` via `.wk-tooltip`) so it never steals hover.
 */
export default function ToolTooltip({ tool, x, y }: ToolTooltipProps): JSX.Element {
  // Keep the card inside the viewport (tools low in the list would overflow).
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.min(x, vw - 252);
  const top = Math.max(8, Math.min(y, vh - 232));
  return (
    <div className="wk-tooltip" style={{ left, top }} role="tooltip">
      <div className="wk-tooltip__title">
        <span aria-hidden="true">{tool.icon}</span>
        <span>{tool.name}</span>
      </div>
      <div className="wk-tooltip__stage">
        <ToolAnimation id={tool.tooltipAnimation} icon={tool.icon} />
      </div>
      <div className="wk-tooltip__desc">{tool.description}</div>
      {tool.hint ? (
        <div className="wk-tooltip__desc" style={{ marginTop: 6, opacity: 0.85 }}>
          {tool.hint}
        </div>
      ) : null}
      {tool.shortcut ? (
        <div className="wk-tooltip__kbd">
          Shortcut: {renderShortcut(tool.shortcut)}
        </div>
      ) : null}
    </div>
  );
}
