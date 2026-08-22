import { useEffect, useState } from "react";
import type { ConnectorPattern, ConnectorType } from "@/core/model/types";
import { useProject, useUI } from "@/core/store/store";
import { connectPortPair, createPortPair, findConnector, selectConnector, type EdgePlacement } from "@/core/store/actions";

type Edge = "top" | "right" | "bottom" | "left" | "center";
const JOINTS: { type: ConnectorType; pattern: ConnectorPattern; label: string; detail: string }[] = [
  { type: "tab", pattern: "standard", label: "Tab & slot", detail: "A simple slide-in joint" },
  { type: "peg", pattern: "peg_hole", label: "Peg & hole", detail: "A round locating joint" },
  { type: "custom", pattern: "dovetail", label: "Dovetail", detail: "A locking tapered profile" },
  { type: "custom", pattern: "finger", label: "Finger joint", detail: "Interlocking box fingers" },
];

function PartSelect(props: { label: string; value: string; onChange: (id: string) => void; exclude?: string }) {
  const project = useProject();
  return <label className="wk-field"><span className="wk-field__label">{props.label}</span><select className="wk-select" value={props.value} onChange={(e) => props.onChange(e.target.value)}><option value="">Choose a part…</option>{project.parts.filter((part) => part.id !== props.exclude).map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}</select></label>;
}

export default function JointsPanel(): JSX.Element {
  const project = useProject();
  const ui = useUI();
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [sourceEdge, setSourceEdge] = useState<Edge>("bottom");
  const [targetEdge, setTargetEdge] = useState<Edge>("top");
  const [joint, setJoint] = useState(JOINTS[0]);
  const [tolerance, setTolerance] = useState(0.2);
  useEffect(() => { if (ui.activePartId && project.parts.some((part) => part.id === ui.activePartId)) setSourceId(ui.activePartId); }, [ui.activePartId, project.parts]);
  const create = () => {
    if (!sourceId || !targetId) return;
    createPortPair(sourceId, targetId, joint.type, { pattern: joint.pattern, tolerance }, { edge: sourceEdge } as EdgePlacement, { edge: targetEdge } as EdgePlacement);
  };
  const selected = ui.selectedConnectorId ? findConnector(ui.selectedConnectorId) : undefined;
  const existing = project.parts.flatMap((part) => part.connectors.map((connector) => ({ part, connector })));
  return <div className="wk-panel__body" style={{ padding: 12, display: "grid", gap: 14 }}>
    <div><div className="wk-section-title" style={{ margin: 0 }}>Joints</div><p style={{ margin: "5px 0 0", color: "var(--wk-ink-soft)", fontSize: 12 }}>Create a matched plug and receiver without leaving the canvas.</p></div>
    <div style={{ display: "grid", gap: 8 }}><PartSelect label="1. Connector part" value={sourceId} onChange={setSourceId} /><PartSelect label="2. Mating part" value={targetId} onChange={setTargetId} exclude={sourceId} /></div>
    <div><div className="wk-field__label" style={{ marginBottom: 6 }}>3. Joint type</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{JOINTS.map((option) => <button key={option.label} type="button" className={`wk-btn ${joint.label === option.label ? "wk-btn--primary" : "wk-btn--ghost"}`} style={{ textAlign: "left", padding: "8px 9px" }} onClick={() => setJoint(option)}><div style={{ fontWeight: 700, fontSize: 12 }}>{option.label}</div><div style={{ opacity: .75, fontSize: 10 }}>{option.detail}</div></button>)}</div></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><label className="wk-field"><span className="wk-field__label">Connector position</span><select className="wk-select" value={sourceEdge} onChange={(e) => setSourceEdge(e.target.value as Edge)}>{(["top", "right", "bottom", "left", "center"] as Edge[]).map((edge) => <option key={edge}>{edge}</option>)}</select></label><label className="wk-field"><span className="wk-field__label">Receiver position</span><select className="wk-select" value={targetEdge} onChange={(e) => setTargetEdge(e.target.value as Edge)}>{(["top", "right", "bottom", "left", "center"] as Edge[]).map((edge) => <option key={edge}>{edge}</option>)}</select></label></div>
    <label className="wk-field"><span className="wk-field__label">Clearance (mm)</span><input className="wk-input wk-input--num" type="number" min="0" step="0.05" value={tolerance} onChange={(e) => setTolerance(Number(e.target.value) || 0)} /></label>
    <button type="button" className="wk-btn wk-btn--primary" disabled={!sourceId || !targetId} onClick={create}>Create matched joint</button>
    <div style={{ borderTop: "1px solid var(--wk-border)", paddingTop: 10 }}><div className="wk-field__label">Selected port</div>{selected ? <><div style={{ fontSize: 12, margin: "4px 0 8px" }}>{selected.name}</div><button type="button" className="wk-btn wk-btn--ghost" onClick={() => connectPortPair(selected.id)}>Snap & connect pair</button></> : <div className="wk-empty">Select a port on the canvas to inspect or connect it.</div>}</div>
    <div style={{ borderTop: "1px solid var(--wk-border)", paddingTop: 10 }}><div className="wk-field__label">Existing joints</div>{existing.length ? existing.slice(0, 8).map(({ part, connector }) => <button key={connector.id} type="button" className="wk-row" onClick={() => selectConnector(connector.id)}><span className="wk-row__name">{connector.name}</span><span className="wk-chip">{part.name}</span></button>) : <div className="wk-empty">No joints created yet.</div>}</div>
  </div>;
}
