/**
 * Watertight 3D Solid Mesh Extruder (Phase 86 - Stages 2 & 3).
 *
 * Extrudes 2D closed piece profiles into watertight 3D solid representations
 * strictly in piece-local coordinates (z in [-thickness/2, +thickness/2]).
 */

import type { Vec2 } from "@/core/model/types";
import type { SolidMeshBuffer3D, SolidRepresentation3D } from "../solid3d/types";
import type { ExtrudablePieceProfile } from "./types";

export class SolidExtruder {
  /**
   * Extrudes a 2D piece profile into a closed, manifold 3D solid mesh.
   */
  public static extrudeToSolid(
    pieceId: string,
    profile: ExtrudablePieceProfile,
    thickness: number,
    materialId = "stock_material",
    density = 0.68 // g/cm^3
  ): SolidRepresentation3D {
    const halfT = thickness / 2.0;
    const verts = profile.localVertices;
    const n = verts.length;

    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    // 1. Top Face Vertices (z = +halfT, index 0 .. n-1)
    for (let i = 0; i < n; i++) {
      positions.push(verts[i].x, verts[i].y, halfT);
      normals.push(0, 0, 1);
    }

    // 2. Bottom Face Vertices (z = -halfT, index n .. 2n-1)
    for (let i = 0; i < n; i++) {
      positions.push(verts[i].x, verts[i].y, -halfT);
      normals.push(0, 0, -1);
    }

    // 3. Triangulate planar polygon using robust Ear Clipping
    const faceTriangles = this.triangulatePolygon(verts);

    // Top face triangles (CCW winding facing +Z)
    for (const [i0, i1, i2] of faceTriangles) {
      indices.push(i0, i1, i2);
    }

    // Bottom face triangles (Inverted CW winding facing -Z)
    for (const [i0, i1, i2] of faceTriangles) {
      indices.push(i0 + n, i2 + n, i1 + n);
    }

    // 4. Side Wall Quads (each edge gets independent vertices with outward side normals)
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const p1 = verts[i];
      const p2 = verts[next];

      // Side normal in 2D
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);
      const nx = len > 1e-6 ? dy / len : 0;
      const ny = len > 1e-6 ? -dx / len : 0;

      const baseIdx = positions.length / 3;

      // 4 vertices of the side wall quad
      positions.push(p1.x, p1.y, halfT);
      normals.push(nx, ny, 0);

      positions.push(p2.x, p2.y, halfT);
      normals.push(nx, ny, 0);

      positions.push(p2.x, p2.y, -halfT);
      normals.push(nx, ny, 0);

      positions.push(p1.x, p1.y, -halfT);
      normals.push(nx, ny, 0);

      // Two CCW triangles for the outward-facing quad
      indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
      indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
    }

    // Physical metrics
    const volumeMm3 = Number((profile.areaMm2 * thickness).toFixed(3));
    const surfaceAreaMm2 = Number((2 * profile.areaMm2 + profile.perimeterMm * thickness).toFixed(3));
    const massGrams = Number((volumeMm3 * (density * 0.001)).toFixed(4));

    const localMesh: SolidMeshBuffer3D = {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      indices: new Uint32Array(indices),
      bounds: {
        min: { x: profile.localBounds.minX, y: profile.localBounds.minY, z: -halfT },
        max: { x: profile.localBounds.maxX, y: profile.localBounds.maxY, z: halfT },
      },
    };

    return {
      pieceId,
      localMesh,
      volumeMm3,
      surfaceAreaMm2,
      massGrams,
      thickness,
      materialId,
    };
  }

  /**
   * Triangulates a simple closed polygon using the Ear Clipping method.
   * Returns an array of index triplets [i, j, k] referencing the input vertices array.
   */
  public static triangulatePolygon(vertices: Vec2[]): [number, number, number][] {
    const n = vertices.length;
    if (n < 3) return [];
    if (n === 3) return [[0, 1, 2]];

    const triangles: [number, number, number][] = [];
    const indexList: number[] = Array.from({ length: n }, (_, i) => i);

    let count = 0;
    const maxIterations = n * 5;

    while (indexList.length > 3 && count < maxIterations) {
      count++;
      let earFound = false;
      const len = indexList.length;

      for (let i = 0; i < len; i++) {
        const prevIdx = indexList[(i - 1 + len) % len];
        const currIdx = indexList[i];
        const nextIdx = indexList[(i + 1) % len];

        const a = vertices[prevIdx];
        const b = vertices[currIdx];
        const c = vertices[nextIdx];

        // Must be convex
        if (this.isConvex(a, b, c)) {
          // Check if any other vertex lies inside triangle (a, b, c)
          let hasPointInside = false;
          for (let j = 0; j < len; j++) {
            const pIdx = indexList[j];
            if (pIdx !== prevIdx && pIdx !== currIdx && pIdx !== nextIdx) {
              if (this.pointInTriangle(vertices[pIdx], a, b, c)) {
                hasPointInside = true;
                break;
              }
            }
          }

          if (!hasPointInside) {
            triangles.push([prevIdx, currIdx, nextIdx]);
            indexList.splice(i, 1);
            earFound = true;
            break;
          }
        }
      }

      if (!earFound) {
        // Fallback: fan triangulation from vertex 0 to prevent infinite loop
        break;
      }
    }

    if (indexList.length === 3) {
      triangles.push([indexList[0], indexList[1], indexList[2]]);
    } else if (indexList.length > 3) {
      // Fallback fan triangulation for remaining vertices
      const root = indexList[0];
      for (let i = 1; i < indexList.length - 1; i++) {
        triangles.push([root, indexList[i], indexList[i + 1]]);
      }
    }

    return triangles;
  }

  private static isConvex(a: Vec2, b: Vec2, c: Vec2): boolean {
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    return cross > 1e-7;
  }

  private static pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
    const cross1 = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const cross2 = (c.x - b.x) * (p.y - b.y) - (c.y - b.y) * (p.x - b.x);
    const cross3 = (a.x - c.x) * (p.y - c.y) - (a.y - c.y) * (p.x - c.x);

    const hasNeg = cross1 < 0 || cross2 < 0 || cross3 < 0;
    const hasPos = cross1 > 0 || cross2 > 0 || cross3 > 0;

    return !(hasNeg && hasPos);
  }
}
