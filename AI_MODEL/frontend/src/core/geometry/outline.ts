/**
 * Convert a parametric Shape into explicit outline loops (arrays of points) in
 * the shape's LOCAL coordinate system (mm). Curves are sampled to polylines.
 * This is the geometric backbone used by 2D rendering, hit-testing, snapping
 * and 3D extrusion, so it is part of the frozen contract.
 */
import type { Bounds, Shape, Vec2 } from "../model/types";
import { rotateAround } from "./vec";

const TAU = Math.PI * 2;

function center(s: Shape): Vec2 {
  return { x: s.x + s.width / 2, y: s.y + s.height / 2 };
}

/** Apply the shape's own rotation about its centre to a set of local points. */
function applyShapeRotation(s: Shape, pts: Vec2[]): Vec2[] {
  if (!s.rotation) return pts;
  const c = center(s);
  return pts.map((p) => rotateAround(p, c, s.rotation));
}

function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 48): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return out;
}

function regularPolygon(cx: number, cy: number, rx: number, ry: number, sides: number, rot = -Math.PI / 2): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return out;
}

function roundedRectPts(x: number, y: number, w: number, h: number, r: number, seg = 6): Vec2[] {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr <= 0) return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  const out: Vec2[] = [];
  const corners: [number, number, number][] = [
    [x + w - rr, y + rr, -Math.PI / 2],
    [x + w - rr, y + h - rr, 0],
    [x + rr, y + h - rr, Math.PI / 2],
    [x + rr, y + rr, Math.PI],
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = start + (i / seg) * (Math.PI / 2);
      out.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
  }
  return out;
}

function cubicBezier(p0: Vec2, c0: Vec2, c1: Vec2, p1: Vec2, seg = 16): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 1; i <= seg; i++) {
    const t = i / seg;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * c0.x + 3 * u * t * t * c1.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c0.y + 3 * u * t * t * c1.y + t * t * t * p1.y,
    });
  }
  return out;
}

/**
 * Return the outline as one or more closed loops of points (local mm).
 * Most shapes return a single loop; "ring" returns [outer, inner].
 */
export function shapeOutline(s: Shape): Vec2[][] {
  const { x, y, width: w, height: h } = s;
  const cx = x + w / 2;
  const cy = y + h / 2;
  let loops: Vec2[][];

  switch (s.kind) {
    case "circle":
    case "ellipse":
      loops = [ellipsePts(cx, cy, w / 2, h / 2)];
      break;
    case "ring": {
      const inner = s.innerRadius ?? Math.min(w, h) / 4;
      loops = [ellipsePts(cx, cy, w / 2, h / 2), ellipsePts(cx, cy, inner, inner).reverse()];
      break;
    }
    case "roundedRect":
    case "capsule": {
      const r = s.kind === "capsule" ? Math.min(w, h) / 2 : s.radius ?? 8;
      loops = [roundedRectPts(x, y, w, h, r)];
      break;
    }
    case "slot": {
      const r = Math.min(w, h) / 2;
      loops = [roundedRectPts(x, y, w, h, r)];
      break;
    }
    case "triangle":
      loops = [[{ x: cx, y }, { x: x + w, y: y + h }, { x, y: y + h }]];
      break;
    case "diamond":
      loops = [[{ x: cx, y }, { x: x + w, y: cy }, { x: cx, y: y + h }, { x, y: cy }]];
      break;
    case "trapezoid":
      loops = [[{ x: x + w * 0.2, y }, { x: x + w * 0.8, y }, { x: x + w, y: y + h }, { x, y: y + h }]];
      break;
    case "parallelogram":
      loops = [[{ x: x + w * 0.25, y }, { x: x + w, y }, { x: x + w * 0.75, y: y + h }, { x, y: y + h }]];
      break;
    case "hexagon":
      loops = [regularPolygon(cx, cy, w / 2, h / 2, 6, 0)];
      break;
    case "octagon":
      loops = [regularPolygon(cx, cy, w / 2, h / 2, 8, Math.PI / 8)];
      break;
    case "polygon":
      if (s.nodes?.length) loops = [s.nodes.map((n) => ({ x: n.x, y: n.y }))];
      else loops = [regularPolygon(cx, cy, w / 2, h / 2, Math.max(3, s.sides ?? 5))];
      break;
    case "star": {
      const points = Math.max(3, s.points ?? 5);
      const ratio = s.innerRadius ? s.innerRadius / (w / 2) : 0.45;
      const pts: Vec2[] = [];
      for (let i = 0; i < points * 2; i++) {
        const rr = i % 2 === 0 ? 1 : ratio;
        const a = -Math.PI / 2 + (i / (points * 2)) * TAU;
        pts.push({ x: cx + Math.cos(a) * (w / 2) * rr, y: cy + Math.sin(a) * (h / 2) * rr });
      }
      loops = [pts];
      break;
    }
    case "line":
    case "polyline":
      if (s.nodes?.length) loops = [s.nodes.map((n) => ({ x: n.x, y: n.y }))];
      else loops = [[{ x, y }, { x: x + w, y: y + h }]];
      break;
    case "arc": {
      const pts: Vec2[] = [];
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI + (i / 24) * Math.PI; // top half arc
        pts.push({ x: cx + Math.cos(a) * (w / 2), y: cy + Math.sin(a) * (h / 2) });
      }
      loops = [pts];
      break;
    }
    case "bezier":
    case "path": {
      const nodes = s.nodes ?? [];
      if (nodes.length < 2) {
        loops = [[{ x, y }, { x: x + w, y: y + h }]];
        break;
      }
      const pts: Vec2[] = [{ x: nodes[0].x, y: nodes[0].y }];
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];
        if (a.cOut || b.cIn) {
          pts.push(...cubicBezier(a, a.cOut ?? a, b.cIn ?? b, b));
        } else {
          pts.push({ x: b.x, y: b.y });
        }
      }
      loops = [pts];
      break;
    }
    case "square":
    case "rect":
    default:
      loops = [[{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]];
      break;
  }
  return loops.map((loop) => applyShapeRotation(s, loop));
}

/** Whether a shape kind produces a closed, fillable region. */
export function isClosedShape(kind: Shape["kind"]): boolean {
  return kind !== "line" && kind !== "polyline" && kind !== "arc" && kind !== "bezier" && kind !== "path";
}

export function boundsOfPoints(pts: Vec2[]): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

export function shapeBounds(s: Shape): Bounds {
  return boundsOfPoints(shapeOutline(s).flat());
}

/** Even-odd point-in-polygon test against a single loop. */
export function pointInLoop(pt: Vec2, loop: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    const intersect =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}
