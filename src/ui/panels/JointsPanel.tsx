import { useEffect, useState } from "react";
import type { ConnectorPattern, ConnectorType, Part } from "@/core/model/types";
import { useProject, useUI } from "@/core/store/store";
import { connectPortPair, convertShapeToConnector, createPart, createPortPair, findConnector, selectConnector, type EdgePlacement } from "@/core/store/actions";
import { identityTransform } from "@/core/model/defaults";
import { partConnectorSummaries, validateAssembly } from "@/core/assembly/validate";
import { edgeOrientation, oppositeEdge, oppositeOrientation, type Edge } from "@/core/connectors/mate";

const JOINTS: { type: ConnectorType; pattern: ConnectorPattern; label: string; detail: string }[] = [
  { type: "tab", pattern: "standard", label: "Tab & slot", detail: "A simple slide-in joint" },
  { type: "peg", pattern: "peg_hole", label: "Peg & hole", detail: "A round locating joint" },
  { type: "custom", pattern: "dovetail", label: "Dovetail", detail: "A locking tapered profile" },
  { type: "custom", pattern: "finger", label: "Finger joint", detail: "Interlocking box fingers" },
  { type: "custom", pattern: "custom", label: "Custom profile", detail: "Define your own joint feature" },
];
const CUSTOM_PROFILES: { pattern: ConnectorPattern; label: string }[] = [
  { pattern: "dovetail", label: "Dovetail" }, { pattern: "finger", label: "Finger" },
  { pattern: "halflap", label: "Half lap" }, { pattern: "shoulder", label: "Shoulder" },
  { pattern: "puzzle", label: "Puzzle" }, { pattern: "tslot", label: "T-slot" },
  { pattern: "teeth", label: "Teeth" }, { pattern: "wave", label: "Wave" },
];

/** A deliberately simple, readable profile language used in the builder.
 * The same glyph is shown as material for a plug and as a cutout for its mate. */
function ProfileGlyph(props: { pattern: ConnectorPattern; receiver?: boolean; x?: number; y?: number; width?: number; height?: number }) {
  const { pattern, receiver = false, x = 0, y = 0, width = 48, height = 28 } = props;
  const fill = receiver ? "#10294b" : "#f59e0b";
  const stroke = receiver ? "#f8d28b" : "#fff1c2";
  const cx = x + width / 2, cy = y + height / 2;
  if (pattern === "puzzle") return <path d={`M${x} ${y + 5}h${width * .28}a5 5 0 1 1 ${width * .18} 0H${x + width}v${height - 10}H${x + width * .46}a5 5 0 1 1-${width * .18} 0H${x}Z`} fill={fill} stroke={stroke} strokeWidth="2" />;
  if (pattern === "finger" || pattern === "teeth") return <path d={`M${x} ${y}h${width}v${height * .28}h-${width * .18}v${height * .22}h${width * .18}v${height * .22}h-${width * .18}V${y + height}H${x}v-${height * .28}h${width * .18}v-${height * .22}H${x}Z`} fill={fill} stroke={stroke} strokeWidth="2" />;
  if (pattern === "wave") return <path d={`M${x} ${cy}q${width / 8}-${height / 2} ${width / 4} 0t${width / 4} 0t${width / 4} 0t${width / 4} 0v${height / 4}q-${width / 8} ${height / 2}-${width / 4} 0t-${width / 4} 0t-${width / 4} 0t-${width / 4} 0Z`} fill={fill} stroke={stroke} strokeWidth="2" />;
  if (pattern === "tslot") return <path d={`M${x} ${y}h${width}v${height * .35}h-${width * .3}V${y + height}h-${width * .4}V${y + height * .35}H${x}Z`} fill={fill} stroke={stroke} strokeWidth="2" />;
  if (pattern === "halflap") return <path d={`M${x} ${y}h${width}v${height / 2}h-${width / 2}v${height / 2}H${x}Z`} fill={fill} stroke={stroke} strokeWidth="2" />;
  if (pattern === "shoulder") return <path d={`M${x} ${y + height * .24}h${width * .2}v-${height * .24}h${width * .6}v${height * .24}h${width * .2}v${height * .52}h-${width * .2}v${height * .24}h-${width * .6}v-${height * .24}h-${width * .2}Z`} fill={fill} stroke={stroke} strokeWidth="2" />;
  // dovetail (and the free-form custom fallback) is a tapered locking profile.
  return <path d={`M${x + width * .18} ${y}h${width * .64}L${x + width} ${y + height}H${x}Z`} fill={fill} stroke={stroke} strokeWidth="2" />;
}

