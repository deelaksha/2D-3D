import { useState } from "react";
import type { Connector, ConnectorPattern, ConnectorType, Part } from "@/core/model/types";
import { useProject, useUI } from "@/core/store/store";
import {
  createPortPair,
  createReceiverForConnector,
  connectPortPair,
  findConnector,
  selectConnector,
  syncReceiverToConnector,
  updateConnector,
  deleteConnector,
  rotateConnector,
  calcEdgePosition,
  addConnector,
  convertShapeToConnector,
  type EdgePlacement,
} from "@/core/store/actions";

type EdgeName = "top" | "bottom" | "left" | "right" | "center";

export default function JointsPanel(): JSX.Element {
  const project = useProject();
  const ui = useUI();

  // Part Selection State
  const [sourcePartId, setSourcePartId] = useState<string>(
    ui.activePartId || project.parts[0]?.id || ""
  );
  const [targetPartId, setTargetPartId] = useState<string>(
    project.parts.find((p) => p.id !== (ui.activePartId || project.parts[0]?.id))?.id || ""
  );

  // Position & Edge Placement State
  const [sourceEdge, setSourceEdge] = useState<EdgeName>("bottom");
  const [sourceOffset, setSourceOffset] = useState<number>(0);
  const [targetEdge, setTargetEdge] = useState<EdgeName>("center");
  const [targetOffset, setTargetOffset] = useState<number>(0);

  // Connector ID Receiver Sync State
  const [selectedSourceConnId, setSelectedSourceConnId] = useState<string>("");

  // Custom Connector Builder State
  const [customName, setCustomName] = useState<string>("MyCustomJoint");
  const [customType, setCustomType] = useState<ConnectorType>("custom");
  const [customPattern, setCustomPattern] = useState<ConnectorPattern>("custom");
  const [customWidth, setCustomWidth] = useState<number>(16);
  const [customHeight, setCustomHeight] = useState<number>(6);
  const [customDepth, setCustomDepth] = useState<number>(4);

  const sourcePart = project.parts.find((p) => p.id === sourcePartId);
  const targetPart = project.parts.find((p) => p.id === targetPartId);

  // Gather all connectors in the project
  const allConnectors: { part: Part; connector: Connector }[] = [];
  for (const p of project.parts) {
    for (const c of p.connectors) {
      allConnectors.push({ part: p, connector: c });
    }
  }

  const selectedConn = ui.selectedConnectorId
    ? findConnector(ui.selectedConnectorId)
    : undefined;
  const selectedConnPart = selectedConn
    ? project.parts.find((p) => p.id === selectedConn.partId)
    : undefined;

  const handleCreateJoint = (type: ConnectorType, pattern: ConnectorPattern, diameter?: number) => {
    if (!sourcePartId) return;
    const srcPlacement: EdgePlacement = { edge: sourceEdge, offsetMm: sourceOffset };
    const tgtPlacement: EdgePlacement = { edge: targetEdge, offsetMm: targetOffset };

    createPortPair(
      sourcePartId,
      targetPartId || undefined,
      type,
      { pattern, diameter },
      srcPlacement,
      tgtPlacement
    );
  };

  return (
    <div className="wk-panel__body" style={{ padding: 12 }}>
      {/* Header */}
      <div className="wk-section-title" style={{ marginTop: 0, fontSize: 13, fontWeight: 700, color: "var(--wk-accent, #ef8c3b)" }}>
        ⚡ Wooden Joints & Attachment Engine
      </div>
      <p style={{ fontSize: 11, color: "var(--wk-ink-soft, #94a3b8)", marginBottom: 12 }}>
        Choose source & target objects, pick attachment edges & positions, and generate 2D/3D wood joints automatically.
      </p>

      {/* OBJECT ATTACHMENT SELECTION */}
      <div className="wk-section-title">1. Object Attachment Selection</div>
      <div className="wk-field">
        <span className="wk-field__label">Source Object (Plug)</span>
        <select
          className="wk-select"
          value={sourcePartId}
          onChange={(e) => setSourcePartId(e.target.value)}
        >
          <option value="">-- Select Source Part --</option>
          {project.parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({Math.round(p.width)}x{Math.round(p.height)}mm)
            </option>
          ))}
        </select>
      </div>

      <div className="wk-field" style={{ marginTop: 6 }}>
        <span className="wk-field__label">Target Object (Receiver)</span>
        <select
          className="wk-select"
          value={targetPartId}
          onChange={(e) => setTargetPartId(e.target.value)}
        >
          <option value="">-- Select Target Part --</option>
          {project.parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({Math.round(p.width)}x{Math.round(p.height)}mm)
            </option>
          ))}
        </select>
      </div>

      {/* POSITION & EDGE SELECTION */}
      <div className="wk-section-title">2. Attachment Position & Edge</div>

      {/* Source Position */}
      <div style={{ background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--wk-ink)", marginBottom: 4 }}>
          Source Edge ({sourcePart?.name ?? "Source Part"}):
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {(["top", "bottom", "left", "right", "center"] as const).map((e) => (
            <button
              key={e}
              type="button"
              className={`wk-btn${sourceEdge === e ? " wk-btn--primary" : " wk-btn--ghost"}`}
              style={{ fontSize: 10, padding: "3px 7px", textTransform: "capitalize" }}
              onClick={() => setSourceEdge(e)}
            >
              {e}
            </button>
          ))}
        </div>
        <label className="wk-field" style={{ margin: 0 }}>
          <span className="wk-field__label" style={{ fontSize: 10 }}>Edge Offset (mm)</span>
          <input
            className="wk-input wk-input--num"
            type="number"
            value={sourceOffset}
            onChange={(e) => setSourceOffset(parseFloat(e.target.value) || 0)}
          />
        </label>
      </div>

      {/* Target Position */}
      <div style={{ background: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 6, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--wk-ink)", marginBottom: 4 }}>
          Target Edge ({targetPart?.name ?? "Target Part"}):
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {(["center", "top", "bottom", "left", "right"] as const).map((e) => (
            <button
              key={e}
              type="button"
              className={`wk-btn${targetEdge === e ? " wk-btn--primary" : " wk-btn--ghost"}`}
              style={{ fontSize: 10, padding: "3px 7px", textTransform: "capitalize" }}
              onClick={() => setTargetEdge(e)}
            >
              {e}
            </button>
          ))}
        </div>
        <label className="wk-field" style={{ margin: 0 }}>
          <span className="wk-field__label" style={{ fontSize: 10 }}>Edge Offset (mm)</span>
          <input
            className="wk-input wk-input--num"
            type="number"
            value={targetOffset}
            onChange={(e) => setTargetOffset(parseFloat(e.target.value) || 0)}
          />
        </label>
      </div>

      {/* 3. GENERATE JOINT */}
      <div className="wk-section-title">3. Create Perpendicular Wooden Joint</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
        <button
          type="button"
          className="wk-btn wk-btn--primary"
          style={{ fontSize: 11, justifyContent: "center", padding: "6px 8px" }}
          disabled={!sourcePartId}
          onClick={() => handleCreateJoint("tab", "standard")}
          title="Attach Slot Joint"
        >
          1. Slot Joint
        </button>
        <button
          type="button"
          className="wk-btn wk-btn--primary"
          style={{ fontSize: 11, justifyContent: "center", padding: "6px 8px" }}
          disabled={!sourcePartId}
          onClick={() => handleCreateJoint("tab", "shoulder")}
          title="Attach Tab & Slot Joint with Shoulder"
        >
          2. Shoulder Joint
        </button>
        <button
          type="button"
          className="wk-btn wk-btn--primary"
          style={{ fontSize: 11, justifyContent: "center", padding: "6px 8px" }}
          disabled={!sourcePartId}
          onClick={() => handleCreateJoint("notch", "halflap")}
          title="Attach Half-Lap Joint"
        >
          3. Half-Lap Joint
        </button>
        <button
          type="button"
          className="wk-btn wk-btn--primary"
          style={{ fontSize: 11, justifyContent: "center", padding: "6px 8px" }}
          disabled={!sourcePartId}
          onClick={() => handleCreateJoint("tab", "finger")}
          title="Attach Interlocking Finger Joint"
        >
          4. Finger Joint
        </button>
        <button
          type="button"
          className="wk-btn wk-btn--primary"
          style={{ fontSize: 11, justifyContent: "center", padding: "6px 8px" }}
          disabled={!sourcePartId}
          onClick={() => handleCreateJoint("tab", "dovetail")}
          title="Attach Dovetail Joint"
        >
          5. Dovetail Joint
        </button>
        <button
          type="button"
          className="wk-btn wk-btn--primary"
          style={{ fontSize: 11, justifyContent: "center", padding: "6px 8px" }}
          disabled={!sourcePartId}
          onClick={() => handleCreateJoint("peg", "peg_hole", 6)}
          title="Attach Peg & Hole Joint"
        >
          6. Peg & Hole Joint
        </button>
      </div>

      {/* 4. CUSTOM CONNECTOR BUILDER */}
      <div className="wk-section-title" style={{ color: "var(--wk-accent, #ef8c3b)" }}>
        ✨ Create Custom Connector & Receiver Pair
      </div>
      <div style={{ background: "rgba(239,140,59,0.06)", border: "1px dashed var(--wk-accent)", padding: 10, borderRadius: 6, marginBottom: 14 }}>
        <div className="wk-field">
          <span className="wk-field__label">Custom Name</span>
          <input
            type="text"
            className="wk-input"
            value={customName}
            placeholder="e.g. SnapLock, PinJoint..."
            onChange={(e) => setCustomName(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
          <label className="wk-field">
            <span className="wk-field__label">Type</span>
            <select
              className="wk-select"
              value={customType}
              onChange={(e) => setCustomType(e.target.value as ConnectorType)}
            >
              <option value="custom">custom</option>
              <option value="tab">tab</option>
              <option value="slot">slot</option>
              <option value="peg">peg</option>
              <option value="hole">hole</option>
              <option value="dowel">dowel</option>
              <option value="notch">notch</option>
              <option value="hinge">hinge</option>
              <option value="magnet">magnet</option>
              <option value="snap">snap</option>
            </select>
          </label>
          <label className="wk-field">
            <span className="wk-field__label">Pattern</span>
            <select
              className="wk-select"
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value as ConnectorPattern)}
            >
              <option value="custom">Custom Design</option>
              <option value="standard">Standard</option>
              <option value="dovetail">Dovetail</option>
              <option value="shoulder">Shoulder</option>
              <option value="halflap">Half-Lap</option>
              <option value="finger">Finger</option>
              <option value="puzzle">Puzzle Key</option>
              <option value="tslot">T-Slot</option>
              <option value="wave">Wave</option>
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 6 }}>
          <label className="wk-field">
            <span className="wk-field__label">Width (mm)</span>
            <input
              type="number"
              className="wk-input wk-input--num"
              value={customWidth}
              onChange={(e) => setCustomWidth(parseFloat(e.target.value) || 1)}
            />
          </label>
          <label className="wk-field">
            <span className="wk-field__label">Height (mm)</span>
            <input
              type="number"
              className="wk-input wk-input--num"
              value={customHeight}
              onChange={(e) => setCustomHeight(parseFloat(e.target.value) || 1)}
            />
          </label>
          <label className="wk-field">
            <span className="wk-field__label">Depth (mm)</span>
            <input
              type="number"
              className="wk-input wk-input--num"
              value={customDepth}
              onChange={(e) => setCustomDepth(parseFloat(e.target.value) || 1)}
            />
          </label>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          <button
            type="button"
            className="wk-btn wk-btn--primary"
            style={{ justifyContent: "center", fontWeight: 700, fontSize: 11 }}
            disabled={!sourcePartId}
            onClick={() => {
              const srcPlacement: EdgePlacement = { edge: sourceEdge, offsetMm: sourceOffset };
              const tgtPlacement: EdgePlacement = { edge: targetEdge, offsetMm: targetOffset };
              createPortPair(
                sourcePartId,
                targetPartId || undefined,
                customType,
                {
                  name: customName || "Custom Connector",
                  customTypeName: customName || "CustomJoint",
                  pattern: customPattern,
                  width: customWidth,
                  height: customHeight,
                  depth: customDepth,
                },
                srcPlacement,
                tgtPlacement
              );
            }}
            title="Create Custom Connector Plug on Source Part and matching Receiver Socket on Target Part"
          >
            ✨ Create Custom Pair & Auto-Sync
          </button>

          <button
            type="button"
            className="wk-btn wk-btn--ghost"
            style={{ justifyContent: "center", fontSize: 10 }}
            disabled={!sourcePartId}
            onClick={() => {
              if (!sourcePart) return;
              const res = calcEdgePosition(sourcePart, { edge: sourceEdge, offsetMm: sourceOffset });
              addConnector(sourcePartId, customType, res.pos, {
                name: customName || "Custom Connector",
                customTypeName: customName || "CustomJoint",
                pattern: customPattern,
                width: customWidth,
                height: customHeight,
                depth: customDepth,
                orientation: res.orientation,
              });
            }}
            title="Add a single custom connector to the source part"
          >
            ＋ Add Single Custom Connector to Source Part
          </button>
        </div>
      </div>

      {/* CONVERT DRAWN SHAPE INTO CUSTOM CONNECTOR */}
      {sourcePart && sourcePart.modifiers.length > 0 && (
        <div style={{ background: "rgba(168, 85, 247, 0.08)", border: "1px solid var(--wk-purple, #a855f7)", padding: 10, borderRadius: 6, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wk-purple, #a855f7)", marginBottom: 4 }}>
            🎨 Convert Drawn 2D Shape into Custom Joint
          </div>
          <p style={{ fontSize: 10, color: "var(--wk-ink-soft)", marginBottom: 6 }}>
            Convert any drawn circle, rectangle, slot, or polygon on {sourcePart.name} into a custom connector with auto-synced receiver!
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {sourcePart.modifiers.map((m) => (
              <button
                key={m.id}
                type="button"
                className="wk-btn wk-btn--primary"
                style={{ fontSize: 10, justifyContent: "space-between", padding: "5px 8px", background: "var(--wk-purple, #a855f7)" }}
                onClick={() => convertShapeToConnector(sourcePart.id, m.id, targetPartId || undefined, customType, customPattern)}
                title="Convert this drawn shape into a joint connector"
              >
                <span>✨ Turn "{m.name || m.shape.kind}" into Connector</span>
                <span>→ Auto-Sync</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SELECTED CONNECTOR POSITION ADJUSTER */}
      {selectedConn && selectedConnPart && (
        <div style={{ background: "rgba(239,140,59,0.08)", border: "1px solid var(--wk-accent)", padding: 10, borderRadius: 6, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wk-accent)", marginBottom: 4 }}>
            Selected Joint: {selectedConn.name}
          </div>
          <div style={{ fontSize: 10, color: "var(--wk-ink-soft)", marginBottom: 8 }}>
            Attached to Object: <strong>{selectedConnPart.name}</strong> · ID: <code>{selectedConn.id}</code>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
            <label className="wk-field">
              <span className="wk-field__label">Pos X (mm)</span>
              <input
                className="wk-input wk-input--num"
                type="number"
                value={selectedConn.position?.x ?? 0}
                onChange={(e) =>
                  updateConnector(selectedConn.id, {
                    position: { x: parseFloat(e.target.value) || 0, y: selectedConn.position?.y ?? 0 },
                  })
                }
              />
            </label>
            <label className="wk-field">
              <span className="wk-field__label">Pos Y (mm)</span>
              <input
                className="wk-input wk-input--num"
                type="number"
                value={selectedConn.position?.y ?? 0}
                onChange={(e) =>
                  updateConnector(selectedConn.id, {
                    position: { x: selectedConn.position?.x ?? 0, y: parseFloat(e.target.value) || 0 },
                  })
                }
              />
            </label>
          </div>

          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--wk-ink)", marginBottom: 4 }}>
            Quick Snap to Edge:
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {(["top", "bottom", "left", "right", "center"] as const).map((e) => {
              const res = calcEdgePosition(selectedConnPart, { edge: e });
              return (
                <button
                  key={e}
                  type="button"
                  className="wk-btn wk-btn--ghost"
                  style={{ fontSize: 10, padding: "2px 6px", textTransform: "capitalize" }}
                  onClick={() =>
                    updateConnector(selectedConn.id, {
                      position: res.pos,
                      orientation: res.orientation,
                    })
                  }
                >
                  {e}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="wk-btn wk-btn--primary"
              style={{ flex: 1, fontSize: 10, justifyContent: "center" }}
              onClick={() => connectPortPair(selectedConn.id)}
            >
              ⚡ Snap in 3D
            </button>
            <button
              type="button"
              className="wk-btn wk-btn--ghost"
              style={{ fontSize: 10, justifyContent: "center" }}
              onClick={() => rotateConnector(selectedConn.id, 90)}
            >
              ↻ Rotate 90°
            </button>
          </div>
        </div>
      )}

      {/* Connector ID Reference & Receiver Auto-Creation */}
      <div className="wk-section-title">Connector ID Receiver Sync</div>
      <div className="wk-field">
        <span className="wk-field__label">Source Connector</span>
        <select
          className="wk-select"
          value={selectedSourceConnId}
          onChange={(e) => setSelectedSourceConnId(e.target.value)}
        >
          <option value="">-- Select Source Connector --</option>
          {allConnectors.map(({ part, connector }) => (
            <option key={connector.id} value={connector.id}>
              {part.name} → {connector.name} ({connector.id})
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, marginBottom: 14 }}>
        <button
          type="button"
          className="wk-btn wk-btn--primary"
          style={{ justifyContent: "center", fontWeight: 700, fontSize: 11 }}
          disabled={!selectedSourceConnId}
          onClick={() => {
            if (selectedSourceConnId) {
              createReceiverForConnector(selectedSourceConnId, targetPartId || undefined);
            }
          }}
          title="Automatically generate matching Receiver socket on target part with locked dimensions"
        >
          ⚡ Auto-Create Receiver on Target Object
        </button>
      </div>

      {/* Active Connectors & Synced Joint Pairs */}
      <div className="wk-section-title">
        Project Connectors & Joints ({allConnectors.length})
      </div>
      {allConnectors.length === 0 ? (
        <div className="wk-empty">No connectors or joints created yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {allConnectors.map(({ part, connector: c }) => {
            const isSelected = ui.selectedConnectorId === c.id;
            const isSynced = Boolean(c.referencedConnectorId);
            return (
              <div
                key={c.id}
                className="wk-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  borderRadius: 4,
                  background: isSelected ? "var(--wk-bg-selected, rgba(239,140,59,0.15))" : "var(--wk-bg-subtle, rgba(255,255,255,0.03))",
                  border: isSelected ? "1px solid var(--wk-accent)" : "1px solid transparent",
                  cursor: "pointer",
                }}
                onClick={() => selectConnector(c.id)}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--wk-ink)" }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--wk-ink-soft)" }}>
                    Attached to: <strong>{part.name}</strong> · ({Math.round(c.position?.x ?? 0)}, {Math.round(c.position?.y ?? 0)}mm)
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {isSynced && (
                    <span className="wk-chip" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#16a34a", fontSize: 9 }}>
                      Synced
                    </span>
                  )}
                  <span className="wk-chip" style={{ fontSize: 9 }}>
                    {c.pattern ?? c.type}
                  </span>
                  <button
                    type="button"
                    className="wk-btn wk-btn--ghost"
                    style={{ padding: "2px 5px", fontSize: 10, color: "#ef4444" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConnector(c.id);
                    }}
                    title="Delete connector"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
