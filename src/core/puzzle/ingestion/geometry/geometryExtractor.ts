/**
 * Geometry Extractor Master Coordinator.
 * Orchestrates PrimitiveExtractor, BoundaryExtractor, DimensionExtractor, LabelExtractor, and GeometryValidator.
 * Maps extracted 2D vector geometry directly into CanonicalPiece and GeometryReference models.
 */
import type { Vec2 } from "@/core/model/types";
import type { Extracted2DGeometryResult } from "./types";
import type { NormalizedRepresentation } from "../types";
import type { CanonicalPiece } from "../../canonical/types";
import { ImportDiagnostics } from "../diagnostics";
import { PrimitiveExtractor } from "./primitiveExtractor";
import { BoundaryExtractor } from "./boundaryExtractor";
import { DimensionExtractor } from "./dimensionExtractor";
import { LabelExtractor } from "./labelExtractor";
import { GeometryValidator } from "./geometryValidator";
import { createCanonicalPiece } from "../../canonical/defaults";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class GeometryExtractor {
  /**
   * Main entrypoint: Extracts exact 2D primitives, topology, dimensions, labels, and CanonicalPiece models.
   */
  static extract(
    normalized: NormalizedRepresentation,
    diagnostics?: ImportDiagnostics
  ): Extracted2DGeometryResult {
    const diag = diagnostics || new ImportDiagnostics();
    diag.info("GEOM_EXTRACT_START", `Extracting 2D geometry primitives for '${normalized.sourceFilename}'.`);

    // 1. Primitive Extraction
    const primitives = PrimitiveExtractor.extractPrimitives(
      normalized.contours.map((c) => ({
        id: c.id,
        points: c.outerLoop,
        closed: true,
      }))
    );
    diag.info("PRIMITIVES_EXTRACTED", `Extracted ${primitives.length} geometric primitive(s) (lines, arcs, circles, splines).`);

    // 2. Boundary Topology Extraction
    const topologies = normalized.segmentedPieces.map((p) =>
      BoundaryExtractor.extractTopology(primitives, p.localOuterLoop, p.localHoles)
    );

    // 3. Dimension & Label Extraction
    const textStrings: string[] = [];
    if (normalized.metadata && Array.isArray(normalized.metadata.textAnnotations)) {
      textStrings.push(...(normalized.metadata.textAnnotations as string[]));
    }
    const dimensions = DimensionExtractor.extractDimensions([], textStrings);
    const labels = LabelExtractor.extractLabels([], textStrings);

    // 4. Geometric Validation Engine
    const validationIssues = topologies.flatMap((topo) =>
      GeometryValidator.validateGeometry(primitives, topo)
    );

    for (const issue of validationIssues) {
      if (issue.severity === "error") {
        diag.error(issue.code, issue.message, { elementId: issue.elementId, location: issue.location });
      } else {
        diag.warning(issue.code, issue.message, { elementId: issue.elementId, location: issue.location });
      }
    }

    const isValid = !validationIssues.some((issue) => issue.severity === "error");

    // 5. Canonical Piece Mapping
    const canonicalPieces: CanonicalPiece[] = normalized.segmentedPieces.map((p) => {
      const w = p.contour.bounds.width;
      const h = p.contour.bounds.height;
      const t = p.materialThicknessMm;

      const cPiece = createCanonicalPiece(p.pieceName, { width: w, height: h, depth: t }, t);
      cPiece.id = p.pieceId;
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

    diag.info("CANONICAL_2D_MAPPED", `Mapped ${canonicalPieces.length} CanonicalPiece model(s) with exact geometry references.`);

    return {
      sourceFilename: normalized.sourceFilename,
      primitives,
      topologies,
      dimensions,
      labels,
      canonicalPieces,
      validationIssues,
      isValid,
    };
  }
}