function PartSelect(props: { label: string; value: string; onChange: (id: string) => void; exclude?: string }) {
  const project = useProject();
  return <label className="wk-field"><span className="wk-field__label">{props.label}</span><select className="wk-select" value={props.value} onChange={(e) => props.onChange(e.target.value)}><option value="">Choose a part…</option>{project.parts.filter((part) => part.id !== props.exclude).map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}</select></label>;
}

/** The on-screen box a part's silhouette occupies in the preview svg, shared
 * by the silhouette itself and by edge-dot placement so they never drift apart. */
function silhouetteBox(part: Part | undefined, x: number) {
  const width = part?.shape.width ?? 100;
  const height = part?.shape.height ?? 80;
  const scale = Math.min(98 / Math.max(width, 1), 58 / Math.max(height, 1));
  const w = Math.max(26, width * scale);
  const h = Math.max(26, height * scale);
  const y0 = 70 - h / 2;
  return { x0: x, x1: x + w, y0, y1: y0 + h, cx: x + w / 2, cy: 70, w, h };
}

/** Where a named edge's joint sits on a part's on-screen silhouette box. */
function edgePoint(box: ReturnType<typeof silhouetteBox>, edge: Edge): { x: number; y: number } {
  switch (edge) {
    case "top": return { x: box.cx, y: box.y0 };
    case "bottom": return { x: box.cx, y: box.y1 };
    case "left": return { x: box.x0, y: box.cy };
    case "right": return { x: box.x1, y: box.cy };
    default: return { x: box.cx, y: box.cy };
  }
}

function PartSilhouette(props: { part?: Part; x: number; fill: string }) {
  const { part, x, fill } = props;
  const { x0, y0, w, h } = silhouetteBox(part, x);
  const common = { fill, stroke: "#f3d49e", strokeWidth: 2 };
  if (part?.shape.kind === "circle" || part?.shape.kind === "ellipse") return <ellipse cx={x0 + w / 2} cy="70" rx={w / 2} ry={h / 2} {...common} />;
  if (part?.shape.kind === "triangle") return <path d={`M ${x0 + w / 2} ${y0} L ${x0 + w} ${y0 + h} L ${x0} ${y0 + h} Z`} {...common} />;
  if (part?.shape.kind === "hexagon") return <path d={`M ${x0 + w * .25} ${y0} L ${x0 + w * .75} ${y0} L ${x0 + w} ${y0 + h / 2} L ${x0 + w * .75} ${y0 + h} L ${x0 + w * .25} ${y0 + h} L ${x0} ${y0 + h / 2} Z`} {...common} />;
  return <rect x={x0} y={y0} width={w} height={h} rx={part?.shape.kind === "roundedRect" ? Math.min(10, w / 6) : 4} {...common} />;
}

/** A small arrow, rotated to the connector's world-facing direction (0° = →,
 * matching the same CW/y-down orientation convention used everywhere else). */
function OrientArrow(props: { x: number; y: number; angleDeg: number; color: string }) {
  return <g transform={`translate(${props.x} ${props.y}) rotate(${props.angleDeg})`}>
    <path d="M4,-5 L17,0 L4,5 Z" fill={props.color} stroke="#0b1c34" strokeWidth="1" />
  </g>;
}

function facingLabel(deg: number): string {
  const n = ((deg % 360) + 360) % 360;
  if (n === 0) return "0° →";
  if (n === 90) return "90° ↓";
  if (n === 180) return "180° ←";
  if (n === 270) return "270° ↑";
  return `${Math.round(n)}°`;
}

