/**
 * Material & Cardboard physical constraint definitions.
 */
import type { CardboardSpecification } from "../domain/types";

export interface CardboardJointFeasibility {
  feasible: boolean;
  clearanceRatio: number;
  grainAngleDiffDeg: number;
  recommendation?: string;
}
