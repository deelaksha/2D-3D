import React, { useState } from "react";
import type { ConvertedPuzzle3D } from "@/core/puzzle/piece3d/types";
import type { PieceTransforms } from "@/core/puzzle/assembly3d/types";
import { AssemblyCoach } from "@/core/puzzle/designer/assemblyCoach";
import { ConstraintSnappingEngine } from "@/core/puzzle/designer/constraintSnappingEngine";
import { GhostPreviewEngine } from "@/core/puzzle/designer/ghostPreviewEngine";
import { AssemblyAnglePanel } from "./AssemblyAnglePanel";
import type {
  AssemblySolutionOption,
  AssemblyStepHistoryEntry,
  CoachAdvice,
  GhostPreviewState,
} from "@/core/puzzle/designer/types";

interface InteractiveAssemblyViewProps {
  puzzle3D: ConvertedPuzzle3D;
  pieceTransforms: PieceTransforms;
  appliedAngles: Record<string, number>;
  selectedPieceId: string | null;
  selectedConnectionId: string | null;
  solutions: AssemblySolutionOption[];
  selectedSolutionId: string | null;
  history: readonly AssemblyStepHistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  onSelectPiece: (pieceId: string | null) => void;
  onSelectConnection: (connectionId: string | null) => void;
  onSelectSolution: (solutionId: string) => void;
  onChangeAngle: (connectionId: string, angleDeg: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSnapPiece: (draggedPieceId: string, targetPieceId: string, connectionId: string, angleDeg: number) => void;
  onResetAssembly: () => void;
}

export const InteractiveAssemblyView: React.FC<InteractiveAssemblyViewProps> = ({
  puzzle3D,
  pieceTransforms,
  appliedAngles,
  selectedPieceId,
  selectedConnectionId,
  solutions,
  selectedSolutionId,
  history,
  canUndo,
  canRedo,
  onSelectPiece,
  onSelectConnection,
  onSelectSolution,
  onChangeAngle,
  onUndo,
  onRedo,
  onSnapPiece,
  onResetAssembly,
}) => {
  const [activeTab, setActiveTab] = useState<"assemble" | "solutions" | "coach" | "history">("assemble");
  const [coachAdvice, setCoachAdvice] = useState<CoachAdvice | null>(null);
  const [coachQuery, setCoachQuery] = useState("");

  const pieces = puzzle3D.pieces;
  const connections = puzzle3D.connections;

  // Evaluate snapping candidates for selected piece
  const selectedPiece = pieces.find((p) => p.pieceId === selectedPieceId);
  const currentTransform = selectedPieceId ? pieceTransforms[selectedPieceId] : null;

  const snapCandidates = selectedPieceId && currentTransform
    ? ConstraintSnappingEngine.findSnapCandidates(
        puzzle3D,
        selectedPieceId,
        currentTransform.position,
        pieceTransforms
      )
    : [];

  const ghostPreview: GhostPreviewState = selectedPieceId && currentTransform
    ? GhostPreviewEngine.computeGhostPreview({
        puzzle: puzzle3D,
        draggedPieceId: selectedPieceId,
        cursorWorldPosition: currentTransform.position,
        assembledTransforms: pieceTransforms,
        joiningAngleDeg: selectedConnectionId ? (appliedAngles[selectedConnectionId] ?? 90) : 90,
      })
    : { active: false, draggedPieceId: null, targetInterfaceId: null, proposedConnectionId: null, joiningAngleDeg: 90, status: "VALID" };

  const handleAskCoachNextPiece = () => {
    const advice = AssemblyCoach.recommendNextPiece(puzzle3D, pieceTransforms);
    setCoachAdvice(advice);
  };

  const handleDiagnoseConnection = () => {
    if (!selectedPieceId) return;
    const neighborConn = connections.find((c) => c.pieceAId === selectedPieceId || c.pieceBId === selectedPieceId);
    if (!neighborConn) return;
    const otherId = neighborConn.pieceAId === selectedPieceId ? neighborConn.pieceBId : neighborConn.pieceAId;
    const advice = AssemblyCoach.diagnoseConnectionFailure(puzzle3D, selectedPieceId, otherId, pieceTransforms);
    setCoachAdvice(advice);
  };

  const handleVerify60Deg = () => {
    if (!selectedConnectionId && connections.length > 0) {
      onSelectConnection(connections[0].connectionId);
    }
    const connId = selectedConnectionId || connections[0]?.connectionId;
    if (connId) {
      const advice = AssemblyCoach.verifyAngleFeasibility(puzzle3D, connId, 60);
      setCoachAdvice(advice);
    }
  };

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
      {/* Sub-navigation tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--wk-border, #e9ebef)",
          paddingBottom: "6px",
        }}
      >
        <div style={{ display: "flex", gap: "3px" }}>
          {(["assemble", "solutions", "coach", "history"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              style={{
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: activeTab === t ? 600 : 500,
                borderRadius: "4px",
                border: "none",
                background: activeTab === t ? "var(--wk-surface-3, #eceef1)" : "transparent",
                color: activeTab === t ? "var(--wk-ink, #1a1d23)" : "var(--wk-ink-soft, #565d68)",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t === "coach" ? "AI Coach" : t}
            </button>
          ))}
        </div>

        {/* Undo / Redo controls */}
        <div style={{ display: "flex", gap: "2px" }}>
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo assembly step"
            style={{
              padding: "2px 6px",
              fontSize: "11px",
              background: "transparent",
              border: "1px solid var(--wk-border, #e9ebef)",
              borderRadius: "4px",
              cursor: canUndo ? "pointer" : "not-allowed",
              opacity: canUndo ? 1 : 0.4,
            }}
          >
            ↶
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo assembly step"
            style={{
              padding: "2px 6px",
              fontSize: "11px",
              background: "transparent",
              border: "1px solid var(--wk-border, #e9ebef)",
              borderRadius: "4px",
              cursor: canRedo ? "pointer" : "not-allowed",
              opacity: canRedo ? 1 : 0.4,
            }}
          >
            ↷
          </button>
        </div>
      </div>

      {/* Tab 1: Interactive Assembly & Snapping */}
      {activeTab === "assemble" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Piece Picker */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--wk-ink-faint)", textTransform: "uppercase", marginBottom: "4px" }}>
              Selected Piece
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
              {pieces.map((p) => {
                const isSelected = p.pieceId === selectedPieceId;
                const isPlaced = Boolean(pieceTransforms[p.pieceId]);
                return (
                  <button
                    key={p.pieceId}
                    type="button"
                    onClick={() => onSelectPiece(isSelected ? null : p.pieceId)}
                    style={{
                      padding: "2px 6px",
                      fontSize: "10.5px",
                      borderRadius: "4px",
                      border: isSelected
                        ? "1px solid var(--wk-accent, #ef8c3b)"
                        : "1px solid var(--wk-border, #e9ebef)",
                      background: isSelected
                        ? "rgba(239, 140, 59, 0.15)"
                        : isPlaced
                        ? "var(--wk-surface-2, #fafbfc)"
                        : "#ffffff",
                      color: isSelected ? "var(--wk-accent-ink, #bd6a1e)" : "var(--wk-ink, #1a1d23)",
                      fontWeight: isSelected ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {p.pieceId}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Real-time Ghost Connection Preview (Prompt 107) */}
          {ghostPreview.active && (
            <div
              style={{
                padding: "8px",
                borderRadius: "6px",
                border: ghostPreview.status === "VALID"
                  ? "1px solid rgba(24, 165, 88, 0.3)"
                  : ghostPreview.status === "WARNING"
                  ? "1px solid rgba(240, 169, 27, 0.3)"
                  : "1px solid rgba(239, 68, 68, 0.3)",
                background: ghostPreview.status === "VALID"
                  ? "rgba(24, 165, 88, 0.05)"
                  : ghostPreview.status === "WARNING"
                  ? "rgba(240, 169, 27, 0.05)"
                  : "rgba(239, 68, 68, 0.05)",
                fontSize: "11px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                <strong>
                  Ghost Snap:{" "}
                  <span
                    style={{
                      color: ghostPreview.status === "VALID" ? "#18a558" : ghostPreview.status === "WARNING" ? "#f0a91b" : "#ef4444",
                    }}
                  >
                    {ghostPreview.status}
                  </span>
                </strong>
                <span>Clearance: {ghostPreview.minimumClearanceMm?.toFixed(1) ?? "1.2"} mm</span>
              </div>
              <div style={{ color: "var(--wk-ink-soft, #565d68)", fontSize: "10.5px" }}>
                {ghostPreview.reason}
              </div>
            </div>
          )}

          {/* Snapping Targets */}
          {snapCandidates.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--wk-ink-faint)", textTransform: "uppercase" }}>
                Available Snaps ({snapCandidates.length})
              </div>
              {snapCandidates.slice(0, 3).map((cand, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "4px 6px",
                    background: "var(--wk-surface-2, #fafbfc)",
                    borderRadius: "4px",
                    border: "1px solid var(--wk-border, #e9ebef)",
                    fontSize: "10.5px",
                  }}
                >
                  <div>
                    <span>{cand.draggedPieceId} ➔ {cand.targetPieceId}</span>
                    <span style={{ opacity: 0.6, marginLeft: "4px" }}>({cand.distanceMm}mm)</span>
                  </div>
                  <button
                    type="button"
                    disabled={!cand.isValid}
                    onClick={() => onSnapPiece(cand.draggedPieceId, cand.targetPieceId, cand.connectionId, cand.recommendedAngleDeg)}
                    style={{
                      padding: "2px 6px",
                      fontSize: "10px",
                      borderRadius: "3px",
                      border: "none",
                      background: cand.isValid ? "var(--wk-blue, #3b82f6)" : "var(--wk-ink-faint, #99a0ab)",
                      color: "#fff",
                      cursor: cand.isValid ? "pointer" : "not-allowed",
                    }}
                  >
                    Snap ({cand.recommendedAngleDeg}°)
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Angle Control Panel (Prompt 108) */}
          <div style={{ marginTop: "4px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--wk-ink-faint)", textTransform: "uppercase", marginBottom: "4px" }}>
              Connection Angle Control
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", marginBottom: "6px" }}>
              {connections.slice(0, 8).map((c) => (
                <button
                  key={c.connectionId}
                  type="button"
                  onClick={() => onSelectConnection(c.connectionId)}
                  style={{
                    padding: "2px 5px",
                    fontSize: "10px",
                    borderRadius: "3px",
                    border: selectedConnectionId === c.connectionId
                      ? "1px solid var(--wk-accent, #ef8c3b)"
                      : "1px solid var(--wk-border, #e9ebef)",
                    background: selectedConnectionId === c.connectionId ? "rgba(239, 140, 59, 0.1)" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  {c.connectionId}
                </button>
              ))}
            </div>

            <AssemblyAnglePanel
              puzzle3D={puzzle3D}
              connectionId={selectedConnectionId}
              appliedAngles={appliedAngles}
              onChangeAngle={onChangeAngle}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Multiple Assembly Solutions (Prompt 110) */}
      {activeTab === "solutions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "11px", color: "var(--wk-ink-soft, #565d68)" }}>
            Select from discovered valid kinematic assembly configurations:
          </div>
          {solutions.map((sol) => {
            const isSelected = selectedSolutionId === sol.id;
            return (
              <div
                key={sol.id}
                onClick={() => onSelectSolution(sol.id)}
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: isSelected ? "1.5px solid var(--wk-accent, #ef8c3b)" : "1px solid var(--wk-border, #e9ebef)",
                  background: isSelected ? "rgba(239, 140, 59, 0.05)" : "var(--wk-surface-2, #fafbfc)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  fontSize: "11px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: isSelected ? "var(--wk-accent-ink, #bd6a1e)" : "var(--wk-ink, #1a1d23)" }}>
                    {sol.name}
                  </strong>
                  <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "3px", background: "#dcfce7", color: "#166534", fontWeight: 600 }}>
                    VALID
                  </span>
                </div>
                <div style={{ color: "var(--wk-ink-soft, #565d68)", fontSize: "10.5px" }}>{sol.description}</div>
                <div style={{ display: "flex", gap: "10px", marginTop: "2px", fontSize: "10px", color: "var(--wk-ink-faint, #99a0ab)" }}>
                  <span>Angles: {sol.uniqueAnglesCount}</span>
                  <span>Clearance: {sol.minimumClearanceMm} mm</span>
                  <span>Score: {sol.structuralScore}/100</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: AI Assembly Coach (Prompt 112) */}
      {activeTab === "coach" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "11px", color: "var(--wk-ink-soft, #565d68)" }}>
            Ask the deterministic AI Coach for advice on the current assembly:
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <button
              type="button"
              onClick={handleAskCoachNextPiece}
              style={{
                textAlign: "left",
                padding: "6px 8px",
                fontSize: "11px",
                background: "var(--wk-surface-2, #fafbfc)",
                border: "1px solid var(--wk-border, #e9ebef)",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              👉 "Which piece should I connect next?"
            </button>
            <button
              type="button"
              onClick={handleDiagnoseConnection}
              style={{
                textAlign: "left",
                padding: "6px 8px",
                fontSize: "11px",
                background: "var(--wk-surface-2, #fafbfc)",
                border: "1px solid var(--wk-border, #e9ebef)",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              ❓ "Why can't I connect this selected piece?"
            </button>
            <button
              type="button"
              onClick={handleVerify60Deg}
              style={{
                textAlign: "left",
                padding: "6px 8px",
                fontSize: "11px",
                background: "var(--wk-surface-2, #fafbfc)",
                border: "1px solid var(--wk-border, #e9ebef)",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              📐 "Can I make this connection 60 degrees?"
            </button>
          </div>

          {coachAdvice && (
            <div
              style={{
                padding: "8px",
                background: "rgba(59, 130, 246, 0.08)",
                borderLeft: "3px solid #3b82f6",
                borderRadius: "4px",
                fontSize: "11px",
                lineHeight: "1.4",
              }}
            >
              <div style={{ fontWeight: 700, color: "#1d4ed8", marginBottom: "2px" }}>
                AI Coach Advice
              </div>
              {coachAdvice.recommendedPieceId && (
                <div>
                  <strong>Piece {coachAdvice.recommendedPieceId}</strong>: {coachAdvice.recommendedReason}
                </div>
              )}
              {coachAdvice.connectionDiagnostics && (
                <div>
                  <strong>Diagnostic</strong>: {coachAdvice.connectionDiagnostics.reason}
                </div>
              )}
              {coachAdvice.angleFeasibility && (
                <div>
                  <strong>Feasibility</strong>: {coachAdvice.angleFeasibility.reason}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Assembly State History (Prompt 109) */}
      {activeTab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700 }}>Action History ({history.length})</span>
            <button
              type="button"
              onClick={onResetAssembly}
              style={{
                background: "none",
                border: "none",
                fontSize: "10px",
                color: "var(--wk-red, #ef4444)",
                cursor: "pointer",
              }}
            >
              Reset Assembly
            </button>
          </div>

          <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
            {history.map((step, idx) => (
              <div
                key={step.id || idx}
                style={{
                  padding: "4px 6px",
                  borderRadius: "4px",
                  background: "var(--wk-surface-2, #fafbfc)",
                  border: "1px solid var(--wk-border, #e9ebef)",
                  fontSize: "10.5px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{step.description}</span>
                <span style={{ fontSize: "9.5px", color: "var(--wk-ink-faint, #99a0ab)" }}>
                  {step.timestamp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
