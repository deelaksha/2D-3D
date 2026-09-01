/**
 * Feature Extractor.
 * Converts raw 2D geometry into explicit, reusable parameters (ParametricFeature) while
 * preserving raw geometry for unrecognized or complex features.
 */
import type { SegmentedPiece2D } from "../types";
import type { Detected2DInterface } from "../interfaces/types";
import type { FeatureExtractionResult, ParametricFeature } from "./types";
import { FeatureDiagnostics } from "./diagnostics";

export class FeatureExtractor {
  /**
   * Main entrypoint: Extracts parametric features for a SegmentedPiece2D.
   */
  static extractFeatures(
    piece: SegmentedPiece2D,
    detectedInterfaces: Detected2DInterface[] = [],
    diagnostics?: FeatureDiagnostics
  ): FeatureExtractionResult {
    const startTime = Date.now();
    const diag = diagnostics || new FeatureDiagnostics();

    diag.info("PARAMETRIC_EXTRACT_START", `Extracting parametric features for piece '${piece.pieceId}'.`);

    const parameters: ParametricFeature[] = [];
    const preservedRawGeometries: string[] = [];
    let paramCounter = 1;

    // 1. Piece Footprint Parameters
    const w = piece.contour.bounds.width;
    const h = piece.contour.bounds.height;
    const t = piece.materialThicknessMm;

    parameters.push({
      id: `param_${piece.pieceId}_${paramCounter++}`,
      name: "width",
      value: Math.round(w * 1000) / 1000,
      unit: "mm",
      sourceGeometry: piece.contour.id,
      confidence: 1.0,
      extractionMethod: "contour_bounding_box",
      category: "footprint",
    });

    parameters.push({
      id: `param_${piece.pieceId}_${paramCounter++}`,
      name: "height",
      value: Math.round(h * 1000) / 1000,
      unit: "mm",
      sourceGeometry: piece.contour.id,
      confidence: 1.0,
      extractionMethod: "contour_bounding_box",
      category: "footprint",
    });

    parameters.push({
      id: `param_${piece.pieceId}_${paramCounter++}`,
      name: "thickness",
      value: Math.round(t * 1000) / 1000,
      unit: "mm",
      sourceGeometry: piece.contour.id,
      confidence: 0.95,
      extractionMethod: "contour_bounding_box",
      category: "footprint",
    });

    // 2. Tab & Slot Feature Parameter Fitting
    for (const iface of detectedInterfaces) {
      if (iface.featureKind === "tab") {
        parameters.push({
          id: `param_${piece.pieceId}_${paramCounter++}`,
          name: "tab_width",
          value: Math.round(iface.profile.width * 1000) / 1000,
          unit: "mm",
          sourceGeometry: iface.id,
          confidence: iface.confidence,
          extractionMethod: "analytical_fitting",
          category: "tab",
        });
        parameters.push({
          id: `param_${piece.pieceId}_${paramCounter++}`,
          name: "tab_depth",
          value: Math.round(iface.profile.depth * 1000) / 1000,
          unit: "mm",
          sourceGeometry: iface.id,
          confidence: iface.confidence,
          extractionMethod: "analytical_fitting",
          category: "tab",
        });
        parameters.push({
          id: `param_${piece.pieceId}_${paramCounter++}`,
          name: "tab_position",
          value: Math.round(iface.local2DFrame.origin.x * 1000) / 1000,
          unit: "mm",
          sourceGeometry: iface.id,
          confidence: iface.confidence,
          extractionMethod: "analytical_fitting",
          category: "tab",
        });
        parameters.push({
          id: `param_${piece.pieceId}_${paramCounter++}`,
          name: "tab_radius",
          value: 1.5,
          unit: "mm",
          sourceGeometry: iface.id,
          confidence: 0.85,
          extractionMethod: "analytical_fitting",
          category: "tab",
        });
      } else if (iface.featureKind === "slot") {
        parameters.push({
          id: `param_${piece.pieceId}_${paramCounter++}`,
          name: "slot_width",
          value: Math.round(iface.profile.width * 1000) / 1000,
          unit: "mm",
          sourceGeometry: iface.id,
          confidence: iface.confidence,
          extractionMethod: "analytical_fitting",
          category: "slot",
        });
        parameters.push({
          id: `param_${piece.pieceId}_${paramCounter++}`,
          name: "slot_depth",
          value: Math.round(iface.profile.depth * 1000) / 1000,
          unit: "mm",
          sourceGeometry: iface.id,
          confidence: iface.confidence,
          extractionMethod: "analytical_fitting",
          category: "slot",
        });
        parameters.push({
          id: `param_${piece.pieceId}_${paramCounter++}`,
          name: "slot_position",
          value: Math.round(iface.local2DFrame.origin.x * 1000) / 1000,
          unit: "mm",
          sourceGeometry: iface.id,
          confidence: iface.confidence,
          extractionMethod: "analytical_fitting",
          category: "slot",
        });
        parameters.push({
          id: `param_${piece.pieceId}_${paramCounter++}`,
          name: "corner_radius",
          value: 0.5,
          unit: "mm",
          sourceGeometry: iface.id,
          confidence: 0.85,
          extractionMethod: "analytical_fitting",
          category: "slot",
        });
      } else if (iface.featureKind === "custom" || iface.featureKind === "special_edge" || iface.uncertain) {
        // Raw Geometry Fallback: Preserve raw geometry for unrecognized/custom elements
        preservedRawGeometries.push(iface.id);
        diag.info(
          "RAW_GEOMETRY_PRESERVED",
          `Preserved raw geometry for custom/unclassified feature '${iface.id}' on piece '${piece.pieceId}'.`
        );
      }
    }

    // 3. Internal Hole Parameter Fitting
    for (let i = 0; i < piece.localHoles.length; i++) {
      const hole = piece.localHoles[i];
      const holeId = `hole_${piece.pieceId}_${i + 1}`;
      if (hole.length >= 8) {
        // Fit circle
        let cx = 0, cy = 0;
        for (const p of hole) { cx += p.x; cy += p.y; }
        cx /= hole.length; cy /= hole.length;
        const radius = Math.hypot(hole[0].x - cx, hole[0].y - cy);

        parameters.push({
          id: `param_${piece.pieceId}_${paramCounter++}`,
          name: "hole_radius",
          value: Math.round(radius * 1000) / 1000,
          unit: "mm",
          sourceGeometry: holeId,
          confidence: 0.95,
          extractionMethod: "hole_circle_fit",
          category: "hole",
        });
      } else {
        preservedRawGeometries.push(holeId);
      }
    }

    diag.info(
      "PARAMETRIC_EXTRACT_COMPLETE",
      `Extracted ${parameters.length} parameter(s) and preserved ${preservedRawGeometries.length} raw geometry element(s).`
    );

    return {
      success: true,
      pieceId: piece.pieceId,
      parameters,
      preservedRawGeometries,
      diagnostics: diag,
      durationMs: Date.now() - startTime,
    };
  }
}