function JointPreview(props: { type: ConnectorType; pattern: ConnectorPattern; sourceEdge: Edge; targetEdge: Edge; targetOrientation: number; source?: Part; target?: Part; ready: boolean }) {
  const isRound = props.type === "peg";
  const srcOrientation = edgeOrientation(props.sourceEdge);
  const tgtOrientation = props.targetOrientation;
  const srcBox = silhouetteBox(props.source, 24);
  const tgtBox = silhouetteBox(props.target, 178);
  const srcDot = edgePoint(srcBox, props.sourceEdge);
  const tgtDot = edgePoint(tgtBox, props.targetEdge);

  const glyphAt = (dot: { x: number; y: number }, angleDeg: number, receiver: boolean) =>
    isRound
      ? <circle cx={dot.x} cy={dot.y} r={receiver ? 13 : 12} fill={receiver ? "#10294b" : "#f59e0b"} stroke={receiver ? "#f8d28b" : "#fff1c2"} strokeWidth="2" />
      : <g transform={`rotate(${angleDeg} ${dot.x} ${dot.y})`}><ProfileGlyph pattern={props.pattern} receiver={receiver} x={dot.x - 22} y={dot.y - 14} width={44} height={28} /></g>;

  return <div style={{ border: "1px solid var(--wk-border)", borderRadius: 10, overflow: "hidden", background: "linear-gradient(135deg, #10294b, #0b1c34)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", fontSize: 10, color: "var(--wk-ink-soft)", borderBottom: "1px solid rgba(255,255,255,.08)" }}><span>LIVE JOINT PREVIEW</span><span style={{ color: props.ready ? "#86efac" : "#fbbf24" }}>{props.ready ? "READY" : "SELECT PARTS"}</span></div>
    <svg viewBox="0 0 300 140" width="100%" height="140" aria-label="Joint preview">
      <PartSilhouette part={props.source} x={24} fill="#d9b380" />
      <PartSilhouette part={props.target} x={178} fill="#c99a61" />
      <path d={`M${srcDot.x} ${srcDot.y}L${tgtDot.x} ${tgtDot.y}`} stroke="#facc15" strokeWidth="1.5" strokeDasharray="4 4" />
      {glyphAt(srcDot, srcOrientation, false)}
      {glyphAt(tgtDot, tgtOrientation, true)}
      <OrientArrow x={srcDot.x} y={srcDot.y} angleDeg={srcOrientation} color="#f59e0b" />
      <OrientArrow x={tgtDot.x} y={tgtDot.y} angleDeg={tgtOrientation} color="#3b82f6" />
      <text x="78" y="16" textAnchor="middle" fill="#cbd5e1" fontSize="10">{props.source?.shape.kind ?? "PART"} · {Math.round(props.source?.width ?? 0)}×{Math.round(props.source?.height ?? 0)}</text>
      <text x="222" y="16" textAnchor="middle" fill="#cbd5e1" fontSize="10">{props.target ? `${props.target.shape.kind} · ${Math.round(props.target.width)}×${Math.round(props.target.height)}` : "SELECT MATING PART"}</text>
      <text x="78" y="128" textAnchor="middle" fill="#f8d28b" fontSize="9">CONNECTOR · {facingLabel(srcOrientation)}</text>
      <text x="222" y="128" textAnchor="middle" fill="#93c5fd" fontSize="9">RECEIVER · {facingLabel(tgtOrientation)}</text>
    </svg>
  </div>;
}

