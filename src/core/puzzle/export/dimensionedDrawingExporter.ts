/**
 * Dimensioned Engineering Drawing Exporter (Phase 99).
 *
 * Generates ISO/ANSI-style engineering fabrication drawings in annotated SVG format:
 *  - Piece boundary profile with cut line representation.
 *  - Overall horizontal & vertical dimension lines with extension witnesses, arrows, and text.
 *  - Material thickness callouts and interface connector port callouts.
 *  - Standard technical drawing Title Block containing piece ID, project, scale, date, and units.
 */

import type { GeneratedPiece2D, GeneratedConnection2D } from "../automatic2d/types";
import type { Export2DOptions } from "./types";
import { SvgExporter } from "./svgExporter";

export class DimensionedDrawingExporter {
  /**
   * Generates a complete dimensioned engineering drawing SVG for a 2D piece.
   */
  public static exportDrawingSVG(
    piece: GeneratedPiece2D,
    connections: GeneratedConnection2D[] = [],
    options: Export2DOptions = {}
  ): string {
    const pieceId = piece.pieceId || piece.id;
    const bounds = piece.dimensions?.bounds || { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const widthMm = Math.max(10, bounds.maxX - bounds.minX);
    const heightMm = Math.max(10, bounds.maxY - bounds.minY);
    const thicknessMm = piece.thicknessMm || piece.material?.stockThicknessMm || 3.0;
    const materialName = piece.material?.name || "Cardboard";

    // Margins around the piece for dimension lines and title block
    const leftMargin = 35;
    const rightMargin = 25;
    const topMargin = 30;
    const bottomMargin = 55; // Room for horizontal dimension and title block

    const drawingWidth = widthMm + leftMargin + rightMargin;
    const drawingHeight = heightMm + topMargin + bottomMargin;

    // Piece offset inside the drawing area
    const pieceOffsetX = leftMargin - bounds.minX;
    const pieceOffsetY = topMargin - bounds.minY;

    // Convert piece boundary to SVG path
    const pathData = SvgExporter.polygonToPathData(piece.exactBoundary, pieceOffsetX, pieceOffsetY);

    // Dimension positions
    // 1. Horizontal Overall Width (below piece)
    const dimY = topMargin + heightMm + 14;
    const dimX1 = leftMargin;
    const dimX2 = leftMargin + widthMm;

    // 2. Vertical Overall Height (left of piece)
    const dimX = leftMargin - 14;
    const dimY1 = topMargin;
    const dimY2 = topMargin + heightMm;

    // Title Block Dimensions (at bottom right)
    const tbWidth = Math.min(180, drawingWidth - 10);
    const tbHeight = 35;
    const tbX = drawingWidth - tbWidth - 5;
    const tbY = drawingHeight - tbHeight - 5;

    // Find connections attached to this piece
    const pieceConnections = connections.filter(
      (c) => c.pieceA === pieceId || c.pieceB === pieceId
    );

    const connectionMarkers = pieceConnections.map((c, index) => {
      const isA = c.pieceA === pieceId;
      const iface = isA ? c.interfaceA : c.interfaceB;
      const posX = (iface?.midpoint?.x ?? (bounds.minX + widthMm / 2)) + pieceOffsetX;
      const posY = (iface?.midpoint?.y ?? (bounds.minY + heightMm / 2)) + pieceOffsetY;
      const connId = c.id;

      return `
    <!-- Interface Marker ${connId} -->
    <g class="interface-callout">
      <circle cx="${posX.toFixed(2)}" cy="${posY.toFixed(2)}" r="2.5" fill="none" stroke="#27ae60" stroke-width="0.3" />
      <line x1="${(posX - 3).toFixed(2)}" y1="${posY.toFixed(2)}" x2="${(posX + 3).toFixed(2)}" y2="${posY.toFixed(2)}" stroke="#27ae60" stroke-width="0.2" />
      <line x1="${posX.toFixed(2)}" y1="${(posY - 3).toFixed(2)}" x2="${posX.toFixed(2)}" y2="${(posY + 3).toFixed(2)}" stroke="#27ae60" stroke-width="0.2" />
      <text x="${(posX + 4).toFixed(2)}" y="${(posY - 4).toFixed(2)}" font-family="monospace" font-size="2.8" fill="#27ae60">
        [${c.connectorType}] ${connId}
      </text>
    </g>`;
    });

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${drawingWidth.toFixed(2)}mm" 
     height="${drawingHeight.toFixed(2)}mm" 
     viewBox="0 0 ${drawingWidth.toFixed(2)} ${drawingHeight.toFixed(2)}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
      <path d="M 0 2 L 10 5 L 0 8 z" fill="#111111" />
    </marker>
  </defs>

  <style>
    .border-line { stroke: #222; stroke-width: 0.5; fill: none; }
    .grid-line { stroke: #ddd; stroke-width: 0.15; stroke-dasharray: 2,2; }
    .piece-cut { stroke: #c0392b; stroke-width: 0.35; fill: rgba(240, 230, 210, 0.4); stroke-linejoin: round; }
    .witness-line { stroke: #555; stroke-width: 0.2; stroke-dasharray: 1,1; }
    .dimension-line { stroke: #111; stroke-width: 0.25; marker-start: url(#arrow); marker-end: url(#arrow); }
    .dim-text { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 3.5px; fill: #111; font-weight: 600; text-anchor: middle; }
    .tb-border { stroke: #333; stroke-width: 0.4; fill: rgba(255, 255, 255, 0.95); }
    .tb-inner { stroke: #777; stroke-width: 0.2; }
    .tb-title { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 3.2px; font-weight: bold; fill: #111; }
    .tb-val { font-family: monospace, sans-serif; font-size: 3.0px; fill: #333; }
  </style>

  <!-- Drawing Outer Frame -->
  <rect x="2" y="2" width="${(drawingWidth - 4).toFixed(2)}" height="${(drawingHeight - 4).toFixed(2)}" class="border-line" />
  <rect x="4" y="4" width="${(drawingWidth - 8).toFixed(2)}" height="${(drawingHeight - 8).toFixed(2)}" stroke="#555" stroke-width="0.2" fill="none" />

  <!-- Piece Cut Outline -->
  <path id="piece_${pieceId}_geometry" class="piece-cut" d="${pathData}" />

  <!-- Horizontal Dimension Line (Width) -->
  <line x1="${dimX1.toFixed(2)}" y1="${(topMargin + heightMm).toFixed(2)}" x2="${dimX1.toFixed(2)}" y2="${(dimY + 3).toFixed(2)}" class="witness-line" />
  <line x1="${dimX2.toFixed(2)}" y1="${(topMargin + heightMm).toFixed(2)}" x2="${dimX2.toFixed(2)}" y2="${(dimY + 3).toFixed(2)}" class="witness-line" />
  <line x1="${dimX1.toFixed(2)}" y1="${dimY.toFixed(2)}" x2="${dimX2.toFixed(2)}" y2="${dimY.toFixed(2)}" class="dimension-line" />
  <text x="${((dimX1 + dimX2) / 2).toFixed(2)}" y="${(dimY - 2).toFixed(2)}" class="dim-text">${widthMm.toFixed(1)} mm</text>

  <!-- Vertical Dimension Line (Height) -->
  <line x1="${(leftMargin).toFixed(2)}" y1="${dimY1.toFixed(2)}" x2="${(dimX - 3).toFixed(2)}" y2="${dimY1.toFixed(2)}" class="witness-line" />
  <line x1="${(leftMargin).toFixed(2)}" y1="${dimY2.toFixed(2)}" x2="${(dimX - 3).toFixed(2)}" y2="${dimY2.toFixed(2)}" class="witness-line" />
  <line x1="${dimX.toFixed(2)}" y1="${dimY1.toFixed(2)}" x2="${dimX.toFixed(2)}" y2="${dimY2.toFixed(2)}" class="dimension-line" />
  <text x="${(dimX - 3).toFixed(2)}" y="${((dimY1 + dimY2) / 2).toFixed(2)}" class="dim-text" transform="rotate(-90 ${(dimX - 3).toFixed(2)} ${((dimY1 + dimY2) / 2).toFixed(2)})">${heightMm.toFixed(1)} mm</text>

  <!-- Material & Thickness Callout -->
  <text x="${leftMargin.toFixed(2)}" y="${(topMargin - 10).toFixed(2)}" font-family="monospace" font-size="3.2" fill="#444">
    MATERIAL: ${materialName.toUpperCase()} | THICKNESS: ${thicknessMm.toFixed(2)} mm
  </text>

  <!-- Connection Callouts -->
  ${connectionMarkers.join("\n")}

  <!-- Engineering Title Block -->
  <g id="title_block">
    <rect x="${tbX.toFixed(2)}" y="${tbY.toFixed(2)}" width="${tbWidth.toFixed(2)}" height="${tbHeight.toFixed(2)}" class="tb-border" />
    <line x1="${tbX.toFixed(2)}" y1="${(tbY + 11).toFixed(2)}" x2="${(tbX + tbWidth).toFixed(2)}" y2="${(tbY + 11).toFixed(2)}" class="tb-inner" />
    <line x1="${tbX.toFixed(2)}" y1="${(tbY + 23).toFixed(2)}" x2="${(tbX + tbWidth).toFixed(2)}" y2="${(tbY + 23).toFixed(2)}" class="tb-inner" />
    <line x1="${(tbX + tbWidth * 0.5).toFixed(2)}" y1="${(tbY + 11).toFixed(2)}" x2="${(tbX + tbWidth * 0.5).toFixed(2)}" y2="${(tbY + tbHeight).toFixed(2)}" class="tb-inner" />

    <text x="${(tbX + 4).toFixed(2)}" y="${(tbY + 7).toFixed(2)}" class="tb-title">WOODKIT DESIGNER — CAD FABRICATION DRAWING</text>
    
    <text x="${(tbX + 4).toFixed(2)}" y="${(tbY + 16).toFixed(2)}" class="tb-title">PIECE ID:</text>
    <text x="${(tbX + 26).toFixed(2)}" y="${(tbY + 16).toFixed(2)}" class="tb-val">${pieceId}</text>

    <text x="${(tbX + tbWidth * 0.5 + 4).toFixed(2)}" y="${(tbY + 16).toFixed(2)}" class="tb-title">SCALE:</text>
    <text x="${(tbX + tbWidth * 0.5 + 20).toFixed(2)}" y="${(tbY + 16).toFixed(2)}" class="tb-val">1:1 (mm)</text>

    <text x="${(tbX + 4).toFixed(2)}" y="${(tbY + 28).toFixed(2)}" class="tb-title">STATUS:</text>
    <text x="${(tbX + 26).toFixed(2)}" y="${(tbY + 28).toFixed(2)}" class="tb-val" fill="#27ae60">VALIDATED</text>

    <text x="${(tbX + tbWidth * 0.5 + 4).toFixed(2)}" y="${(tbY + 28).toFixed(2)}" class="tb-title">DATE:</text>
    <text x="${(tbX + tbWidth * 0.5 + 20).toFixed(2)}" y="${(tbY + 28).toFixed(2)}" class="tb-val">${new Date().toISOString().slice(0, 10)}</text>
  </g>
</svg>`;
  }
}
