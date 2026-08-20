/**
 * Inspector panel — context-sensitive property editor.
 *
 * Priority:
 *   1. A selected connector (`ui.selectedConnectorId`) → edit connector props.
 *   2. Otherwise the active part (`ui.activePartId`) → edit part props + list
 *      its connectors and constraints.
 *   3. Otherwise an empty prompt.
 *
 * All lengths are stored in millimetres; the panel displays values in
 * `project.meta.displayUnit` (converted via the units helpers) and converts
 * user input back to mm before committing through the semantic actions.
 */
import { useEffect, useState } from "react";
import type {
  Connector,
  ConnectorType,
  Part,
  Project,
  Unit,
} from "@/core/model/types";
import { useProject, useUI } from "@/core/store/store";
import { roundForUnit, toMm } from "@/core/units";
import { materialOf } from "@/core/model/defaults";
import { describeConstraint } from "@/core/constraints/solver";
import {
  findConnector,
  MIN_DIM_MM,
  createComplementConnector,
  invertConnector,
  renameConnector,
  renamePart,
  selectConnector,
  setConnectorRole,
  setPartMaterial,
  setPartShape,
  updateConnector,
  updatePart,
  updatePartTransform,
} from "@/core/store/actions";
import { connectorRole } from "@/core/connectors/feature";
import { complementType } from "@/core/connectors/compat";

/* ------------------------------------------------------------------ */
/* Static lists                                                        */
/* ------------------------------------------------------------------ */

const CONNECTOR_TYPES: ConnectorType[] = [
  "peg",
  "hole",
  "slot",
  "tab",
  "notch",
  "dowel",
  "hinge",
  "magnet",
  "snap",
  "edge",
  "corner",
  "surface",
];

/* ------------------------------------------------------------------ */
/* Reusable field inputs                                               */
/* ------------------------------------------------------------------ */

/**
 * A numeric field shown in the current display unit. Commits (in mm) on every
 * change and on blur. While focused it holds its own text so partial input
 * (e.g. "12.") is never clobbered by external re-renders.
 */
function NumField(props: {
  label: string;
  /** Stored value in millimetres. */
  valueMm: number;
  unit: Unit;
  onCommit: (mm: number) => void;
  /** When true, values are plain numbers (deg) and are not unit-converted. */
  raw?: boolean;
  step?: number;
  /** Minimum allowed value, in the SAME space as onCommit (mm, or deg if raw). */
  min?: number;
}): JSX.Element {
  const { label, valueMm, unit, onCommit, raw, step, min } = props;
  const shown = raw ? round(valueMm) : roundForUnit(valueMm, unit);
  const [text, setText] = useState<string>(String(shown));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(String(raw ? round(valueMm) : roundForUnit(valueMm, unit)));
    }
  }, [valueMm, unit, raw, focused]);

  // Commit ONCE, on blur or Enter — not on every keystroke — so a single edit is
  // one undo entry and typing "120" doesn't fire three document mutations.
  const commit = (rawText: string): void => {
    const n = parseFloat(rawText);
    if (Number.isNaN(n)) return;
    let mm = raw ? n : toMm(n, unit);
    if (min != null && mm < min) mm = min;
    onCommit(mm);
  };

  return (
    <label className="wk-field">
      <span className="wk-field__label">{label}</span>
      <input
        className="wk-input wk-input--num"
        type="number"
        step={step ?? "any"}
        value={text}
        onFocus={() => setFocused(true)}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter just blurs; onBlur is the single commit site (avoids double-commit).
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onBlur={(e) => {
          commit(e.target.value);
          setFocused(false);
        }}
      />
    </label>
  );
}

