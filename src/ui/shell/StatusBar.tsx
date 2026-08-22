import type { ChangeEvent } from "react";
import { store, useProject, useUI } from "@/core/store/store";
import type { Unit } from "@/core/model/types";
import { registry } from "@/tools/registry";

/** Bottom status bar: status message, counts, zoom, unit selector, tool count. */
export default function StatusBar() {
  const project = useProject();
  const ui = useUI();

  const partCount = project.parts.length;
  const zoomPct = Math.round(ui.camera2d.zoom * 100);

  function handleUnitChange(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value as Unit;
    // Display unit is a view preference — change it without polluting undo history.
    store.patchSilent((d) => {
      d.meta.displayUnit = value;
    });
  }

  return (
    <div className="wk-status">
      <span className={`wk-status__dot wk-status__dot--${ui.statusLevel}`} />
      <span className="wk-status__message">{ui.statusMessage}</span>
      <span className="wk-status__sep" />
      <span className="wk-status__item">{partCount} parts</span>
      <span className="wk-status__item">Zoom {zoomPct}%</span>
      <span className="wk-status__item">
        <select
          className="wk-status__unit"
          aria-label="Display unit"
          title="Display unit"
          value={project.meta.displayUnit}
          onChange={handleUnitChange}
        >
          <option value="mm">mm</option>
          <option value="cm">cm</option>
          <option value="inch">inch</option>
        </select>
      </span>
      <span className="wk-status__item">{registry.size} tools</span>
    </div>
  );
}
