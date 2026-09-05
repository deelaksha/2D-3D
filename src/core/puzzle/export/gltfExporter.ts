/**
 * 3D glTF 2.0 Exporter (Phase 99).
 *
 * Generates standard glTF 2.0 JSON asset files:
 *  - Scene graph with one node per piece, preserving `pieceId` in node name and metadata `extras`.
 *  - Assembled transforms preserved as node translations, rotations (quaternions), and scales.
 *  - Mesh geometry buffers embedded as data URIs (RFC 2397 base64) for standalone portability.
 */

import type { RigidTransform3D } from "../framesystem/types";
import type { GeneratedPiece3D } from "../piece3d/types";
import type { Export3DOptions } from "./types";
import { vec3 } from "../geometry/math3d";

export class GltfExporter {
  /**
   * Exports the entire 3D puzzle assembly into a valid, standalone glTF 2.0 JSON file.
   */
  public static exportAssemblyGLTF(
    pieces3D: GeneratedPiece3D[],
    pieceTransforms: Record<string, RigidTransform3D>,
    options: Export3DOptions = {}
  ): string {
    const nodes: any[] = [];
    const meshes: any[] = [];
    const accessors: any[] = [];
    const bufferViews: any[] = [];
    const buffers: any[] = [];

    // Accumulate binary data into a single combined ArrayBuffer
    const binaryChunks: Uint8Array[] = [];
    let currentByteOffset = 0;

    for (let pIdx = 0; pIdx < pieces3D.length; pIdx++) {
      const piece = pieces3D[pIdx];
      const mesh = piece.solid?.localMesh;
      const pieceId = piece.pieceId || piece.id || `piece_${pIdx}`;

      if (!mesh || !mesh.positions || mesh.positions.length < 9) {
        continue;
      }

      const transform = pieceTransforms[pieceId] || {
        position: vec3(0, 0, 0),
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: vec3(1, 1, 1),
      };

      const positions = mesh.positions;
      const normals = mesh.normals || new Float32Array(positions.length);
      const indices =
        mesh.indices && mesh.indices.length > 0
          ? mesh.indices
          : new Uint32Array(Array.from({ length: positions.length / 3 }, (_, i) => i));

      // Calculate position bounds
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i], y = positions[i + 1], z = positions[i + 2];
        if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
      }

      // 1. Index BufferView & Accessor
      const indexBytes = new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength);
      const indexAlignPad = (4 - (currentByteOffset % 4)) % 4;
      currentByteOffset += indexAlignPad;

      const indexViewIdx = bufferViews.length;
      bufferViews.push({
        buffer: 0,
        byteOffset: currentByteOffset,
        byteLength: indexBytes.byteLength,
        target: 34963, // ELEMENT_ARRAY_BUFFER
      });

      const indexAccessorIdx = accessors.length;
      accessors.push({
        bufferView: indexViewIdx,
        byteOffset: 0,
        componentType: 5125, // UNSIGNED_INT
        count: indices.length,
        type: "SCALAR",
        min: [0],
        max: [positions.length / 3 - 1],
      });

      binaryChunks.push(indexBytes);
      currentByteOffset += indexBytes.byteLength;

      // 2. Position BufferView & Accessor
      const posBytes = new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength);
      const posAlignPad = (4 - (currentByteOffset % 4)) % 4;
      currentByteOffset += posAlignPad;

      const posViewIdx = bufferViews.length;
      bufferViews.push({
        buffer: 0,
        byteOffset: currentByteOffset,
        byteLength: posBytes.byteLength,
        target: 34962, // ARRAY_BUFFER
      });

      const posAccessorIdx = accessors.length;
      accessors.push({
        bufferView: posViewIdx,
        byteOffset: 0,
        componentType: 5126, // FLOAT
        count: positions.length / 3,
        type: "VEC3",
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      });

      binaryChunks.push(posBytes);
      currentByteOffset += posBytes.byteLength;

      // 3. Normal BufferView & Accessor
      const normBytes = new Uint8Array(normals.buffer, normals.byteOffset, normals.byteLength);
      const normAlignPad = (4 - (currentByteOffset % 4)) % 4;
      currentByteOffset += normAlignPad;

      const normViewIdx = bufferViews.length;
      bufferViews.push({
        buffer: 0,
        byteOffset: currentByteOffset,
        byteLength: normBytes.byteLength,
        target: 34962, // ARRAY_BUFFER
      });

      const normAccessorIdx = accessors.length;
      accessors.push({
        bufferView: normViewIdx,
        byteOffset: 0,
        componentType: 5126, // FLOAT
        count: normals.length / 3,
        type: "VEC3",
      });

      binaryChunks.push(normBytes);
      currentByteOffset += normBytes.byteLength;

      // 4. Mesh
      const meshIdx = meshes.length;
      meshes.push({
        name: `Mesh_${pieceId}`,
        primitives: [
          {
            attributes: {
              POSITION: posAccessorIdx,
              NORMAL: normAccessorIdx,
            },
            indices: indexAccessorIdx,
            mode: 4, // TRIANGLES
          },
        ],
      });

      // 5. Node
      const nodeIdx = nodes.length;
      nodes.push({
        name: pieceId,
        mesh: meshIdx,
        translation: [
          transform.position.x,
          transform.position.y,
          transform.position.z,
        ],
        rotation: [
          transform.rotation.x,
          transform.rotation.y,
          transform.rotation.z,
          transform.rotation.w,
        ],
        scale: [
          transform.scale?.x ?? 1,
          transform.scale?.y ?? 1,
          transform.scale?.z ?? 1,
        ],
        extras: {
          pieceId,
          thicknessMm: piece.thickness,
          material: piece.material,
          interfaceIds: piece.interfaceIds,
          connectorIds: piece.connectorIds,
        },
      });
    }

    // Assemble final contiguous binary buffer
    const totalBinaryLength = binaryChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    const combinedBuffer = new Uint8Array(totalBinaryLength);
    let writePos = 0;
    for (const chunk of binaryChunks) {
      combinedBuffer.set(chunk, writePos);
      writePos += chunk.byteLength;
    }

    // Encode buffer as Base64 data URI
    const base64Data = this.uint8ArrayToBase64(combinedBuffer);
    buffers.push({
      byteLength: totalBinaryLength,
      uri: `data:application/octet-stream;base64,${base64Data}`,
    });

    const gltfDoc = {
      asset: {
        version: "2.0",
        generator: "WoodKit Designer Phase 99 - Comprehensive Puzzle Export Subsystem",
      },
      scene: 0,
      scenes: [
        {
          name: "PuzzleAssemblyScene",
          nodes: Array.from({ length: nodes.length }, (_, i) => i),
        },
      ],
      nodes,
      meshes,
      accessors,
      bufferViews,
      buffers,
    };

    return JSON.stringify(gltfDoc, null, 2);
  }

  private static uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    if (typeof btoa !== "undefined") {
      return btoa(binary);
    }
    return Buffer.from(binary, "binary").toString("base64");
  }
}
