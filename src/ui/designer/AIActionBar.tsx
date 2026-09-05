import React from "react";

interface AIActionBarProps {
  onGenerate: () => void;
  onPreview: () => void;
  onValidate: () => void;
  onOptimize: () => void;
  onRepair: () => void;
  isLoading: boolean;
  hasDesign: boolean;
  hasIssues?: boolean;
}

export const AIActionBar: React.FC<AIActionBarProps> = ({
  onGenerate,
  onPreview,
  onValidate,
  onOptimize,
  onRepair,
  isLoading,
  hasDesign,
  hasIssues = false,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        paddingTop: "6px",
        borderTop: "1px solid var(--wk-border, #e9ebef)",
      }}
    >
      {/* Primary Hero Action: Generate */}
      <button
        type="button"
        disabled={isLoading}
        onClick={onGenerate}
        style={{
          width: "100%",
          padding: "9px 14px",
          fontSize: "13px",
          fontWeight: 700,
          borderRadius: "var(--wk-r1, 8px)",
          border: "none",
          background: isLoading
            ? "var(--wk-ink-faint, #99a0ab)"
            : "linear-gradient(135deg, var(--wk-accent, #ef8c3b) 0%, #d97706 100%)",
          color: "#ffffff",
          cursor: isLoading ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          boxShadow: "0 2px 8px rgba(239, 140, 59, 0.35)",
          transition: "transform 0.1s ease, box-shadow 0.1s ease",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {isLoading ? (
          <>
            <span className="wk-spinner" style={{ width: "12px", height: "12px" }} />
            <span>Generating CAD Model...</span>
          </>
        ) : (
          <>
            <span>✨</span>
            <span>{hasDesign ? "Regenerate Design" : "Generate Puzzle"}</span>
          </>
        )}
      </button>

      {/* Secondary CAD Workflow Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "4px",
        }}
      >
        <button
          type="button"
          disabled={!hasDesign || isLoading}
          onClick={onPreview}
          title="Open interactive 3D WebGL preview"
          style={{
            padding: "5px 6px",
            fontSize: "11px",
            fontWeight: 600,
            borderRadius: "6px",
            border: "1px solid var(--wk-border-strong, #d5d9df)",
            background: "var(--wk-surface, #ffffff)",
            color: hasDesign ? "var(--wk-ink, #1a1d23)" : "var(--wk-ink-faint, #99a0ab)",
            cursor: hasDesign ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "3px",
          }}
        >
          <span>👁️</span>
          <span>Preview</span>
        </button>

        <button
          type="button"
          disabled={!hasDesign || isLoading}
          onClick={onValidate}
          title="Run 17-point geometric and assembly validation pass"
          style={{
            padding: "5px 6px",
            fontSize: "11px",
            fontWeight: 600,
            borderRadius: "6px",
            border: "1px solid var(--wk-border-strong, #d5d9df)",
            background: "var(--wk-surface, #ffffff)",
            color: hasDesign ? "var(--wk-ink, #1a1d23)" : "var(--wk-ink-faint, #99a0ab)",
            cursor: hasDesign ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "3px",
          }}
        >
          <span>✓</span>
          <span>Validate</span>
        </button>

        <button
          type="button"
          disabled={!hasDesign || isLoading}
          onClick={onOptimize}
          title="Optimize 2D piece nesting on fixed cardboard sheet"
          style={{
            padding: "5px 6px",
            fontSize: "11px",
            fontWeight: 600,
            borderRadius: "6px",
            border: "1px solid var(--wk-border-strong, #d5d9df)",
            background: "var(--wk-surface, #ffffff)",
            color: hasDesign ? "var(--wk-ink, #1a1d23)" : "var(--wk-ink-faint, #99a0ab)",
            cursor: hasDesign ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "3px",
          }}
        >
          <span>⚡</span>
          <span>Optimize</span>
        </button>

        <button
          type="button"
          disabled={!hasDesign || isLoading}
          onClick={onRepair}
          title="Open AI Repair Center for collision & clearance fixes"
          style={{
            padding: "5px 6px",
            fontSize: "11px",
            fontWeight: 600,
            borderRadius: "6px",
            border: hasIssues ? "1px solid #ef4444" : "1px solid var(--wk-border-strong, #d5d9df)",
            background: hasIssues ? "rgba(239, 68, 68, 0.08)" : "var(--wk-surface, #ffffff)",
            color: hasIssues ? "#ef4444" : hasDesign ? "var(--wk-ink, #1a1d23)" : "var(--wk-ink-faint, #99a0ab)",
            cursor: hasDesign ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "3px",
          }}
        >
          <span>🛠️</span>
          <span>Repair</span>
        </button>
      </div>
    </div>
  );
};
