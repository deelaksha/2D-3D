/**
 * Drawing Normalizer (Step 27).
 * Scales units to mm, aligns canvas origin, and applies Ramer-Douglas-Peucker curve simplification.
 */
import type { Vec2 } from "@/core/model/types";
import type { IngestedDrawing, NormalizedDrawing, RawVectorPath } from "./types";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class DrawingNormalizer {
  /**
   * Normalizes an IngestedDrawing into standard mm coordinates.
   */
  static normalize(ingested: IngestedDrawing, epsilon: number = 0.05): NormalizedDrawing {
    const scale = ingested.scaleToMmFactor;
    const rawMin = ingested.rawBoundingBox.min;

    const normalizedPaths: RawVectorPath[] = [];

    for (const p of ingested.paths) {
      // 1. Scale to mm & Translate to positive origin frame
      const scaledPts = p.points.map((pt) =>
        vec2((pt.x - rawMin.x) * scale, (pt.y - rawMin.y) * scale)
      );

      // 2. Ramer-Douglas-Peucker curve simplification
      const simplifiedPts = this.simplifyRamerDouglasPeucker(scaledPts, epsilon);

      if (simplifiedPts.length >= 3) {
        normalizedPaths.push({
          ...p,
          points: simplifiedPts,
        });
      }
    }

    // Compute normalized bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of normalizedPaths) {
      for (const pt of p.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }

    if (minX === Infinity) {
      minX = 0; minY = 0; maxX = 0; maxY = 0;
    }

    const width = maxX - minX;
    const height = maxY - minY;

    return {
      sourceFilename: ingested.sourceFilename,
      units: "mm",
      paths: normalizedPaths,
      bounds: {
        min: vec2(minX, minY),
        max: vec2(maxX, maxY),
        width,
        height,
      },
      simplifiedPathCount: normalizedPaths.length,
    };
  }

  /**
   * Ramer-Douglas-Peucker algorithm for polyline simplification.
   */
  private static simplifyRamerDouglasPeucker(points: Vec2[], epsilon: number): Vec2[] {
    if (points.length <= 2) return points;

    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
      const d = this.perpendicularDistance(points[i], points[0], points[end]);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    if (dmax > epsilon) {
      const rec1 = this.simplifyRamerDouglasPeucker(points.slice(0, index + 1), epsilon);
      const rec2 = this.simplifyRamerDouglasPeucker(points.slice(index), epsilon);
      return rec1.slice(0, rec1.length - 1).concat(rec2);
    } else {
      return [points[0], points[end]];
    }
  }

  /**
   * Perpendicular distance from point p to line segment (p1, p2).
   */
  private static perpendicularDistance(p: Vec2, p1: Vec2, p2: Vec2): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {
      const ex = p.x - p1.x;
      const ey = p.y - p1.y;
      return Math.sqrt(ex * ex + ey * ey);
    }

    const num = Math.abs(dy * p.x - dx * p.y + p2.x * p1.y - p2.y * p1.x);
    return num / Math.sqrt(lenSq);
  }
}
