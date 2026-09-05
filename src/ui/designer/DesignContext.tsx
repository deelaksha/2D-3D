import React from "react";
import type { ContextItem } from "@/core/puzzle/designer/types";

interface DesignContextProps {
  contextItems: ContextItem[];
  onRemoveItem: (id: string) => void;
  onClearRemovable?: () => void;
}

export const DesignContext: React.FC<DesignContextProps> = ({
  contextItems,
  onRemoveItem,
  onClearRemovable,
}) => {
  if (contextItems.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "8px 10px",
        background: "var(--wk-surface-2, #fafbfc)",
        borderRadius: "var(--wk-r1, 8px)",
        border: "1px solid var(--wk-border, #e9ebef)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "var(--wk-ink-faint, #99a0ab)",
        }}
      >
        <span>Active CAD Context ({contextItems.length})</span>
        {onClearRemovable && contextItems.some((c) => c.removable) && (
          <button
            type="button"
            onClick={onClearRemovable}
            style={{
              background: "none",
              border: "none",
              fontSize: "10px",
              color: "var(--wk-ink-soft, #565d68)",
              cursor: "pointer",
              padding: "0 2px",
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "4px",
          alignItems: "center",
        }}
      >
        {contextItems.map((item) => {
          let badgeBg = "rgba(59, 130, 246, 0.08)";
          let badgeBorder = "rgba(59, 130, 246, 0.25)";
          let badgeColor = "#2563eb";

          if (item.type === "piece") {
            badgeBg = "rgba(239, 140, 59, 0.1)";
            badgeBorder = "rgba(239, 140, 59, 0.3)";
            badgeColor = "var(--wk-accent-ink, #bd6a1e)";
          } else if (item.type === "validation") {
            badgeBg = item.label.includes("Issues")
              ? "rgba(239, 68, 68, 0.1)"
              : "rgba(24, 165, 88, 0.1)";
            badgeBorder = item.label.includes("Issues")
              ? "rgba(239, 68, 68, 0.3)"
              : "rgba(24, 165, 88, 0.3)";
            badgeColor = item.label.includes("Issues") ? "#ef4444" : "#18a558";
          } else if (item.type === "sheet" || item.type === "material") {
            badgeBg = "rgba(100, 116, 139, 0.1)";
            badgeBorder = "rgba(100, 116, 139, 0.25)";
            badgeColor = "#475569";
          }

          return (
            <span
              key={item.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 7px",
                borderRadius: "var(--wk-r-pill, 999px)",
                fontSize: "10.5px",
                fontWeight: 500,
                background: badgeBg,
                border: `1px solid ${badgeBorder}`,
                color: badgeColor,
              }}
            >
              <span>{item.label}</span>
              {item.removable && (
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  title="Remove context item"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "none",
                    border: "none",
                    padding: 0,
                    margin: 0,
                    width: "12px",
                    height: "12px",
                    cursor: "pointer",
                    color: "inherit",
                    opacity: 0.7,
                    fontWeight: 700,
                  }}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};
