/**
 * Automatic Puzzle-Boundary Partitioning Engine Smoke Tests (Phase 82).
 *
 * Validates:
 *  1. Rectangular partitioning (4, 9, 16 pieces)
 *  2. Polygonal partitioning
 *  3. Irregular partitioning (asymmetric, jitter, complexity parameters)
 *  4. Organic partitioning (smooth harmonic waves)
 *  5. Arbitrary irregular global boundary (L-shaped polygon)
 *  6. Area conservation (total piece area == boundary area)
 *  7. Boundary containment (all vertices inside boundary)
 *  8. Piece connectivity (0 isolated orphan pieces)
 *  9. Self-intersection prevention
 *  10. Minimum feature size compliance
 *  11. Deterministic repeatability
 *  12. Diagnostic reporting for invalid inputs
 */

import { describe, expect, it } from "vitest";
import { BoundaryPartitionEngine } from "../core/puzzle/boundarypartition/boundaryPartitionEngine";
import type { Vec2 } from "@/core/model/types";

// Standard 200 x 200 mm rectangular boundary
const RECT_BOUNDARY: Vec2[] = [
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 200 },
  { x: 0, y: 200 },
];

// L-shaped irregular boundary (300 x 300 mm with 150 x 150 mm cutout)
const L_SHAPED_BOUNDARY: Vec2[] = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 150 },
  { x: 150, y: 150 },
  { x: 150, y: 300 },
  { x: 0, y: 300 },
];

