/**
 * Canvas2D — the precise, SVG-based 2D design surface.
 *
 * Renders every visible part (filled outlines, hole modifiers, open strokes),
 * typed connector glyphs with leaders + labels, selection highlights, and
 * dimensions. Handles pan (space / middle-drag), wheel-zoom around the cursor,
 * click-selection, and the active tool's gesture (draw / connector / move).
 *
 * World space is millimetres; the camera maps world -> screen pixels. The main
 * geometry is drawn inside one transformed <g> (with non-scaling strokes) while
 * fixed-size overlays (connectors, handles, dimensions) are drawn in screen
 * space so they stay crisp at any zoom.
 */
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { store, useProject, useUI } from "@/core/store/store";
import {
  connectorWorld,
  connectorWorldOrientation,
  dir,
  dist,
  isClosedShape,
  partBoundsWorld,
  partModifiersWorld,
  partOutlineWorld,
  partToWorld,
  pointInPart,
  rotate,
  shapeOutline,
  worldToPart,
} from "@/core/geometry";
import { makeShape, materialOf } from "@/core/model/defaults";
import { formatLength } from "@/core/units";
import {
  addConnector,
  clearSelection,
  createPart,
  createPortPair,
  connectPortPair,
  deleteConnector,
  findConnector,
  select,
  selectConnector,
  selectOne,
  setActiveTool,
  setPartShape,
  toggleJointRole,
  toggleSelect,
  updatePartTransform,
  updatePartsTransform,
} from "@/core/store/actions";
import { registry } from "@/tools/registry";
import { connectorRole, defaultRole } from "@/core/connectors/feature";
import type {
  Bounds,
  Connector,
  ConnectorType,
  Dimension,
  Part,
  Project,
  Shape,
  ShapeKind,
  Unit,
  Vec2,
} from "@/core/model/types";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 40;
const CONNECTOR_HIT_PX = 10;
const LEADER_PX = 12;
const GLYPH = 7;
const RULER_PX = 22;
const CANVAS_BG = "#0e2c54"; // blueprint navy — also used to punch out cuts
const HANDLE_HIT_PX = 9; // click radius (screen px) for grabbing a handle
const ROTATE_HANDLE_PX = 26; // rotate knob distance above the box (screen px)
const MIN_PART_MM = 2;
/** Which edges each of the 8 handles moves (index matches SelectionBox order). */
const HANDLE_EDGES: { l?: boolean; r?: boolean; t?: boolean; b?: boolean }[] = [
  { l: true, t: true }, // 0 top-left
  { t: true }, //           1 top-mid
  { r: true, t: true }, // 2 top-right
  { r: true }, //           3 right-mid
  { r: true, b: true }, // 4 bottom-right
  { b: true }, //           5 bottom-mid
  { l: true, b: true }, // 6 bottom-left
  { l: true }, //           7 left-mid
];

const UNIT_MM: Record<Unit, number> = { mm: 1, cm: 10, inch: 25.4 };
const UNIT_SHORT: Record<Unit, string> = { mm: "mm", cm: "cm", inch: "in" };

/** Nearest 1/2/5·10ⁿ step ≥ the requested minimum (in display units). */
function niceStep(min: number): number {
  if (min <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(min)));
  const f = min / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * pow;
}

/** Trim a tick value to a short readable label. */
function tickLabel(v: number): string {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
}

const CONNECTOR_COLOR: Record<ConnectorType, string> = {
  tab: "var(--wk-c-tab)",
  slot: "var(--wk-c-slot)",
  hole: "var(--wk-c-hole)",
  peg: "var(--wk-c-peg)",
  dowel: "var(--wk-c-peg)",
  notch: "var(--wk-c-slot)",
  hinge: "var(--wk-purple)",
  magnet: "var(--wk-red)",
  snap: "var(--wk-green)",
  edge: "var(--wk-blue)",
  corner: "var(--wk-amber)",
  surface: "var(--wk-ink-soft)",
  custom: "var(--wk-purple)",
};

/* ------------------------------------------------------------------ */
/* Local types                                                        */
/* ------------------------------------------------------------------ */

interface Size {
  w: number;
  h: number;
}

interface DrawPreview {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ShapeKind;
}

type DragState =
  | { mode: "pan"; startClientX: number; startClientY: number; startCamX: number; startCamY: number }
  | { mode: "draw"; start: Vec2 }
  | { mode: "drawConnector"; start: Vec2; partId: string; type: ConnectorType }
  | { mode: "move"; start: Vec2; parts: { id: string; x: number; y: number }[] }
  | { mode: "resize"; id: string; handle: number; start: Bounds; shapeX: number; shapeY: number }
  | { mode: "rotate"; id: string; pivot: Vec2; local: Vec2; startAngle: number; startRotation: number }
  | { mode: "marquee"; start: Vec2; additive: boolean }
  | null;

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

function loopPath(loop: Vec2[], close = true): string {
  if (loop.length === 0) return "";
  let d = `M ${loop[0].x} ${loop[0].y}`;
  for (let i = 1; i < loop.length; i++) d += ` L ${loop[i].x} ${loop[i].y}`;
  if (close) d += " Z";
  return d;
}

function loopsPath(loops: Vec2[][], close = true): string {
  return loops.map((l) => loopPath(l, close)).join(" ");
}

