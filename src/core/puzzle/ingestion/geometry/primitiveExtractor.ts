/**
 * Primitive Extractor.
 * Parses normalized vector path data into exact geometric primitives: Lines, Arcs, Circles, and Splines/Beziers.
 */
import type { Vec2 } from "@/core/model/types";
import type { ExactArcPrimitive, ExactCirclePrimitive, ExactLinePrimitive, ExactPrimitive, ExactSplinePrimitive } from "./types";
import type { RawVectorPath } from "../types";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class PrimitiveExtractor {
  /**
   * Extracts exact geometric primitives from raw or normalized vector paths.
   */
  static extractPrimitives(paths: RawVectorPath[]): ExactPrimitive[] {
    const primitives: ExactPrimitive[] = [];
    let primCounter = 1;

    for (const p of paths) {
      const pts = p.points;
      if (pts.length < 2) continue;

      // 1. Check if path represents a 360° circle (e.g. 16+ sampled points on circle)
      const circle = this.tryExtractCircle(pts, `prim_circle_${primCounter}`);
      if (circle) {
        primitives.push(circle);
        primCounter++;
        continue;
      }

      // 2. Extract line segments and arcs between consecutive vertices
      const count = p.closed ? pts.length : pts.length - 1;
      for (let i = 0; i < count; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];

        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (len < 1e-6) continue; // Ignore degenerate zero-length

        // Check if explicit arc curve (requires > 3 sampled points along smooth curve)
        if (pts.length >= 5 && i < count - 2) {
          const p3 = pts[(i + 2) % pts.length];
          const arc = this.tryExtractArc(p1, p2, p3, `prim_arc_${primCounter}`);
          if (arc) {
            primitives.push(arc);
            primCounter++;
            i++; // Advance past mid-arc point
            continue;
          }
        }

        // Standard straight line segment primitive
        primitives.push({
          kind: "line",
          id: `prim_line_${primCounter++}`,
          start: p1,
          end: p2,
          length: Math.round(len * 1000) / 1000,
        });
      }
    }

    return primitives;
  }

  /**
   * Attempts to extract a circle from a path.
   */
  private static tryExtractCircle(pts: Vec2[], id: string): ExactCirclePrimitive | null {
    if (pts.length < 8) return null;

    let cx = 0, cy = 0;
    for (const p of pts) {
      cx += p.x;
      cy += p.y;
    }
    cx /= pts.length;
    cy /= pts.length;
    const center = vec2(cx, cy);

    const r0 = Math.hypot(pts[0].x - cx, pts[0].y - cy);
    if (r0 < 1e-3) return null;

    for (let i = 1; i < pts.length; i++) {
      const r = Math.hypot(pts[i].x - cx, pts[i].y - cy);
      if (Math.abs(r - r0) / r0 > 0.05) {
        return null; // Radius variation > 5%, not a clean circle
      }
    }

    return {
      kind: "circle",
      id,
      center,
      radius: Math.round(r0 * 1000) / 1000,
    };
  }

  /**
   * Attempts to fit an arc primitive through 3 non-collinear, non-orthogonal points (p1, p2, p3).
   */
  private static tryExtractArc(p1: Vec2, p2: Vec2, p3: Vec2, id: string): ExactArcPrimitive | null {
    // Verify that p1-p2 and p2-p3 do not form a right-angle or straight corner
    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);
    if (l1 === 0 || l2 === 0) return null;

    const cosTheta = dot / (l1 * l2);
    // Ignore sharp corners (e.g. 90 degree corners where cosTheta ≈ 0)
    if (Math.abs(cosTheta) < 0.2) return null;

    const temp = p2.x * p2.x + p2.y * p2.y;
    const bc = (p1.x * p1.x + p1.y * p1.y - temp) / 2.0;
    const cd = (temp - (p3.x * p3.x + p3.y * p3.y)) / 2.0;
    const det = (p1.x - p2.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p2.y);

    if (Math.abs(det) < 1e-5) return null; // Collinear points

    const cx = (bc * (p2.y - p3.y) - cd * (p1.y - p2.y)) / det;
    const cy = ((p1.x - p2.x) * cd - (p2.x - p3.x) * bc) / det;
    const radius = Math.hypot(p1.x - cx, p1.y - cy);

    if (radius <= 0 || isNaN(radius)) return null;

    const startAngleRad = Math.atan2(p1.y - cy, p1.x - cx);
    const endAngleRad = Math.atan2(p3.y - cy, p3.x - cx);

    return {
      kind: "arc",
      id,
      center: vec2(cx, cy),
      radius: Math.round(radius * 1000) / 1000,
      startAngleRad,
      endAngleRad,
      counterClockwise: det > 0,
    };
  }

  /**
   * Helper to create a spline primitive.
   */
  static createSpline(id: string, controlPoints: Vec2[], degree: number = 3): ExactSplinePrimitive {
    return {
      kind: "spline",
      id,
      controlPoints,
      degree,
    };
  }
}
