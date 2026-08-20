/**
 * PartsPanel — flat list of every part in the project ("House" root), each row
 * selectable. Shows a connector-count badge and the part's material chip.
 */
import { useProject, useUI } from "@/core/store/store";
import { createPart, selectOne } from "@/core/store/actions";
import { materialOf } from "@/core/model/defaults";
import type { Part } from "@/core/model/types";

/** Pick readable black/white text for an arbitrary background color (WCAG luminance). */
function readableInk(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#1a1d23";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.42 ? "#1a1d23" : "#ffffff";
}

export default function PartsPanel() {
  const project = useProject();
  const ui = useUI();

  const parts: Part[] = [...project.parts].sort((a, b) => a.order - b.order);

  return (
    <div className="wk-panel wk-parts-panel">
      <div className="wk-panel__head">Parts</div>

      <div className="wk-parts-root">
        <span className="wk-parts-root__icon" aria-hidden="true">
          🏠
        </span>
        <span className="wk-parts-root__name">House</span>
        <span className="wk-badge">{parts.length}</span>
      </div>

      <div className="wk-parts-list">
        {parts.length === 0 && (
          <div className="wk-parts-empty">No parts yet — add one below.</div>
        )}
        {parts.map((part) => {
          const material = materialOf(project, part.materialId);
          const active = ui.selection.includes(part.id);
          return (
            <div
              key={part.id}
              className={`wk-row${active ? " wk-row--active" : ""}`}
              onClick={() => selectOne(part.id)}
              title={`${part.name} — ${part.connectors.length} connector${part.connectors.length === 1 ? "" : "s"}`}
            >
              <span className="wk-row__icon" aria-hidden="true">
                ▤
              </span>
              <span className="wk-row__name">{part.name}</span>
              <span
                className="wk-chip"
                style={{ backgroundColor: material.color, color: readableInk(material.color) }}
                title={material.name}
              >
                {material.name}
              </span>
              <span className="wk-badge" title={`${part.connectors.length} connectors`}>
                <span aria-hidden="true">◆</span> {part.connectors.length}
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="wk-btn wk-parts-add"
        onClick={() => createPart("New Part")}
      >
        + Add Part
      </button>
    </div>
  );
}
