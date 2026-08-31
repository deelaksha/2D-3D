/**
 * Geometry Validation Engine for Parametric 2D Geometry Pipeline.
 *
 * Verifies:
 *  - Closed boundary topology
 *  - Self-intersection detection
 *  - Invalid physical dimensions
 *  - Degenerate geometry (zero-length edges)
 *  - Minimum feature size
 */
import type { Vec2 } from "@/core/model/types";
import type { BoundaryLoop, Vertex2D } from "../parametric/types";
import type { PipelineInput, PipelineValidationIssue, PipelineValidationReport } from "./types";
import { dist, len } from "@/core/geometry/vec";

export function validateGeneratedGeometry(
  input: PipelineInput,
  boundary: BoundaryLoop,
  vertices: Record<string, Vertex2D>,
  sampledPoints: Vec2[],
): PipelineValidationReport {
  const issues: PipelineValidationIssue[] = [];
  const pParams = input.pieceParameters || { width: 100, height: 100, thickness: 2.0 };

  // 1. Invalid dimensions check
  if (pParams.width <= 0) {
    issues.push({
      severity: "error",
      code: "INVALID_WIDTH",
      message: `Piece width (${pParams.width}mm) must be positive.`,
    });
  }
  if (pParams.height <= 0) {
    issues.push({
      severity: "error",
      code: "INVALID_HEIGHT",
      message: `Piece height (${pParams.height}mm) must be positive.`,
    });
  }

  // 2. Closed boundary check
  if (boundary.edgeSegments.length < 3) {
    issues.push({
      severity: "error",
      code: "OPEN_BOUNDARY",
      message: "Boundary loop contains fewer than 3 edge segments and cannot form a closed polygon.",
    });
  } else {
    const firstSeg = boundary.edgeSegments[0];
    const lastSeg = boundary.edgeSegments[boundary.edgeSegments.length - 1];
    if (firstSeg.startVertexId !== lastSeg.endVertexId) {
      issues.push({
        severity: "error",
        code: "UNCLOSED_BOUNDARY_TOPOLOGY",
        message: `Boundary loop is not closed: first start vertex (${firstSeg.startVertexId}) != last end vertex (${lastSeg.endVertexId}).`,
      });
    }
  }

  // 3. Degenerate edge check (zero-length edges)
  for (const seg of boundary.edgeSegments) {
    const sv = vertices[seg.startVertexId];
    const ev = vertices[seg.endVertexId];
    if (sv && ev) {
      const length = dist(sv, ev);
      if (length < 1e-4) {
        issues.push({
          severity: "error",
          code: "DEGENERATE_EDGE",
          message: `Edge segment '${seg.id}' is degenerate with zero length (${length.toFixed(4)}mm).`,
          refIds: [seg.id],
        });
      }
    }
  }

  // 4. Minimum feature size check
  const minFeat = input.manufacturing?.minFeatureSize ?? 1.5;
  for (const feat of input.interfaceParameters || []) {
    if (feat.width < minFeat) {
      issues.push({
        severity: "error",
        code: "FEATURE_TOO_SMALL",
        message: `Edge feature '${feat.id}' width (${feat.width}mm) is smaller than minimum feature size (${minFeat}mm).`,
        refIds: [feat.id],
      });
    }
  }

  // 5. Self-intersection detection check
  const selfIntersecting = checkPolygonSelfIntersection(sampledPoints);
  if (selfIntersecting) {
    issues.push({
      severity: "error",
      code: "SELF_INTERSECTING_GEOMETRY",
      message: "Generated 2D outer boundary contains illegal self-intersecting segments.",
    });
  }

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const level = hasError ? "error" : hasWarning ? "warning" : "ok";

  return { level, isValid: !hasError, issues };
}

function checkPolygonSelfIntersection(pts: Vec2[]): boolean {
  const n = pts.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];

    for (let j = i + 2; j < n; j++) {
      // Do not test adjacent edges sharing a vertex
      if (i === 0 && j === n - 1) continue;

      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];

      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  return false;
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  function ccw(p1: Vec2, p2: Vec2, p3: Vec2): boolean {
    return (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  }
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}
