import type { ChangeEvent } from "react";
import { store, useProject, useUI } from "@/core/store/store";
import type { Unit } from "@/core/model/types";
import { registry } from "@/tools/registry";
import { connectorStatuses, validateAssembly } from "@/core/assembly/validate";

/** Bottom status bar: status message, counts, zoom, unit selector, tool count. */
export default function StatusBar() {
  const project = useProject();
  const ui = useUI();

  const partCount = project.parts.length;
  const zoomPct = Math.round(ui.camera2d.zoom * 100);
  const statuses = connectorStatuses(project);
  const joinedCount = statuses.filter((s) => s.state === "joined").length;
  const report = validateAssembly(project);

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
      {statuses.length > 0 && (
        <span
          className="wk-status__item"
          title={report.issues.length ? report.issues.map((i) => i.message).join("\n") : "All connectors joined or matched."}
        >
          {report.level !== "ok" && <span className={`wk-status__dot wk-status__dot--${report.level}`} />}
          {joinedCount}/{statuses.length} joined
          {report.issues.length > 0 ? ` · ${report.issues.length} issue${report.issues.length === 1 ? "" : "s"}` : ""}
        </span>
      )}
    </div>
  );
}