function partFill(project: Project, part: Part): string {
  return part.color ?? materialOf(project, part.materialId)?.color ?? "#cccccc";
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function Canvas2D(): JSX.Element {
  const project = useProject();
  const ui = useUI();
  const activePart = ui.activePartId
    ? project.parts.find((part) => part.id === ui.activePartId)
    : undefined;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState>(null);
  const spaceRef = useRef(false);

  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [preview, setPreview] = useState<DrawPreview | null>(null);
  /** In-progress marquee rectangle, in world coordinates (null when idle). */
  const [marquee, setMarquee] = useState<{ a: Vec2; b: Vec2 } | null>(null);

  const cam = ui.camera2d;
  const zoom = cam.zoom || 1;
  const cx = size.w / 2;
  const cy = size.h / 2;

  /* ---- responsive sizing ---- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---- space-to-pan tracking ---- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTypingTarget(e.target)) {
        spaceRef.current = true;
      }
      // Escape cancels an in-progress draw / marquee gesture on the canvas.
      if (e.key === "Escape" && dragRef.current) {
        if (dragRef.current.mode === "draw") setPreview(null);
        if (dragRef.current.mode === "marquee") setMarquee(null);
        store.cancelGesture();
        dragRef.current = null;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  /* ---- wheel zoom (native, non-passive so we can preventDefault) ---- */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const st = store.getState().ui.camera2d;
      const z = st.zoom || 1;
      const cxx = rect.width / 2;
      const cyy = rect.height / 2;
      // world point under the cursor, before zoom
      const wx = (sx - cxx) / z + st.x;
      const wy = (sy - cyy) / z + st.y;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const nz = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
      // keep (wx,wy) under the cursor after zoom
      const nx = wx - (sx - cxx) / nz;
      const ny = wy - (sy - cyy) / nz;
      store.setUI({ camera2d: { x: nx, y: ny, zoom: nz } });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // Frame the whole design: centre all parts and zoom to fit. Used once on
  // first appearance and by the "Fit" button in the zoom HUD.
  const fitToContent = () => {
    if (size.w === 0 || size.h === 0 || project.parts.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of project.parts) {
      const b = partBoundsWorld(p);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    if (!isFinite(minX)) return;
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const pad = 64;
    const fitZoom = clamp(
      Math.min((size.w - RULER_PX - pad * 2) / bw, (size.h - RULER_PX - pad * 2) / bh),
      MIN_ZOOM,
      2,
    );
    store.setUI({ camera2d: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom: fitZoom } });
  };

  /** Zoom about the canvas centre by a multiplicative factor. */
  const zoomByFactor = (factor: number) => {
    const st = store.getState().ui.camera2d;
    const nz = clamp((st.zoom || 1) * factor, MIN_ZOOM, MAX_ZOOM);
    store.setUI({ camera2d: { ...st, zoom: nz } });
  };

  const didFitRef = useRef(false);
  useEffect(() => {
    if (didFitRef.current || size.w === 0 || size.h === 0) return;
    if (project.parts.length === 0) return;
    fitToContent();
    didFitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, project.parts.length]);

  /* ---- coordinate transforms ---- */
  const worldToScreen = (p: Vec2): Vec2 => ({
    x: (p.x - cam.x) * zoom + cx,
    y: (p.y - cam.y) * zoom + cy,
  });

  const clientToWorld = (clientX: number, clientY: number): Vec2 => {
    const svg = svgRef.current;
    const rect = svg?.getBoundingClientRect();
    const st = store.getState().ui.camera2d;
    const z = st.zoom || 1;
    const rw = rect?.width ?? size.w;
    const rh = rect?.height ?? size.h;
    const sx = clientX - (rect?.left ?? 0);
    const sy = clientY - (rect?.top ?? 0);
    return { x: (sx - rw / 2) / z + st.x, y: (sy - rh / 2) / z + st.y };
  };

  const snapPoint = (p: Vec2): Vec2 => {
    if (!ui.grid.snap) return p;
    const g = ui.grid.size || 1;
    return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
  };

  const snapDelta = (d: Vec2): Vec2 => {
    if (!ui.grid.snap) return d;
    const g = ui.grid.size || 1;
    return { x: Math.round(d.x / g) * g, y: Math.round(d.y / g) * g };
  };

  /* ---- hit testing ---- */
  const pickPart = (world: Vec2, tolPx = 0): Part | null => {
    const parts = store.getState().project.parts;
    let best: Part | null = null;
    // Primary: topmost part whose filled body contains the point.
    for (const p of parts) {
      if (!p.visible) continue;
      if (pointInPart(p, world)) {
        if (!best || p.order > best.order) best = p;
      }
    }
    if (best || tolPx <= 0) return best;
    // Fallback: forgiving pick — a near-miss within tolPx of a part's bounds
    // selects it too (makes thin/small parts easy to grab again).
    const tol = tolPx / (store.getState().ui.camera2d.zoom || 1);
    for (const p of parts) {
      if (!p.visible) continue;
      const b = partBoundsWorld(p);
      if (
        world.x >= b.minX - tol &&
        world.x <= b.maxX + tol &&
        world.y >= b.minY - tol &&
        world.y <= b.maxY + tol
      ) {
        if (!best || p.order > best.order) best = p;
      }
    }
    return best;
  };

  // Detect whether a world click lands on the active part's rotate knob or one
  // of its 8 resize handles (screen-space proximity), returning the drag to start.
  const detectHandle = (part: Part, world: Vec2): DragState | null => {
    const b = partBoundsWorld(part);
    const ps = worldToScreen(world);
    const cx = (b.minX + b.maxX) / 2;
    const topC = worldToScreen({ x: cx, y: b.minY });
    if (Math.hypot(ps.x - topC.x, ps.y - (topC.y - ROTATE_HANDLE_PX)) <= HANDLE_HIT_PX + 1) {
      const L = { x: part.shape.x + part.shape.width / 2, y: part.shape.y + part.shape.height / 2 };
      const Ls = {
        x: L.x * part.transform.scaleX * (part.transform.flipX ? -1 : 1),
        y: L.y * part.transform.scaleY * (part.transform.flipY ? -1 : 1),
      };
      const pivot = partToWorld(part, L);
      return {
        mode: "rotate",
        id: part.id,
        pivot,
        local: Ls,
        startAngle: Math.atan2(world.y - pivot.y, world.x - pivot.x),
        startRotation: part.transform.rotation,
      };
    }
    if (part.transform.rotation % 360 === 0) {
      const my = (b.minY + b.maxY) / 2;
      const hs: Vec2[] = [
        { x: b.minX, y: b.minY }, { x: cx, y: b.minY }, { x: b.maxX, y: b.minY },
        { x: b.maxX, y: my }, { x: b.maxX, y: b.maxY }, { x: cx, y: b.maxY },
        { x: b.minX, y: b.maxY }, { x: b.minX, y: my },
      ];
      for (let i = 0; i < hs.length; i++) {
        const s = worldToScreen(hs[i]);
        if (Math.hypot(ps.x - s.x, ps.y - s.y) <= HANDLE_HIT_PX) {
          return { mode: "resize", id: part.id, handle: i, start: b, shapeX: part.shape.x, shapeY: part.shape.y };
        }
      }
    }
    return null;
  };

  /* ---- pointer interaction ---- */
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    // Only react to primary (left) / middle buttons.
    if (e.button !== 0 && e.button !== 1) return;
    svg.setPointerCapture(e.pointerId);

    const world = clientToWorld(e.clientX, e.clientY);
    const panning = e.button === 1 || spaceRef.current;

    if (panning) {
      const st = store.getState().ui.camera2d;
      dragRef.current = {
        mode: "pan",
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCamX: st.x,
        startCamY: st.y,
      };
      return;
    }

    const tool = registry.get(store.getState().ui.activeToolId);

    if (tool?.kind === "draw" && tool.createsShape) {
      dragRef.current = { mode: "draw", start: snapPoint(world) };
      const s = snapPoint(world);
      setPreview({ x: s.x, y: s.y, w: 0, h: 0, kind: tool.createsShape });
      return;
    }

    if (tool?.kind === "connector" && tool.createsConnector) {
      const part = pickPart(world);
      if (part) {
        const s = snapPoint(world);
        dragRef.current = {
          mode: "drawConnector",
          start: s,
          partId: part.id,
          type: tool.createsConnector,
        };
        const isRound = tool.createsConnector === "hole" || tool.createsConnector === "peg" || tool.createsConnector === "dowel";
        setPreview({ x: s.x, y: s.y, w: 0, h: 0, kind: isRound ? "circle" : "rect" });
      } else {
        store.status("Click and drag on a part to draw a connector joint", "warning");
      }
      return;
    }

    // If a part is already selected, allow grabbing its resize/rotate handles
    // first — so you can EDIT it on the canvas, not only move it.
    const activeId = store.getState().ui.activePartId;
    if (activeId) {
      const ap = store.getState().project.parts.find((p) => p.id === activeId);
      if (ap && ap.visible && !ap.locked) {
        const h = detectHandle(ap, world);
        if (h) {
          store.beginGesture(); // whole resize/rotate = one undo step
          dragRef.current = h;
          return;
        }
      }
    }

    // Default / move / transform: select + drag the picked part (forgiving pick).
    const part = pickPart(world, 7);
    if (!part) {
      // Empty space: start a marquee (rubber-band) selection. Shift keeps the
      // current selection and adds to it.
      if (!e.shiftKey) clearSelection();
      dragRef.current = { mode: "marquee", start: world, additive: e.shiftKey };
      setMarquee({ a: world, b: world });
      return;
    }

    const curUI = store.getState().ui;
    if (e.shiftKey) {
      toggleSelect(part.id);
    } else if (!curUI.selection.includes(part.id)) {
      selectOne(part.id);
    }

    // Build the movable set from the (post-update) selection, skipping locked parts.
    const sel = store.getState().ui.selection;
    const movable = store
      .getState()
      .project.parts.filter((p) => sel.includes(p.id) && !p.locked)
      .map((p) => ({ id: p.id, x: p.transform.x, y: p.transform.y }));

    if (movable.length === 0) {
      dragRef.current = null;
      return;
    }
    store.beginGesture(); // whole move = one undo step
    dragRef.current = { mode: "move", start: world, parts: movable };
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const world = clientToWorld(e.clientX, e.clientY);

    if (drag.mode === "pan") {
      const z = store.getState().ui.camera2d.zoom || 1;
      const dx = (e.clientX - drag.startClientX) / z;
      const dy = (e.clientY - drag.startClientY) / z;
      store.setUI({ camera2d: { x: drag.startCamX - dx, y: drag.startCamY - dy, zoom: z } });
      return;
    }

    if (drag.mode === "marquee") {
      setMarquee({ a: drag.start, b: world });
      return;
    }

    if (drag.mode === "draw" || drag.mode === "drawConnector") {
      const cur = snapPoint(world);
      setPreview((prev) =>
        prev
          ? { ...prev, x: drag.start.x, y: drag.start.y, w: cur.x - drag.start.x, h: cur.y - drag.start.y }
          : prev,
      );
      return;
    }

    if (drag.mode === "move") {
      const raw = { x: world.x - drag.start.x, y: world.y - drag.start.y };
      const d = snapDelta(raw);
      // One commit for the whole selection (one clone + one render per frame).
      updatePartsTransform(
        drag.parts.map((p) => ({ id: p.id, patch: { x: p.x + d.x, y: p.y + d.y } })),
        "Move part",
      );
      return;
    }

    if (drag.mode === "resize") {
      const p = snapPoint(world);
      const edges = HANDLE_EDGES[drag.handle];
      let minX = drag.start.minX;
      let minY = drag.start.minY;
      let maxX = drag.start.maxX;
      let maxY = drag.start.maxY;
      if (edges.l) minX = p.x;
      if (edges.r) maxX = p.x;
      if (edges.t) minY = p.y;
      if (edges.b) maxY = p.y;
      const nMinX = Math.min(minX, maxX);
      const nMinY = Math.min(minY, maxY);
      let nMaxX = Math.max(minX, maxX);
      let nMaxY = Math.max(minY, maxY);
      if (nMaxX - nMinX < MIN_PART_MM) nMaxX = nMinX + MIN_PART_MM;
      if (nMaxY - nMinY < MIN_PART_MM) nMaxY = nMinY + MIN_PART_MM;
      const w = nMaxX - nMinX;
      const h = nMaxY - nMinY;
      store.commit("Resize part", (dd) => {
        const q = dd.parts.find((x) => x.id === drag.id);
        if (!q) return;
        q.shape.width = w;
        q.shape.height = h;
        q.width = w;
        q.height = h;
        q.transform.x = nMinX - drag.shapeX;
        q.transform.y = nMinY - drag.shapeY;
      });
      return;
    }

    if (drag.mode === "rotate") {
      const ang = Math.atan2(world.y - drag.pivot.y, world.x - drag.pivot.x);
      let deg = drag.startRotation + ((ang - drag.startAngle) * 180) / Math.PI;
      if (store.getState().ui.grid.snap) deg = Math.round(deg / 15) * 15;
      const rot = rotate(drag.local, deg); // keep the part's centre fixed while turning
      const tx = drag.pivot.x - rot.x;
      const ty = drag.pivot.y - rot.y;
      store.commit("Rotate part", (dd) => {
        const q = dd.parts.find((x) => x.id === drag.id);
        if (!q) return;
        q.transform.rotation = deg;
        q.transform.x = tx;
        q.transform.y = ty;
      });
      return;
    }
  };

  // An interrupted gesture (touch stolen, OS gesture) should REVERT, not commit
  // the half-finished transform. Distinct from a normal pointer-up.
  const onPointerCancel = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (svg?.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setPreview(null);
    setMarquee(null);
    store.cancelGesture();
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (svg?.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    const drag = dragRef.current;
    dragRef.current = null;

    if (drag?.mode === "draw") {
      finishDraw();
      return;
    }
    if (drag?.mode === "drawConnector") {
      finishDrawConnector(drag);
      return;
    }
    if (drag?.mode === "marquee") {
      finishMarquee(drag);
      return;
    }
    // A move / resize / rotate gesture: commit the whole thing as one undo step.
    if (drag?.mode === "move") store.endGesture("Move part");
    else if (drag?.mode === "resize") store.endGesture("Resize part");
    else if (drag?.mode === "rotate") store.endGesture("Rotate part");
  };

  const finishDrawConnector = (drag: any) => {
    const p = preview;
    setPreview(null);
    if (!p) return;
    const part = store.getState().project.parts.find((part) => part.id === drag.partId);
    if (!part) return;

    const rawW = Math.abs(p.w);
    const rawH = Math.abs(p.h);
    const isSingleClick = rawW < 3 && rawH < 3;

    // Center point in world space
    const minX = Math.min(drag.start.x, drag.start.x + p.w);
    const minY = Math.min(drag.start.y, drag.start.y + p.h);
    const centerWorld = isSingleClick
      ? drag.start
      : { x: minX + rawW / 2, y: minY + rawH / 2 };

    const localPos = worldToPart(part, centerWorld);
    const connW = isSingleClick ? 12 : Math.max(4, Math.round(rawW));
    const connH = isSingleClick ? 4 : Math.max(4, Math.round(rawH));
    const isRound = drag.type === "hole" || drag.type === "peg" || drag.type === "dowel";
    const diameter = isRound ? (isSingleClick ? 6 : Math.round(Math.min(connW, connH))) : undefined;

    const cId = addConnector(part.id, drag.type, localPos, {
      width: connW,
      height: connH,
      diameter,
    });

    store.status(`Drawn ${drag.type} connector on ${part.name} (${connW}x${connH}mm)`, "ok");
    selectConnector(cId);
  };

  /** Select every part whose bounding box intersects the marquee rectangle. */
  const finishMarquee = (drag: { start: Vec2; additive: boolean }) => {
    const m = marquee;
    setMarquee(null);
    if (!m) return;
    const minX = Math.min(m.a.x, m.b.x);
    const maxX = Math.max(m.a.x, m.b.x);
    const minY = Math.min(m.a.y, m.b.y);
    const maxY = Math.max(m.a.y, m.b.y);
    // Ignore a marquee that never really opened (treat as a click on empty space).
    if (maxX - minX < 1 && maxY - minY < 1) return;
    const hits: string[] = [];
    for (const part of visibleParts) {
      if (part.locked) continue;
      const b = partBoundsWorld(part);
      if (b.maxX >= minX && b.minX <= maxX && b.maxY >= minY && b.minY <= maxY) {
        hits.push(part.id);
      }
    }
    if (hits.length === 0) {
      if (!drag.additive) clearSelection();
      return;
    }
    const base = drag.additive ? store.getState().ui.selection : [];
    select([...new Set([...base, ...hits])]);
  };

  // A shape is only created by an actual drag — a single click does nothing.
  // This is the minimum drag extent (in mm) that counts as "drawing".
  const MIN_DRAW_MM = 3;

  const finishDraw = () => {
    const p = preview;
    setPreview(null);
    if (!p) return;
    const tool = registry.get(store.getState().ui.activeToolId);
    const kind = tool?.createsShape ?? p.kind;
    const closed = isClosedShape(kind);

    const drag = Math.max(Math.abs(p.w), Math.abs(p.h));
    if (drag < MIN_DRAW_MM) {
      // Just a click (or a jitter) — do NOT place anything. Drag to draw.
      store.status("Drag to draw a shape (click alone won't place it)", "info");
      return;
    }

    let sx = p.x;
    let sy = p.y;
    let w = p.w;
    let h = p.h;

    if (closed) {
      // Normalise to positive extents from the actual drag.
      sx = Math.min(p.x, p.x + p.w);
      sy = Math.min(p.y, p.y + p.h);
      w = Math.max(1, Math.abs(p.w));
      h = Math.max(1, Math.abs(p.h));
    }

    const label = kind.charAt(0).toUpperCase() + kind.slice(1);
    // Create + size the part as ONE undo step (otherwise drawing a shape costs
    // two Ctrl+Z presses to remove).
    store.beginGesture();
    const id = createPart(label);
    // The new part sits at identity transform, so shape-local == world here.
    setPartShape(id, { kind, x: sx, y: sy, width: w, height: h, rotation: 0 });
    store.endGesture(`Draw ${label}`);
    selectOne(id);
    // Switch to the Move tool so the new part can be picked / moved / resized
    // right away — otherwise the draw tool stays active and clicks keep drawing.
    setActiveTool("transform.move");
    store.status(
      `Drew ${label} · ${formatLength(w, project.meta.displayUnit)} × ${formatLength(h, project.meta.displayUnit)} — drag to move, handles to resize`,
      "ok",
    );
  };

  const onContextMenu = (e: ReactMouseEvent) => {
    // Avoid the browser menu interfering with middle/right interactions.
    e.preventDefault();
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  const unit: Unit = project.meta.displayUnit;
  const worldTransform = `translate(${cx} ${cy}) scale(${zoom}) translate(${-cam.x} ${-cam.y})`;
  const cursor =
    dragRef.current?.mode === "pan" || spaceRef.current
      ? "grabbing"
      : registry.get(ui.activeToolId)?.kind === "draw"
        ? "crosshair"
        : "default";

  const visibleParts = project.parts.filter((p) => p.visible);
  const sortedParts = [...visibleParts].sort((a, b) => a.order - b.order);

  return (
    <div ref={containerRef} className="wk-canvas" style={{ position: "relative", width: "100%", height: "100%" }}>
      {size.w > 0 && (
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          style={{ display: "block", cursor, touchAction: "none", userSelect: "none", background: CANVAS_BG }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={onContextMenu}
        >
          {/* ---- world-space geometry ---- */}
          <g transform={worldTransform}>
            <Grid cam={cam} zoom={zoom} size={size} grid={ui.grid} />

            {sortedParts.map((part) => (
              <PartShape key={part.id} part={part} fill={partFill(project, part)} />
            ))}

            {/* live draw preview — shows the ACTUAL shape being drawn */}
            {preview &&
              (() => {
                const minX = Math.min(preview.x, preview.x + preview.w);
                const minY = Math.min(preview.y, preview.y + preview.h);
                const w = Math.max(0.5, Math.abs(preview.w));
                const h = Math.max(0.5, Math.abs(preview.h));
                const shape = makeShape(preview.kind, { x: minX, y: minY, width: w, height: h });
                const closed = isClosedShape(preview.kind);
                const d = shapeOutline(shape)
                  .map(
                    (loop) =>
                      "M " + loop.map((p) => `${p.x} ${p.y}`).join(" L ") + (closed ? " Z" : ""),
                  )
                  .join(" ");
                return (
                  <path
                    d={d}
                    fill={closed ? "var(--wk-accent)" : "none"}
                    fillOpacity={0.12}
                    stroke="var(--wk-accent)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                );
              })()}
          </g>

          {/* ---- screen-space overlays (fixed pixel sizes) ---- */}
          <g>
            {/* selection highlights */}
            {sortedParts
              .filter((p) => ui.selection.includes(p.id))
              .map((p) => (
                <SelectionBox key={`sel-${p.id}`} part={p} unit={unit} worldToScreen={worldToScreen} />
              ))}

            {/* dimensions */}
            {ui.showDimensions &&
              project.dimensions.map((dim) => (
                <DimensionMark
                  key={dim.id}
                  dim={dim}
                  unit={unit}
                  worldToScreen={worldToScreen}
                />
              ))}

            {/* connectors */}
            {sortedParts.flatMap((part) =>
              part.connectors.map((c) => (
                <ConnectorGlyph
                  key={c.id}
                  part={part}
                  connector={c}
                  worldToScreen={worldToScreen}
                  hovered={ui.hoverConnectorId === c.id}
                  selected={ui.selectedConnectorId === c.id}
                  showLabel={
                    ui.showConnectorLabels ||
                    ui.selection.includes(part.id) ||
                    ui.hoverConnectorId === c.id ||
                    ui.selectedConnectorId === c.id
                  }
                />
              )),
            )}

            {/* On-Canvas Floating Joint Quick-Action Overlay Toolbar */}
            {activePart && (
              <SelectedJointToolbar
                part={activePart}
                connector={ui.selectedConnectorId ? findConnector(ui.selectedConnectorId) : undefined}
                worldToScreen={worldToScreen}
              />
            )}

            {/* live size readout while drawing (shows the current unit) */}
            {preview && (Math.abs(preview.w) >= 1 || Math.abs(preview.h) >= 1) &&
              (() => {
                const far = worldToScreen({
                  x: Math.max(preview.x, preview.x + preview.w),
                  y: Math.max(preview.y, preview.y + preview.h),
                });
                const label = `${formatLength(Math.abs(preview.w), unit)} × ${formatLength(
                  Math.abs(preview.h),
                  unit,
                )}`;
                return (
                  <g pointerEvents="none" transform={`translate(${far.x + 10} ${far.y + 18})`}>
                    <rect x={0} y={-11} width={label.length * 6.3 + 10} height={16} rx={4} fill="var(--wk-ink)" opacity={0.88} />
                    <text x={5} y={1} fontSize={10} fontFamily="var(--wk-font)" fill="#fff">
                      {label}
                    </text>
                  </g>
                );
              })()}

            {/* rubber-band marquee selection rectangle */}
            {marquee &&
              (() => {
                const a = worldToScreen(marquee.a);
                const b = worldToScreen(marquee.b);
                return (
                  <rect
                    pointerEvents="none"
                    x={Math.min(a.x, b.x)}
                    y={Math.min(a.y, b.y)}
                    width={Math.abs(a.x - b.x)}
                    height={Math.abs(a.y - b.y)}
                    fill="var(--wk-accent)"
                    fillOpacity={0.1}
                    stroke="var(--wk-accent)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                );
              })()}

            {/* measurement rulers (drawn last so they sit on top) */}
            <Rulers cam={cam} zoom={zoom} size={size} unit={unit} />
          </g>
        </svg>
      )}

      {/* zoom HUD (bottom-right) */}
      <div className="wk-canvas__hud wk-canvas__hud--right" style={{ top: "auto", bottom: "var(--wk-s3)" }}>
        <div className="wk-hud-card">
          <button type="button" className="wk-icon-btn" title="Zoom out" onClick={() => zoomByFactor(1 / 1.2)}>
            −
          </button>
          <span
            style={{ minWidth: 42, textAlign: "center", fontVariantNumeric: "tabular-nums", cursor: "pointer" }}
            title="Reset to 100%"
            onClick={() => zoomByFactor(1 / (store.getState().ui.camera2d.zoom || 1))}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" className="wk-icon-btn" title="Zoom in" onClick={() => zoomByFactor(1.2)}>
            +
          </button>
          <button type="button" className="wk-icon-btn" title="Fit to content" onClick={fitToContent}>
            ⤢
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Grid(props: {
  cam: { x: number; y: number };
  zoom: number;
  size: Size;
  grid: { size: number; visible: boolean };
}): JSX.Element | null {
  const { cam, zoom, size, grid } = props;
  if (!grid.visible || size.w === 0) return null;
  // Blueprint grid: one white cell per centimetre (grid.size, 10mm by default),
  // a faint 1mm sub-grid when zoomed in, and heavier lines every 5cm.
  const cm = grid.size || 10;
  const mm = cm / 10;

  const worldLeft = cam.x - size.w / 2 / zoom;
  const worldRight = cam.x + size.w / 2 / zoom;
  const worldTop = cam.y - size.h / 2 / zoom;
  const worldBottom = cam.y + size.h / 2 / zoom;

  const build = (step: number): string => {
    const s: string[] = [];
    const startX = Math.floor(worldLeft / step) * step;
    const startY = Math.floor(worldTop / step) * step;
    for (let x = startX; x <= worldRight; x += step) s.push(`M ${x} ${worldTop} L ${x} ${worldBottom}`);
    for (let y = startY; y <= worldBottom; y += step) s.push(`M ${worldLeft} ${y} L ${worldRight} ${y}`);
    return s.join(" ");
  };

  const drawMm = mm * zoom >= 5; // only when there's room for 1mm lines
  const drawCm = cm * zoom >= 4;

  return (
    <g pointerEvents="none">
      {drawMm && (
        <path d={build(mm)} stroke="#ffffff" strokeOpacity={0.07} strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" />
      )}
      {drawCm && (
        <path d={build(cm)} stroke="#ffffff" strokeOpacity={0.22} strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" />
      )}
      {/* heavier line every 5cm for orientation */}
      <path d={build(cm * 5)} stroke="#ffffff" strokeOpacity={0.42} strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" />
      {/* origin axes (brightest) */}
      <path
        d={`M ${worldLeft} 0 L ${worldRight} 0 M 0 ${worldTop} L 0 ${worldBottom}`}
        stroke="#ffffff"
        strokeOpacity={0.7}
        strokeWidth={1.25}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function PartShape(props: { part: Part; fill: string }): JSX.Element {
  const { part, fill } = props;
  const loops = partOutlineWorld(part);
  const closed = isClosedShape(part.shape.kind);

  if (!closed) {
    // Open shapes (line/arc/bezier/polyline) render as a stroke only.
    return (
      <g pointerEvents="none">
        {loops.map((loop, i) => (
          <path
            key={i}
            d={loopPath(loop, false)}
            fill="none"
            stroke={fill}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    );
  }

  const mods = partModifiersWorld(part);
  const subtractLoops = mods.filter((m) => m.op === "subtract").flatMap((m) => m.loops);
  const unionLoops = mods.filter((m) => m.op === "union").flatMap((m) => m.loops);

  return (
    <g pointerEvents="none">
      {/* insert plugs (union) painted as added material, UNDER the base so the
          overlap seam is covered and only the protruding part shows */}
      {unionLoops.length > 0 && (
        <path
          d={loopsPath(unionLoops)}
          fill={fill}
          fillRule="evenodd"
          stroke="var(--wk-border-strong)"
          strokeWidth={1.25}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {/* base fill (even-odd so ring/inner loops become holes) */}
      <path
        d={loopsPath(loops)}
        fill={fill}
        fillRule="evenodd"
        stroke="var(--wk-border-strong)"
        strokeWidth={1.25}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* subtract modifiers painted in the blueprint colour so cuts read as
          real openings punched through the material (not a sticker on top) */}
      {subtractLoops.length > 0 && (
        <path
          d={loopsPath(subtractLoops)}
          fill={CANVAS_BG}
          fillRule="evenodd"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

function SelectionBox(props: {
  part: Part;
  unit: Unit;
  worldToScreen: (p: Vec2) => Vec2;
}): JSX.Element {
  const { part, unit, worldToScreen } = props;
  const b = partBoundsWorld(part);
  const sizeLabel = `${formatLength(b.maxX - b.minX, unit)} × ${formatLength(b.maxY - b.minY, unit)}`;
  const tl = worldToScreen({ x: b.minX, y: b.minY });
  const br = worldToScreen({ x: b.maxX, y: b.maxY });
  const x = Math.min(tl.x, br.x);
  const y = Math.min(tl.y, br.y);
  const w = Math.abs(br.x - tl.x);
  const h = Math.abs(br.y - tl.y);
  const handles: Vec2[] = [
    { x, y },
    { x: x + w / 2, y },
    { x: x + w, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w, y: y + h },
    { x: x + w / 2, y: y + h },
    { x, y: y + h },
    { x, y: y + h / 2 },
  ];
  return (
    <g pointerEvents="none">
      <rect
        x={x - 1}
        y={y - 1}
        width={w + 2}
        height={h + 2}
        fill="none"
        stroke="var(--wk-accent)"
        strokeWidth={1.5}
        strokeDasharray="6 4"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="0.6s" repeatCount="indefinite" />
      </rect>
      {/* size readout in the current unit */}
      <g transform={`translate(${x} ${y - 8})`}>
        <rect x={0} y={-11} width={sizeLabel.length * 6.1 + 10} height={15} rx={4} fill="var(--wk-accent)" />
        <text x={5} y={0} fontSize={9.5} fontFamily="var(--wk-font)" fill="#fff">
          {sizeLabel}
        </text>
      </g>
      {handles.map((p, i) => (
        <rect
          key={i}
          x={p.x - 4}
          y={p.y - 4}
          width={8}
          height={8}
          rx={1.5}
          fill="var(--wk-surface)"
          stroke="var(--wk-accent)"
          strokeWidth={1.5}
        />
      ))}
      {/* rotate knob above the top edge */}
      <line
        x1={x + w / 2}
        y1={y}
        x2={x + w / 2}
        y2={y - ROTATE_HANDLE_PX}
        stroke="var(--wk-accent)"
        strokeWidth={1.5}
      />
      <circle
        cx={x + w / 2}
        cy={y - ROTATE_HANDLE_PX}
        r={5.5}
        fill="var(--wk-surface)"
        stroke="var(--wk-accent)"
        strokeWidth={1.5}
      />
    </g>
  );
}

function SelectedJointToolbar(props: {
  part: Part;
  connector?: Connector;
  worldToScreen: (p: Vec2) => Vec2;
}): JSX.Element | null {
  const { part, connector, worldToScreen } = props;
  if (!part) return null;

  try {
    const connPart = connector
      ? store.getState().project.parts.find((p) => p.connectors.some((c) => c.id === connector.id)) ?? part
      : part;

    const partW = part.width ?? part.shape?.width ?? 100;
    const wp = connector
      ? connectorWorld(connPart, connector)
      : { x: (part.transform?.x ?? 0) + partW / 2, y: part.transform?.y ?? 0 };

    if (!wp || typeof wp.x !== "number" || typeof wp.y !== "number" || !isFinite(wp.x) || !isFinite(wp.y)) {
      return null;
    }

    const targetPos = worldToScreen(wp);
    if (!targetPos || typeof targetPos.x !== "number" || typeof targetPos.y !== "number" || !isFinite(targetPos.x) || !isFinite(targetPos.y)) {
      return null;
    }

    return (
      <g transform={`translate(${targetPos.x} ${targetPos.y - 42})`} style={{ pointerEvents: "auto" }}>
        <rect
          x={-115}
          y={-14}
          width={230}
          height={28}
          rx={14}
          fill="#0f172a"
          fillOpacity={0.95}
          stroke="var(--wk-accent)"
          strokeWidth={1.5}
        />
        {connector ? (
          <>
            <g
              transform="translate(-105, -5)"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                toggleJointRole(connector.id);
              }}
            >
              <rect x={0} y={-4} width={70} height={18} rx={9} fill={connectorRole(connector) === "insert" ? "#22c55e" : "#3b82f6"} />
              <text x={35} y={8} fontSize={9} fontWeight="bold" fill="#fff" textAnchor="middle">
                {connectorRole(connector) === "insert" ? "+ Plug (Fill)" : "- Socket (Hole)"}
              </text>
            </g>

            <g
              transform="translate(-30, -5)"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                connectPortPair(connector.id);
              }}
            >
              <rect x={0} y={-4} width={75} height={18} rx={9} fill="#ef8c3b" />
              <text x={37.5} y={8} fontSize={9} fontWeight="bold" fill="#fff" textAnchor="middle">
                ⚡ Auto-Sync
              </text>
            </g>

            <g
              transform="translate(50, -5)"
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                e.stopPropagation();
                deleteConnector(connector.id);
              }}
            >
              <rect x={0} y={-4} width={55} height={18} rx={9} fill="#ef4444" />
              <text x={27.5} y={8} fontSize={9} fontWeight="bold" fill="#fff" textAnchor="middle">
                ✕ Remove
              </text>
            </g>
          </>
        ) : (
          <g
            transform="translate(-100, -5)"
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              createPortPair(part.id, undefined, "tab");
            }}
          >
            <rect x={0} y={-4} width={200} height={18} rx={9} fill="#ef8c3b" />
            <text x={100} y={8} fontSize={9} fontWeight="bold" fill="#fff" textAnchor="middle">
              ＋ Add Joint & Auto-Sync Receiver
            </text>
          </g>
        )}
      </g>
    );
  } catch (err) {
    console.error("SelectedJointToolbar error:", err);
    return null;
  }
}

function ConnectorGlyph(props: {
  part: Part;
  connector: Connector;
  worldToScreen: (p: Vec2) => Vec2;
  hovered: boolean;
  selected: boolean;
  showLabel: boolean;
}): JSX.Element {
  const { part, connector, worldToScreen, hovered, selected, showLabel } = props;
  const wp = connectorWorld(part, connector);
  const sp = worldToScreen(wp);
  const orient = connectorWorldOrientation(part, connector);
  const d = dir(orient);
  const color = CONNECTOR_COLOR[connector.type];
  const role = connectorRole(connector);
  const scale = hovered || selected ? 1.25 : 1;

  const onEnter = () => store.setUI({ hoverConnectorId: connector.id });
  const onLeave = () =>
    store.setUI((cur) =>
      cur.hoverConnectorId === connector.id ? { hoverConnectorId: null } : {},
    );
  const onDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    selectConnector(connector.id);
  };

  return (
    <g
      transform={`translate(${sp.x} ${sp.y})`}
      style={{ cursor: "pointer" }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onPointerDown={onDown}
    >
      {/* invisible hit target */}
      <circle r={CONNECTOR_HIT_PX} fill="transparent" />
      {/* leader in the facing direction */}
      <line
        x1={0}
        y1={0}
        x2={d.x * LEADER_PX}
        y2={d.y * LEADER_PX}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* role marker: insert = solid arrow poking OUT; receiver = open socket mouth */}
      {role === "insert" && (
        <g transform={`rotate(${orient})`}>
          <polygon points={`${LEADER_PX + 6},0 ${LEADER_PX - 3},-4.5 ${LEADER_PX - 3},4.5`} fill={color} />
        </g>
      )}
      {role === "receiver" && (
        <g transform={`rotate(${orient})`}>
          <path
            d={`M ${LEADER_PX - 4} -5 L ${LEADER_PX + 3} -5 L ${LEADER_PX + 3} 5 L ${LEADER_PX - 4} 5`}
            fill="none"
            stroke={color}
            strokeWidth={1.75}
            strokeLinejoin="round"
          />
        </g>
      )}
      {selected && <circle r={GLYPH + 4} fill="none" stroke="var(--wk-accent)" strokeWidth={1.5} strokeDasharray="3 3" />}
      <g transform={`scale(${scale})`}>{glyphFor(connector.type, color)}</g>
      {showLabel && (
        <g style={{ pointerEvents: "none" }}>
          {/* readable plate behind the label so overlapping text stays legible */}
          <rect
            x={GLYPH + 2}
            y={-GLYPH - 12}
            width={connector.name.length * 6 + 8}
            height={14}
            rx={3}
            fill="var(--wk-surface)"
            fillOpacity={0.92}
            stroke="var(--wk-border)"
            strokeWidth={0.75}
          />
          <text
            x={GLYPH + 6}
            y={-GLYPH - 2}
            fontSize={10}
            fontFamily="var(--wk-font)"
            fill="var(--wk-ink)"
          >
            {connector.name}
          </text>
        </g>
      )}
    </g>
  );
}

function glyphFor(type: ConnectorType, color: string): JSX.Element {
  const s = GLYPH;
  switch (type) {
    case "peg":
      return <circle r={s - 1} fill={color} />;
    case "dowel":
      return (
        <>
          <circle r={s} fill={color} fillOpacity={0.25} />
          <circle r={s - 2} fill={color} />
        </>
      );
    case "hole":
      return <circle r={s} fill="var(--wk-surface)" stroke={color} strokeWidth={2} />;
    case "magnet":
      return (
        <rect
          x={-s}
          y={-s}
          width={s * 2}
          height={s * 2}
          transform="rotate(45)"
          fill={color}
        />
      );
    case "tab":
      return <rect x={-s} y={-s} width={s * 2} height={s * 2} fill="none" stroke={color} strokeWidth={2} />;
    case "slot":
      return (
        <rect x={-s - 2} y={-s + 2} width={s * 2 + 4} height={s * 2 - 4} rx={s - 2} fill="none" stroke={color} strokeWidth={2} />
      );
    case "notch":
      return (
        <path
          d={`M ${-s} ${-s} L ${s} ${-s} L ${s} ${s} L 0 ${s - 4} L ${-s} ${s} Z`}
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
      );
    case "snap":
      return (
        <path d={`M ${-s} ${s} L 0 ${-s} L ${s} ${s}`} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      );
    case "hinge":
      return (
        <>
          <circle cx={-s / 2} r={s - 2} fill="none" stroke={color} strokeWidth={1.75} />
          <circle cx={s / 2} r={s - 2} fill="none" stroke={color} strokeWidth={1.75} />
        </>
      );
    case "edge":
      return <line x1={-s * 1.4} y1={0} x2={s * 1.4} y2={0} stroke={color} strokeWidth={3} strokeLinecap="round" />;
    case "corner":
      return (
        <path d={`M ${-s} ${s} L ${-s} ${-s} L ${s} ${-s}`} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
      );
    case "surface":
      return <rect x={-s} y={-s} width={s * 2} height={s * 2} fill={color} fillOpacity={0.4} stroke={color} strokeWidth={1.25} />;
    default:
      return <rect x={-s} y={-s} width={s * 2} height={s * 2} fill="none" stroke={color} strokeWidth={2} />;
  }
}

function DimensionMark(props: {
  dim: Dimension;
  unit: Unit;
  worldToScreen: (p: Vec2) => Vec2;
}): JSX.Element {
  const { dim, unit, worldToScreen } = props;
  const { a, b, offset } = dim;

  let p1: Vec2;
  let p2: Vec2;
  let measured: number;

  if (dim.kind === "horizontal") {
    const y0 = Math.max(a.y, b.y) + offset;
    p1 = { x: a.x, y: y0 };
    p2 = { x: b.x, y: y0 };
    measured = Math.abs(a.x - b.x);
  } else if (dim.kind === "vertical") {
    const x0 = Math.max(a.x, b.x) + offset;
    p1 = { x: x0, y: a.y };
    p2 = { x: x0, y: b.y };
    measured = Math.abs(a.y - b.y);
  } else {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const n = { x: -dy / l, y: dx / l };
    p1 = { x: a.x + n.x * offset, y: a.y + n.y * offset };
    p2 = { x: b.x + n.x * offset, y: b.y + n.y * offset };
    measured = dist(a, b);
  }

  const sa = worldToScreen(a);
  const sb = worldToScreen(b);
  const s1 = worldToScreen(p1);
  const s2 = worldToScreen(p2);
  const mid = { x: (s1.x + s2.x) / 2, y: (s1.y + s2.y) / 2 };
  const label = dim.label ?? formatLength(measured, unit);

  // arrowheads
  const ang = Math.atan2(s2.y - s1.y, s2.x - s1.x);
  const ah = 6;
  const arrow = (tip: Vec2, dirAng: number) =>
    `M ${tip.x} ${tip.y} L ${tip.x - ah * Math.cos(dirAng - 0.4)} ${tip.y - ah * Math.sin(dirAng - 0.4)} ` +
    `M ${tip.x} ${tip.y} L ${tip.x - ah * Math.cos(dirAng + 0.4)} ${tip.y - ah * Math.sin(dirAng + 0.4)}`;

  const color = "var(--wk-ink-soft)";
  return (
    <g pointerEvents="none">
      {/* extension lines */}
      <line x1={sa.x} y1={sa.y} x2={s1.x} y2={s1.y} stroke={color} strokeWidth={0.75} opacity={0.7} />
      <line x1={sb.x} y1={sb.y} x2={s2.x} y2={s2.y} stroke={color} strokeWidth={0.75} opacity={0.7} />
      {/* dimension line */}
      <line x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke={color} strokeWidth={1} />
      <path d={arrow(s1, ang + Math.PI)} stroke={color} strokeWidth={1} fill="none" />
      <path d={arrow(s2, ang)} stroke={color} strokeWidth={1} fill="none" />
      {/* label */}
      <g transform={`translate(${mid.x} ${mid.y})`}>
        <rect x={-24} y={-9} width={48} height={16} rx={4} fill="var(--wk-surface)" opacity={0.9} />
        <text
          textAnchor="middle"
          y={3}
          fontSize={10}
          fontFamily="var(--wk-font)"
          fill="var(--wk-ink)"
        >
          {label}
        </text>
      </g>
    </g>
  );
}

/** Top + left measurement rulers, labelled in the current display unit. */
function Rulers(props: {
  cam: { x: number; y: number };
  zoom: number;
  size: Size;
  unit: Unit;
}): JSX.Element | null {
  const { cam, zoom, size, unit } = props;
  if (size.w === 0) return null;
  const cx = size.w / 2;
  const cy = size.h / 2;
  const unitMm = UNIT_MM[unit];

  const worldLeft = cam.x - cx / zoom;
  const worldRight = cam.x + cx / zoom;
  const worldTop = cam.y - cy / zoom;
  const worldBottom = cam.y + cy / zoom;

  // Labelled step: at least ~66px between labels, snapped to a nice unit value.
  const stepMm = niceStep(66 / zoom / unitMm) * unitMm;
  const subMm = stepMm / 5;
  const drawMinor = subMm * zoom >= 5;

  const toX = (x: number) => (x - cam.x) * zoom + cx;
  const toY = (y: number) => (y - cam.y) * zoom + cy;

  const hMajor: { sx: number; label: string }[] = [];
  for (let x = Math.ceil(worldLeft / stepMm) * stepMm; x <= worldRight; x += stepMm) {
    hMajor.push({ sx: toX(x), label: tickLabel(x / unitMm) });
  }
  const vMajor: { sy: number; label: string }[] = [];
  for (let y = Math.ceil(worldTop / stepMm) * stepMm; y <= worldBottom; y += stepMm) {
    vMajor.push({ sy: toY(y), label: tickLabel(y / unitMm) });
  }
  const hMinor: number[] = [];
  const vMinor: number[] = [];
  if (drawMinor) {
    for (let x = Math.ceil(worldLeft / subMm) * subMm; x <= worldRight; x += subMm) hMinor.push(toX(x));
    for (let y = Math.ceil(worldTop / subMm) * subMm; y <= worldBottom; y += subMm) vMinor.push(toY(y));
  }

  return (
    <g pointerEvents="none" fontFamily="var(--wk-font)">
      <rect x={0} y={0} width={size.w} height={RULER_PX} fill="var(--wk-surface)" />
      <rect x={0} y={0} width={RULER_PX} height={size.h} fill="var(--wk-surface)" />
      {hMinor.map(
        (sx, i) =>
          sx > RULER_PX && (
            <line key={`hm${i}`} x1={sx} y1={RULER_PX - 3} x2={sx} y2={RULER_PX} stroke="var(--wk-ink-faint)" strokeWidth={0.75} />
          ),
      )}
      {vMinor.map(
        (sy, i) =>
          sy > RULER_PX && (
            <line key={`vm${i}`} x1={RULER_PX - 3} y1={sy} x2={RULER_PX} y2={sy} stroke="var(--wk-ink-faint)" strokeWidth={0.75} />
          ),
      )}
      {hMajor.map(
        (t, i) =>
          t.sx > RULER_PX && (
            <g key={`h${i}`}>
              <line x1={t.sx} y1={RULER_PX - 7} x2={t.sx} y2={RULER_PX} stroke="var(--wk-ink-soft)" strokeWidth={1} />
              <text x={t.sx + 3} y={9} fontSize={9} fill="var(--wk-ink-soft)">
                {t.label}
              </text>
            </g>
          ),
      )}
      {vMajor.map(
        (t, i) =>
          t.sy > RULER_PX && (
            <g key={`v${i}`}>
              <line x1={RULER_PX - 7} y1={t.sy} x2={RULER_PX} y2={t.sy} stroke="var(--wk-ink-soft)" strokeWidth={1} />
              <text
                x={11}
                y={t.sy}
                fontSize={9}
                fill="var(--wk-ink-soft)"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(-90 11 ${t.sy})`}
              >
                {t.label}
              </text>
            </g>
          ),
      )}
      <line x1={RULER_PX + 0.5} y1={0} x2={RULER_PX + 0.5} y2={size.h} stroke="var(--wk-border)" strokeWidth={1} />
      <line x1={0} y1={RULER_PX + 0.5} x2={size.w} y2={RULER_PX + 0.5} stroke="var(--wk-border)" strokeWidth={1} />
      {/* corner shows the active unit */}
      <rect x={0} y={0} width={RULER_PX} height={RULER_PX} fill="var(--wk-surface-3)" />
      <line x1={RULER_PX + 0.5} y1={0} x2={RULER_PX + 0.5} y2={RULER_PX} stroke="var(--wk-border)" strokeWidth={1} />
      <line x1={0} y1={RULER_PX + 0.5} x2={RULER_PX} y2={RULER_PX + 0.5} stroke="var(--wk-border)" strokeWidth={1} />
      <text x={RULER_PX / 2} y={RULER_PX / 2 + 3} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--wk-accent-ink)">
        {UNIT_SHORT[unit]}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Utilities                                                          */
/* ------------------------------------------------------------------ */

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}
