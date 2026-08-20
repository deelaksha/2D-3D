/**
 * ToolAnimation — tiny, self-contained, looping SVG demos keyed by animation id.
 * Each animation visually demonstrates what its tool does. Animations use inline
 * SMIL (<animate>/<animateTransform>) so they are fully self-contained, loop
 * forever, and need no JavaScript ticking. Unknown ids fall back to a gently
 * pulsing big icon.
 */

import { makeShape } from "@/core/model/defaults";
import { shapeOutline, isClosedShape } from "@/core/geometry/outline";
import type { ShapeKind, Vec2 } from "@/core/model/types";

export interface ToolAnimationProps {
  /** The tool's `tooltipAnimation` id (e.g. 'draw-rect', 'tab-slot'). */
  id?: string;
  /** The tool's icon, used for the pulsing fallback. */
  icon: string;
}

const ACCENT = "var(--wk-accent, #c8792e)";
const ACCENT_SOFT = "var(--wk-accent-soft, rgba(200,121,46,0.18))";
const PANEL = "var(--wk-surface, #f4ece0)";
const INK = "var(--wk-ink-soft, #6b5d4a)";
const FAINT = "var(--wk-ink-faint, #a99a84)";

/** Shared SVG stage sized to the .wk-tooltip__stage (~216 x 96). */
function Stage(props: { children: JSX.Element | JSX.Element[] }): JSX.Element {
  return (
    <svg
      viewBox="0 0 200 96"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

/* --------------------------------------------------------------------------
 * Generic shape animation — traces the TRUE silhouette of any shape kind, so
 * every shape gets a distinct, accurate demo (no two shapes share a canned
 * rectangle/circle/polygon animation). Driven by the real `shapeOutline`.
 * ------------------------------------------------------------------------ */

/** Scale + centre a set of outline loops into the stage's drawing box. */
function fitLoops(loops: Vec2[][], box = { x: 46, y: 20, w: 108, h: 56 }): Vec2[][] {
  const pts = loops.flat();
  if (pts.length === 0) return loops;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const s = Math.min(box.w / w, box.h / h);
  const ox = box.x + (box.w - w * s) / 2 - minX * s;
  const oy = box.y + (box.h - h * s) / 2 - minY * s;
  return loops.map((loop) => loop.map((p) => ({ x: p.x * s + ox, y: p.y * s + oy })));
}

function loopPath(loop: Vec2[], close: boolean): string {
  const d = loop.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return close ? `${d} Z` : d;
}

function loopLength(loop: Vec2[], close: boolean): number {
  let L = 0;
  for (let i = 1; i < loop.length; i++) L += Math.hypot(loop[i].x - loop[i - 1].x, loop[i].y - loop[i - 1].y);
  if (close && loop.length > 1) {
    const a = loop[0];
    const b = loop[loop.length - 1];
    L += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return L;
}

/** A looping "draw this exact shape" animation for the given shape kind. */
function drawShape(kind: ShapeKind): JSX.Element {
  const shape = makeShape(kind, { x: 0, y: 0, width: 100, height: 66 });
  const closed = isClosedShape(kind);
  const loops = fitLoops(shapeOutline(shape));
  const outer = loops[0] ?? [];
  const L = Math.max(1, Math.round(loopLength(outer, closed)));
  const d = loops.map((l) => loopPath(l, closed)).join(" ");
  const keyTimes = "0;0.5;0.72;0.9;1";
  const dur = "2.6s";
  return (
    <Stage>
      <path
        d={d}
        fillRule="evenodd"
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={L}
      >
        {/* trace the outline on, hold, then fade out and restart */}
        <animate attributeName="stroke-dashoffset" values={`${L};0;0;0;${L}`} keyTimes={keyTimes} dur={dur} repeatCount="indefinite" />
        <animate attributeName="fill-opacity" values="0;0;1;1;0" keyTimes={keyTimes} dur={dur} repeatCount="indefinite" />
      </path>
      <circle r="3.5" fill={ACCENT}>
        {/* pen dot rides along the outline as it's drawn */}
        <animateMotion path={loopPath(outer.length > 1 ? outer : [{ x: 100, y: 48 }], closed)} keyPoints="0;1;1;1;0" keyTimes={keyTimes} calcMode="linear" dur={dur} repeatCount="indefinite" />
      </circle>
    </Stage>
  );
}

/* --------------------------------------------------------------------------
 * Individual animations. Each returns the SVG contents for the Stage.
 * ------------------------------------------------------------------------ */

function drawRect(): JSX.Element {
  return (
    <Stage>
      <rect
        x="60"
        y="26"
        width="0"
        height="0"
        rx="3"
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth="3"
      >
        <animate attributeName="width" values="0;80;80;0" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="height" values="0;0;44;0" dur="2.4s" repeatCount="indefinite" />
      </rect>
      <circle r="3.5" fill={ACCENT}>
        <animate
          attributeName="cx"
          values="60;140;140;60;60"
          dur="2.4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values="26;26;70;70;26"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </circle>
    </Stage>
  );
}

function drawCircle(): JSX.Element {
  return (
    <Stage>
      <circle cx="100" cy="48" r="0" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="3">
        <animate attributeName="r" values="0;30;30;0" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <line x1="100" y1="48" x2="100" y2="48" stroke={ACCENT} strokeWidth="2" strokeDasharray="3 3">
        <animate attributeName="x2" values="100;130;130;100" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="y2" values="48;18;18;48" dur="2.2s" repeatCount="indefinite" />
      </line>
    </Stage>
  );
}

function drawLine(): JSX.Element {
  return (
    <Stage>
      <line
        x1="40"
        y1="70"
        x2="40"
        y2="70"
        stroke={ACCENT}
        strokeWidth="4"
        strokeLinecap="round"
      >
        <animate attributeName="x2" values="40;160;160;40" dur="2s" repeatCount="indefinite" />
        <animate attributeName="y2" values="70;26;26;70" dur="2s" repeatCount="indefinite" />
      </line>
      <circle cx="40" cy="70" r="3.5" fill={ACCENT} />
      <circle r="3.5" fill={ACCENT}>
        <animate attributeName="cx" values="40;160;160;40" dur="2s" repeatCount="indefinite" />
        <animate attributeName="cy" values="70;26;26;70" dur="2s" repeatCount="indefinite" />
      </circle>
    </Stage>
  );
}

function drawPolygon(): JSX.Element {
  // Hexagon drawn via stroke dashoffset.
  const pts = "100,20 143,44 143,74 100,86 57,74 57,44";
  return (
    <Stage>
      <polygon
        points={pts}
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth="3"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray={100}
      >
        <animate
          attributeName="stroke-dashoffset"
          values="100;0;0;100"
          dur="2.6s"
          repeatCount="indefinite"
        />
        <animate attributeName="fill-opacity" values="0;0;1;0" dur="2.6s" repeatCount="indefinite" />
      </polygon>
    </Stage>
  );
}

function drawStar(): JSX.Element {
  const pts =
    "100,18 111,44 139,44 117,62 125,88 100,72 75,88 83,62 61,44 89,44";
  return (
    <Stage>
      <polygon
        points={pts}
        fill={ACCENT_SOFT}
        stroke={ACCENT}
        strokeWidth="3"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray={100}
      >
        <animate
          attributeName="stroke-dashoffset"
          values="100;0;0;100"
          dur="2.8s"
          repeatCount="indefinite"
        />
        <animate attributeName="fill-opacity" values="0;0;1;0" dur="2.8s" repeatCount="indefinite" />
      </polygon>
    </Stage>
  );
}

function tabSlot(): JSX.Element {
  return (
    <Stage>
      {/* Receiving panel with a slot notch on its left edge */}
      <path
        d="M120 24 H180 V72 H120 V60 H132 V36 H120 Z"
        fill={PANEL}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Tab piece sliding into the slot */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="-46 0; 0 0; 0 0; -46 0"
          keyTimes="0;0.45;0.75;1"
          dur="2.8s"
          repeatCount="indefinite"
        />
        <path
          d="M60 30 H108 V36 H120 V60 H108 V66 H60 Z"
          fill={ACCENT_SOFT}
          stroke={ACCENT}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </g>
    </Stage>
  );
}

function cutHole(): JSX.Element {
  return (
    <Stage>
      <rect x="46" y="24" width="108" height="48" rx="4" fill={PANEL} stroke={INK} strokeWidth="2.5" />
      {/* Drill bit descending */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 -18; 0 0; 0 0; 0 -18"
          keyTimes="0;0.4;0.7;1"
          dur="2.6s"
          repeatCount="indefinite"
        />
        <line x1="100" y1="2" x2="100" y2="40" stroke={FAINT} strokeWidth="3" />
        <polygon points="100,48 94,38 106,38" fill={ACCENT} />
      </g>
      {/* Hole punched */}
      <circle cx="100" cy="48" r="0" fill="var(--wk-surface-3, #e6dccb)" stroke={ACCENT} strokeWidth="2">
        <animate attributeName="r" values="0;0;9;9;0" keyTimes="0;0.4;0.55;0.85;1" dur="2.6s" repeatCount="indefinite" />
      </circle>
    </Stage>
  );
}

function pegHole(): JSX.Element {
  return (
    <Stage>
      <rect x="46" y="52" width="108" height="30" rx="3" fill={PANEL} stroke={INK} strokeWidth="2.5" />
      {/* Hole target */}
      <ellipse cx="100" cy="52" rx="11" ry="4" fill="var(--wk-surface-3, #e6dccb)" stroke={INK} strokeWidth="1.5" />
      {/* Peg dropping in */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 -34; 0 0; 0 0; 0 -34"
          keyTimes="0;0.45;0.78;1"
          dur="2.8s"
          repeatCount="indefinite"
        />
        <rect x="92" y="24" width="16" height="30" rx="4" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="2.5" />
        <ellipse cx="100" cy="24" rx="8" ry="3" fill={ACCENT} />
      </g>
    </Stage>
  );
}

function join(): JSX.Element {
  return (
    <Stage>
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="-34 0; 0 0; 0 0; -34 0"
          keyTimes="0;0.45;0.75;1"
          dur="2.6s"
          repeatCount="indefinite"
        />
        <rect x="34" y="30" width="60" height="36" rx="4" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="2.5" />
      </g>
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="34 0; 0 0; 0 0; 34 0"
          keyTimes="0;0.45;0.75;1"
          dur="2.6s"
          repeatCount="indefinite"
        />
        <rect x="106" y="30" width="60" height="36" rx="4" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="2.5" />
      </g>
    </Stage>
  );
}

function split(): JSX.Element {
  return (
    <Stage>
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; -30 0; -30 0; 0 0"
          keyTimes="0;0.4;0.7;1"
          dur="2.6s"
          repeatCount="indefinite"
        />
        <rect x="42" y="30" width="56" height="36" rx="4" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="2.5" />
      </g>
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 30 0; 30 0; 0 0"
          keyTimes="0;0.4;0.7;1"
          dur="2.6s"
          repeatCount="indefinite"
        />
        <rect x="102" y="30" width="56" height="36" rx="4" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="2.5" />
      </g>
    </Stage>
  );
}

function move(): JSX.Element {
  return (
    <Stage>
      <rect x="18" y="34" width="164" height="28" rx="4" fill="none" stroke={FAINT} strokeWidth="1.5" strokeDasharray="4 5" />
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 118 0; 118 0; 0 0"
          keyTimes="0;0.4;0.6;1"
          dur="2.6s"
          repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.4 0 0.2 1; 0 0 1 1; 0.4 0 0.2 1"
        />
        <rect x="24" y="34" width="40" height="28" rx="4" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="2.5" />
        <path d="M44 40 v16 M38 48 h12 M38 48 l4 -4 M38 48 l4 4 M50 48 l-4 -4 M50 48 l-4 4" stroke={ACCENT} strokeWidth="1.5" fill="none" />
      </g>
    </Stage>
  );
}

function rotate(): JSX.Element {
  return (
    <Stage>
      <g transform="translate(100 48)">
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0;90;90;0"
            keyTimes="0;0.5;0.75;1"
            dur="2.8s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0 0 1 1; 0.4 0 0.2 1"
          />
          <rect x="-26" y="-22" width="52" height="44" rx="4" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="2.5" />
          <circle cx="0" cy="-14" r="3" fill={ACCENT} />
        </g>
      </g>
      <path
        d="M128 30 a34 34 0 0 1 0 36"
        fill="none"
        stroke={FAINT}
        strokeWidth="2"
        strokeLinecap="round"
        markerEnd="url(#wk-anim-arrow)"
      />
      <defs>
        <marker id="wk-anim-arrow" markerWidth="7" markerHeight="7" refX="3" refY="3.5" orient="auto">
          <path d="M0 0 L7 3.5 L0 7 Z" fill={FAINT} />
        </marker>
      </defs>
    </Stage>
  );
}

function scale(): JSX.Element {
  return (
    <Stage>
      <rect x="66" y="24" width="68" height="48" rx="4" fill="none" stroke={FAINT} strokeWidth="1.5" strokeDasharray="4 5" />
      <g transform="translate(100 48)">
        <rect x="-34" y="-24" width="68" height="48" rx="4" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="2.5">
          <animateTransform
            attributeName="transform"
            type="scale"
            values="0.45;1;1;0.45"
            keyTimes="0;0.45;0.7;1"
            dur="2.6s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0 0 1 1; 0.4 0 0.2 1"
          />
        </rect>
      </g>
      <circle cx="134" cy="72" r="3.5" fill={ACCENT} />
    </Stage>
  );
}

function flip(): JSX.Element {
  return (
    <Stage>
      <line x1="100" y1="14" x2="100" y2="82" stroke={FAINT} strokeWidth="1.5" strokeDasharray="4 4" />
      <g transform="translate(100 48)">
        <g>
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1 1; 0 1; -1 1; -1 1; 0 1; 1 1"
            keyTimes="0;0.25;0.5;0.6;0.85;1"
            dur="3s"
            repeatCount="indefinite"
          />
          <path d="M4 -24 H40 V24 H4 Z" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M12 -12 h20 M12 0 h20 M12 12 h12" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
    </Stage>
  );
}

function measure(): JSX.Element {
  return (
    <Stage>
      <rect x="46" y="30" width="108" height="36" rx="4" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="2" />
      <line x1="46" y1="80" x2="46" y2="30" stroke={INK} strokeWidth="1.5" />
      <line x1="154" y1="80" x2="154" y2="30" stroke={INK} strokeWidth="1.5" />
      <line x1="46" y1="80" x2="154" y2="80" stroke={INK} strokeWidth="2" markerStart="url(#wk-m-a)" markerEnd="url(#wk-m-b)" />
      <text x="100" y="76" textAnchor="middle" fontSize="11" fill={ACCENT} fontFamily="monospace">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite" />
        108 mm
      </text>
      <defs>
        <marker id="wk-m-a" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M8 0 L0 4 L8 8 Z" fill={INK} />
        </marker>
        <marker id="wk-m-b" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill={INK} />
        </marker>
      </defs>
    </Stage>
  );
}

function grid(): JSX.Element {
  const lines: JSX.Element[] = [];
  for (let i = 1; i < 8; i++) {
    lines.push(<line key={`v${i}`} x1={20 + i * 20} y1="14" x2={20 + i * 20} y2="82" stroke={FAINT} strokeWidth="1" />);
  }
  for (let i = 1; i < 4; i++) {
    lines.push(<line key={`h${i}`} x1="20" y1={14 + i * 17} x2="180" y2={14 + i * 17} stroke={FAINT} strokeWidth="1" />);
  }
  return (
    <Stage>
      <g opacity="0.8">
        <animate attributeName="opacity" values="0.2;0.9;0.2" dur="2.4s" repeatCount="indefinite" />
        {lines}
      </g>
      <rect x="60" y="31" width="40" height="34" fill={ACCENT_SOFT} stroke={ACCENT} strokeWidth="2">
        <animate attributeName="x" values="60;80;60" dur="2.4s" repeatCount="indefinite" />
      </rect>
    </Stage>
  );
}

function connect(): JSX.Element {
  return (
    <Stage>
      <rect x="24" y="30" width="52" height="36" rx="4" fill={PANEL} stroke={INK} strokeWidth="2.5" />
      <rect x="124" y="30" width="52" height="36" rx="4" fill={PANEL} stroke={INK} strokeWidth="2.5" />
      <circle cx="76" cy="48" r="5" fill={ACCENT} />
      <circle cx="124" cy="48" r="5" fill={ACCENT} />
      <line x1="76" y1="48" x2="76" y2="48" stroke={ACCENT} strokeWidth="3" strokeDasharray="4 4">
        <animate attributeName="x2" values="76;124;124;76" keyTimes="0;0.5;0.8;1" dur="2.6s" repeatCount="indefinite" />
      </line>
      <text x="100" y="24" textAnchor="middle" fontSize="12" fill={ACCENT}>
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.5;0.6;0.85;1" dur="2.6s" repeatCount="indefinite" />
        ✓
      </text>
    </Stage>
  );
}

function fallback(icon: string): JSX.Element {
  return (
    <Stage>
      <circle cx="100" cy="48" r="28" fill={ACCENT_SOFT}>
        <animate attributeName="r" values="24;30;24" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;1;0.5" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <text x="100" y="48" textAnchor="middle" dominantBaseline="central" fontSize="34">
        <animate attributeName="font-size" values="30;36;30" dur="1.8s" repeatCount="indefinite" />
        {icon}
      </text>
    </Stage>
  );
}

/** Map of animation id -> renderer. Aliases share renderers. */
const RENDERERS: Record<string, () => JSX.Element> = {
  // Every shape traces its TRUE outline via drawShape(kind) — no duplicates.
  "draw-rect": () => drawShape("rect"),
  "draw-rectangle": () => drawShape("rect"),
  "draw-square": () => drawShape("square"),
  "draw-circle": () => drawShape("circle"),
  "draw-ellipse": () => drawShape("ellipse"),
  "draw-line": () => drawShape("line"),
  "draw-arc": () => drawShape("arc"),
  "draw-polygon": () => drawShape("polygon"),
  "draw-hexagon": () => drawShape("hexagon"),
  "draw-triangle": () => drawShape("triangle"),
  "draw-star": () => drawShape("star"),
  "tab-slot": tabSlot,
  "tab": tabSlot,
  "slot": tabSlot,
  "notch": tabSlot,
  "joinery": tabSlot,
  "finger-joint": tabSlot,
  "dovetail": tabSlot,
  "cut-hole": cutHole,
  "cut": cutHole,
  "subtract": cutHole,
  "hole": cutHole,
  "peg-hole": pegHole,
  "peg": pegHole,
  "dowel": pegHole,
  "join": join,
  "union": join,
  "connect": connect,
  "assemble": connect,
  "split": split,
  "disconnect": split,
  "move": move,
  "rotate": rotate,
  "scale": scale,
  "flip": flip,
  "mirror": flip,
  "measure": measure,
  "dimension": measure,
  "grid": grid,
  "layout": grid,
  // --- additional shape draw aliases (were falling back to a static icon) ---
  "draw-rounded-rect": () => drawShape("roundedRect"),
  "draw-slot": () => drawShape("slot"),
  "draw-capsule": () => drawShape("capsule"),
  "draw-trapezoid": () => drawShape("trapezoid"),
  "draw-parallelogram": () => drawShape("parallelogram"),
  "draw-diamond": () => drawShape("diamond"),
  "draw-octagon": () => drawShape("octagon"),
  "draw-ring": () => drawShape("ring"),
  // --- additional connector/joinery aliases ---
  "snap-fit": tabSlot,
  "hinge-swing": tabSlot,
  "edge-join": join,
  "corner-join": join,
  "surface-glue": connect,
  "magnet-snap": pegHole,
  "mortise": tabSlot,
  "tenon": tabSlot,
  "rabbet": cutHole,
  "lap-joint": tabSlot,
  "box-joint": tabSlot,
};

/**
 * ToolAnimation — renders a short looping demo for the given animation id,
 * falling back to a pulsing icon when the id is unknown.
 */
export default function ToolAnimation({ id, icon }: ToolAnimationProps): JSX.Element {
  const render = id ? RENDERERS[id] : undefined;
  return render ? render() : fallback(icon);
}

export { ToolAnimation };
