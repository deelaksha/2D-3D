/**
 * Edge & Connection Interface domain definitions.
 *
 * A ConnectionInterface represents an explicit physical port or mating feature
 * along a piece edge, defining local position, normal vector, and tangent vector.
 */
import type { ID, Vec2 } from "@/core/model/types";

export type InterfaceRole = "insert" | "receiver" | "neutral" | "custom";

export type InterfacePattern =
  | "tab_slot"
  | "finger"
  | "dovetail"
  | "mitre"
  | "butt"
  | "custom";

export interface ConnectionInterface {
  id: ID;
  pieceId: ID;
  name: string;
  /** Edge index or edge designation (e.g. 0=top, 1=right, 2=bottom, 3=left). */
  edgeIndex: number;
  /** Parametric offset along the edge (0.0 to 1.0) or absolute mm offset. */
  parametricOffset: number;
  /** 2D local position on the piece (mm). */
  position: Vec2;
  /** Outward normal vector in local 2D piece space. */
  normal: Vec2;
  /** Along-edge tangent vector in local 2D piece space. */
  tangent: Vec2;
  /** Feature width / length along the edge (mm). */
  width: number;
  /** Feature depth / extrusion into/out-of the piece (mm). */
  depth: number;
  /** Physical role: male insert, female receiver, or neutral face. */
  role: InterfaceRole;
  /** Joint pattern designation. */
  pattern: InterfacePattern;
  /** Recommended clearance tolerance (mm). */
  tolerance: number;
  /** Allow-list of compatible interface IDs or types. */
  compatibleTypes?: string[];
  metadata?: Record<string, string | number | boolean>;
}