describe("Automatic Puzzle-Boundary Partitioning Engine (Phase 82)", () => {
  describe("Rectangular Style Partitioning", () => {
    it("partitions a boundary into 4 pieces with exact area conservation", () => {
      const res = BoundaryPartitionEngine.partition({
        boundary: RECT_BOUNDARY,
        targetPieceCount: 4,
        style: "rectangular",
      });

      expect(res.success).toBe(true);
      expect(res.pieces.length).toBe(4);
      expect(res.actualPieceCount).toBe(4);
      expect(res.diagnostics.isValid).toBe(true);

      // Area conservation: 200x200 = 40,000 mm^2
      expect(res.boundary.areaMm2).toBe(40000);
      const totalPieceArea = res.pieces.reduce((sum, p) => sum + p.areaMm2, 0);
      expect(totalPieceArea).toBeCloseTo(40000, 0);
      expect(res.diagnostics.metrics.areaConservationErrorPct).toBeLessThan(0.01);

      // Each piece should be 100x100 mm = 10,000 mm^2
      for (const piece of res.pieces) {
        expect(piece.areaMm2).toBeCloseTo(10000, 0);
        expect(piece.vertices.length).toBe(4);
        expect(piece.isBorderPiece).toBe(true);
      }
    });

    it("partitions a boundary into 9 pieces (3x3 grid)", () => {
      const res = BoundaryPartitionEngine.partition({
        boundary: RECT_BOUNDARY,
        targetPieceCount: 9,
        style: "rectangular",
      });

      expect(res.success).toBe(true);
      expect(res.pieces.length).toBe(9);
      expect(res.diagnostics.isValid).toBe(true);

      // Center piece should not be a border piece
      const interiorPieces = res.pieces.filter((p) => !p.isBorderPiece);
      expect(interiorPieces.length).toBe(1);

      // Border pieces count = 8
      const borderPieces = res.pieces.filter((p) => p.isBorderPiece);
      expect(borderPieces.length).toBe(8);
    });

    it("partitions a boundary into 16 pieces (4x4 grid)", () => {
      const res = BoundaryPartitionEngine.partition({
        boundary: RECT_BOUNDARY,
        targetPieceCount: 16,
        style: "rectangular",
      });

      expect(res.success).toBe(true);
      expect(res.pieces.length).toBe(16);
      expect(res.diagnostics.isValid).toBe(true);
      expect(res.diagnostics.metrics.containmentViolationsCount).toBe(0);
      expect(res.diagnostics.metrics.isolatedPieceCount).toBe(0);
    });
  });

  describe("Polygonal Style Partitioning", () => {
    it("partitions a boundary into convex polygonal tiles with balanced areas", () => {
      const res = BoundaryPartitionEngine.partition({
        boundary: RECT_BOUNDARY,
        targetPieceCount: 7,
        style: "polygonal",
      });

      expect(res.success).toBe(true);
      expect(res.pieces.length).toBe(7);
      expect(res.diagnostics.isValid).toBe(true);

      for (const piece of res.pieces) {
        expect(piece.vertices.length).toBeGreaterThanOrEqual(3);
        expect(piece.areaMm2).toBeGreaterThan(100);
      }

      // Connectivity test: 0 isolated pieces
      expect(res.diagnostics.metrics.isolatedPieceCount).toBe(0);
      // Area conservation test
      expect(res.diagnostics.metrics.areaConservationErrorPct).toBeLessThan(0.01);
    });
  });

  describe("Irregular Style Partitioning", () => {
    it("supports parametric complexity and jitter producing asymmetric pieces", () => {
      const res = BoundaryPartitionEngine.partition({
        boundary: RECT_BOUNDARY,
        targetPieceCount: 8,
        style: "irregular",
        parameters: {
          seed: 42,
          complexity: "high",
          jitter: 0.5,
          minFeatureSizeMm: 6.0,
        },
      });

      expect(res.success).toBe(true);
      expect(res.pieces.length).toBe(8);
      expect(res.diagnostics.isValid).toBe(true);

      // Verify no self-intersections
      expect(res.diagnostics.metrics.selfIntersectionCount).toBe(0);
      // Verify containment
      expect(res.diagnostics.metrics.containmentViolationsCount).toBe(0);
    });
  });

  describe("Organic Style Partitioning", () => {
    it("modulates interior boundaries with smooth harmonic waves without self-intersection", () => {
      const res = BoundaryPartitionEngine.partition({
        boundary: RECT_BOUNDARY,
        targetPieceCount: 4,
        style: "organic",
        parameters: {
          curvature: 3.5,
          waveFrequency: 1.0,
          minFeatureSizeMm: 5.0,
        },
      });

      expect(res.success).toBe(true);
      expect(res.pieces.length).toBe(4);
      expect(res.diagnostics.isValid).toBe(true);

      // Organic pieces should have more than 4 vertices due to curved discretization
      for (const piece of res.pieces) {
        expect(piece.vertices.length).toBeGreaterThan(4);
        expect(piece.areaMm2).toBeGreaterThan(0);
      }

      expect(res.diagnostics.metrics.selfIntersectionCount).toBe(0);
      expect(res.diagnostics.metrics.containmentViolationsCount).toBe(0);
    });
  });

  describe("Arbitrary Irregular Global Boundary", () => {
    it("partitions an L-shaped concave polygon with strict boundary containment", () => {
      const res = BoundaryPartitionEngine.partition({
        boundary: L_SHAPED_BOUNDARY,
        targetPieceCount: 6,
        style: "polygonal",
      });

      expect(res.success).toBe(true);
      expect(res.pieces.length).toBe(6);

      // Expected L-shape area: 300*300 - 150*150 = 90,000 - 22,500 = 67,500 mm^2
      expect(res.boundary.areaMm2).toBeCloseTo(67500, 0);

      const totalPieceArea = res.pieces.reduce((sum, p) => sum + p.areaMm2, 0);
      expect(totalPieceArea).toBeCloseTo(67500, 0);

      // Zero vertices outside the L-shape
      expect(res.diagnostics.metrics.containmentViolationsCount).toBe(0);
      expect(res.diagnostics.metrics.overlapDetected).toBe(false);
      expect(res.diagnostics.metrics.gapDetected).toBe(false);
    });
  });

  describe("Validation Suite & Diagnostics", () => {
    it("is strictly deterministic when given the same seed", () => {
      const req1 = {
        boundary: RECT_BOUNDARY,
        targetPieceCount: 6,
        style: "irregular" as const,
        parameters: { seed: 999, jitter: 0.4 },
      };
      const run1 = BoundaryPartitionEngine.partition(req1);
      const run2 = BoundaryPartitionEngine.partition(req1);

      expect(run1.pieces.length).toBe(run2.pieces.length);
      for (let i = 0; i < run1.pieces.length; i++) {
        expect(run1.pieces[i].areaMm2).toBe(run2.pieces[i].areaMm2);
        expect(run1.pieces[i].centroid.x).toBeCloseTo(run2.pieces[i].centroid.x, 4);
        expect(run1.pieces[i].centroid.y).toBeCloseTo(run2.pieces[i].centroid.y, 4);
      }
    });

    it("returns structured diagnostics when boundary is invalid or degenerate", () => {
      const invalidBoundary: Vec2[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]; // Only 2 points, cannot form 2D polygon

      const res = BoundaryPartitionEngine.partition({
        boundary: invalidBoundary,
        targetPieceCount: 4,
      });

      expect(res.success).toBe(false);
      expect(res.pieces.length).toBe(0);
      expect(res.diagnostics.isValid).toBe(false);
      expect(res.diagnostics.issues.some((i) => i.code === "ERR_INVALID_BOUNDARY")).toBe(true);
    });

    it("reports minimum feature size warnings when pieces become too small", () => {
      // 50 pieces on a small 50x50 mm square with minFeatureSizeMm = 15 mm
      const smallSquare: Vec2[] = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 0, y: 50 },
      ];

      const res = BoundaryPartitionEngine.partition({
        boundary: smallSquare,
        targetPieceCount: 16,
        style: "rectangular",
        parameters: { minFeatureSizeMm: 15.0 },
      });

      // Should succeed geometrically, but flag warning about minimum feature size
      expect(res.diagnostics.issues.some((i) => i.code === "WARN_MIN_FEATURE_SIZE_VIOLATION")).toBe(true);
    });
  });
});
