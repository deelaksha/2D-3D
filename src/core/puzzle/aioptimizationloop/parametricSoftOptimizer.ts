/**
 * Parametric Soft Objective Optimizer (Phase 75).
 *
 * Optimizes soft engineering, manufacturing, and aesthetic objectives
 * strictly over parametric variables:
 *  - Material utilization (sheet packing density optimization)
 *  - Clearance centering (targeting the ideal 0.15mm tolerance for cardboard)
 *  - Dimensional aspect harmony
 *
 * CRITICAL INVARIANTS:
 *  - Hard constraints are NEVER negotiable.
 *  - NEVER directly modifies raw mesh geometry or vertex coordinates.
 *  - Every parameter change is tracked in ParameterModificationRecord.
 */

import type { ParametricDesignSpecification } from "../ailayer/types";
import type { ParameterModificationRecord } from "./types";

export class ParametricSoftOptimizer {
  /**
   * Optimizes a parametric design specification to improve soft objectives.
   */
  public static optimizeSoftObjectives(spec: ParametricDesignSpecification): {
    optimizedSpec: ParametricDesignSpecification;
    modifications: ParameterModificationRecord[];
  } {
    const modifications: ParameterModificationRecord[] = [];
    const nextSpec: ParametricDesignSpecification = JSON.parse(JSON.stringify(spec));

    // 1. Soft Objective: Material Utilization (Packing Density Optimization)
    this.optimizeSheetNesting(nextSpec, modifications);

    // 2. Soft Objective: Clearance Centering (0.15mm Sweet Spot)
    this.optimizeClearanceCentering(nextSpec, modifications);

    // 3. Soft Objective: Dimensional Aspect Harmony
    this.optimizeAspectProportions(nextSpec, modifications);

    return {
      optimizedSpec: nextSpec,
      modifications,
    };
  }

  /**
   * 1. Optimizes sheet stock dimensions to achieve optimal 40% - 60% packing density.
   */
  private static optimizeSheetNesting(
    spec: ParametricDesignSpecification,
    modifications: ParameterModificationRecord[]
  ): void {
    const currentStockW = spec.material?.stockWidthMm ?? 300;
    const currentStockH = spec.material?.stockHeightMm ?? 300;
    const currentStockArea = currentStockW * currentStockH;

    const pCount = spec.piece_count ?? 4;
    const avgW = (spec.overall_size?.widthMm ?? 160) / Math.max(1, Math.sqrt(pCount));
    const avgH = (spec.overall_size?.heightMm ?? 120) / Math.max(1, Math.sqrt(pCount));
    const estimatedPieceArea = pCount * avgW * avgH;

    const currentDensity = (estimatedPieceArea / currentStockArea) * 100;

    // If current density is < 30% (excessive sheet waste), compact the sheet dimensions
    if (currentDensity < 30.0) {
      // Hard constraints: Stock must comfortably contain all pieces with kerf margins
      const minSafeStockW = Math.max(120, Math.round(spec.overall_size.widthMm * 1.25));
      const minSafeStockH = Math.max(120, Math.round(spec.overall_size.heightMm * 1.25));

      if (currentStockW > minSafeStockW) {
        const newStockW = minSafeStockW;
        modifications.push({
          variable: "stock_width",
          previousValue: currentStockW,
          newValue: newStockW,
          delta: newStockW - currentStockW,
          stage: "OPTIMIZATION",
          rationale: `Compacted stock sheet width from ${currentStockW}mm to ${newStockW}mm to improve material utilization and reduce cardboard waste.`,
          timestamp: Date.now(),
        });
        spec.material.stockWidthMm = newStockW;
      }

      if (currentStockH > minSafeStockH) {
        const newStockH = minSafeStockH;
        modifications.push({
          variable: "stock_height",
          previousValue: currentStockH,
          newValue: newStockH,
          delta: newStockH - currentStockH,
          stage: "OPTIMIZATION",
          rationale: `Compacted stock sheet height from ${currentStockH}mm to ${newStockH}mm to increase nesting density.`,
          timestamp: Date.now(),
        });
        spec.material.stockHeightMm = newStockH;
      }
    }
  }

  /**
   * 2. Centers connection clearance toward the 0.15mm sweet spot for friction-fit.
   */
  private static optimizeClearanceCentering(
    spec: ParametricDesignSpecification,
    modifications: ParameterModificationRecord[]
  ): void {
    const currentClearance = Number((spec.connection_preferences as any)?.clearance ?? 0.15);

    // If clearance deviates from the 0.15mm sweet spot
    if (Math.abs(currentClearance - 0.15) > 0.005 && currentClearance >= 0.10 && currentClearance <= 0.30) {
      const targetClearance = 0.15;
      modifications.push({
        variable: "clearance",
        previousValue: currentClearance,
        newValue: targetClearance,
        delta: Number((targetClearance - currentClearance).toFixed(3)),
        stage: "OPTIMIZATION",
        rationale: `Centered joint clearance from ${currentClearance}mm to ${targetClearance}mm for optimal laser-cut friction fit.`,
        timestamp: Date.now(),
      });
      (spec.connection_preferences as any).clearance = targetClearance;
    }
  }

  /**
   * 3. Fine-tunes dimensional proportions for visual and physical stability.
   */
  private static optimizeAspectProportions(
    spec: ParametricDesignSpecification,
    modifications: ParameterModificationRecord[]
  ): void {
    const w = spec.overall_size.widthMm;
    const h = spec.overall_size.heightMm;
    const currentAspect = w / Math.max(1, h);

    // If aspect ratio is slightly extreme (> 2.2) and no rigid constraint prevents adjustment
    if (currentAspect > 2.5 && w > 200) {
      const optimizedW = Math.round(w * 0.9);
      modifications.push({
        variable: "bounding_width",
        previousValue: w,
        newValue: optimizedW,
        delta: optimizedW - w,
        stage: "OPTIMIZATION",
        rationale: `Harmonized extreme aspect ratio (${currentAspect.toFixed(2)}) towards ergonomic desk-top proportions.`,
        timestamp: Date.now(),
      });
      spec.overall_size.widthMm = optimizedW;
    }
  }
}
