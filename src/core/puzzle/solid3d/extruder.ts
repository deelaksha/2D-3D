/**
 * Deterministic 2D-to-3D Solid Mesh Extruder.
 *
 * Extrudes 2D piece outlines strictly in piece-LOCAL coordinate space
 * (z in [-thickness/2, +thickness/2]).
 */
import type { Vec2, Vec3 } from "@/core/model/types";
import type { SolidMeshBuffer3D, SolidRepresentation3D } from "./types";

export function extrude2DPieceTo3DSolidMesh(
  pieceId: string,
  sampledOutlines: Vec2[][],
  thickness: number,
  density = 0.68, // g/cm^3
  materialId = "cardboard-2mm",
): SolidRepresentation3D {
  const halfT = thickness / 2;
  const outerLoop = sampledOutlines[0] || [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  const n = outerLoop.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  // 1. Front face vertices (z = +halfT)
  for (let i = 0; i < n; i++) {
    const p = outerLoop[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;

    positions.push(p.x, p.y, halfT);
    normals.push(0, 0, 1);
  }

  // 2. Back face vertices (z = -halfT)
  for (let i = 0; i < n; i++) {
    const p = outerLoop[i];
    positions.push(p.x, p.y, -halfT);
    normals.push(0, 0, -1);
  }

  // 3. Side wall quads
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const p1 = outerLoop[i];
    const p2 = outerLoop[next];

    // Outward side normal
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = len > 1e-6 ? dy / len : 0;
    const ny = len > 1e-6 ? -dx / len : 0;

    const baseIdx = positions.length / 3;

    // 4 quad vertices
    positions.push(p1.x, p1.y, halfT);
    normals.push(nx, ny, 0);

    positions.push(p2.x, p2.y, halfT);
    normals.push(nx, ny, 0);

    positions.push(p2.x, p2.y, -halfT);
    normals.push(nx, ny, 0);

    positions.push(p1.x, p1.y, -halfT);
    normals.push(nx, ny, 0);

    // 2 triangles per quad
    indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
  }

  // Simple polygon area calculation (Shoelace formula)
  let area2D = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area2D += outerLoop[i].x * outerLoop[j].y;
    area2D -= outerLoop[j].x * outerLoop[i].y;
  }
  area2D = Math.abs(area2D) / 2;

  // Subtract hole areas if holes are present
  for (let hIdx = 1; hIdx < sampledOutlines.length; hIdx++) {
    const holeLoop = sampledOutlines[hIdx];
    let hArea = 0;
    for (let i = 0; i < holeLoop.length; i++) {
      const j = (i + 1) % holeLoop.length;
      hArea += holeLoop[i].x * holeLoop[j].y;
      hArea -= holeLoop[j].x * holeLoop[i].y;
    }
    area2D -= Math.abs(hArea) / 2;
  }
  area2D = Math.max(0, area2D);

  const volumeMm3 = area2D * thickness;
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = outerLoop[j].x - outerLoop[i].x;
    const dy = outerLoop[j].y - outerLoop[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  const surfaceAreaMm2 = 2 * area2D + perimeter * thickness;

  // Density g/cm^3 to g/mm^3: 1 g/cm^3 = 0.001 g/mm^3
  const massGrams = volumeMm3 * (density * 0.001);

  const localMesh: SolidMeshBuffer3D = {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    bounds: {
      min: { x: minX, y: minY, z: -halfT },
      max: { x: maxX, y: maxY, z: halfT },
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
