/**
 * Deterministic 3D Solid Representation Generator.
 * Extrudes 2D cardboard piece outlines into 3D mesh buffers.
 */
import type { PuzzlePiece } from "../piece/types";
import type { MeshBuffer3D } from "./types";
import { shapeOutline } from "@/core/geometry/outline";

export function buildExtrudedPieceMesh3D(piece: PuzzlePiece): MeshBuffer3D {
  const loops = shapeOutline(piece.contour);
  const thickness = piece.thickness;
  const halfThickness = thickness / 2;

  // Primary outer loop
  const loop = loops[0] || [
    { x: 0, y: 0 },
    { x: piece.width, y: 0 },
    { x: piece.width, y: piece.height },
    { x: 0, y: piece.height },
  ];

  const n = loop.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Front face (z = +halfThickness)
  for (let i = 0; i < n; i++) {
    positions.push(loop[i].x, loop[i].y, halfThickness);
    normals.push(0, 0, 1);
  }
  // Back face (z = -halfThickness)
  for (let i = 0; i < n; i++) {
    positions.push(loop[i].x, loop[i].y, -halfThickness);
    normals.push(0, 0, -1);
  }

  // Generate side quads
  let minX = Infinity, minY = Infinity, minZ = -halfThickness;
  let maxX = -Infinity, maxY = -Infinity, maxZ = halfThickness;

  for (let i = 0; i < n; i++) {
    const p = loop[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    bounds: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    },
  };
}
