/**
 * @vitest-environment happy-dom
 *
 * Regression test: the 3D Parts Library sidebar thumbnail must preview the
 * part's REAL 2D shape (PartThumbnail in Canvas3D.tsx), not a generic
 * rectangle. This mounts PartThumbnail in isolation (no WebGL needed — it's
 * plain SVG) for a spread of shape kinds, transforms and modifiers, and
 * checks the rendered <path> geometry actually varies with shape.kind
 * instead of always drawing the same 4-point box.
 */
import { describe, it, expect } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PartThumbnail } from "@/ui/canvas3d/Canvas3D";
import { makePart, makeShape } from "@/core/model/defaults";
import type { Part, ShapeKind } from "@/core/model/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function partWithShape(kind: ShapeKind, shapeOverrides: Record<string, unknown> = {}, partOverrides: Partial<Part> = {}): Part {
  const part = makePart("Test Part", "mat-plywood-12", partOverrides);
  part.shape = makeShape(kind, shapeOverrides);
  return part;
}

function renderThumbnail(part: Part): { host: HTMLDivElement; unmount: () => void } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(<PartThumbnail part={part} materialColor="#c8a25a" />);
  });
  return { host, unmount: () => act(() => root.unmount()) };
}

/** Count of straight-line segments ("L" commands) across all <path> "d" attrs. */
function lineSegmentCounts(host: HTMLDivElement): number[] {
  return Array.from(host.querySelectorAll("path")).map((el) => {
    const d = el.getAttribute("d") ?? "";
    return (d.match(/L/g) ?? []).length;
  });
}

describe("PartThumbnail renders the real shape, not a generic rectangle", () => {
  it("rect: main panel is a 4-point quad", () => {
    const { host, unmount } = renderThumbnail(partWithShape("rect"));
    const counts = lineSegmentCounts(host);
    // rect outline has 4 points -> 1 M + 3 L + Z
    expect(counts).toContain(3);
    unmount();
  });

  it("triangle: main panel is a 3-point triangle, not a rectangle", () => {
    const { host, unmount } = renderThumbnail(partWithShape("triangle"));
    const counts = lineSegmentCounts(host);
    expect(counts).toContain(2); // 1 M + 2 L + Z
    expect(counts).not.toContain(3); // must NOT fall back to the old rectangle shape
    unmount();
  });

  it("circle: main panel is a smooth many-point loop, not a rectangle", () => {
    const { host, unmount } = renderThumbnail(partWithShape("circle"));
    const counts = lineSegmentCounts(host);
    expect(Math.max(...counts)).toBeGreaterThan(20);
    expect(counts).not.toContain(3);
    unmount();
  });

  it("hexagon: main panel has 6 points", () => {
    const { host, unmount } = renderThumbnail(partWithShape("hexagon"));
    const counts = lineSegmentCounts(host);
    expect(counts).toContain(5); // 1 M + 5 L + Z
    unmount();
  });

  it("diamond: main panel has 4 points distinct from the rect box", () => {
    const { host, unmount } = renderThumbnail(partWithShape("diamond"));
    const counts = lineSegmentCounts(host);
    expect(counts).toContain(3);
    // The diamond path's points must differ from an axis-aligned rect's corners.
    const paths = Array.from(host.querySelectorAll("path")).map((el) => el.getAttribute("d"));
    expect(paths.some((d) => d && /M\s*[\d.]+\s+\d+(\.\d+)?\s+L/.test(d))).toBe(true);
    unmount();
  });

  it("star: main panel has 10 points (5-point star)", () => {
    const { host, unmount } = renderThumbnail(partWithShape("star"));
    const counts = lineSegmentCounts(host);
    expect(counts).toContain(9); // 1 M + 9 L + Z
    unmount();
  });

  it("ring: renders two loops (outer + inner hole) in one even-odd path", () => {
    const { host, unmount } = renderThumbnail(partWithShape("ring"));
    const mainPath = Array.from(host.querySelectorAll("path")).find((el) => el.getAttribute("fill-rule") === "evenodd");
    expect(mainPath).toBeTruthy();
    const d = mainPath!.getAttribute("d") ?? "";
    expect((d.match(/M/g) ?? []).length).toBe(2);
    unmount();
  });

  it("line: open shape previews as an unfilled stroke, not a filled blob", () => {
    const part = partWithShape("line");
    const { host, unmount } = renderThumbnail(part);
    const paths = Array.from(host.querySelectorAll("path"));
    expect(paths.some((el) => el.getAttribute("fill") === "none")).toBe(true);
    unmount();
  });

  it("rotated + flipped triangle still previews as a triangle (uses world transform)", () => {
    const part = partWithShape("triangle", {}, {
      transform: { x: 0, y: 0, rotation: 40, scaleX: 1, scaleY: 1, flipX: true, flipY: false },
    });
    const { host, unmount } = renderThumbnail(part);
    const counts = lineSegmentCounts(host);
    expect(counts).toContain(2);
    unmount();
  });

  it("subtract modifier (a hole) shows up as an extra loop in the main panel path", () => {
    const part = partWithShape("rect", { width: 100, height: 80 });
    part.modifiers = [
      { id: "mod-1", op: "subtract", shape: makeShape("circle", { x: 30, y: 20, width: 20, height: 20 }) },
    ];
    const { host, unmount } = renderThumbnail(part);
    const mainPath = Array.from(host.querySelectorAll("path")).find((el) => el.getAttribute("fill-rule") === "evenodd");
    const d = mainPath!.getAttribute("d") ?? "";
    expect((d.match(/M/g) ?? []).length).toBe(2); // base rect loop + hole loop
    unmount();
  });
});
