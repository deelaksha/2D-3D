/**
 * Polygon Mathematics & Computational Geometry Utilities for Boundary Partitioning.
 */

import type { Vec2 } from "@/core/model/types";

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function computeBounds(points: Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function polygonSignedArea(vertices: Vec2[]): number {
  const n = vertices.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return area * 0.5;
}

export function polygonArea(vertices: Vec2[]): number {
  return Math.abs(polygonSignedArea(vertices));
}

export function polygonCentroid(vertices: Vec2[]): Vec2 {
  const n = vertices.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { ...vertices[0] };
  if (n === 2) return { x: (vertices[0].x + vertices[1].x) / 2, y: (vertices[0].y + vertices[1].y) / 2 };

  const sArea = polygonSignedArea(vertices);
  if (Math.abs(sArea) < 1e-9) {
    let sumX = 0;
    let sumY = 0;
    for (const v of vertices) {
      sumX += v.x;
      sumY += v.y;
    }
    return { x: sumX / n, y: sumY / n };
  }

  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const factor = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
    cx += (vertices[i].x + vertices[j].x) * factor;
    cy += (vertices[i].y + vertices[j].y) * factor;
  }

  const factor = 1 / (6 * sArea);
  return { x: cx * factor, y: cy * factor };
}

export function polygonPerimeter(vertices: Vec2[]): number {
  const n = vertices.length;
  if (n < 2) return 0;
  let p = 0;
  for (let i = 0; i < n; i++) {
    p += distance(vertices[i], vertices[(i + 1) % n]);
  }
  return p;
}

export function ensureCCW(vertices: Vec2[]): Vec2[] {
  if (polygonSignedArea(vertices) < 0) {
    return [...vertices].reverse();
  }
  return [...vertices];
}

export function findShortestEdgeLength(vertices: Vec2[]): number {
  const n = vertices.length;
  if (n < 2) return 0;
  let minLen = Infinity;
  for (let i = 0; i < n; i++) {
    const d = distance(vertices[i], vertices[(i + 1) % n]);
    if (d < minLen) minLen = d;
  }
  return minLen === Infinity ? 0 : minLen;
}

/**
 * Removes duplicate or nearly identical consecutive vertices.
 */
export function cleanPolygonVertices(vertices: Vec2[], tol = 0.01): Vec2[] {
  if (vertices.length < 3) return vertices;
  const out: Vec2[] = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const curr = vertices[i];
    const prev = out.length > 0 ? out[out.length - 1] : null;
    if (!prev || distance(curr, prev) > tol) {
      out.push(curr);
    }
  }
  // Check wrap-around
  if (out.length > 2 && distance(out[0], out[out.length - 1]) <= tol) {
    out.pop();
  }
  return out;
}

/**
 * Ray casting point-in-polygon test with boundary inclusion tolerance.
 */
export function pointInPolygon(pt: Vec2, vertices: Vec2[], onEdgeTol = 0.05): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  // Check if point is on any edge
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const dAB = distance(a, b);
    if (dAB > 1e-6) {
      const dAP = distance(a, pt);
      const dPB = distance(pt, b);
      if (Math.abs(dAP + dPB - dAB) <= onEdgeTol) {
        return true; // Point is on edge
      }
    }
  }

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;

    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Checks whether line segments [p1, p2] and [p3, p4] intersect strictly.
 */
export function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  function ccw(a: Vec2, b: Vec2, c: Vec2): boolean {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  }
  const d1 = ccw(p1, p3, p4) !== ccw(p2, p3, p4);
  const d2 = ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  return d1 && d2;
}

/**
 * Tests if a polygon has self-intersecting non-adjacent edges.
 */
export function hasSelfIntersections(vertices: Vec2[]): boolean {
  const n = vertices.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      if ((j + 1) % n === i) continue;
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Deterministically cuts a polygon into two sub-polygons by an infinite line (pointOnLine, normal).
 * Returns polyA, polyB, and the shared cut segment [cutStart, cutEnd].
 */
export function clipPolygonByLine(
  vertices: Vec2[],
  pointOnLine: Vec2,
  normal: Vec2
): { polyA: Vec2[]; polyB: Vec2[]; cutStart: Vec2; cutEnd: Vec2 } | null {
  const n = vertices.length;
  if (n < 3) return null;

  const side: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = (vertices[i].x - pointOnLine.x) * normal.x + (vertices[i].y - pointOnLine.y) * normal.y;
    side.push(d);
  }

  const polyA: Vec2[] = [];
  const polyB: Vec2[] = [];
  const intersections: Vec2[] = [];

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const v1 = vertices[i];
    const v2 = vertices[j];
    const s1 = side[i];
    const s2 = side[j];

    if (s1 >= -1e-6) polyA.push(v1);
    if (s1 <= 1e-6) polyB.push(v1);

    if ((s1 > 1e-6 && s2 < -1e-6) || (s1 < -1e-6 && s2 > 1e-6)) {
      const t = s1 / (s1 - s2);
      const intersectPt: Vec2 = {
        x: Number((v1.x + (v2.x - v1.x) * t).toFixed(4)),
        y: Number((v1.y + (v2.y - v1.y) * t).toFixed(4)),
      };
      polyA.push(intersectPt);
      polyB.push(intersectPt);
      intersections.push(intersectPt);
    }
  }

  if (intersections.length < 2) return null;

  // Clean vertices
  const cleanA = cleanPolygonVertices(polyA);
  const cleanB = cleanPolygonVertices(polyB);

  if (cleanA.length < 3 || cleanB.length < 3) return null;

  return {
    polyA: cleanA,
    polyB: cleanB,
    cutStart: intersections[0],
    cutEnd: intersections[1],
  };
}
