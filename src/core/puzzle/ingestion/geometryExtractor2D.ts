/**
 * 2D Geometry Extractor (Step 28).
 * Reconstructs closed loops, separates outer piece boundaries from inner cutouts/holes,
 * and calculates polygon area/perimeter metrics.
 */
import type { Vec2 } from "@/core/model/types";
import type { ExtractedContour2D, NormalizedDrawing } from "./types";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class GeometryExtractor2D {
  /**
   * Extracts closed 2D polygon contours from a normalized drawing.
   */
  static extractContours(normalized: NormalizedDrawing): ExtractedContour2D[] {
    const contours: ExtractedContour2D[] = [];
    let idCounter = 1;

    for (const path of normalized.paths) {
      if (path.points.length < 3) continue;

      const pts = path.points;
      const area = Math.abs(this.calculatePolygonArea(pts));
      const perimeter = this.calculatePolygonPerimeter(pts);
      const bounds = this.computeBounds(pts);

      contours.push({
        id: `contour_${idCounter++}`,
        outerLoop: pts,
        holes: [],
        area,
        perimeter,
        bounds,
      });
    }

    return this.classifyOuterAndHoles(contours);
  }

  /**
   * Shoelace formula for polygon area.
   */
  private static calculatePolygonArea(pts: Vec2[]): number {
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    return area / 2.0;
  }

  /**
   * Polygon perimeter length.
   */
  private static calculatePolygonPerimeter(pts: Vec2[]): number {
    let len = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = pts[j].x - pts[i].x;
      const dy = pts[j].y - pts[i].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  /**
   * Bounding box computation.
   */
  private static computeBounds(pts: Vec2[]): { min: Vec2; max: Vec2; width: number; height: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return {
      min: vec2(minX, minY),
      max: vec2(maxX, maxY),
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Classifies polygons as outer boundaries vs inner holes based on area and point containment.
   */
  private static classifyOuterAndHoles(contours: ExtractedContour2D[]): ExtractedContour2D[] {
    contours.sort((a, b) => b.area - a.area);
    const outerContours: ExtractedContour2D[] = [];

    for (const c of contours) {
      let isHole = false;
      for (const parent of outerContours) {
        if (this.isContourInsideParent(c, parent)) {
          parent.holes.push(c.outerLoop);
          isHole = true;
          break;
        }
      }
      if (!isHole) {
        outerContours.push(c);
      }
    }

    return outerContours;
  }

  /**
   * Checks if contour child is completely inside parent using point-in-polygon check.
   */
  private static isContourInsideParent(child: ExtractedContour2D, parent: ExtractedContour2D): boolean {
    if (
      child.bounds.min.x < parent.bounds.min.x ||
      child.bounds.max.x > parent.bounds.max.x ||
      child.bounds.min.y < parent.bounds.min.y ||
      child.bounds.max.y > parent.bounds.max.y
    ) {
      return false;
    }

    const testPt = child.outerLoop[0];
    return this.pointInPolygon(testPt, parent.outerLoop);
  }

  /**
   * Ray-casting point in polygon algorithm.
   */
  private static pointInPolygon(pt: Vec2, polygon: Vec2[]): boolean {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect =
        yi > pt.y !== yj > pt.y &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