export default function JointsPanel(): JSX.Element {
  const project = useProject();
  const ui = useUI();
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [sourceEdge, setSourceEdge] = useState<Edge>("bottom");
  const [targetEdge, setTargetEdge] = useState<Edge>("top");
  const [targetOrientation, setTargetOrientation] = useState<number | null>(null);
  const [joint, setJoint] = useState(JOINTS[0]);
  const [tolerance, setTolerance] = useState(0.2);
  const [role, setRole] = useState<"insert" | "receiver">("insert");
  const [profile, setProfile] = useState<ConnectorPattern>("dovetail");
  const [width, setWidth] = useState(16);
  const [height, setHeight] = useState(6);
  const [depth, setDepth] = useState(4);
  const [drawnProfileId, setDrawnProfileId] = useState("");
  useEffect(() => {
    if (ui.activePartId && project.parts.some((part) => part.id === ui.activePartId)) setSourceId(ui.activePartId);
    else if (!sourceId && project.parts[0]) setSourceId(project.parts[0].id);
  }, [ui.activePartId, project.parts, sourceId]);
  useEffect(() => { if (!targetId) { const next = project.parts.find((part) => part.id !== sourceId); if (next) setTargetId(next.id); } }, [project.parts, sourceId, targetId]);
  // Requirement: automatically face the receiver opposite the connector
  // (right -> left, top -> bottom, etc). Stays fully overridable afterwards
  // for perpendicular 90°/270° corner joints.
  useEffect(() => {
    setTargetEdge(oppositeEdge(sourceEdge));
    setTargetOrientation(null);
  }, [sourceEdge]);
  const effectiveTargetOrientation = targetOrientation ?? edgeOrientation(targetEdge);
  const create = () => {
    if (!sourceId || !targetId) return;
    if (joint.pattern === "custom" && drawnProfileId) {
      convertShapeToConnector(sourceId, drawnProfileId, targetId, "custom", "custom", role);
      return;
    }
    const custom = joint.pattern === "custom";
    const targetPlacement: EdgePlacement = { edge: targetEdge };
    if (targetOrientation != null) targetPlacement.orientation = targetOrientation;
    createPortPair(sourceId, targetId, joint.type, {
      pattern: custom ? profile : joint.pattern,
      tolerance,
      width: custom ? width : undefined,
      height: custom ? height : undefined,
      depth: custom ? depth : undefined,
      role,
    }, { edge: sourceEdge }, targetPlacement);
  };
  const selected = ui.selectedConnectorId ? findConnector(ui.selectedConnectorId) : undefined;
  const existing = project.parts.flatMap((part) => part.connectors.map((connector) => ({ part, connector })));
  const source = project.parts.find((part) => part.id === sourceId);
  const target = project.parts.find((part) => part.id === targetId);
  const drawnProfiles = source?.modifiers.filter((modifier) => !modifier.connectorId) ?? [];
  const addMatingPart = () => { const id = createPart("Mating part", { transform: identityTransform(160, 0) }); setTargetId(id); };
  return <div className="wk-panel__body" style={{ padding: 12, display: "grid", gap: 14 }}>
    <div><div className="wk-section-title" style={{ margin: 0 }}>Joint builder</div><p style={{ margin: "5px 0 0", color: "var(--wk-ink-soft)", fontSize: 12 }}>Design a physical connection, preview it, then apply it to your parts.</p></div>
    <JointPreview type={joint.type} pattern={joint.pattern === "custom" ? profile : joint.pattern} sourceEdge={sourceEdge} targetEdge={targetEdge} targetOrientation={effectiveTargetOrientation} source={source} target={target} ready={!!sourceId && !!targetId} />
    <div style={{ display: "grid", gap: 8 }}><PartSelect label="1. Connector part" value={sourceId} onChange={setSourceId} /><PartSelect label="2. Mating part" value={targetId} onChange={setTargetId} exclude={sourceId} /></div>
    {project.parts.length < 2 && <div className="wk-warning-box">You need two parts to make a physical joint.<button type="button" className="wk-btn wk-btn--ghost" style={{ marginTop: 8, width: "100%" }} onClick={addMatingPart}>+ Add a mating part</button></div>}
    <div><div className="wk-field__label" style={{ marginBottom: 6 }}>3. Joint type</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{JOINTS.map((option) => <button key={option.label} type="button" className={`wk-btn ${joint.label === option.label ? "wk-btn--primary" : "wk-btn--ghost"}`} style={{ textAlign: "left", padding: "8px 9px" }} onClick={() => setJoint(option)}><div style={{ fontWeight: 700, fontSize: 12 }}>{option.label}</div><div style={{ opacity: .75, fontSize: 10 }}>{option.detail}</div></button>)}</div></div>
    {joint.pattern === "custom" && <div style={{ border: "1px solid var(--wk-accent)", borderRadius: 8, padding: 10, background: "rgba(245,158,11,.07)", display: "grid", gap: 8 }}>
      <div className="wk-field__label" style={{ color: "var(--wk-accent)" }}>Custom joint from your 2D design</div>
      <p style={{ margin: 0, color: "var(--wk-ink-soft)", fontSize: 11 }}>Draw a union (plug) or cutout on the connector part in 2D. Select it here to turn that exact shape into a matched connector and receiver.</p>
      <label className="wk-field"><span className="wk-field__label">Drawn 2D shape</span><select className="wk-select" value={drawnProfileId} onChange={(e) => setDrawnProfileId(e.target.value)}><option value="">Use a visual preset below…</option>{drawnProfiles.map((modifier) => <option key={modifier.id} value={modifier.id}>{modifier.name || modifier.shape.kind} · {modifier.shape.kind} ({Math.round(modifier.shape.width)}×{Math.round(modifier.shape.height)} mm)</option>)}</select></label>
      {!drawnProfiles.length && <div style={{ padding: "7px 8px", fontSize: 10, color: "var(--wk-ink-soft)", border: "1px dashed var(--wk-border)", borderRadius: 6 }}>No unassigned 2D shapes on this part yet. Go to 2D, draw a shape on the part, then use Union for a plug or Subtract for a receiver.</div>}
      {drawnProfileId && <div style={{ padding: "7px 8px", borderRadius: 6, background: "rgba(34, 197, 94, .12)", color: "#bbf7d0", fontSize: 11 }}>This exact drawn outline will be saved as the {role === "insert" ? "connector / plug" : "receiver / cutout"}; its matching mate is generated on the other part.</div>}
      {!drawnProfileId && <><div className="wk-field__label">Or start from a visual profile</div>
      <div className="wk-field__label">Choose a matching visual profile</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>{CUSTOM_PROFILES.map((item) => <button key={item.pattern} type="button" className={`wk-btn ${profile === item.pattern ? "wk-btn--primary" : "wk-btn--ghost"}`} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 7px", textAlign: "left" }} onClick={() => setProfile(item.pattern)}><svg viewBox="0 0 48 28" width="38" height="24" aria-hidden="true"><ProfileGlyph pattern={item.pattern} width={48} height={28} /></svg><span style={{ fontSize: 11 }}>{item.label}</span></button>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px", borderRadius: 6, background: "rgba(15, 41, 75, .6)" }}><div><div className="wk-field__label">Connector / plug</div><svg viewBox="0 0 56 32" width="100%" height="32" aria-label="Custom connector preview"><ProfileGlyph pattern={profile} x={4} y={2} width={48} height={28} /></svg></div><div><div className="wk-field__label">Receiver / cutout</div><svg viewBox="0 0 56 32" width="100%" height="32" aria-label="Custom receiver preview"><ProfileGlyph pattern={profile} receiver x={4} y={2} width={48} height={28} /></svg></div></div>
      </>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}><label className="wk-field"><span className="wk-field__label">Width</span><input className="wk-input wk-input--num" type="number" min="2" value={width} onChange={(e) => setWidth(Number(e.target.value) || 2)} /></label><label className="wk-field"><span className="wk-field__label">Height</span><input className="wk-input wk-input--num" type="number" min="2" value={height} onChange={(e) => setHeight(Number(e.target.value) || 2)} /></label><label className="wk-field"><span className="wk-field__label">Depth</span><input className="wk-input wk-input--num" type="number" min="1" value={depth} onChange={(e) => setDepth(Number(e.target.value) || 1)} /></label></div>
    </div>}
    <div><div className="wk-field__label" style={{ marginBottom: 6 }}>4. Start with on connector part</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button type="button" className={`wk-btn ${role === "insert" ? "wk-btn--primary" : "wk-btn--ghost"}`} onClick={() => setRole("insert")}>+ Connector / plug</button><button type="button" className={`wk-btn ${role === "receiver" ? "wk-btn--primary" : "wk-btn--ghost"}`} onClick={() => setRole("receiver")}>− Receiver / cutout</button></div><div style={{ color: "var(--wk-ink-soft)", fontSize: 10, marginTop: 5 }}>The complementary {role === "insert" ? "receiver" : "connector"} is generated automatically on the mating part.</div></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><label className="wk-field"><span className="wk-field__label">Connector position</span><select className="wk-select" value={sourceEdge} onChange={(e) => setSourceEdge(e.target.value as Edge)}>{(["top", "right", "bottom", "left", "center"] as Edge[]).map((edge) => <option key={edge}>{edge}</option>)}</select></label><label className="wk-field"><span className="wk-field__label">Receiver position</span><select className="wk-select" value={targetEdge} onChange={(e) => setTargetEdge(e.target.value as Edge)}>{(["top", "right", "bottom", "left", "center"] as Edge[]).map((edge) => <option key={edge}>{edge}</option>)}</select></label></div>
    <div style={{ display: "grid", gap: 6 }}>
      <div className="wk-field__label">5. Receiver orientation <span style={{ opacity: .6, fontWeight: 400 }}>({targetOrientation == null ? "auto — faces the connector" : `manual · ${facingLabel(effectiveTargetOrientation)}`})</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) auto auto", gap: 6 }}>
        {[0, 90, 180, 270].map((deg) => <button key={deg} type="button" className={`wk-btn ${targetOrientation === deg ? "wk-btn--primary" : "wk-btn--ghost"}`} onClick={() => setTargetOrientation(deg)}>{deg}°</button>)}
        <button type="button" className="wk-btn wk-btn--ghost" title="Flip 180° from the current orientation" onClick={() => setTargetOrientation(oppositeOrientation(effectiveTargetOrientation))}>⟲ Flip</button>
        <button type="button" className="wk-btn wk-btn--ghost" title="Reset to the automatic opposite-facing default" onClick={() => setTargetOrientation(null)}>Auto</button>
      </div>
    </div>
    <label className="wk-field"><span className="wk-field__label">Clearance (mm)</span><input className="wk-input wk-input--num" type="number" min="0" step="0.05" value={tolerance} onChange={(e) => setTolerance(Number(e.target.value) || 0)} /></label>
    <button type="button" className="wk-btn wk-btn--primary" disabled={!sourceId || !targetId} onClick={create}>Create matched joint</button>
    <div style={{ borderTop: "1px solid var(--wk-border)", paddingTop: 10 }}><div className="wk-field__label">Selected port</div>{selected ? <><div style={{ fontSize: 12, margin: "4px 0 8px" }}>{selected.name}</div><button type="button" className="wk-btn wk-btn--ghost" onClick={() => connectPortPair(selected.id)}>Snap & connect pair</button></> : <div className="wk-empty">Select a port on the canvas to inspect or connect it.</div>}</div>
    <div style={{ borderTop: "1px solid var(--wk-border)", paddingTop: 10 }}><div className="wk-field__label">Existing joints</div>{existing.length ? existing.slice(0, 8).map(({ part, connector }) => <button key={connector.id} type="button" className="wk-row" onClick={() => selectConnector(connector.id)}><span className="wk-row__name">{connector.name}</span><span className="wk-chip">{part.name}</span></button>) : <div className="wk-empty">No joints created yet.</div>}</div>
    <AssemblyHealth />
  </div>;
}

