/**
 * 3D STL Exporter (Phase 99).
 *
 * Generates standards-compliant stereolithography (.stl) CAD models:
 *  - Individual piece solids in local coordinate space (for 3D printing or CAM).
 *  - Complete 3D assembly models with rigid-body transforms applied to match authoritative assembly.
 *  - Correct facet surface normals and winding order.
 */

import type { Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { GeneratedPiece3D } from "../piece3d/types";
import type { Export3DOptions } from "./types";
import {
  cross3,
  len3,
  normalize3,
  quatRotateVector,
  sub3,
  vec3,
} from "../geometry/math3d";

export class StlExporter {
  /**
   * Exports an individual 3D piece solid mesh to ASCII STL format.
   */
  public static exportPieceSTL(piece3D: GeneratedPiece3D, options: Export3DOptions = {}): string {
    const mesh = piece3D.solid?.localMesh;
    const pieceId = piece3D.pieceId || piece3D.id || "piece";

    if (!mesh || !mesh.positions || mesh.positions.length < 9) {
      return `solid Piece_${pieceId}\nendsolid Piece_${pieceId}\n`;
    }

    return this.buildStlString(`Piece_${pieceId}`, mesh.positions, mesh.indices);
  }

  /**
   * Exports the entire 3D puzzle assembly with all pieces transformed into their assembled world poses.
   */
  public static exportAssemblySTL(
    pieces3D: GeneratedPiece3D[],
    pieceTransforms: Record<string, RigidTransform3D>,
    options: Export3DOptions = {}
  ): { stl: string; totalTriangles: number; bounds: { min: Vec3; max: Vec3 } } {
    const lines: string[] = ["solid PuzzleAssembly"];
    let totalTriangles = 0;

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const piece of pieces3D) {
      const mesh = piece.solid?.localMesh;
      if (!mesh || !mesh.positions || mesh.positions.length < 9) continue;

      const pieceId = piece.pieceId || piece.id || "piece";
      const transform = pieceTransforms[pieceId] || {
        position: vec3(0, 0, 0),
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: vec3(1, 1, 1),
      };

      const positions = mesh.positions;
      const indices = mesh.indices;
      const numTriangles = indices && indices.length > 0 ? indices.length / 3 : positions.length / 9;

      for (let t = 0; t < numTriangles; t++) {
        let i0 = t * 3;
        let i1 = t * 3 + 1;
        let i2 = t * 3 + 2;

        if (indices && indices.length > 0) {
          i0 = indices[t * 3];
          i1 = indices[t * 3 + 1];
          i2 = indices[t * 3 + 2];
        }

        const v0 = this.transformVertex(positions, i0, transform);
        const v1 = this.transformVertex(positions, i1, transform);
        const v2 = this.transformVertex(positions, i2, transform);

        // Update assembly bounds
        for (const v of [v0, v1, v2]) {
          if (v.x < minX) minX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.z < minZ) minZ = v.z;
          if (v.x > maxX) maxX = v.x;
          if (v.y > maxY) maxY = v.y;
          if (v.z > maxZ) maxZ = v.z;
        }

        const normal = this.computeNormal(v0, v1, v2);

        lines.push(
          `  facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}`,
          "    outer loop",
          `      vertex ${v0.x.toFixed(4)} ${v0.y.toFixed(4)} ${v0.z.toFixed(4)}`,
          `      vertex ${v1.x.toFixed(4)} ${v1.y.toFixed(4)} ${v1.z.toFixed(4)}`,
          `      vertex ${v2.x.toFixed(4)} ${v2.y.toFixed(4)} ${v2.z.toFixed(4)}`,
          "    endloop",
          "  endfacet"
        );
        totalTriangles++;
      }
    }

    lines.push("endsolid PuzzleAssembly\n");

    const bounds = {
      min: vec3(
        Number.isFinite(minX) ? minX : 0,
        Number.isFinite(minY) ? minY : 0,
        Number.isFinite(minZ) ? minZ : 0
      ),
      max: vec3(
        Number.isFinite(maxX) ? maxX : 0,
        Number.isFinite(maxY) ? maxY : 0,
        Number.isFinite(maxZ) ? maxZ : 0
      ),
    };

    return {
      stl: lines.join("\n"),
      totalTriangles,
      bounds,
    };
  }

  /**
   * Builds an ASCII STL string from vertex positions and optional triangle index buffer.
   */
  private static buildStlString(solidName: string, positions: Float32Array, indices?: Uint32Array): string {
    const lines: string[] = [`solid ${solidName}`];
    const numTriangles = indices && indices.length > 0 ? indices.length / 3 : positions.length / 9;

    for (let t = 0; t < numTriangles; t++) {
      let i0 = t * 3;
      let i1 = t * 3 + 1;
      let i2 = t * 3 + 2;

      if (indices && indices.length > 0) {
        i0 = indices[t * 3];
        i1 = indices[t * 3 + 1];
        i2 = indices[t * 3 + 2];
      }

      const v0 = vec3(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
      const v1 = vec3(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
      const v2 = vec3(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

      const normal = this.computeNormal(v0, v1, v2);

      lines.push(
        `  facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}`,
        "    outer loop",
        `      vertex ${v0.x.toFixed(4)} ${v0.y.toFixed(4)} ${v0.z.toFixed(4)}`,
        `      vertex ${v1.x.toFixed(4)} ${v1.y.toFixed(4)} ${v1.z.toFixed(4)}`,
        `      vertex ${v2.x.toFixed(4)} ${v2.y.toFixed(4)} ${v2.z.toFixed(4)}`,
        "    endloop",
        "  endfacet"
      );
    }

    lines.push(`endsolid ${solidName}\n`);
    return lines.join("\n");
  }

  private static transformVertex(positions: Float32Array, index: number, transform: RigidTransform3D): Vec3 {
    const lx = positions[index * 3];
    const ly = positions[index * 3 + 1];
    const lz = positions[index * 3 + 2];

    const localV = vec3(
      lx * (transform.scale?.x ?? 1),
      ly * (transform.scale?.y ?? 1),
      lz * (transform.scale?.z ?? 1)
    );

    const rotated = quatRotateVector(transform.rotation, localV);

    return vec3(
      rotated.x + transform.position.x,
      rotated.y + transform.position.y,
      rotated.z + transform.position.z
    );
  }

  private static computeNormal(v0: Vec3, v1: Vec3, v2: Vec3): Vec3 {
    const e1 = sub3(v1, v0);
    const e2 = sub3(v2, v0);
    const c = cross3(e1, e2);
    const length = len3(c);
    if (length > 0.000001) {
      return normalize3(c);
    }
    return vec3(0, 0, 1);
  }
}
