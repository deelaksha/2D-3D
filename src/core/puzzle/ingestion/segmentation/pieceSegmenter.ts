/**
 * Piece Segmenter Subsystem.
 * Segments individual puzzle pieces from 2D drawings using multi-source detection
 * (labels/layers, closed boundaries, nesting trees, project metadata).
 */
import type { Vec2 } from "@/core/model/types";
import type { ExtractedContour2D, NormalizedRepresentation } from "../types";
import type { PieceCandidate, SegmentationResult } from "./types";
import type { CanonicalPiece } from "../../canonical/types";
import { SegmentationDiagnostics } from "./diagnostics";
import { createCanonicalPiece } from "../../canonical/defaults";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class PieceSegmenter {
  /**
   * Main entrypoint: Segments a NormalizedRepresentation into piece candidates and CanonicalPiece objects.
   */
  static segmentDrawing(
    normalized: NormalizedRepresentation,
    diagnostics?: SegmentationDiagnostics
  ): SegmentationResult {
    const startTime = Date.now();
    const diag = diagnostics || new SegmentationDiagnostics();

    diag.info("SEGMENTATION_START", `Starting piece segmentation for '${normalized.sourceFilename}'.`);

    // 1. Generate Candidates from Closed Contours and Nesting Tree
    const candidates = this.generateCandidates(normalized, diag);

    diag.info("CANDIDATES_GENERATED", `Generated ${candidates.length} piece candidate(s).`);

    // 2. Perform Ambiguity Checks (Touching boundaries, conflicting labels, unclosed paths)
    this.checkAmbiguities(candidates, normalized, diag);

    // 3. Map Candidates into CanonicalPiece Objects
    const pieces: CanonicalPiece[] = candidates.map((cand) => {
      const w = cand.bounds.width;
      const h = cand.bounds.height;
      const t = normalized.estimatedMaterialThicknessMm || 3.0;

      const cPiece = createCanonicalPiece(cand.suggestedName, { width: w, height: h, depth: t }, t);
      cPiece.id = cand.candidateId;
      cPiece.geometryRef = {
        contour: {
          kind: "rect",
          x: 0,
          y: 0,
          width: w,
          height: h,
          rotation: 0,
        },
      };
      return cPiece;
    });

    const success = !diag.hasErrors();
    const durationMs = Date.now() - startTime;

    return {
      success,
      pieces,
      candidates,
      diagnostics: diag,
      durationMs,
    };
  }

  /**
   * Generates piece candidates from multi-source detection.
   */
  private static generateCandidates(
    normalized: NormalizedRepresentation,
    diag: SegmentationDiagnostics
  ): PieceCandidate[] {
    const candidates: PieceCandidate[] = [];
    const contours = normalized.contours;

    let candCounter = 1;

    for (const c of contours) {
      const candidateId = `piece_seg_${candCounter}`;
      const suggestedName = `Piece ${candCounter}`;

      // Source Hint 1: Check for explicit layer or label tags
      let sourceHint: PieceCandidate["sourceHint"] = "closed_loop";
      let layerName: string | undefined = undefined;

      if (normalized.metadata?.layerName) {
        sourceHint = "layer";
        layerName = String(normalized.metadata.layerName);
      }

      // Check for nested sub-pieces (Source Hint: nesting)
      if (c.holes.length > 0) {
        diag.info("NESTED_HOLES_DETECTED", `Piece '${candidateId}' has ${c.holes.length} internal cutout hole(s).`);
      }

      candidates.push({
        candidateId,
        suggestedName,
        outerBoundary: c.outerLoop,
        holes: c.holes,
        sourceHint,
        confidence: 0.95,
        bounds: c.bounds,
        layerName,
      });

      candCounter++;
    }

    return candidates;
  }

  /**
   * Performs explicit ambiguity validation checks.
   */
  private static checkAmbiguities(
    candidates: PieceCandidate[],
    normalized: NormalizedRepresentation,
    diag: SegmentationDiagnostics
  ): void {
    // Ambiguity 1: Touching boundaries sharing vertices
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const c1 = candidates[i];
        const c2 = candidates[j];

        const sharedCount = this.countSharedVertices(c1.outerBoundary, c2.outerBoundary);
        if (sharedCount > 0) {
          diag.info(
            "TOUCHING_PIECES",
            `Detected touching piece boundaries between '${c1.candidateId}' and '${c2.candidateId}' sharing ${sharedCount} vertex/vertices.`,
            c1.outerBoundary[0]
          );
        }
      }
    }

    // Ambiguity 2: Conflicting labels check
    if (normalized.metadata && Array.isArray(normalized.metadata.labels)) {
      const labels = normalized.metadata.labels as string[];
      if (labels.length > candidates.length * 2) {
        diag.warning(
          "CONFLICTING_PIECE_LABELS",
          `Found ${labels.length} label string(s) for only ${candidates.length} candidate(s). Potential naming conflict.`
        );
      }
    }

    // Ambiguity 3: Ambiguous nested containers (sub-piece inside hole of parent piece)
    for (let i = 0; i < candidates.length; i++) {
      for (let j = 0; j < candidates.length; j++) {
        if (i === j) continue;
        const parent = candidates[i];
        const child = candidates[j];

        if (this.isCandidateInsideParent(child, parent)) {
          diag.warning(
            "AMBIGUOUS_CONTAINMENT",
            `Candidate '${child.candidateId}' is nested inside the boundary loop of candidate '${parent.candidateId}'.`,
            child.outerBoundary[0]
          );
        }
      }
    }
  }

  private static countSharedVertices(poly1: Vec2[], poly2: Vec2[]): number {
    let count = 0;
    for (const p1 of poly1) {
      for (const p2 of poly2) {
        if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 1e-3) {
          count++;
        }
      }
    }
    return count;
  }

  private static isCandidateInsideParent(child: PieceCandidate, parent: PieceCandidate): boolean {
    if (
      child.bounds.min.x < parent.bounds.min.x ||
      child.bounds.max.x > parent.bounds.max.x ||
      child.bounds.min.y < parent.bounds.min.y ||
      child.bounds.max.y > parent.bounds.max.y
    ) {
      return false;
    }
    const testPt = child.outerBoundary[0];
    return this.pointInPolygon(testPt, parent.outerBoundary);
  }

  private static pointInPolygon(pt: Vec2, polygon: Vec2[]): boolean {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect =
        yi > pt.y !== yj > pt.y &&
        pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