function AssemblyHealth(): JSX.Element {
  const project = useProject();
  const summaries = partConnectorSummaries(project);
  const report = validateAssembly(project);
  const stateGlyph: Record<string, string> = { joined: "✓", paired: "•", unmatched: "⚠" };
  const stateDot: Record<string, string> = { joined: "ok", paired: "info", unmatched: "warning" };
  return <div style={{ borderTop: "1px solid var(--wk-border)", paddingTop: 10 }}>
    <div className="wk-field__label">Assembly health</div>
    {summaries.length ? <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
      {summaries.map((part) => <div key={part.partId}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{part.partName}</div>
        <div style={{ display: "grid", gap: 2 }}>
          {part.connectors.map((c) => <button key={c.connectorId} type="button" className="wk-status__item" title={c.detail} style={{ cursor: "pointer", background: "none", border: "none", textAlign: "left", padding: "2px 0" }} onClick={() => selectConnector(c.connectorId)}>
            <span className={`wk-status__dot wk-status__dot--${stateDot[c.state]}`} />
            <span style={{ fontSize: 11 }}>{stateGlyph[c.state]} {c.connectorName} {c.state === "unmatched" ? "not connected" : c.state === "paired" ? "matched, not joined" : "connected"}</span>
          </button>)}
        </div>
      </div>)}
    </div> : <div className="wk-empty">Add connectors to see assembly health.</div>}
    {report.issues.length > 0 && <div className="wk-warning-box" style={{ marginTop: 8, display: "grid", gap: 5 }}>
      {report.issues.slice(0, 6).map((issue, i) => <div key={i} style={{ fontSize: 11 }}>{issue.level === "error" ? "⛔" : "⚠"} {issue.message}</div>)}
      {report.issues.length > 6 && <div style={{ fontSize: 10, opacity: .7 }}>+{report.issues.length - 6} more…</div>}
    </div>}
  </div>;
}
