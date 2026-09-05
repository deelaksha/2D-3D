/**
 * 3D Wavefront OBJ Exporter (Phase 99).
 *
 * Generates standard Wavefront OBJ files:
 *  - Individual piece solids with piece metadata.
 *  - Complete 3D puzzle assembly with distinct named objects (`o Piece_<pieceId>`),
 *    preserving piece identity in external CAD, Blender, and rendering tools.
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

export class ObjExporter {
  /**
   * Exports an individual 3D piece solid mesh to Wavefront OBJ format.
   */
  public static exportPieceOBJ(piece3D: GeneratedPiece3D, options: Export3DOptions = {}): string {
    const mesh = piece3D.solid?.localMesh;
    const pieceId = piece3D.pieceId || piece3D.id || "piece";

    const lines: string[] = [
      "# Wavefront OBJ File",
      "# Created by WoodKit Designer Phase 99",
      `# Piece ID: ${pieceId}`,
      `o Piece_${pieceId}`,
      `g Piece_${pieceId}`,
    ];

    if (!mesh || !mesh.positions || mesh.positions.length < 9) {
      return lines.join("\n") + "\n";
    }

    const positions = mesh.positions;
    const indices = mesh.indices;
    const numVertices = positions.length / 3;

    // Output vertices
    for (let i = 0; i < numVertices; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      lines.push(`v ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`);
    }

    // Output faces (1-indexed in OBJ format)
    const numTriangles = indices && indices.length > 0 ? indices.length / 3 : numVertices / 3;
    for (let t = 0; t < numTriangles; t++) {
      let i0 = t * 3;
      let i1 = t * 3 + 1;
      let i2 = t * 3 + 2;

      if (indices && indices.length > 0) {
        i0 = indices[t * 3];
        i1 = indices[t * 3 + 1];
        i2 = indices[t * 3 + 2];
      }

      lines.push(`f ${i0 + 1} ${i1 + 1} ${i2 + 1}`);
    }

    return lines.join("\n") + "\n";
  }

  /**
   * Exports the complete 3D puzzle assembly into a multi-object Wavefront OBJ file.
   * Each piece has its own named object (`o Piece_<pieceId>`), preserving piece identity.
   */
  public static exportAssemblyOBJ(
    pieces3D: GeneratedPiece3D[],
    pieceTransforms: Record<string, RigidTransform3D>,
    options: Export3DOptions = {}
  ): string {
    const lines: string[] = [
      "# Wavefront OBJ Multi-Object Assembly",
      "# Created by WoodKit Designer Phase 99",
      `# Total Pieces: ${pieces3D.length}`,
    ];

    let vertexOffset = 0;

    for (const piece of pieces3D) {
      const mesh = piece.solid?.localMesh;
      if (!mesh || !mesh.positions || mesh.positions.length < 9) continue;

      const pieceId = piece.pieceId || piece.id || "piece";
      const transform = pieceTransforms[pieceId] || {
        position: vec3(0, 0, 0),
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: vec3(1, 1, 1),
      };

      lines.push(
        "",
        `# --- Piece: ${pieceId} ---`,
        `o Piece_${pieceId}`,
        `g Piece_${pieceId}`
      );

      const positions = mesh.positions;
      const indices = mesh.indices;
      const numVertices = positions.length / 3;

      // Output transformed vertices for this piece
      for (let i = 0; i < numVertices; i++) {
        const v = this.transformVertex(positions, i, transform);
        lines.push(`v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}`);
      }

      // Output faces referencing global 1-indexed vertices with current offset
      const numTriangles = indices && indices.length > 0 ? indices.length / 3 : numVertices / 3;
      for (let t = 0; t < numTriangles; t++) {
        let i0 = t * 3;
        let i1 = t * 3 + 1;
        let i2 = t * 3 + 2;

        if (indices && indices.length > 0) {
          i0 = indices[t * 3];
          i1 = indices[t * 3 + 1];
          i2 = indices[t * 3 + 2];
        }

        const v0 = vertexOffset + i0 + 1;
        const v1 = vertexOffset + i1 + 1;
        const v2 = vertexOffset + i2 + 1;

        lines.push(`f ${v0} ${v1} ${v2}`);
      }

      vertexOffset += numVertices;
    }

    return lines.join("\n") + "\n";
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
}
