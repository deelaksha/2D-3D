/** Deterministic, dependency-free id generation (no Math.random / Date). */

let counter = 0;

/** Monotonic id with a semantic prefix, e.g. uid("part") -> "part_000012". */
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${counter.toString(36).padStart(6, "0")}`;
}

/** Reset the counter (used by tests / project import to avoid collisions). */
export function seedIdCounter(value: number): void {
  if (value > counter) counter = value;
}

/** Extract the numeric portion of a uid, for reseeding after import. */
export function idOrdinal(id: string): number {
  const m = /_([0-9a-z]+)$/.exec(id);
  return m ? parseInt(m[1], 36) : 0;
}
