/**
 * Factory and helper functions for PuzzleConnection instances.
 */
import type { ID } from "@/core/model/types";
import type { PuzzleConnection } from "./types";
import { uid } from "@/core/model/ids";

export interface CreateConnectionOptions {
  sourcePieceId: ID;
  sourceInterfaceId: ID;
  targetPieceId: ID;
  targetInterfaceId: ID;
  /** Arbitrary 3D joining angle in degrees (default 90°). */
  joiningAngleDeg?: number;
  rollAngleDeg?: number;
  clearance?: number;
}

export function createPuzzleConnection(options: CreateConnectionOptions): PuzzleConnection {
  return {
    id: uid("conn_"),
    sourcePieceId: options.sourcePieceId,
    sourceInterfaceId: options.sourceInterfaceId,
    targetPieceId: options.targetPieceId,
    targetInterfaceId: options.targetInterfaceId,
    joiningAngleDeg: options.joiningAngleDeg ?? 90.0,
    rollAngleDeg: options.rollAngleDeg ?? 0.0,
    clearance: options.clearance ?? 0.0,
    status: "unverified",
  };
}

/** Utility to normalize joining angle into range [0, 360). */
export function normalizeJoiningAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
