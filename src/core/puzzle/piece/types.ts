/**
 * 2D Cardboard Piece domain definitions.
 *
 * NOTE ON ASSEMBLY ORIENTATION:
 * Physical pieces have fixed/default dimensions (width, height, thickness) and a 2D local
 * frame layout. Assembly orientation belongs strictly to the 3D Assembly configuration (Placement),
 * NOT permanently to the piece template itself.
 */
import type { Bounds, ID, Shape, Vec2 } from "@/core/model/types";
import type { ConnectionInterface } from "../interface/types";

export interface ParameterDefinition {
  name: string;
  defaultValue: number;
  minValue?: number;
  maxValue?: number;
  description?: string;
}

export interface PuzzlePiece {
  id: ID;
  name: string;
  /** Fixed footprint width in 2D local space (mm). */
  width: number;
  /** Fixed footprint height in 2D local space (mm). */
  height: number;
  /** Stock cardboard thickness (mm) extruding into 3D. */
  thickness: number;
  /** Material ID reference. */
  materialId: ID;
  /** Primary 2D local contour shape. */
  contour: Shape;
  /** Connection ports / edge interfaces attached to this piece. */
  interfaces: ConnectionInterface[];
  /** Optional parameter specifications if piece dimensions are explicitly parameterized. */
  parameters?: Record<string, ParameterDefinition>;
  /** Current active parameter values. */
  parameterValues?: Record<string, number>;
  /** Visual color override (hex). */
  color?: string;
  metadata?: Record<string, string | number | boolean>;
}
