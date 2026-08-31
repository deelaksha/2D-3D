/**
 * 3D Solid Mesh representation structures for extruded 2D cardboard pieces.
 */
import type { Vec3 } from "@/core/model/types";
import type { Box3D } from "../geometry/types";

export interface MeshBuffer3D {
  /** Flat array of vertex positions [x0, y0, z0, x1, y1, z1, ...]. */
  positions: Float32Array;
  /** Flat array of vertex normals [nx0, ny0, nz0, ...]. */
  normals: Float32Array;
  /** Flat array of triangle face indices [i0, j0, k0, ...]. */
  indices: Uint32Array;
  /** Bounding box of the 3D mesh. */
  bounds: Box3D;
}
