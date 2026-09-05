import React, { useRef, useEffect, useState } from "react";
import type { PromptInterpretationPreview } from "@/core/puzzle/designer/types";

interface PromptComposerProps {
  promptText: string;
  onChangePrompt: (text: string) => void;
  onSubmitPrompt: (text: string) => void;
  onCancel?: () => void;
  isLoading: boolean;
  suggestions: string[];
  recentPrompts: string[];
  interpretationPreview?: PromptInterpretationPreview | null;
}

export const PromptComposer: React.FC<PromptComposerProps> = ({
  promptText,
  onChangePrompt,
  onSubmitPrompt,
  onCancel,
  isLoading,
  suggestions,
  recentPrompts,
  interpretationPreview,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showPreviewDetails, setShowPreviewDetails] = useState(false);

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(140, Math.max(54, textareaRef.current.scrollHeight))}px`;
    }
  }, [promptText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (promptText.trim() && !isLoading) {
        onSubmitPrompt(promptText.trim());
      }
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      {/* Interpretation Preview Badge / Callout */}
      {interpretationPreview && (
        <div
          style={{
            padding: "6px 8px",
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: "var(--wk-r1, 8px)",
            fontSize: "11px",
            color: "#1e3a8a",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
            onClick={() => setShowPreviewDetails((v) => !v)}
          >
            <span style={{ fontWeight: 600 }}>
              🎯 Intent: {interpretationPreview.intent} ({interpretationPreview.targetPieceCount} pieces, {interpretationPreview.puzzleType})
            </span>
            <span style={{ fontSize: "10px", opacity: 0.8 }}>
              {showPreviewDetails ? "▲ Hide" : "▼ Details"}
            </span>
          </div>

          {showPreviewDetails && (
            <div style={{ marginTop: "4px", fontSize: "10px", opacity: 0.9, lineHeight: 1.4 }}>
              <div>
                <strong>Fixed Constraints:</strong> Sheet {interpretationPreview.fixedSheetWidthMm}×{interpretationPreview.fixedSheetHeightMm} mm (cardboard {interpretationPreview.thicknessMm}mm, no resize permitted).
              </div>
              <div>
                <strong>Joining:</strong> {interpretationPreview.joiningAngleBehavior} • Style: {interpretationPreview.assemblyStyle}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Composer Input Area */}
      <div
        style={{
          position: "relative",
          background: "var(--wk-surface, #ffffff)",
          border: "1px solid var(--wk-border-strong, #d5d9df)",
          borderRadius: "var(--wk-r1, 8px)",
          boxShadow: "var(--wk-shadow-1, 0 1px 2px rgba(0,0,0,0.04))",
          overflow: "hidden",
        }}
      >
        <textarea
          ref={textareaRef}
          value={promptText}
          onChange={(e) => onChangePrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Describe puzzle design requirement or ask CAD copilot (⌘Enter to execute)..."
          rows={2}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "none",
            outline: "none",
            resize: "none",
            padding: "8px 10px",
            fontSize: "12px",
            fontFamily: "var(--wk-font, inherit)",
            color: "var(--wk-ink, #1a1d23)",
            background: "transparent",
            lineHeight: "1.4",
          }}
        />

        {/* Action controls inside textarea footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 8px",
            background: "var(--wk-surface-2, #fafbfc)",
            borderTop: "1px solid var(--wk-border, #e9ebef)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {recentPrompts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                title="Recent Prompts History"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "11px",
                  color: "var(--wk-ink-soft, #565d68)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                🕒 Recent
              </button>
            )}

            {promptText && !isLoading && (
              <button
                type="button"
                onClick={() => onChangePrompt("")}
                title="Clear input"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "11px",
                  color: "var(--wk-ink-faint, #99a0ab)",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {isLoading && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: "3px 8px",
                  fontSize: "11px",
                  background: "transparent",
                  color: "var(--wk-red, #ef4444)",
                  border: "1px solid var(--wk-red, #ef4444)",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              disabled={isLoading || !promptText.trim()}
              onClick={() => onSubmitPrompt(promptText.trim())}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 12px",
                fontSize: "11.5px",
                fontWeight: 600,
                color: "#ffffff",
                background: isLoading || !promptText.trim() ? "var(--wk-ink-faint, #99a0ab)" : "var(--wk-accent, #ef8c3b)",
                border: "none",
                borderRadius: "5px",
                cursor: isLoading || !promptText.trim() ? "not-allowed" : "pointer",
                boxShadow: "var(--wk-shadow-1, 0 1px 2px rgba(0,0,0,0.08))",
              }}
            >
              {isLoading ? (
                <>
                  <span className="wk-spinner" style={{ width: "10px", height: "10px" }} />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <span>Execute</span>
                  <span style={{ fontSize: "10px", opacity: 0.8 }}>⌘↵</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Prompts Dropdown */}
      {showHistory && recentPrompts.length > 0 && (
        <div
          style={{
            background: "var(--wk-surface, #ffffff)",
            border: "1px solid var(--wk-border-strong, #d5d9df)",
            borderRadius: "var(--wk-r1, 8px)",
            padding: "4px",
            boxShadow: "var(--wk-shadow-2, 0 4px 12px rgba(0,0,0,0.08))",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", color: "var(--wk-ink-faint, #99a0ab)" }}>
            RECENT REQUESTS
          </div>
          {recentPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onChangePrompt(p);
                setShowHistory(false);
              }}
              style={{
                textAlign: "left",
                padding: "4px 6px",
                fontSize: "11px",
                background: "transparent",
                border: "none",
                borderRadius: "4px",
                color: "var(--wk-ink, #1a1d23)",
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--wk-surface-3, #eceef1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Dynamic Contextual Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "2px" }}>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onChangePrompt(s)}
              disabled={isLoading}
              style={{
                fontSize: "10.5px",
                padding: "3px 8px",
                borderRadius: "var(--wk-r-pill, 999px)",
                background: "var(--wk-surface-2, #fafbfc)",
                border: "1px solid var(--wk-border, #e9ebef)",
                color: "var(--wk-ink-soft, #565d68)",
                cursor: "pointer",
                transition: "all 0.1s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--wk-accent, #ef8c3b)";
                e.currentTarget.style.color = "var(--wk-accent-ink, #bd6a1e)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--wk-border, #e9ebef)";
                e.currentTarget.style.color = "var(--wk-ink-soft, #565d68)";
              }}
            >
              💡 {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
