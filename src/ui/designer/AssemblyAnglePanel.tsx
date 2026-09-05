import React from "react";
import type { ConvertedPuzzle3D } from "@/core/puzzle/piece3d/types";
import { AngleManipulationEngine } from "@/core/puzzle/manipulation/angleManipulationEngine";
import type { ConnectionAngleInspection } from "@/core/puzzle/manipulation/types";

interface AssemblyAnglePanelProps {
  puzzle3D: ConvertedPuzzle3D;
  connectionId: string | null;
  appliedAngles: Record<string, number>;
  onChangeAngle: (connectionId: string, newAngleDeg: number) => void;
}

export const AssemblyAnglePanel: React.FC<AssemblyAnglePanelProps> = ({
  puzzle3D,
  connectionId,
  appliedAngles,
  onChangeAngle,
}) => {
  if (!connectionId) {
    return (
      <div style={{ fontSize: "11px", color: "var(--wk-ink-faint, #99a0ab)", padding: "6px" }}>
        Select a connection to adjust 3D joining angle.
      </div>
    );
  }

  let inspection: ConnectionAngleInspection | null = null;
  try {
    inspection = AngleManipulationEngine.inspectConnection(puzzle3D, connectionId, appliedAngles);
  } catch {
    inspection = null;
  }

  if (!inspection) {
    return (
      <div style={{ fontSize: "11px", color: "#ef4444", padding: "6px" }}>
        Connection '{connectionId}' not found in assembly model.
      </div>
    );
  }

  const currentAngle = appliedAngles[connectionId] ?? inspection.currentAngleDeg;
  const validAngles = inspection.allowedAngleRange.validCandidates;
  const minAngle = inspection.allowedAngleRange.min;
  const maxAngle = inspection.allowedAngleRange.max;

  const presets = [30, 45, 60, 90, 120, 180];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "8px",
        background: "var(--wk-surface-2, #fafbfc)",
        borderRadius: "6px",
        border: "1px solid var(--wk-border, #e9ebef)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700 }}>
        <span>Joint: {connectionId} ({inspection.connectorType})</span>
        <span style={{ color: "var(--wk-accent-ink, #bd6a1e)" }}>{currentAngle}°</span>
      </div>

      <div style={{ fontSize: "10px", color: "var(--wk-ink-soft, #565d68)" }}>
        Piece {inspection.pieceAId} ↔ Piece {inspection.pieceBId}
      </div>

      {/* Angle Slider & Numeric Input */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="range"
          min={minAngle}
          max={maxAngle}
          step={15}
          value={currentAngle}
          onChange={(e) => onChangeAngle(connectionId, Number(e.target.value))}
          style={{ flex: 1, accentColor: "var(--wk-accent, #ef8c3b)" }}
        />
        <input
          type="number"
          min={minAngle}
          max={maxAngle}
          step={5}
          value={currentAngle}
          onChange={(e) => onChangeAngle(connectionId, Number(e.target.value))}
          style={{
            width: "50px",
            padding: "2px 4px",
            fontSize: "11px",
            borderRadius: "4px",
            border: "1px solid var(--wk-border-strong, #d5d9df)",
            background: "var(--wk-surface, #ffffff)",
          }}
        />
        <span style={{ fontSize: "11px" }}>deg</span>
      </div>

      {/* Presets with Valid-Angle Gating (Prompt 108) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "2px" }}>
        {presets.map((deg) => {
          const isValid = validAngles.includes(deg);
          const isSelected = currentAngle === deg;

          return (
            <button
              key={deg}
              type="button"
              disabled={!isValid}
              onClick={() => onChangeAngle(connectionId, deg)}
              title={isValid ? `Set angle to ${deg}°` : `${deg}° is rejected by physical/collision clearance constraints`}
              style={{
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "4px",
                border: isSelected
                  ? "1px solid var(--wk-accent, #ef8c3b)"
                  : "1px solid var(--wk-border, #e9ebef)",
                background: isSelected
                  ? "rgba(239, 140, 59, 0.15)"
                  : isValid
                  ? "var(--wk-surface, #ffffff)"
                  : "var(--wk-surface-3, #eceef1)",
                color: isSelected
                  ? "var(--wk-accent-ink, #bd6a1e)"
                  : isValid
                  ? "var(--wk-ink, #1a1d23)"
                  : "var(--wk-ink-faint, #99a0ab)",
                cursor: isValid ? "pointer" : "not-allowed",
                textDecoration: isValid ? "none" : "line-through",
              }}
            >
              {deg}°
            </button>
          );
        })}
      </div>
    </div>
  );
};
