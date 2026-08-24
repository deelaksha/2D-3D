import { useState } from "react";
import { useProject } from "@/core/store/store";
import { clear3DScene, placeAllParts } from "@/core/store/actions";

export default function AssemblyProgressBar(): JSX.Element {
  const project = useProject();
  const [collapsed, setCollapsed] = useState(false);

  const totalParts = project.parts.length;
  const placedPartIds = new Set(
    project.assembly.placements.filter((pl) => pl.placed).map((pl) => pl.partId)
  );
  const placedCount = project.parts.filter((p) => placedPartIds.has(p.id)).length;
  const percent = totalParts > 0 ? Math.round((placedCount / totalParts) * 100) : 100;
  const connectionsCount = project.assembly.connections.length;

  const isComplete = totalParts > 0 && placedCount === totalParts;

  return (
    <div className="wk-3d-progress-banner" grid-area="progress">
      <div className="wk-3d-progress-inner">
        {/* Left Info Section */}
        <div className="wk-3d-progress-info">
          <span className="wk-3d-progress-icon">
            {isComplete ? "🎉" : "🧩"}
          </span>
          <div className="wk-3d-progress-labels">
            <div className="wk-3d-progress-title">
              3D Assembly Progress
              <span className={`wk-3d-progress-chip ${isComplete ? "wk-3d-progress-chip--success" : ""}`}>
                {percent}%
              </span>
            </div>
            <div className="wk-3d-progress-sub">
              {placedCount} of {totalParts} parts placed in 3D scene
              {connectionsCount > 0 && ` • ${connectionsCount} 3D joint${connectionsCount > 1 ? "s" : ""} connected`}
            </div>
          </div>
        </div>

        {/* Center Progress Track */}
        <div className="wk-3d-progress-track-wrapper">
          <div className="wk-3d-progress-track">
            <div
              className={`wk-3d-progress-fill ${isComplete ? "wk-3d-progress-fill--complete" : ""}`}
              style={{ width: `${percent}%` }}
            >
              <div className="wk-3d-progress-shimmer" />
            </div>
          </div>
          {/* Segment ticks for parts */}
          {totalParts > 1 && totalParts <= 20 && (
            <div className="wk-3d-progress-ticks">
              {Array.from({ length: totalParts }).map((_, i) => (
                <div
                  key={i}
                  className={`wk-3d-progress-tick ${i < placedCount ? "wk-3d-progress-tick--active" : ""}`}
                  style={{ left: `${(i / totalParts) * 100}%` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="wk-3d-progress-actions">
          {placedCount < totalParts && (
            <button
              type="button"
              className="wk-btn wk-btn--primary wk-3d-progress-btn"
              onClick={() => placeAllParts()}
              title="Stage all designed 2D parts in the 3D scene"
            >
              ⚡ Place All Parts
            </button>
          )}
          {placedCount > 0 && (
            <button
              type="button"
              className="wk-btn wk-btn--ghost wk-3d-progress-btn"
              onClick={() => clear3DScene()}
              title="Reset 3D assembly and return all parts to staging library"
            >
              ↺ Reset Scene
            </button>
          )}
          <button
            type="button"
            className="wk-icon-btn"
            style={{ width: 26, height: 26, fontSize: 11 }}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand progress details" : "Collapse progress bar"}
          >
            {collapsed ? "▼" : "▲"}
          </button>
        </div>
      </div>
    </div>
  );
}
