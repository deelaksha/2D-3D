/**
 * Piece Profile Extractor (Phase 86 - Stage 1).
 *
 * Extracts, validates, and normalizes the exact 2D boundary of each piece
 * into a closed, centered local profile ready for 3D extrusion.
 */

import type { Vec2 } from "@/core/model/types";
import type { GeneratedPiece2D } from "../automatic2d/types";
import type { ExtrudablePieceProfile } from "./types";

export class ProfileExtractor {
  /**
   * Extracts and normalizes the 2D profile from a GeneratedPiece2D into piece-local coordinates.
   */
  public static extractProfile(piece2D: GeneratedPiece2D): ExtrudablePieceProfile {
    const rawBoundary = piece2D.exactBoundary || piece2D.rawBoundary;
    if (!rawBoundary || rawBoundary.length < 3) {
      throw new Error(`Piece '${piece2D.id}' has an invalid or degenerate boundary.`);
    }

    // 1. Clean consecutive duplicate points and remove redundant closing vertex
    const cleaned: Vec2[] = [];
    const n = rawBoundary.length;
    for (let i = 0; i < n; i++) {
      const curr = rawBoundary[i];
      const next = rawBoundary[(i + 1) % n];
      const d = Math.hypot(next.x - curr.x, next.y - curr.y);
      if (d > 1e-4) {
        cleaned.push({ x: curr.x, y: curr.y });
      }
    }

    if (cleaned.length < 3) {
      throw new Error(`Piece '${piece2D.id}' boundary reduced to < 3 vertices after cleaning.`);
    }

    // 2. Ensure Counter-Clockwise (CCW) winding for consistent surface normal extrusion
    const ccwVertices = this.ensureCounterClockwise(cleaned);

    // 3. Compute centroid
    const centroid = this.calculateCentroid(ccwVertices);

    // 4. Transform to piece-local coordinates centered at (0, 0)
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const localVertices: Vec2[] = ccwVertices.map((v) => {
      const lx = Number((v.x - centroid.x).toFixed(4));
      const ly = Number((v.y - centroid.y).toFixed(4));
      if (lx < minX) minX = lx;
      if (ly < minY) minY = ly;
      if (lx > maxX) maxX = lx;
      if (ly > maxY) maxY = ly;
      return { x: lx, y: ly };
    });

    const areaMm2 = Math.abs(this.calculatePolygonArea(localVertices));
    const perimeterMm = this.calculatePolygonPerimeter(localVertices);

    return {
      globalVertices: ccwVertices,
      localVertices,
      centroid,
      isClosed: true,
      areaMm2: Number(areaMm2.toFixed(3)),
      perimeterMm: Number(perimeterMm.toFixed(3)),
      localBounds: {
        minX: Number(minX.toFixed(4)),
        minY: Number(minY.toFixed(4)),
        maxX: Number(maxX.toFixed(4)),
        maxY: Number(maxY.toFixed(4)),
      },
    };
  }

  public static calculatePolygonArea(vertices: Vec2[]): number {
    let area = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    return area / 2.0;
  }

  public static calculatePolygonPerimeter(vertices: Vec2[]): number {
    let perimeter = 0;
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      perimeter += Math.hypot(vertices[j].x - vertices[i].x, vertices[j].y - vertices[i].y);
    }
    return perimeter;
  }

  public static calculateCentroid(vertices: Vec2[]): Vec2 {
    let cx = 0;
    let cy = 0;
    let signedArea = 0;
    const n = vertices.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
      signedArea += a;
      cx += (vertices[i].x + vertices[j].x) * a;
      cy += (vertices[i].y + vertices[j].y) * a;
    }

    signedArea *= 0.5;
    if (Math.abs(signedArea) < 1e-6) {
      // Fallback to arithmetic mean for degenerate areas
      const sumX = vertices.reduce((s, v) => s + v.x, 0);
      const sumY = vertices.reduce((s, v) => s + v.y, 0);
      return { x: sumX / n, y: sumY / n };
    }

    return {
      x: Number((cx / (6.0 * signedArea)).toFixed(4)),
      y: Number((cy / (6.0 * signedArea)).toFixed(4)),
    };
  }

  private static ensureCounterClockwise(vertices: Vec2[]): Vec2[] {
    const area = this.calculatePolygonArea(vertices);
    if (area < 0) {
      return [...vertices].reverse();
    }
    return vertices;
  }
}
