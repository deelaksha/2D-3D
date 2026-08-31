/**
 * Cardboard physical constraint rules and feasibility checker.
 */
import type { CardboardSpecification } from "../domain/types";
import type { ConnectionInterface } from "../interface/types";
import type { CardboardJointFeasibility } from "./types";

export function checkCardboardJointFeasibility(
  cardboard: CardboardSpecification,
  interfaceDepth: number,
  slotWidth: number,
): CardboardJointFeasibility {
  // Slot width vs cardboard thickness check
  const thickness = cardboard.thickness;
  const tolerance = cardboard.slotTolerance;
  const idealSlotWidth = thickness + tolerance;
  const clearanceRatio = slotWidth / idealSlotWidth;

  let feasible = true;
  let recommendation: string | undefined;

  if (slotWidth < thickness) {
    feasible = false;
    recommendation = `Slot width (${slotWidth}mm) is tighter than cardboard stock thickness (${thickness}mm). Risk of crushing cardboard.`;
  } else if (slotWidth > thickness + tolerance * 3) {
    feasible = true;
    recommendation = `Slot width (${slotWidth}mm) is loose for ${thickness}mm cardboard stock. Connection may feel loose.`;
  }

  return {
    feasible,
    clearanceRatio,
    grainAngleDiffDeg: 0,
    recommendation,
  };
}
