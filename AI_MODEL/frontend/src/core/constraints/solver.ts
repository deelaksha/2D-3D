import type { Constraint, ConstraintKind } from "@/core/model/types";

const KIND_DESCRIPTIONS: Record<ConstraintKind, (c: Constraint) => string> = {
  fixedWidth: (c) =>
    typeof c.value === "number"
      ? `Keep this piece exactly ${c.value}mm wide.`
      : "Keep this piece a fixed width.",
  fixedHeight: (c) =>
    typeof c.value === "number"
      ? `Keep this piece exactly ${c.value}mm tall.`
      : "Keep this piece a fixed height.",
  equalLength: () => "Make these pieces the same length as each other.",
  parallel: () => "Keep these pieces running side by side, never crossing.",
  perpendicular: () => "Keep these pieces meeting at a right angle, like a corner.",
  concentric: () => "Keep these pieces sharing the same center point.",
  centered: () => "Keep this piece centered in the middle of the others.",
  aligned: () => "Keep this piece lined up evenly with the other one.",
  fixedAngle: (c) =>
    typeof c.value === "number"
      ? `Keep this piece tilted at ${c.value}°.`
      : "Keep this piece at a fixed angle.",
  fixedDistance: (c) =>
    typeof c.value === "number"
      ? `Keep this piece ${c.value}mm away from the other one.`
      : "Keep this piece a fixed distance from the other one.",
  symmetric: () => "Keep this piece mirrored evenly on the other side.",
};

/** Returns a short, child-friendly sentence describing what a constraint does. */
export function describeConstraint(c: Constraint): string {
  const fn = KIND_DESCRIPTIONS[c.kind];
  return fn ? fn(c) : "Keep these pieces working together nicely.";
}
