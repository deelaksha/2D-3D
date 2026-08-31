/**
 * Assembly domain types representing 3D piece placements and assembly structures.
 *
 * NOTE: Assembly orientation belongs strictly to the Assembly/Configuration,
 * NOT permanently to the piece model.
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { Quaternion, Transform3D } from "../geometry/types";
import type { PuzzleConnection } from "../connection/types";

export interface PuzzlePlacement3D {
  pieceId: ID;
  position: Vec3;
  rotation: Quaternion;
  scale: Vec3;
  placed: boolean;
}

export interface PuzzleAssembly {
  id: ID;
  name: string;
  placements: PuzzlePlacement3D[];
  connections: PuzzleConnection[];
}
