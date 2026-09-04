/**
 * 2D Geometry Utilities for Autonomous Puzzle Generation.
 *
 * Deterministic vector mathematics, polygon properties, and boundary utilities.
 */

import type { Vec2 } from "@/core/model/types";

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 */
export class DeterministicRNG {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 1337;
  }

  nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

export function distance2D(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function lerp2D(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function normalize2D(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len < 1e-9) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function dot2D(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function cross2D(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

/**
 * Calculates 2D polygon signed area using the Shoelace formula.
 * Positive for Counter-Clockwise (CCW), negative for Clockwise (CW).
 */
export function polygonSignedArea(vertices: Vec2[]): number {
  const n = vertices.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return area * 0.5;
}

/**
 * Calculates absolute planar area of a polygon (mm^2).
 */
export function polygonArea(vertices: Vec2[]): number {
  return Math.abs(polygonSignedArea(vertices));
}

/**
 * Calculates planar centroid of a 2D polygon.
 */
export function polygonCentroid(vertices: Vec2[]): Vec2 {
  const n = vertices.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { ...vertices[0] };
  if (n === 2) return { x: (vertices[0].x + vertices[1].x) / 2, y: (vertices[0].y + vertices[1].y) / 2 };

  const signedArea = polygonSignedArea(vertices);
  if (Math.abs(signedArea) < 1e-9) {
    // Degenerate polygon: fallback to arithmetic mean
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

  const factor = 1 / (6 * signedArea);
  return { x: cx * factor, y: cy * factor };
}

/**
 * Calculates perimeter length of a closed polygon.
 */
export function polygonPerimeter(vertices: Vec2[]): number {
  const n = vertices.length;
  if (n < 2) return 0;
  let p = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    p += distance2D(vertices[i], vertices[j]);
  }
  return p;
}

/**
 * Ensures polygon vertices are ordered Counter-Clockwise (CCW).
 */
export function ensureCCW(vertices: Vec2[]): Vec2[] {
  if (polygonSignedArea(vertices) < 0) {
    return [...vertices].reverse();
  }
  return [...vertices];
}

/**
 * Computes outward normal for an edge directed from start to end in a CCW polygon.
 * In a standard Cartesian coordinate system (x right, y up), edge vector (dx, dy)
 * has right-hand outward normal (dy, -dx).
 */
export function edgeOutwardNormal(start: Vec2, end: Vec2): Vec2 {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return normalize2D({ x: dy, y: -dx });
}

/**
 * Tests if two 2D line segments [p1, p2] and [p3, p4] intersect strictly (not at endpoints).
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
 * Validates that a closed polygon has no self-intersecting non-adjacent edges.
 */
export function hasSelfIntersections(vertices: Vec2[]): boolean {
  const n = vertices.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      if ((j + 1) % n === i) continue; // adjacent edge
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
 * Bounding box of a set of 2D points.
 */
export function computeBoundingBox(points: Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } {
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
