/**
 * Geometric Validation Subsystem.
 * Validates 2D geometry for self-intersections, open boundaries, duplicate edges, zero-length edges,
 * invalid curves, and disconnected geometry. Returns explicit diagnostic issues.
 */
import type { Vec2 } from "@/core/model/types";
import type { ExactPrimitive, GeometricValidationIssue } from "./types";
import type { PieceTopology } from "../../parametric/types";

export class GeometryValidator {
  /**
   * Performs full 2D geometric validation over primitives and piece topology.
   */
  static validateGeometry(primitives: ExactPrimitive[], topology: PieceTopology): GeometricValidationIssue[] {
    const issues: GeometricValidationIssue[] = [];

    // 1. Zero-Length Edge & Degenerate Point Check
    this.checkZeroLengthEdges(primitives, issues);

    // 2. Invalid Curve Parameters (Negative/NaN radius, collinear arc points)
    this.checkInvalidCurves(primitives, issues);

    // 3. Open Boundaries Check
    this.checkOpenBoundaries(topology, issues);

    // 4. Duplicate / Overlapping Edges Check
    this.checkDuplicateEdges(primitives, issues);

    // 5. Self-Intersection Check
    this.checkSelfIntersections(topology, issues);

    // 6. Disconnected Geometry Check
    this.checkDisconnectedGeometry(topology, issues);

    return issues;
  }

  /**
   * Checks for zero-length edges ($\Delta < 1e-4$).
   */
  private static checkZeroLengthEdges(primitives: ExactPrimitive[], issues: GeometricValidationIssue[]): void {
    for (const p of primitives) {
      if (p.kind === "line") {
        if (p.length < 1e-4) {
          issues.push({
            code: "GEOM_ZERO_LENGTH_EDGE",
            message: `Degenerate zero-length edge detected (ID: ${p.id}, length: ${p.length}mm).`,
            severity: "error",
            elementId: p.id,
            location: p.start,
          });
        }
      }
    }
  }

  /**
   * Checks for invalid curve parameters.
   */
  private static checkInvalidCurves(primitives: ExactPrimitive[], issues: GeometricValidationIssue[]): void {
    for (const p of primitives) {
      if (p.kind === "arc" || p.kind === "circle") {
        if (p.radius <= 0 || isNaN(p.radius)) {
          issues.push({
            code: "GEOM_INVALID_CURVE_RADIUS",
            message: `Invalid curve radius (${p.radius}) detected on primitive '${p.id}'.`,
            severity: "error",
            elementId: p.id,
            location: p.center,
          });
        }
        if (isNaN(p.center.x) || isNaN(p.center.y)) {
          issues.push({
            code: "GEOM_NAN_COORDINATE",
            message: `NaN coordinate detected in curve center for primitive '${p.id}'.`,
            severity: "error",
            elementId: p.id,
          });
        }
      }
    }
  }

  /**
   * Checks for open outer boundary loops.
   */
  private static checkOpenBoundaries(topology: PieceTopology, issues: GeometricValidationIssue[]): void {
    const loop = topology.outerBoundary;
    if (!loop || loop.edgeSegments.length < 3) {
      issues.push({
        code: "GEOM_OPEN_BOUNDARY",
        message: "Outer boundary loop is unclosed or has fewer than 3 edge segments.",
        severity: "error",
      });
      return;
    }

    const firstSeg = loop.edgeSegments[0];
    const lastSeg = loop.edgeSegments[loop.edgeSegments.length - 1];

    if (firstSeg.startVertexId !== lastSeg.endVertexId) {
      const v1 = topology.vertices[firstSeg.startVertexId];
      const v2 = topology.vertices[lastSeg.endVertexId];
      if (v1 && v2) {
        const gap = Math.hypot(v1.x - v2.x, v1.y - v2.y);
        if (gap > 1e-3) {
          issues.push({
            code: "GEOM_OPEN_BOUNDARY_GAP",
            message: `Open boundary detected: ${gap.toFixed(3)}mm gap between start and end vertices.`,
            severity: "error",
            location: { x: v2.x, y: v2.y },
          });
        }
      }
    }
  }

  /**
   * Checks for duplicate / coincident edges.
   */
  private static checkDuplicateEdges(primitives: ExactPrimitive[], issues: GeometricValidationIssue[]): void {
    const lines = primitives.filter((p): p is Extract<ExactPrimitive, { kind: "line" }> => p.kind === "line");

    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const l1 = lines[i];
        const l2 = lines[j];

        const matchDirect = this.ptsEqual(l1.start, l2.start) && this.ptsEqual(l1.end, l2.end);
        const matchReverse = this.ptsEqual(l1.start, l2.end) && this.ptsEqual(l1.end, l2.start);

        if (matchDirect || matchReverse) {
          issues.push({
            code: "GEOM_DUPLICATE_EDGE",
            message: `Duplicate coincident edge detected between '${l1.id}' and '${l2.id}'.`,
            severity: "warning",
            elementId: l2.id,
            location: l1.start,
          });
        }
      }
    }
  }

  /**
   * Checks for self-intersecting boundary edges.
   */
  private static checkSelfIntersections(topology: PieceTopology, issues: GeometricValidationIssue[]): void {
    const loop = topology.outerBoundary;
    if (!loop) return;

    const segs = loop.edgeSegments;
    const n = segs.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue; // Adjacent endpoints expected to touch

        const v1 = topology.vertices[segs[i].startVertexId];
        const v2 = topology.vertices[segs[i].endVertexId];
        const v3 = topology.vertices[segs[j].startVertexId];
        const v4 = topology.vertices[segs[j].endVertexId];

        if (v1 && v2 && v3 && v4) {
          if (this.lineSegmentsIntersect(v1, v2, v3, v4)) {
            issues.push({
              code: "GEOM_SELF_INTERSECTION",
              message: `Self-intersection detected between edge segment ${i + 1} and ${j + 1}.`,
              severity: "error",
              elementId: segs[i].id,
              location: { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 },
            });
          }
        }
      }
    }
  }

  /**
   * Checks for disconnected / floating geometry segments.
   */
  private static checkDisconnectedGeometry(topology: PieceTopology, issues: GeometricValidationIssue[]): void {
    const vertexUsage: Record<string, number> = {};

    for (const seg of topology.outerBoundary.edgeSegments) {
      vertexUsage[seg.startVertexId] = (vertexUsage[seg.startVertexId] || 0) + 1;
      vertexUsage[seg.endVertexId] = (vertexUsage[seg.endVertexId] || 0) + 1;
    }

    for (const [vId, count] of Object.entries(vertexUsage)) {
      if (count < 2) {
        const v = topology.vertices[vId];
        issues.push({
          code: "GEOM_DISCONNECTED_VERTEX",
          message: `Disconnected floating vertex '${vId}' detected (connected to only ${count} edge).`,
          severity: "warning",
          elementId: vId,
          location: v ? { x: v.x, y: v.y } : undefined,
        });
      }
    }
  }

  private static ptsEqual(a: Vec2, b: Vec2): boolean {
    return Math.hypot(a.x - b.x, a.y - b.y) < 1e-4;
  }

  /**
   * 2D line segment intersection algorithm.
   */
  private static lineSegmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
    const ccw = (a: Vec2, b: Vec2, c: Vec2) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
  }
}
