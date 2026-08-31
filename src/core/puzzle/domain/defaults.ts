/**
 * Default domain constants and presets for physical cardboard materials.
 */
import type { CardboardSpecification, PuzzleProjectDomain } from "./types";
import { uid } from "@/core/model/ids";

export const DEFAULT_CARDBOARD_2MM: CardboardSpecification = {
  id: "cardboard-2mm",
  name: "2.0mm Standard Cardboard",
  thickness: 2.0,
  density: 0.68,
  grainDirectionDeg: 0,
  minBendRadius: 4.0,
  slotTolerance: 0.15,
  color: "#D2B48C",
};

export const HEAVY_CARDBOARD_3MM: CardboardSpecification = {
  id: "cardboard-3mm",
  name: "3.0mm Heavy Cardboard",
  thickness: 3.0,
  density: 0.72,
  grainDirectionDeg: 0,
  minBendRadius: 6.0,
  slotTolerance: 0.2,
  color: "#C19A6B",
};

export const CARDBOARD_PRESETS: CardboardSpecification[] = [
  DEFAULT_CARDBOARD_2MM,
  HEAVY_CARDBOARD_3MM,
];

export function createDefaultPuzzleDomain(name = "Parametric Puzzle Project"): PuzzleProjectDomain {
  return {
    meta: {
      id: uid("proj_"),
      name,
      version: "1.0.0",
      displayUnit: "mm",
      description: "Parametric 2D-to-3D cardboard puzzle assembly project",
    },
    defaultCardboard: DEFAULT_CARDBOARD_2MM,
    materials: [...CARDBOARD_PRESETS],
  };
}
