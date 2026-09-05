/**
 * 2D SVG Exporter (Phase 99).
 *
 * Generates standards-compliant vector SVG files:
 *  1. Individual Piece SVGs: Exact boundary contours, laser cut paths, and engraved piece IDs.
 *  2. Combined Layout SVG: Multi-piece arranged cut sheet with nesting margins, layer separation,
 *     and individual piece identifiers preserved in vector tags and engraving text.
 */

import type { Vec2 } from "@/core/model/types";
import type { GeneratedPiece2D } from "../automatic2d/types";
import type { Export2DOptions, CombinedLayoutResult } from "./types";

export class SvgExporter {
  public static readonly DEFAULT_CUT_COLOR = "#ff0000";
  public static readonly DEFAULT_ENGRAVE_COLOR = "#0000ff";
  public static readonly DEFAULT_STROKE_WIDTH_MM = 0.1;
  public static readonly DEFAULT_MARGIN_MM = 10;
  public static readonly DEFAULT_PIECE_SPACING_MM = 8;

  /**
   * Exports an individual 2D puzzle piece as a standalone SVG file.
   */
  public static exportPieceSVG(piece: GeneratedPiece2D, options: Export2DOptions = {}): string {
    const cutColor = options.cutColor || this.DEFAULT_CUT_COLOR;
    const engraveColor = options.engraveColor || this.DEFAULT_ENGRAVE_COLOR;
    const strokeWidth = options.strokeWidthMm || this.DEFAULT_STROKE_WIDTH_MM;
    const margin = this.DEFAULT_MARGIN_MM;

    const bounds = piece.dimensions?.bounds || this.calculateBounds(piece.exactBoundary);
    const minX = bounds.minX;
    const minY = bounds.minY;
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    const viewBoxWidth = width + margin * 2;
    const viewBoxHeight = height + margin * 2;

    // Translate points into local SVG viewport with margin
    const pathData = this.polygonToPathData(piece.exactBoundary, -minX + margin, -minY + margin);

    // Centroid relative to viewport
    const centroidX = (piece.centroid?.x ?? (minX + width / 2)) - minX + margin;
    const centroidY = (piece.centroid?.y ?? (minY + height / 2)) - minY + margin;

    const pieceId = piece.pieceId || piece.id;

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${viewBoxWidth.toFixed(2)}mm" 
     height="${viewBoxHeight.toFixed(2)}mm" 
     viewBox="0 0 ${viewBoxWidth.toFixed(2)} ${viewBoxHeight.toFixed(2)}"
     data-piece-id="${pieceId}">
  <title>Piece ${pieceId}</title>
  <desc>Exported from WoodKit Designer Phase 99 - Exact CAD Boundary for Piece ${pieceId}</desc>
  
  <!-- Laser Cut Layer -->
  <g id="cut_layer" stroke="${cutColor}" stroke-width="${strokeWidth}" fill="rgba(235, 225, 205, 0.4)" stroke-linejoin="round" stroke-linecap="round">
    <path id="piece_${pieceId}_boundary" d="${pathData}" />
  </g>
  
  <!-- Laser Engrave / Text Layer -->
  <g id="engrave_layer" fill="${engraveColor}" font-family="monospace, sans-serif" font-size="5" text-anchor="middle" dominant-baseline="central">
    <text id="piece_${pieceId}_label" x="${centroidX.toFixed(2)}" y="${centroidY.toFixed(2)}">${pieceId}</text>
  </g>
</svg>`;
  }

  /**
   * Arranges all puzzle pieces onto a combined cut-sheet layout SVG with nesting margins.
   */
  public static exportCombinedLayoutSVG(
    pieces: GeneratedPiece2D[],
    options: Export2DOptions = {}
  ): { svg: string; sheetDimensions: { widthMm: number; heightMm: number }; piecePlacements: Record<string, { x: number; y: number; widthMm: number; heightMm: number }> } {
    const cutColor = options.cutColor || this.DEFAULT_CUT_COLOR;
    const engraveColor = options.engraveColor || this.DEFAULT_ENGRAVE_COLOR;
    const strokeWidth = options.strokeWidthMm || this.DEFAULT_STROKE_WIDTH_MM;
    const spacing = options.pieceSpacingMm || this.DEFAULT_PIECE_SPACING_MM;
    const sheetMargin = 15;

    // Determine piece placements using a simple shelf bin-packing arrangement
    const placements: Record<string, { x: number; y: number; widthMm: number; heightMm: number }> = {};

    let currentX = sheetMargin;
    let currentY = sheetMargin;
    let shelfHeight = 0;
    let maxLayoutWidth = sheetMargin;
    let maxLayoutHeight = sheetMargin;

    const targetSheetWidth = options.sheetWidthMm || 600;

    for (const piece of pieces) {
      const bounds = piece.dimensions?.bounds || this.calculateBounds(piece.exactBoundary);
      const pieceW = Math.max(10, bounds.maxX - bounds.minX);
      const pieceH = Math.max(10, bounds.maxY - bounds.minY);

      if (currentX + pieceW + sheetMargin > targetSheetWidth && currentX > sheetMargin) {
        // Move to next shelf
        currentX = sheetMargin;
        currentY += shelfHeight + spacing;
        shelfHeight = 0;
      }

      const pId = piece.pieceId || piece.id;
      placements[pId] = {
        x: currentX,
        y: currentY,
        widthMm: pieceW,
        heightMm: pieceH,
      };

      currentX += pieceW + spacing;
      shelfHeight = Math.max(shelfHeight, pieceH);
      maxLayoutWidth = Math.max(maxLayoutWidth, currentX + sheetMargin);
      maxLayoutHeight = Math.max(maxLayoutHeight, currentY + shelfHeight + sheetMargin);
    }

    const totalWidth = options.sheetWidthMm || Math.max(maxLayoutWidth, 200);
    const totalHeight = options.sheetHeightMm || Math.max(maxLayoutHeight, 150);

    // Build SVG elements for all pieces
    const cutPaths: string[] = [];
    const engraveTexts: string[] = [];

    for (const piece of pieces) {
      const pId = piece.pieceId || piece.id;
      const placement = placements[pId];
      if (!placement) continue;

      const bounds = piece.dimensions?.bounds || this.calculateBounds(piece.exactBoundary);
      const offsetX = placement.x - bounds.minX;
      const offsetY = placement.y - bounds.minY;

      const pathData = this.polygonToPathData(piece.exactBoundary, offsetX, offsetY);
      cutPaths.push(`    <path id="piece_${pId}_cut" data-piece-id="${pId}" d="${pathData}" />`);

      const centroidX = (piece.centroid?.x ?? (bounds.minX + placement.widthMm / 2)) + offsetX;
      const centroidY = (piece.centroid?.y ?? (bounds.minY + placement.heightMm / 2)) + offsetY;
      engraveTexts.push(`    <text id="piece_${pId}_text" x="${centroidX.toFixed(2)}" y="${centroidY.toFixed(2)}">${pId}</text>`);
    }

    const svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${totalWidth.toFixed(2)}mm" 
     height="${totalHeight.toFixed(2)}mm" 
     viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight.toFixed(2)}">
  <title>Combined Puzzle Cut Sheet</title>
  <desc>Combined nested sheet containing ${pieces.length} pieces. Preserves all piece IDs.</desc>

  <!-- Sheet Border -->
  <rect id="sheet_border" x="0" y="0" width="${totalWidth.toFixed(2)}" height="${totalHeight.toFixed(2)}" 
        fill="none" stroke="#666666" stroke-width="0.2" stroke-dasharray="2,2" />

  <!-- Laser Cut Layer (All Piece Boundaries) -->
  <g id="cut_layer" stroke="${cutColor}" stroke-width="${strokeWidth}" fill="rgba(240, 230, 210, 0.5)" stroke-linejoin="round">
${cutPaths.join("\n")}
  </g>

  <!-- Laser Engrave Layer (Piece ID Labels) -->
  <g id="engrave_layer" fill="${engraveColor}" font-family="monospace, sans-serif" font-size="4.5" text-anchor="middle" dominant-baseline="central">
${engraveTexts.join("\n")}
  </g>
</svg>`;

    return {
      svg,
      sheetDimensions: {
        widthMm: totalWidth,
        heightMm: totalHeight,
      },
      piecePlacements: placements,
    };
  }

  /**
   * Converts a 2D closed polygon to an SVG path string ('M ... L ... Z').
   */
  public static polygonToPathData(vertices: Vec2[], offsetX = 0, offsetY = 0): string {
    if (!vertices || vertices.length < 3) return "";

    const parts: string[] = [];
    const first = vertices[0];
    parts.push(`M ${(first.x + offsetX).toFixed(3)} ${(first.y + offsetY).toFixed(3)}`);

    for (let i = 1; i < vertices.length; i++) {
      const v = vertices[i];
      parts.push(`L ${(v.x + offsetX).toFixed(3)} ${(v.y + offsetY).toFixed(3)}`);
    }

    parts.push("Z");
    return parts.join(" ");
  }

  private static calculateBounds(vertices: Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } {
    if (!vertices || vertices.length === 0) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const v of vertices) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }

    return { minX, minY, maxX, maxY };
  }
}
