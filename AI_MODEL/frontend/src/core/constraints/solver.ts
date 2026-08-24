import type { Constraint, ConstraintKind, Part, Project } from "@/core/model/types";

/**
 * Simple, safe constraint solver. Mutates the given project's parts in place
 * to satisfy a handful of basic constraint kinds. Unknown/unsupported kinds
 * (equalLength, parallel, perpendicular, concentric, fixedDistance) are
 * ignored gracefully — they are informational only in this milestone.
 */
export function applyConstraints(project: Project): void {
  const byId = new Map<string, Part>();
  for (const part of project.parts) byId.set(part.id, part);

  for (const part of project.parts) {
    for (const constraint of part.constraints) {
      applyOne(project, byId, part, constraint);
    }
  }
}

function applyOne(
  project: Project,
  byId: Map<string, Part>,
  part: Part,
  constraint: Constraint,
): void {
  switch (constraint.kind) {
    case "fixedWidth": {
      if (typeof constraint.value === "number" && constraint.value > 0) {
        part.width = constraint.value;
        part.shape.width = constraint.value;
      }
      break;
    }
    case "fixedHeight": {
      if (typeof constraint.value === "number" && constraint.value > 0) {
        part.height = constraint.value;
        part.shape.height = constraint.value;
      }
      break;
    }
    case "fixedAngle": {
      if (typeof constraint.value === "number") {
        part.transform.rotation = normalizeAngle(constraint.value);
      }
      break;
    }
    case "centered": {
      // Center this part relative to the target part(s), or the world
      // origin if no other target is given.
      const others = constraint.targets
        .filter((id) => id !== part.id)
        .map((id) => byId.get(id))
        .filter((p): p is Part => Boolean(p));
      if (others.length > 0) {
        const cx = others.reduce((s, p) => s + p.transform.x, 0) / others.length;
        const cy = others.reduce((s, p) => s + p.transform.y, 0) / others.length;
        part.transform.x = cx;
        part.transform.y = cy;
      } else {
        part.transform.x = 0;
        part.transform.y = 0;
      }
      break;
    }
    case "aligned": {
      // Align this part's position onto the same axis as the first other
      // target part: matches whichever of x/y is closer, preferring y
      // (horizontal alignment) when both are similar.
      const otherId = constraint.targets.find((id) => id !== part.id);
      const other = otherId ? byId.get(otherId) : undefined;
      if (other) {
        const dx = Math.abs(part.transform.x - other.transform.x);
        const dy = Math.abs(part.transform.y - other.transform.y);
        if (dx <= dy) {
          part.transform.x = other.transform.x;
        } else {
          part.transform.y = other.transform.y;
        }
      }
      break;
    }
    case "symmetric": {
      // Mirror this part's position around the target part relative to a
      // shared axis (defaults to the world Y axis at x=0 when no anchor
      // target is present, otherwise mirrors around the anchor's x).
      const otherId = constraint.targets.find((id) => id !== part.id);
      const other = otherId ? byId.get(otherId) : undefined;
      const axisX = other ? other.transform.x : 0;
      part.transform.x = 2 * axisX - part.transform.x;
      part.transform.flipX = !part.transform.flipX;
      break;
    }
    case "equalLength":
    case "parallel":
    case "perpendicular":
    case "concentric":
    case "fixedDistance":
    default:
      // Not solved in this milestone — ignored gracefully.
      break;
  }

  void project;
}

function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return a;
}

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
