import React, { useState } from "react";
import type { RepairCenterIssue } from "@/core/puzzle/designer/types";

interface AIRepairCenterProps {
  issues: RepairCenterIssue[];
  activeIssueId: string | null;
  onSelectIssue: (id: string) => void;
  onPreviewRepair: (issueId: string, repairId: string) => void;
  onApplyRepair: (issueId: string, repairId: string) => void;
}

export const AIRepairCenter: React.FC<AIRepairCenterProps> = ({
  issues,
  activeIssueId,
  onSelectIssue,
  onPreviewRepair,
  onApplyRepair,
}) => {
  const [previewingRepairId, setPreviewingRepairId] = useState<string | null>(null);

  if (issues.length === 0) {
    return (
      <div
        style={{
          padding: "16px",
          textAlign: "center",
          background: "rgba(24, 165, 88, 0.05)",
          border: "1px solid rgba(24, 165, 88, 0.2)",
          borderRadius: "var(--wk-r1, 8px)",
          color: "#15803d",
          fontSize: "11.5px",
        }}
      >
        <div style={{ fontSize: "18px", marginBottom: "4px" }}>🎉</div>
        <strong>Zero CAD Violations Detected</strong>
        <div style={{ fontSize: "10.5px", opacity: 0.85, marginTop: "2px" }}>
          All 17 geometric, connection, and kinematic assembly constraints are fully satisfied.
        </div>
      </div>
    );
  }

  const selectedIssue = issues.find((i) => i.id === activeIssueId) || issues[0];

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--wk-red, #ef4444)" }}>
          🛠️ AI CAD Repair Center ({issues.length} Issues)
        </span>
        <span style={{ fontSize: "10px", color: "var(--wk-ink-soft, #565d68)" }}>
          Deterministic Parametric Fixes
        </span>
      </div>

      {/* Issues selector chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {issues.map((issue) => {
          const isSelected = selectedIssue?.id === issue.id;
          return (
            <button
              key={issue.id}
              type="button"
              onClick={() => onSelectIssue(issue.id)}
              style={{
                fontSize: "10.5px",
                padding: "3px 8px",
                borderRadius: "4px",
                border: isSelected ? "1px solid #ef4444" : "1px solid var(--wk-border, #e9ebef)",
                background: isSelected ? "rgba(239, 68, 68, 0.1)" : "var(--wk-surface-2, #fafbfc)",
                color: isSelected ? "#b91c1c" : "var(--wk-ink, #1a1d23)",
                fontWeight: isSelected ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {issue.problemTitle}
            </button>
          );
        })}
      </div>

      {/* Selected Issue Detail Card */}
      {selectedIssue && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            padding: "8px",
            background: "var(--wk-surface-2, #fafbfc)",
            borderRadius: "6px",
            border: "1px solid var(--wk-border, #e9ebef)",
            fontSize: "11px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "var(--wk-ink, #1a1d23)" }}>{selectedIssue.problemTitle}</strong>
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                padding: "1px 5px",
                borderRadius: "3px",
                background: "#fee2e2",
                color: "#991b1b",
              }}
            >
              {selectedIssue.severity}
            </span>
          </div>

          <div>
            <strong>Affected Objects:</strong> Piece(s) {selectedIssue.affectedPieceIds.join(", ")}
            {selectedIssue.affectedConnectionId && ` (Connection ${selectedIssue.affectedConnectionId})`}
          </div>

          <div>
            <strong>Root Cause:</strong> {selectedIssue.rootCause}
          </div>

          {/* Possible 1-Click Parametric Repairs */}
          <div style={{ marginTop: "4px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--wk-ink-faint, #99a0ab)", textTransform: "uppercase", marginBottom: "4px" }}>
              Recommended Parametric Repairs
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {selectedIssue.possibleRepairs.map((rep) => {
                const isPreviewing = previewingRepairId === rep.id;
                return (
                  <div
                    key={rep.id}
                    style={{
                      padding: "6px",
                      background: "var(--wk-surface, #ffffff)",
                      border: "1px solid var(--wk-border, #e9ebef)",
                      borderRadius: "5px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--wk-ink, #1a1d23)" }}>{rep.label}</div>
                      <div style={{ fontSize: "9.5px", color: "var(--wk-ink-soft, #565d68)" }}>Impact: {rep.expectedImpact}</div>
                    </div>

                    <div style={{ display: "flex", gap: "3px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewingRepairId(rep.id);
                          onPreviewRepair(selectedIssue.id, rep.id);
                        }}
                        style={{
                          padding: "3px 6px",
                          fontSize: "10px",
                          borderRadius: "4px",
                          border: "1px solid var(--wk-border-strong, #d5d9df)",
                          background: isPreviewing ? "rgba(59, 130, 246, 0.15)" : "#fff",
                          cursor: "pointer",
                        }}
                      >
                        {isPreviewing ? "Previewing" : "Preview"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onApplyRepair(selectedIssue.id, rep.id)}
                        style={{
                          padding: "3px 8px",
                          fontSize: "10px",
                          fontWeight: 600,
                          borderRadius: "4px",
                          border: "none",
                          background: "var(--wk-green, #18a558)",
                          color: "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
