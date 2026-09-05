import React from "react";
import type { DesignComparisonItem, DesignVariantCard } from "@/core/puzzle/designer/types";

interface DesignComparisonViewProps {
  variants: DesignVariantCard[];
  comparisonItems: DesignComparisonItem[];
  onSelectVariant: (id: string) => void;
  onClose: () => void;
}

export const DesignComparisonView: React.FC<DesignComparisonViewProps> = ({
  variants,
  comparisonItems,
  onSelectVariant,
  onClose,
}) => {
  if (variants.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 17, 23, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "760px",
          maxHeight: "85vh",
          background: "var(--wk-surface, #ffffff)",
          borderRadius: "var(--wk-r2, 12px)",
          border: "1px solid var(--wk-border-strong, #d5d9df)",
          boxShadow: "var(--wk-shadow-3, 0 18px 48px rgba(0,0,0,0.2))",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--wk-border, #e9ebef)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "14px", color: "var(--wk-ink, #1a1d23)" }}>
              ⚖️ Parametric Design Variants Comparison
            </h3>
            <span style={{ fontSize: "11px", color: "var(--wk-ink-soft, #565d68)" }}>
              Evaluated across topology, kinematics, material utilization, and difficulty
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "16px",
              cursor: "pointer",
              color: "var(--wk-ink-soft, #565d68)",
            }}
          >
            ✕
          </button>
        </div>

        {/* Comparative Cards Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `160px repeat(${variants.length}, 1fr)`,
            gap: "8px",
            padding: "12px 16px",
            background: "var(--wk-surface-2, #fafbfc)",
            borderBottom: "1px solid var(--wk-border, #e9ebef)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--wk-ink-faint, #99a0ab)" }}>
            VARIANT
          </div>
          {variants.map((v) => (
            <div key={v.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <strong style={{ fontSize: "12px", color: "var(--wk-ink, #1a1d23)" }}>{v.name}</strong>
              <span style={{ fontSize: "10px", color: "var(--wk-accent-ink, #bd6a1e)", fontWeight: 600 }}>
                {v.difficultyLabel} ({v.difficultyScore}/10)
              </span>
              <button
                type="button"
                onClick={() => {
                  onSelectVariant(v.id);
                  onClose();
                }}
                style={{
                  marginTop: "4px",
                  padding: "3px 8px",
                  fontSize: "10.5px",
                  fontWeight: 600,
                  borderRadius: "4px",
                  border: "none",
                  background: "var(--wk-accent, #ef8c3b)",
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                Load Variant
              </button>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <tbody>
              {comparisonItems.map((item, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: "1px solid var(--wk-border, #e9ebef)",
                  }}
                >
                  <td
                    style={{
                      padding: "8px 4px",
                      fontWeight: 600,
                      color: "var(--wk-ink-soft, #565d68)",
                      width: "160px",
                    }}
                  >
                    {item.metricName}
                    {item.unit && <span style={{ opacity: 0.6, marginLeft: "3px" }}>({item.unit})</span>}
                  </td>
                  {variants.map((v) => {
                    const val = item.values[v.id];
                    const isFavorable = item.favorableVariantId === v.id;
                    return (
                      <td
                        key={v.id}
                        style={{
                          padding: "8px 4px",
                          fontWeight: isFavorable ? 700 : 500,
                          color: isFavorable ? "#15803d" : "var(--wk-ink, #1a1d23)",
                          background: isFavorable ? "rgba(24, 165, 88, 0.05)" : "transparent",
                        }}
                      >
                        {String(val)}
                        {isFavorable && " 🌟"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
