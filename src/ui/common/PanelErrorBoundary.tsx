import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface PanelErrorBoundaryProps {
  name?: string;
  fallbackTitle?: string;
  onReset?: () => void;
  children: ReactNode;
}

interface PanelErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[PanelErrorBoundary: ${this.props.name || "Panel"}] caught error:`, error, errorInfo);
  }

  handleRetry = (): void => {
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        console.warn("PanelErrorBoundary onReset failed:", e);
      }
    }
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const panelName = this.props.name || "Panel";
      return (
        <div
          style={{
            padding: "16px",
            margin: "10px",
            borderRadius: "8px",
            background: "rgba(239, 68, 68, 0.06)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "var(--wk-ink, #1a1d23)",
            fontSize: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontWeight: 700, color: "#ef4444", fontSize: "13px" }}>
            {panelName} temporarily unavailable.
          </div>
          <div style={{ opacity: 0.8, fontSize: "11px", lineHeight: "1.4" }}>
            An unexpected error occurred inside this view. The rest of your CAD workspace remains functional.
          </div>
          {this.state.error?.message && (
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#dc2626",
                background: "rgba(255, 255, 255, 0.8)",
                padding: "6px 8px",
                borderRadius: "4px",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                maxWidth: "100%",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message}
            </div>
          )}
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              padding: "5px 12px",
              background: "var(--wk-accent, #ef8c3b)",
              color: "#ffffff",
              border: "none",
              borderRadius: "4px",
              fontWeight: 600,
              fontSize: "11px",
              cursor: "pointer",
              marginTop: "4px",
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PanelErrorBoundary;
