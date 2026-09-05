/**
 * 2D DXF Exporter (Phase 99).
 *
 * Generates industry-standard AutoCAD ASCII DXF (Release 12/2000 compatible) files:
 *  - Supports layer separation: "CUT" (laser cutting contour) and "ENGRAVE" (piece ID labels).
 *  - Millimeter units ($INSUNITS = 4).
 *  - Standalone individual piece DXFs and combined nested cut sheet DXFs.
 */

import type { Vec2 } from "@/core/model/types";
import type { GeneratedPiece2D } from "../automatic2d/types";
import type { Export2DOptions } from "./types";

export class DxfExporter {
  /**
   * Exports an individual 2D piece to AutoCAD ASCII DXF format.
   */
  public static exportPieceDXF(piece: GeneratedPiece2D, options: Export2DOptions = {}): string {
    const pieceId = piece.pieceId || piece.id;
    const boundary = piece.exactBoundary || [];
    const centroid = piece.centroid || this.calculateCentroid(boundary);

    const entities: string[] = [];

    // 1. Add CUT Layer Polyline
    if (boundary.length >= 3) {
      entities.push(this.createPolylineEntity("CUT", boundary));
    }

    // 2. Add ENGRAVE Layer Piece ID Text
    entities.push(
      this.createTextEntity("ENGRAVE", pieceId, centroid.x, centroid.y, 4.0)
    );

    return this.wrapDxfEntities(entities);
  }

  /**
   * Exports a multi-piece nested layout to a combined AutoCAD ASCII DXF sheet.
   */
  public static exportCombinedLayoutDXF(
    pieces: GeneratedPiece2D[],
    placements: Record<string, { x: number; y: number; widthMm: number; heightMm: number }>,
    sheetDimensions: { widthMm: number; heightMm: number },
    options: Export2DOptions = {}
  ): string {
    const entities: string[] = [];

    // Sheet boundary rectangle on BORDER layer
    const sheetBoundary: Vec2[] = [
      { x: 0, y: 0 },
      { x: sheetDimensions.widthMm, y: 0 },
      { x: sheetDimensions.widthMm, y: sheetDimensions.heightMm },
      { x: 0, y: sheetDimensions.heightMm },
    ];
    entities.push(this.createPolylineEntity("BORDER", sheetBoundary));

    // Place each piece with offset
    for (const piece of pieces) {
      const pId = piece.pieceId || piece.id;
      const placement = placements[pId];
      if (!placement) continue;

      const bounds = piece.dimensions?.bounds || this.calculateBounds(piece.exactBoundary);
      const offsetX = placement.x - bounds.minX;
      const offsetY = placement.y - bounds.minY;

      const shiftedBoundary: Vec2[] = piece.exactBoundary.map((v) => ({
        x: v.x + offsetX,
        y: v.y + offsetY,
      }));

      // Piece cut path
      entities.push(this.createPolylineEntity("CUT", shiftedBoundary));

      // Piece engraved label at centroid
      const centroidX = (piece.centroid?.x ?? (bounds.minX + placement.widthMm / 2)) + offsetX;
      const centroidY = (piece.centroid?.y ?? (bounds.minY + placement.heightMm / 2)) + offsetY;
      entities.push(this.createTextEntity("ENGRAVE", pId, centroidX, centroidY, 3.5));
    }

    return this.wrapDxfEntities(entities);
  }

  /**
   * Creates a closed DXF POLYLINE entity with VERTEX list and SEQEND.
   */
  private static createPolylineEntity(layer: string, points: Vec2[]): string {
    const lines: string[] = [
      "  0",
      "POLYLINE",
      "  8",
      layer,
      " 66",
      "1",
      " 70",
      "1", // 1 = Closed polyline in DXF standard
      " 10",
      "0.0",
      " 20",
      "0.0",
      " 30",
      "0.0",
    ];

    for (const p of points) {
      lines.push(
        "  0",
        "VERTEX",
        "  8",
        layer,
        " 10",
        p.x.toFixed(4),
        " 20",
        p.y.toFixed(4),
        " 30",
        "0.0"
      );
    }

    lines.push("  0", "SEQEND");
    return lines.join("\n");
  }

  /**
   * Creates a DXF TEXT entity.
   */
  private static createTextEntity(
    layer: string,
    text: string,
    x: number,
    y: number,
    height: number
  ): string {
    return [
      "  0",
      "TEXT",
      "  8",
      layer,
      " 10",
      x.toFixed(4),
      " 20",
      y.toFixed(4),
      " 30",
      "0.0",
      " 40",
      height.toFixed(2),
      "  1",
      text,
      " 72",
      "1", // Center aligned
      " 11",
      x.toFixed(4),
      " 21",
      y.toFixed(4),
      " 31",
      "0.0",
    ].join("\n");
  }

  /**
   * Wraps entities within minimal, compliant standard DXF file skeleton.
   */
  private static wrapDxfEntities(entities: string[]): string {
    return [
      "  0",
      "SECTION",
      "  2",
      "HEADER",
      "  9",
      "$ACADVER",
      "  1",
      "AC1009", // AutoCAD R12 standard
      "  9",
      "$INSUNITS",
      " 70",
      "4", // 4 = Millimeters
      "  0",
      "ENDSEC",
      "  0",
      "SECTION",
      "  2",
      "TABLES",
      "  0",
      "TABLE",
      "  2",
      "LAYER",
      " 70",
      "4",
      // Layer 0
      "  0",
      "LAYER",
      "  2",
      "0",
      " 70",
      "0",
      " 62",
      "7",
      "  6",
      "CONTINUOUS",
      // Layer CUT (Red = 1)
      "  0",
      "LAYER",
      "  2",
      "CUT",
      " 70",
      "0",
      " 62",
      "1",
      "  6",
      "CONTINUOUS",
      // Layer ENGRAVE (Blue = 5)
      "  0",
      "LAYER",
      "  2",
      "ENGRAVE",
      " 70",
      "0",
      " 62",
      "5",
      "  6",
      "CONTINUOUS",
      // Layer BORDER (Cyan = 4)
      "  0",
      "LAYER",
      "  2",
      "BORDER",
      " 70",
      "0",
      " 62",
      "4",
      "  6",
      "CONTINUOUS",
      "  0",
      "ENDTAB",
      "  0",
      "ENDSEC",
      "  0",
      "SECTION",
      "  2",
      "BLOCKS",
      "  0",
      "ENDSEC",
      "  0",
      "SECTION",
      "  2",
      "ENTITIES",
      entities.join("\n"),
      "  0",
      "ENDSEC",
      "  0",
      "EOF",
      "",
    ].join("\n");
  }

  private static calculateCentroid(points: Vec2[]): Vec2 {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    let sx = 0;
    let sy = 0;
    for (const p of points) {
      sx += p.x;
      sy += p.y;
    }
    return { x: sx / points.length, y: sy / points.length };
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
