/**
 * Unit system. Storage is ALWAYS millimetres. Display converts on the way out.
 */
import type { Unit } from "./model/types";

const MM_PER: Record<Unit, number> = {
  mm: 1,
  cm: 10,
  inch: 25.4,
};

/** Convert a value stored in mm to the given display unit. */
export function fromMm(valueMm: number, unit: Unit): number {
  return valueMm / MM_PER[unit];
}

/** Convert a display value in the given unit back to mm for storage. */
export function toMm(value: number, unit: Unit): number {
  return value * MM_PER[unit];
}

/** Round to a sensible number of decimals for the unit. */
export function roundForUnit(valueMm: number, unit: Unit): number {
  const v = fromMm(valueMm, unit);
  const dp = unit === "inch" ? 3 : unit === "cm" ? 2 : 1;
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}

/** Format a stored mm value for display, e.g. "100 mm" / "3.94 inch". */
export function formatLength(valueMm: number, unit: Unit): string {
  return `${roundForUnit(valueMm, unit)} ${unit}`;
}

export const UNIT_LABELS: Record<Unit, string> = {
  mm: "Millimetres",
  cm: "Centimetres",
  inch: "Inches",
};
