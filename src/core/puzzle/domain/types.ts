/**
 * Domain types for the 2D-to-3D Parametric Puzzle Assembly System.
 */
import type { ID, Unit } from "@/core/model/types";

export interface CardboardSpecification {
  id: ID;
  name: string;
  /** Nominal thickness of the cardboard stock (mm). */
  thickness: number;
  /** Density in g/cm^3 (for physical weight calculations). */
  density: number;
  /** Flute / grain direction in 2D degrees (0 = along X axis). */
  grainDirectionDeg: number;
  /** Minimum allowable bend radius (mm). */
  minBendRadius: number;
  /** Slot width tolerance offset for snug assembly (mm). */
  slotTolerance: number;
  /** Display color (hex). */
  color: string;
}

export interface PuzzleProjectMeta {
  id: ID;
  name: string;
  version: string;
  createdAt?: string;
  updatedAt?: string;
  displayUnit: Unit;
  author?: string;
  description?: string;
}

export interface PuzzleProjectDomain {
  meta: PuzzleProjectMeta;
  defaultCardboard: CardboardSpecification;
  materials: CardboardSpecification[];
}
