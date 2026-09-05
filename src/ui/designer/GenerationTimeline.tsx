import React, { useState } from "react";
import type { TimelineStage, TimelineStageKey } from "@/core/puzzle/designer/types";

interface GenerationTimelineProps {
  stages: TimelineStage[];
  activeStageKey: TimelineStageKey | null;
  totalElapsedMs: number;
  isGenerating: boolean;
}

export const GenerationTimeline: React.FC<GenerationTimelineProps> = ({
  stages,
  activeStageKey,
  totalElapsedMs,
  isGenerating,
}) => {
  const [expandedStageKey, setExpandedStageKey] = useState<TimelineStageKey | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleExpand = (key: TimelineStageKey) => {
    setExpandedStageKey((cur) => (cur === key ? null : key));
  };

  const completedCount = stages.filter((s) => s.status === "passed" || s.status === "repaired").length;
  const progressPercent = Math.round((completedCount / stages.length) * 100);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "10px",
        background: "var(--wk-surface-2, #fafbfc)",
        borderRadius: "var(--wk-r1, 8px)",
        border: "1px solid var(--wk-border, #e9ebef)",
      }}
    >
      {/* Header with progress & telemetry */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontWeight: 700, color: "var(--wk-ink, #1a1d23)" }}>
            Autonomous Pipeline Timeline
          </span>
          <span
            style={{
              fontSize: "10px",
              padding: "1px 6px",
              borderRadius: "4px",
              background: isGenerating ? "rgba(59, 130, 246, 0.15)" : "rgba(24, 165, 88, 0.15)",
              color: isGenerating ? "#2563eb" : "#18a558",
              fontWeight: 600,
            }}
          >
            {completedCount}/{stages.length} Stages ({progressPercent}%)
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: "var(--wk-ink-soft, #565d68)", fontFamily: "var(--wk-mono, monospace)" }}>
            {(totalElapsedMs / 1000).toFixed(2)}s
          </span>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            style={{
              background: "none",
              border: "none",
              fontSize: "10px",
              color: "var(--wk-accent-ink, #bd6a1e)",
              cursor: "pointer",
              padding: 0,
              fontWeight: 600,
            }}
          >
            {showAdvanced ? "Compact" : "Details"}
          </button>
        </div>
      </div>

      {/* Progress Track */}
      <div
        style={{
          height: "3px",
          background: "var(--wk-border, #e9ebef)",
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.max(2, progressPercent)}%`,
            background: isGenerating ? "var(--wk-blue, #3b82f6)" : "var(--wk-green, #18a558)",
            transition: "width 0.2s ease",
          }}
        />
      </div>

      {/* Structured Stages List */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          maxHeight: "220px",
          overflowY: "auto",
          paddingRight: "2px",
        }}
      >
        {stages.map((stage, idx) => {
          const isCurrent = activeStageKey === stage.key;
          const isExpanded = expandedStageKey === stage.key || showAdvanced;

          let statusIcon = "⏳";
          let statusColor = "var(--wk-ink-faint, #99a0ab)";
          let statusBg = "transparent";

          if (stage.status === "running") {
            statusIcon = "🔄";
            statusColor = "var(--wk-blue, #3b82f6)";
            statusBg = "rgba(59, 130, 246, 0.08)";
          } else if (stage.status === "passed") {
            statusIcon = "✓";
            statusColor = "var(--wk-green, #18a558)";
          } else if (stage.status === "repaired") {
            statusIcon = "🛠️";
            statusColor = "var(--wk-amber, #f0a91b)";
          } else if (stage.status === "warning") {
            statusIcon = "⚠️";
            statusColor = "var(--wk-amber, #f0a91b)";
          } else if (stage.status === "failed") {
            statusIcon = "✗";
            statusColor = "var(--wk-red, #ef4444)";
          }

          return (
            <div
              key={stage.key}
              style={{
                display: "flex",
                flexDirection: "column",
                borderRadius: "5px",
                background: isCurrent ? "rgba(59, 130, 246, 0.05)" : statusBg,
                border: isCurrent ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid transparent",
              }}
            >
              <div
                onClick={() => toggleExpand(stage.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "3px 6px",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "14px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: statusColor,
                      fontSize: "10px",
                    }}
                  >
                    {statusIcon}
                  </span>
                  <span
                    style={{
                      color: stage.status === "pending" ? "var(--wk-ink-faint, #99a0ab)" : "var(--wk-ink, #1a1d23)",
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    {idx + 1}. {stage.label}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {stage.elapsedMs > 0 && (
                    <span
                      style={{
                        fontSize: "9.5px",
                        color: "var(--wk-ink-faint, #99a0ab)",
                        fontFamily: "var(--wk-mono, monospace)",
                      }}
                    >
                      {stage.elapsedMs.toFixed(1)}ms
                    </span>
                  )}
                  <span style={{ fontSize: "9px", color: "var(--wk-ink-faint, #99a0ab)" }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Collapsible Technical Details Drawer */}
              {isExpanded && (
                <div
                  style={{
                    padding: "4px 8px 6px 26px",
                    fontSize: "10.5px",
                    color: "var(--wk-ink-soft, #565d68)",
                    borderTop: "1px dashed var(--wk-border, #e9ebef)",
                    background: "rgba(0,0,0,0.01)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span>
                      Status: <strong style={{ color: statusColor }}>{stage.status.toUpperCase()}</strong>
                    </span>
                    {stage.elapsedMs > 0 && <span>Execution: {stage.elapsedMs.toFixed(2)} ms</span>}
                  </div>

                  {stage.details?.summary && <div>{stage.details.summary}</div>}

                  {stage.details?.metrics && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "2px 8px",
                        marginTop: "4px",
                        fontFamily: "var(--wk-mono, monospace)",
                        fontSize: "9.5px",
                        background: "var(--wk-surface, #ffffff)",
                        padding: "4px 6px",
                        borderRadius: "4px",
                        border: "1px solid var(--wk-border, #e9ebef)",
                      }}
                    >
                      {Object.entries((stage.details?.metrics && typeof stage.details.metrics === "object") ? stage.details.metrics : {}).map(([k, v]) => (
                        <div key={k} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {k}: <strong>{String(v)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
