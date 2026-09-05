/**
 * Manufacturing-Aware 2D Layout Optimizer (Prompts 113 & 114).
 *
 * Optimizes 2D piece placement on fixed stock cardboard sheets:
 *  - STRICT INVARIANT: The configured cardboard sheet size is IMMUTABLE.
 *    The optimizer NEVER expands or modifies the sheet dimensions to make pieces fit.
 *  - Calculates 2D nesting, rotation (0° / 90°), spacing, cut path length,
 *    material utilization %, waste area mm², and edge safety margins.
 *  - Validates boundaries and generates warnings or alternatives if pieces cannot fit.
 */

import type { GeneratedPiece2D, GeneratedPuzzle2D } from "../automatic2d/types";
import type { ManufacturingLayoutOptimizationResult } from "./types";

export interface ManufacturingOptimizerOptions {
  sheetWidthMm: number;
  sheetHeightMm: number;
  marginMm?: number;
  spacingMm?: number;
  thicknessMm?: number;
}

export class ManufacturingLayoutOptimizer {
  /**
   * Optimizes placement of 2D puzzle pieces onto fixed sheet(s).
   */
  public static optimizeLayout(
    puzzle2D: GeneratedPuzzle2D,
    options: ManufacturingOptimizerOptions
  ): ManufacturingLayoutOptimizationResult {
    const sheetWidth = options.sheetWidthMm;
    const sheetHeight = options.sheetHeightMm;
    const margin = options.marginMm ?? 8.0;
    const spacing = options.spacingMm ?? 4.0;
    const spec = (puzzle2D as any)?.specification ?? (puzzle2D as any)?.designSpecification;
    const thickness = options.thicknessMm ?? spec?.thicknessMm ?? 3.0;

    const usableWidth = sheetWidth - margin * 2;
    const usableHeight = sheetHeight - margin * 2;

    const pieces = (puzzle2D as any)?.pieces ?? (puzzle2D as any)?.pieces2D ?? [];
    const totalPieces = pieces.length;

    if (totalPieces === 0) {
      return {
        sheetWidthMm: sheetWidth,
        sheetHeightMm: sheetHeight,
        materialThicknessMm: thickness,
        fitsOnConfiguredSheet: true,
        totalPieces: 0,
        piecesPacked: 0,
        sheetsRequired: 1,
        materialUtilizationPercent: 0,
        wasteAreaMm2: sheetWidth * sheetHeight,
        totalCutLengthMm: 0,
        minimumEdgeDistanceMm: margin,
        manufacturingClearanceMm: spacing,
        warnings: [],
        packedPlacements: [],
      };
    }

    const warnings: string[] = [];
    const packedPlacements: ManufacturingLayoutOptimizationResult["packedPlacements"] = [];

    // Sort pieces descending by area (shelf packing heuristic)
    const sorted = [...pieces].sort((a, b) => {
      const wA = (a as any).dimensions?.widthMm ?? (a as any).dimensions?.width ?? 40;
      const hA = (a as any).dimensions?.heightMm ?? (a as any).dimensions?.height ?? 30;
      const wB = (b as any).dimensions?.widthMm ?? (b as any).dimensions?.width ?? 40;
      const hB = (b as any).dimensions?.heightMm ?? (b as any).dimensions?.height ?? 30;
      const areaA = (a as any).dimensions?.areaMm2 ?? (wA * hA);
      const areaB = (b as any).dimensions?.areaMm2 ?? (wB * hB);
      return areaB - areaA;
    });

    let currentSheetIndex = 0;
    let currentX = margin;
    let currentY = margin;
    let rowMaxHeight = 0;
    let totalPieceAreaMm2 = 0;
    let totalCutLengthMm = 0;

    for (const piece of sorted) {
      const origW = (piece as any).dimensions?.widthMm ?? (piece as any).dimensions?.width ?? ((piece as any).dimensions?.bounds ? ((piece as any).dimensions.bounds.maxX - (piece as any).dimensions.bounds.minX) : 40);
      const origH = (piece as any).dimensions?.heightMm ?? (piece as any).dimensions?.height ?? ((piece as any).dimensions?.bounds ? ((piece as any).dimensions.bounds.maxY - (piece as any).dimensions.bounds.minY) : 30);
      const safeW = origW || 40;
      const safeH = origH || 30;
      const pieceArea = (piece as any).dimensions?.areaMm2 ?? (safeW * safeH);
      totalPieceAreaMm2 += pieceArea;

      // Approximate cut length: perimeter of piece + connector feature overhead
      totalCutLengthMm += 2 * (safeW + safeH) + 16.0;

      // Check if standard orientation fits
      let w = safeW;
      let h = safeH;
      let rot = 0;

      // Try 90° rotation if it packs better
      if (w > usableWidth && h <= usableWidth) {
        w = origH;
        h = origW;
        rot = 90;
      }

      // If single piece is strictly larger than usable sheet dimensions
      if (w > usableWidth || h > usableHeight) {
        warnings.push(
          `Piece '${piece.pieceId}' (${w.toFixed(0)}×${h.toFixed(0)} mm) exceeds usable sheet area (${usableWidth.toFixed(0)}×${usableHeight.toFixed(0)} mm).`
        );
      }

      // Check if we need to wrap to next row
      if (currentX + w > sheetWidth - margin) {
        currentX = margin;
        currentY += rowMaxHeight + spacing;
        rowMaxHeight = 0;
      }

      // Check if we need a new sheet
      if (currentY + h > sheetHeight - margin) {
        currentSheetIndex++;
        currentX = margin;
        currentY = margin;
        rowMaxHeight = 0;
      }

      packedPlacements.push({
        pieceId: piece.pieceId,
        sheetIndex: currentSheetIndex,
        x: Number(currentX.toFixed(1)),
        y: Number(currentY.toFixed(1)),
        rotationDeg: rot,
        width: Number(w.toFixed(1)),
        height: Number(h.toFixed(1)),
        locked: false,
      });

      currentX += w + spacing;
      if (h > rowMaxHeight) {
        rowMaxHeight = h;
      }
    }

    const sheetsRequired = currentSheetIndex + 1;
    const totalStockAreaMm2 = sheetsRequired * (sheetWidth * sheetHeight);
    const materialUtilizationPercent = Number(
      Math.min(100.0, (totalPieceAreaMm2 / totalStockAreaMm2) * 100.0).toFixed(1)
    );
    const wasteAreaMm2 = Math.max(0, totalStockAreaMm2 - totalPieceAreaMm2);

    const fitsOnConfiguredSheet = sheetsRequired === 1 && warnings.length === 0;

    const suggestedAlternatives: string[] = [];
    if (!fitsOnConfiguredSheet) {
      if (sheetsRequired > 1) {
        warnings.push(
          `Design requires ${sheetsRequired} separate sheets of configured size (${sheetWidth}×${sheetHeight} mm).`
        );
      }
      suggestedAlternatives.push("Reduce piece count from " + totalPieces + " to " + Math.max(4, Math.floor(totalPieces * 0.7)) + " pieces.");
      suggestedAlternatives.push("Reduce overall puzzle boundary to fit within single " + sheetWidth + "×" + sheetHeight + " mm sheet.");
      suggestedAlternatives.push("Use multi-sheet manufacturing mode (" + sheetsRequired + " sheets required).");
    }

    return {
      sheetWidthMm: sheetWidth,
      sheetHeightMm: sheetHeight,
      materialThicknessMm: thickness,
      fitsOnConfiguredSheet,
      totalPieces,
      piecesPacked: packedPlacements.length,
      sheetsRequired,
      materialUtilizationPercent,
      wasteAreaMm2: Number(wasteAreaMm2.toFixed(1)),
      totalCutLengthMm: Number(totalCutLengthMm.toFixed(1)),
      minimumEdgeDistanceMm: margin,
      manufacturingClearanceMm: spacing,
      warnings,
      suggestedAlternatives: suggestedAlternatives.length > 0 ? suggestedAlternatives : undefined,
      packedPlacements,
    };
  }
}
