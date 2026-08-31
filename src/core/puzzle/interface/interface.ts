/**
 * Helper functions for creating and evaluating connection interfaces.
 */
import type { ID, Vec2 } from "@/core/model/types";
import type { ConnectionInterface, InterfacePattern, InterfaceRole } from "./types";
import { uid } from "@/core/model/ids";
import { normalize } from "@/core/geometry/vec";

export interface CreateInterfaceOptions {
  name?: string;
  edgeIndex?: number;
  parametricOffset?: number;
  position: Vec2;
  normal: Vec2;
  tangent?: Vec2;
  width?: number;
  depth?: number;
  role?: InterfaceRole;
  pattern?: InterfacePattern;
  tolerance?: number;
}

export function createConnectionInterface(
  pieceId: ID,
  options: CreateInterfaceOptions,
): ConnectionInterface {
  const norm = normalize(options.normal);
  // Tangent is perpendicular to normal (-ny, nx) if not specified
  const tang = options.tangent
    ? normalize(options.tangent)
    : { x: -norm.y, y: norm.x };

  return {
    id: uid("iface_"),
    pieceId,
    name: options.name ?? "Edge Interface",
    edgeIndex: options.edgeIndex ?? 0,
    parametricOffset: options.parametricOffset ?? 0.5,
    position: options.position,
    normal: norm,
    tangent: tang,
    width: options.width ?? 20.0,
    depth: options.depth ?? 2.0,
    role: options.role ?? "neutral",
    pattern: options.pattern ?? "tab_slot",
    tolerance: options.tolerance ?? 0.1,
  };
}
