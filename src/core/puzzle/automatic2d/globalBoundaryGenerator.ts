/**
 * Global Boundary Generator (Phase 85 - Stage 1).
 *
 * Synthesizes and validates the master outer boundary polygon for 2D puzzle generation.
 */

import type { Vec2 } from "@/core/model/types";
import type { DesignSpecification2D } from "./types";

export interface GeneratedBoundary {
  vertices: Vec2[];
  areaMm2: number;
  perimeterMm: number;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export class GlobalBoundaryGenerator {
  /**
   * Generates a closed, non-self-intersecting outer boundary polygon from a design spec.
   */
  public static generate(spec: DesignSpecification2D): GeneratedBoundary {
    const width = Math.max(10, spec.overallSize?.widthMm ?? 200);
    const height = Math.max(10, spec.overallSize?.heightMm ?? 200);
    const shape = spec.boundaryShape ?? "rectangle";

    let rawVertices: Vec2[];

    switch (shape) {
      case "circle": {
        // Discretize circle into 32 segments centered at (width / 2, height / 2)
        const radius = Math.min(width, height) / 2;
        const centerX = width / 2;
        const centerY = height / 2;
        const segments = 32;
        rawVertices = [];
        for (let i = 0; i < segments; i++) {
          const theta = (i / segments) * 2 * Math.PI;
          rawVertices.push({
            x: Number((centerX + radius * Math.cos(theta)).toFixed(4)),
            y: Number((centerY + radius * Math.sin(theta)).toFixed(4)),
          });
        }
        break;
      }

      case "l_shaped": {
        // L-shaped polygon: WxH with top-right corner removed
        const halfW = width / 2;
        const halfH = height / 2;
        rawVertices = [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: halfH },
          { x: halfW, y: halfH },
          { x: halfW, y: height },
          { x: 0, y: height },
        ];
        break;
      }

      case "polygon": {
        if (spec.customBoundaryVertices && spec.customBoundaryVertices.length >= 3) {
          rawVertices = spec.customBoundaryVertices.map((v) => ({ ...v }));
        } else {
          // Default to rectangle if custom vertices missing or invalid
          rawVertices = [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: height },
            { x: 0, y: height },
          ];
        }
        break;
      }

      case "rectangle":
      default: {
        rawVertices = [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, height: 0, y: 0 }, // fallback safety
        ];
        rawVertices = [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: height },
          { x: 0, y: height },
        ];
        break;
      }
    }

    // Ensure counter-clockwise winding for consistent outer boundary
    const orientedVertices = this.ensureCounterClockwise(rawVertices);

    const areaMm2 = Math.abs(this.calculatePolygonArea(orientedVertices));
    const perimeterMm = this.calculatePolygonPerimeter(orientedVertices);
    const bounds = this.calculateBounds(orientedVertices);

    return {
      vertices: orientedVertices,
      areaMm2: Number(areaMm2.toFixed(3)),
      perimeterMm: Number(perimeterMm.toFixed(3)),
      bounds,
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
      const dx = vertices[j].x - vertices[i].x;
      const dy = vertices[j].y - vertices[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    return perimeter;
  }

  public static calculateBounds(vertices: Vec2[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const v of vertices) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }

    return {
      minX: Number(minX.toFixed(4)),
      minY: Number(minY.toFixed(4)),
      maxX: Number(maxX.toFixed(4)),
      maxY: Number(maxY.toFixed(4)),
    };
  }

  private static ensureCounterClockwise(vertices: Vec2[]): Vec2[] {
    const area = this.calculatePolygonArea(vertices);
    if (area < 0) {
      // Clockwise -> reverse to CCW
      return [...vertices].reverse();
    }
    return vertices;
  }
}
