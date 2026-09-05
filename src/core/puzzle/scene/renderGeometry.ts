/**
 * Render Geometry Conversion & Procedural Geometry Generators (Phase 93).
 *
 * Implements strict CAD-to-Render geometry isolation by deep-cloning all typed arrays
 * and computing independent bounds, normals, and wireframes.
 */

import type { Vec3 } from "@/core/model/types";
import type { Box3D } from "../geometry/types";
import type { SolidMeshBuffer3D } from "../solid3d/types";
import type { RenderGeometry } from "./types";

export class RenderGeometryFactory {
  /**
   * Deep-clones a CAD SolidMeshBuffer3D into an independent RenderGeometry.
   * Modifying the returned RenderGeometry will have zero effect on the CAD buffer.
   */
  public static fromSolidMeshBuffer(
    buffer: SolidMeshBuffer3D,
    generateWireframe = true
  ): RenderGeometry {
    const positions = new Float32Array(buffer.positions);
    const normals = new Float32Array(buffer.normals);
    const indices = new Uint32Array(buffer.indices);
    const uvs = buffer.uvs ? new Float32Array(buffer.uvs) : undefined;

    let wireframeIndices: Uint32Array | undefined;
    if (generateWireframe && indices.length >= 3) {
      wireframeIndices = this.extractWireframeIndices(indices);
    }

    const bounds: Box3D = {
      min: { ...buffer.bounds.min },
      max: { ...buffer.bounds.max },
    };

    return {
      positions,
      normals,
      indices,
      uvs,
      wireframeIndices,
      bounds,
      primitiveType: "triangles",
    };
  }

  /**
   * Generates a line segment RenderGeometry between two 3D world points.
   */
  public static createLineSegment(p0: Vec3, p1: Vec3): RenderGeometry {
    const positions = new Float32Array([
      p0.x, p0.y, p0.z,
      p1.x, p1.y, p1.z,
    ]);
    const normals = new Float32Array([
      0, 0, 1,
      0, 0, 1,
    ]);
    const indices = new Uint32Array([0, 1]);

    const bounds: Box3D = {
      min: {
        x: Math.min(p0.x, p1.x),
        y: Math.min(p0.y, p1.y),
        z: Math.min(p0.z, p1.z),
      },
      max: {
        x: Math.max(p0.x, p1.x),
        y: Math.max(p0.y, p1.y),
        z: Math.max(p0.z, p1.z),
      },
    };

    return {
      positions,
      normals,
      indices,
      bounds,
      primitiveType: "lines",
    };
  }

  /**
   * Generates a 3D coordinate axis line along X, Y, or Z.
   */
  public static createAxisLine(axis: "x" | "y" | "z", lengthMm: number): RenderGeometry {
    const origin: Vec3 = { x: 0, y: 0, z: 0 };
    const tip: Vec3 = {
      x: axis === "x" ? lengthMm : 0,
      y: axis === "y" ? lengthMm : 0,
      z: axis === "z" ? lengthMm : 0,
    };
    return this.createLineSegment(origin, tip);
  }

  /**
   * Generates a small 3D marker (octahedron) for connector status visualization.
   */
  public static createMarker(center: Vec3, sizeMm: number): RenderGeometry {
    const r = sizeMm / 2;
    // 6 vertices of an octahedron
    const positions = new Float32Array([
      center.x + r, center.y,     center.z,     // 0: +X
      center.x - r, center.y,     center.z,     // 1: -X
      center.x,     center.y + r, center.z,     // 2: +Y
      center.x,     center.y - r, center.z,     // 3: -Y
      center.x,     center.y,     center.z + r, // 4: +Z
      center.x,     center.y,     center.z - r, // 5: -Z
    ]);

    // Normals (approximate outward directions)
    const normals = new Float32Array([
      1, 0, 0,
      -1, 0, 0,
      0, 1, 0,
      0, -1, 0,
      0, 0, 1,
      0, 0, -1,
    ]);

    // 8 triangle faces
    const indices = new Uint32Array([
      0, 2, 4,
      2, 1, 4,
      1, 3, 4,
      3, 0, 4,
      2, 0, 5,
      1, 2, 5,
      3, 1, 5,
      0, 3, 5,
    ]);

    const bounds: Box3D = {
      min: { x: center.x - r, y: center.y - r, z: center.z - r },
      max: { x: center.x + r, y: center.y + r, z: center.z + r },
    };

    return {
      positions,
      normals,
      indices,
      bounds,
      primitiveType: "triangles",
    };
  }

  /**
   * Extracts unique line segments from indexed triangle faces to form wireframes.
   */
  private static extractWireframeIndices(indices: Uint32Array): Uint32Array {
    const edgeSet = new Set<string>();
    const wireframe: number[] = [];

    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];

      const edges: [number, number][] = [
        [Math.min(a, b), Math.max(a, b)],
        [Math.min(b, c), Math.max(b, c)],
        [Math.min(c, a), Math.max(c, a)],
      ];

      for (const [v0, v1] of edges) {
        const key = `${v0}_${v1}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          wireframe.push(v0, v1);
        }
      }
    }

    return new Uint32Array(wireframe);
  }
}
