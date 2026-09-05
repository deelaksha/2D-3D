import React, { useState } from "react";
import type { ManufacturingLayoutOptimizationResult } from "@/core/puzzle/designer/types";

interface ProductionLayoutEditorProps {
  layout: ManufacturingLayoutOptimizationResult | null;
  onAutoNest: () => void;
  onRotatePiece: (pieceId: string) => void;
  onToggleLock: (pieceId: string) => void;
}

export const ProductionLayoutEditor: React.FC<ProductionLayoutEditorProps> = ({
  layout,
  onAutoNest,
  onRotatePiece,
  onToggleLock,
}) => {
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);

  if (!layout) {
    return (
      <div
        style={{
          padding: "16px",
          textAlign: "center",
          color: "var(--wk-ink-faint, #99a0ab)",
          fontSize: "11px",
          background: "var(--wk-surface-2, #fafbfc)",
          borderRadius: "var(--wk-r1, 8px)",
          border: "1px dashed var(--wk-border, #e9ebef)",
        }}
      >
        No active manufacturing layout. Click <strong>Optimize</strong> to pack pieces onto the configured sheet.
      </div>
    );
  }

  const isProductionValid = layout.fitsOnConfiguredSheet;
  const sheetW = layout.sheetWidthMm;
  const sheetH = layout.sheetHeightMm;

  // Visual scaling to fit thumbnail preview (e.g. 260px wide)
  const scale = 240 / Math.max(sheetW, sheetH);
  const previewW = sheetW * scale;
  const previewH = sheetH * scale;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        background: "var(--wk-surface, #ffffff)",
        borderRadius: "var(--wk-r1, 8px)",
        border: "1px solid var(--wk-border, #e9ebef)",
        padding: "10px",
      }}
    >
      {/* Header & Production Status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: "11px", fontWeight: 700 }}>Production Sheet Layout</span>
          <div style={{ fontSize: "10px", color: "var(--wk-ink-soft, #565d68)" }}>
            Fixed Cardboard Sheet: {sheetW} × {sheetH} mm ({layout.materialThicknessMm} mm stock)
          </div>
        </div>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: "4px",
            background: isProductionValid ? "rgba(24, 165, 88, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: isProductionValid ? "#18a558" : "#ef4444",
          }}
        >
          {isProductionValid ? "PRODUCTION PASS" : "FIT WARNING"}
        </span>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "4px",
          fontSize: "10px",
          textAlign: "center",
        }}
      >
        <div style={{ padding: "4px", background: "var(--wk-surface-2)", borderRadius: "4px" }}>
          <div style={{ color: "var(--wk-ink-faint)" }}>Utilization</div>
          <div style={{ fontWeight: 700 }}>{layout.materialUtilizationPercent}%</div>
        </div>
        <div style={{ padding: "4px", background: "var(--wk-surface-2)", borderRadius: "4px" }}>
          <div style={{ color: "var(--wk-ink-faint)" }}>Sheets</div>
          <div style={{ fontWeight: 700 }}>{layout.sheetsRequired}</div>
        </div>
        <div style={{ padding: "4px", background: "var(--wk-surface-2)", borderRadius: "4px" }}>
          <div style={{ color: "var(--wk-ink-faint)" }}>Cut Length</div>
          <div style={{ fontWeight: 700 }}>{(layout.totalCutLengthMm / 1000).toFixed(1)}m</div>
        </div>
        <div style={{ padding: "4px", background: "var(--wk-surface-2)", borderRadius: "4px" }}>
          <div style={{ color: "var(--wk-ink-faint)" }}>Waste</div>
          <div style={{ fontWeight: 700 }}>{(layout.wasteAreaMm2 / 100).toFixed(0)}cm²</div>
        </div>
      </div>

      {/* Interactive Sheet Preview Canvas */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "8px",
          background: "var(--wk-surface-3, #eceef1)",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            width: `${previewW}px`,
            height: `${previewH}px`,
            background: "#ffffff",
            border: "1.5px solid #1e293b",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          }}
        >
          {/* Edge margin line */}
          <div
            style={{
              position: "absolute",
              top: `${layout.minimumEdgeDistanceMm * scale}px`,
              left: `${layout.minimumEdgeDistanceMm * scale}px`,
              right: `${layout.minimumEdgeDistanceMm * scale}px`,
              bottom: `${layout.minimumEdgeDistanceMm * scale}px`,
              border: "1px dashed #cbd5e1",
              pointerEvents: "none",
            }}
          />

          {/* Placed Pieces */}
          {layout.packedPlacements.map((p) => {
            const isSelected = selectedPieceId === p.pieceId;
            return (
              <div
                key={p.pieceId}
                onClick={() => setSelectedPieceId(p.pieceId)}
                title={`Piece ${p.pieceId} (${p.width}×${p.height}mm)`}
                style={{
                  position: "absolute",
                  left: `${p.x * scale}px`,
                  top: `${p.y * scale}px`,
                  width: `${p.width * scale}px`,
                  height: `${p.height * scale}px`,
                  background: isSelected ? "rgba(239, 140, 59, 0.3)" : "rgba(59, 130, 246, 0.15)",
                  border: isSelected ? "1.5px solid var(--wk-accent, #ef8c3b)" : "1px solid #3b82f6",
                  borderRadius: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "8px",
                  fontWeight: 600,
                  color: "#1e3a8a",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                {p.pieceId}
              </div>
            );
          })}
        </div>
      </div>

      {/* Layout Controls Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          onClick={onAutoNest}
          style={{
            padding: "4px 10px",
            fontSize: "11px",
            fontWeight: 600,
            borderRadius: "5px",
            background: "var(--wk-accent, #ef8c3b)",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
          }}
        >
          ⚡ Auto-Nest
        </button>

        <div style={{ display: "flex", gap: "4px" }}>
          {selectedPieceId && (
            <>
              <button
                type="button"
                onClick={() => onRotatePiece(selectedPieceId)}
                title="Rotate piece 90 degrees"
                style={{
                  padding: "3px 7px",
                  fontSize: "10.5px",
                  borderRadius: "4px",
                  border: "1px solid var(--wk-border-strong, #d5d9df)",
                  background: "var(--wk-surface, #ffffff)",
                  cursor: "pointer",
                }}
              >
                ⟳ Rotate 90°
              </button>
              <button
                type="button"
                onClick={() => onToggleLock(selectedPieceId)}
                title="Lock piece position"
                style={{
                  padding: "3px 7px",
                  fontSize: "10.5px",
                  borderRadius: "4px",
                  border: "1px solid var(--wk-border-strong, #d5d9df)",
                  background: "var(--wk-surface, #ffffff)",
                  cursor: "pointer",
                }}
              >
                🔒 Lock
              </button>
            </>
          )}
        </div>
      </div>

      {/* Warnings & Suggestions if cannot fit */}
      {layout.warnings.length > 0 && (
        <div
          style={{
            padding: "8px",
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid #f59e0b",
            borderRadius: "5px",
            fontSize: "10.5px",
            color: "#b45309",
          }}
        >
          <strong>Manufacturing Constraints:</strong>
          {layout.warnings.map((w, idx) => (
            <div key={idx}>• {w}</div>
          ))}
          {layout.suggestedAlternatives && (
            <div style={{ marginTop: "4px" }}>
              <strong>Recommended Alternatives:</strong>
              {layout.suggestedAlternatives.map((alt, idx) => (
                <div key={idx}>→ {alt}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
