import React from "react";
import type { AIDesignerMode } from "@/core/puzzle/designer/types";

interface AIModeSelectorProps {
  activeMode: AIDesignerMode;
  onChangeMode: (mode: AIDesignerMode) => void;
}

const MODES: Array<{ id: AIDesignerMode; label: string; icon: string; title: string }> = [
  { id: "create", label: "Create", icon: "✨", title: "Parametric puzzle creation & generation" },
  { id: "modify", label: "Modify", icon: "✏️", title: "Natural language CAD copilot modifications" },
  { id: "analyze", label: "Analyze", icon: "🔍", title: "Result inspector & difficulty evaluation" },
  { id: "assemble", label: "Assemble", icon: "🧩", title: "Interactive 3D assembly & snapping" },
  { id: "optimize", label: "Optimize", icon: "📐", title: "Manufacturing-aware sheet nesting" },
  { id: "repair", label: "Repair", icon: "🛠️", title: "AI diagnostic repair center" },
];

export const AIModeSelector: React.FC<AIModeSelectorProps> = ({ activeMode, onChangeMode }) => {
  return (
    <div
      role="tablist"
      aria-label="AI Designer Modes"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "4px",
        padding: "6px",
        background: "var(--wk-surface-3, #eceef1)",
        borderRadius: "var(--wk-r1, 8px)",
        border: "1px solid var(--wk-border, #e9ebef)",
      }}
    >
      {MODES.map((m) => {
        const isActive = activeMode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={m.title}
            onClick={() => onChangeMode(m.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              padding: "6px 4px",
              fontSize: "11px",
              fontWeight: isActive ? 600 : 500,
              borderRadius: "6px",
              border: isActive ? "1px solid var(--wk-border-strong, #d5d9df)" : "1px solid transparent",
              background: isActive ? "var(--wk-surface, #ffffff)" : "transparent",
              color: isActive ? "var(--wk-accent-ink, #bd6a1e)" : "var(--wk-ink-soft, #565d68)",
              boxShadow: isActive ? "var(--wk-shadow-1, 0 1px 2px rgba(0,0,0,0.05))" : "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <span>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
};