/** A text field that commits on change + blur while buffering focus edits. */
function TextField(props: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
}): JSX.Element {
  const { label, value, onCommit, placeholder } = props;
  const [text, setText] = useState<string>(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);

  return (
    <label className="wk-field">
      <span className="wk-field__label">{label}</span>
      <input
        className="wk-input"
        type="text"
        value={text}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter just blurs; onBlur is the single commit site (avoids double-commit).
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onBlur={(e) => {
          onCommit(e.target.value);
          setFocused(false);
        }}
      />
    </label>
  );
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/* ------------------------------------------------------------------ */
/* Connector editor                                                    */
/* ------------------------------------------------------------------ */

function ConnectorEditor(props: {
  connector: Connector;
  part: Part | undefined;
  unit: Unit;
}): JSX.Element {
  const { connector: c, part, unit } = props;
  const role = connectorRole(c);
  const mate = complementType(c.type);
  const [advOpen, setAdvOpen] = useState(false);

  return (
    <div className="wk-panel__body">
      <div className="wk-section-title">
        Connector{part ? ` · ${part.name}` : ""}
      </div>

      <TextField
        label="Name"
        value={c.name}
        onCommit={(name) => renameConnector(c.id, name)}
      />

      <label className="wk-field">
        <span className="wk-field__label">Type</span>
        <select
          className="wk-select"
          value={c.type}
          onChange={(e) =>
            updateConnector(
              c.id,
              { type: e.target.value as ConnectorType },
              "Change connector type",
            )
          }
        >
          {CONNECTOR_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="wk-field">
        <span className="wk-field__label">Role</span>
        <div className="wk-segment" role="radiogroup" aria-label="Connector role">
          {(
            [
              ["insert", "Insert", "Adds a plug that pokes out"],
              ["receiver", "Socket", "Cuts an opening the plug fills"],
              ["neutral", "Neutral", "No cut or plug (magnet, hinge…)"],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={role === value}
              className={`wk-segment__btn${role === value ? " wk-segment__btn--on" : ""}`}
              title={hint}
              onClick={() => setConnectorRole(c.id, value)}
            >
              {label}
            </button>
          ))}
        </div>
      </label>

      <div className="wk-section-title">Position ({unit})</div>
      <NumField
        label="X"
        valueMm={c.position.x}
        unit={unit}
        onCommit={(mm) =>
          updateConnector(
            c.id,
            { position: { x: mm, y: c.position.y } },
            "Move connector",
          )
        }
      />
      <NumField
        label="Y"
        valueMm={c.position.y}
        unit={unit}
        onCommit={(mm) =>
          updateConnector(
            c.id,
            { position: { x: c.position.x, y: mm } },
            "Move connector",
          )
        }
      />
      <NumField
        label="Orientation°"
        valueMm={c.orientation}
        unit={unit}
        raw
        onCommit={(deg) => updateConnector(c.id, { orientation: deg })}
      />

      <div className="wk-section-title">Size ({unit})</div>
      <NumField
        label="Width"
        valueMm={c.width}
        unit={unit}
        onCommit={(mm) => updateConnector(c.id, { width: mm })}
      />
      <NumField
        label="Height"
        valueMm={c.height}
        unit={unit}
        onCommit={(mm) => updateConnector(c.id, { height: mm })}
      />
      <NumField
        label="Depth"
        valueMm={c.depth}
        unit={unit}
        onCommit={(mm) => updateConnector(c.id, { depth: mm })}
      />
      <NumField
        label="Diameter"
        valueMm={c.diameter ?? 0}
        unit={unit}
        onCommit={(mm) => updateConnector(c.id, { diameter: mm })}
      />
      <NumField
        label="Tolerance"
        valueMm={c.tolerance}
        unit={unit}
        onCommit={(mm) => updateConnector(c.id, { tolerance: mm })}
      />

      {/* Advanced: mating / opposite tools */}
      <button
        type="button"
        className="wk-section-title wk-section-title--toggle"
        aria-expanded={advOpen}
        onClick={() => setAdvOpen((v) => !v)}
      >
        <span className="wk-menu__caret" aria-hidden="true">
          {advOpen ? "▾" : "▸"}
        </span>{" "}
        Advanced · mating
      </button>
      {advOpen && (
        <div className="wk-adv">
          <p className="wk-adv__hint">
            This {role === "receiver" ? "socket" : role === "insert" ? "plug" : "feature"} mates with a{" "}
            <strong>{mate}</strong>
            {c.type === mate ? " (same kind)" : ""}.
          </p>
          <button
            type="button"
            className="wk-btn wk-btn--ghost wk-adv__btn"
            title={`Turn this ${c.type} into its opposite (${mate}) — receiver ⇄ connector`}
            onClick={() => invertConnector(c.id)}
            disabled={c.type === mate}
          >
            ⇄ Flip to opposite ({c.type} → {mate})
          </button>
          <button
            type="button"
            className="wk-btn wk-btn--primary wk-adv__btn"
            title={`Create the matching ${mate} that plugs into / receives this one`}
            onClick={() => createComplementConnector(c.id)}
          >
            ＋ Add matching {mate}
          </button>
        </div>
      )}

      <div className="wk-section-title">Compatible with</div>
      <TextField
        label="Allow"
        value={c.compatibleWith.join(", ")}
        placeholder="e.g. tab, slot"
        onCommit={(text) =>
          updateConnector(c.id, {
            compatibleWith: text
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0),
          })
        }
      />
      {c.compatibleWith.length > 0 && (
        <div className="wk-field" style={{ flexWrap: "wrap", gap: 4 }}>
          {c.compatibleWith.map((name, i) => (
            <span key={`${name}-${i}`} className="wk-chip">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Part editor                                                         */
/* ------------------------------------------------------------------ */

function PartEditor(props: { part: Part; project: Project; unit: Unit }): JSX.Element {
  const { part, project, unit } = props;
  const material = materialOf(project, part.materialId);
  const swatch = part.color ?? material?.color ?? "#c8a25a";

  return (
    <div className="wk-panel__body">
      <div className="wk-section-title">Part</div>

      <TextField
        label="Name"
        value={part.name}
        onCommit={(name) => renamePart(part.id, name)}
      />

      <div className="wk-section-title">Size ({unit})</div>
      <NumField
        label="Width"
        valueMm={part.width}
        unit={unit}
        min={MIN_DIM_MM}
        onCommit={(mm) => setPartShape(part.id, { width: mm })}
      />
      <NumField
        label="Height"
        valueMm={part.height}
        unit={unit}
        min={MIN_DIM_MM}
        onCommit={(mm) => setPartShape(part.id, { height: mm })}
      />
      <NumField
        label="Thickness"
        valueMm={part.thickness}
        unit={unit}
        min={MIN_DIM_MM}
        onCommit={(mm) => updatePart(part.id, { thickness: Math.max(MIN_DIM_MM, mm) }, "Set thickness")}
      />

      <div className="wk-section-title">Appearance</div>
      <label className="wk-field">
        <span className="wk-field__label">Material</span>
        <select
          className="wk-select"
          value={part.materialId}
          onChange={(e) => setPartMaterial(part.id, e.target.value)}
        >
          {project.materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="wk-field">
        <span className="wk-field__label">Color</span>
        <input
          className="wk-input"
          type="color"
          value={swatch}
          onChange={(e) =>
            updatePart(part.id, { color: e.target.value }, "Set colour")
          }
        />
      </label>

      <div className="wk-section-title">Transform</div>
      <NumField
        label="Rotation°"
        valueMm={part.transform.rotation}
        unit={unit}
        raw
        onCommit={(deg) => updatePartTransform(part.id, { rotation: deg })}
      />

      <div className="wk-section-title">
        Connectors ({part.connectors.length})
      </div>
      {part.connectors.length === 0 ? (
        <div className="wk-empty">No connectors yet.</div>
      ) : (
        part.connectors.map((c) => (
          <button
            key={c.id}
            type="button"
            className="wk-row"
            onClick={() => selectConnector(c.id)}
          >
            <span className="wk-row__icon">◈</span>
            <span className="wk-row__name">{c.name}</span>
            <span className="wk-chip">{c.type}</span>
          </button>
        ))
      )}

      <div className="wk-section-title">
        Constraints ({part.constraints.length})
      </div>
      {part.constraints.length === 0 ? (
        <div className="wk-empty">No constraints.</div>
      ) : (
        part.constraints.map((cs) => (
          <div key={cs.id} className="wk-field" style={{ alignItems: "flex-start" }}>
            <span className="wk-field__label">{cs.label ?? cs.kind}</span>
            <span style={{ flex: 1, fontSize: 12, color: "var(--wk-ink-soft)" }}>
              {describeConstraint(cs)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel shell                                                         */
/* ------------------------------------------------------------------ */

export default function Inspector(): JSX.Element {
  const project = useProject();
  const ui = useUI();
  const unit = project.meta.displayUnit;

  // Keep a stable ref-free lookup: derive the selected connector + its part.
  const connector = ui.selectedConnectorId
    ? findConnector(ui.selectedConnectorId)
    : undefined;
  const connectorPart = connector
    ? project.parts.find((p) => p.id === connector.partId)
    : undefined;
  const activePart = ui.activePartId
    ? project.parts.find((p) => p.id === ui.activePartId)
    : undefined;

  let body: JSX.Element;
  if (connector) {
    body = (
      <ConnectorEditor connector={connector} part={connectorPart} unit={unit} />
    );
  } else if (activePart) {
    body = <PartEditor part={activePart} project={project} unit={unit} />;
  } else {
    body = <div className="wk-empty">Select a part or connector</div>;
  }

  return (
    <div className="wk-panel">
      <div className="wk-panel__head">Inspector</div>
      {body}
    </div>
  );
}
