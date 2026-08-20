/**
 * Runtime smoke test of the 2D design core: demo → parts → shapes → named
 * connectors → geometry outlines. (3D was removed; this stays 2D-only.)
 */
import { describe, it, expect } from "vitest";
import { houseDemo } from "@/data/houseDemo";
import { materialOf } from "@/core/model/defaults";
import { shapeOutline, partBoundsWorld, connectorWorld } from "@/core/geometry";
import { checkCompatibility } from "@/core/connectors/compat";

describe("WoodKit 2D core", () => {
  const project = houseDemo();

  it("builds the 7-part house demo with materials", () => {
    expect(project.parts.length).toBe(7);
    for (const p of project.parts) {
      expect(materialOf(project, p.materialId)).toBeTruthy();
      expect(p.thickness).toBeGreaterThan(0);
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
    }
  });

  it("has named connectors with finite world positions", () => {
    let total = 0;
    for (const p of project.parts) {
      for (const c of p.connectors) {
        total += 1;
        expect(c.name.length).toBeGreaterThan(0);
        expect(c.partId).toBe(p.id);
        const w = connectorWorld(p, c);
        expect(Number.isFinite(w.x) && Number.isFinite(w.y)).toBe(true);
      }
    }
    expect(total).toBeGreaterThanOrEqual(14);
  });

  it("produces closed outlines and sane world bounds for every part", () => {
    for (const p of project.parts) {
      const loops = shapeOutline(p.shape);
      expect(loops.length).toBeGreaterThan(0);
      expect(loops[0].length).toBeGreaterThanOrEqual(3);
      const b = partBoundsWorld(p);
      expect(b.maxX).toBeGreaterThan(b.minX);
      expect(b.maxY).toBeGreaterThan(b.minY);
    }
  });

  it("still reasons about connector compatibility (design metadata)", () => {
    const conns = project.parts.flatMap((p) => p.connectors.map((c) => ({ part: p, connector: c })));
    let sawValid = false;
    for (const a of conns) {
      for (const b of conns) {
        if (a.part.id === b.part.id) continue;
        const r = checkCompatibility(a, b);
        expect(["valid", "invalid", "possible", "unknown"]).toContain(r.status);
        if (r.status === "valid") sawValid = true;
      }
    }
    expect(sawValid).toBe(true);
  });
});
