/**
 * Nesting Engine — 2D Rectangular Packing & Auto-Placement for Board Sheets.
 *
 * Takes a list of 2D parts (and their quantities), stock sheet dimensions (e.g. A4 297x210mm),
 * and safety margin, and calculates non-overlapping coordinates (x, y, rotation, sheetIndex)
 * for printable and laser-cut layouts.
 */
import type { Part } from "@/core/model/types";

export interface SheetPreset {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  description: string;
}

export const STANDARD_SHEETS: SheetPreset[] = [
  { id: "a5", name: "A5 Sheet", width: 210, height: 148, description: "210 × 148 mm" },
  { id: "a4", name: "A4 Wooden Sheet", width: 297, height: 210, description: "297 × 210 mm (Standard A4)" },
  { id: "a3", name: "A3 Wooden Sheet", width: 420, height: 297, description: "420 × 297 mm (Double A4)" },
  { id: "a2", name: "A2 Sheet", width: 594, height: 420, description: "594 × 420 mm" },
  { id: "laser-small", name: "Desktop Laser Bed", width: 300, height: 300, description: "300 × 300 mm Square" },
  { id: "laser-large", name: "Large CNC Bed", width: 600, height: 400, description: "600 × 400 mm Industrial Sheet" },
];

export interface PartItemToPack {
  part: Part;
  quantity: number;
}

export interface PackedItem {
  id: string;
  partId: string;
  partName: string;
  instanceIndex: number;
  x: number; // local sheet x (mm)
  y: number; // local sheet y (mm)
  width: number; // effective width on sheet (mm)
  height: number; // effective height on sheet (mm)
  originalWidth: number;
  originalHeight: number;
  rotated: boolean; // rotated 90 degrees
  sheetIndex: number;
}

export interface NestingResult {
  packed: PackedItem[];
  unpacked: { partId: string; partName: string; instanceIndex: number }[];
  totalSheets: number;
  efficiency: number; // percentage of sheet area used (0 to 100%)
}

/**
 * 2D Shelf Packing Algorithm (MaxRects / Shelf First Fit Decreasing Height).
 */
export function packPartsOnSheets(
  items: PartItemToPack[],
  sheetWidth: number,
  sheetHeight: number,
  margin = 8,
  gap = 4,
): NestingResult {
  // Expand parts by quantity into individual items
  const flatItems: { id: string; part: Part; instanceIndex: number; w: number; h: number }[] = [];

  for (const item of items) {
    const qty = Math.max(1, item.quantity);
    for (let q = 0; q < qty; q++) {
      flatItems.push({
        id: `${item.part.id}-${q}`,
        part: item.part,
        instanceIndex: q + 1,
        w: item.part.width,
        h: item.part.height,
      });
    }
  }

  // Sort items by perimeter/area descending for better packing density
  flatItems.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

  const packed: PackedItem[] = [];
  const unpacked: { partId: string; partName: string; instanceIndex: number }[] = [];

  let currentSheetIndex = 0;
  let remainingToPack = [...flatItems];

  const maxSheetsToTry = 10;

  while (remainingToPack.length > 0 && currentSheetIndex < maxSheetsToTry) {
    const unplacedOnThisSheet: typeof remainingToPack = [];

    // Simple Shelf bin packer for the current sheet
    let cursorX = margin;
    let cursorY = margin;
    let shelfHeight = 0;

    for (const item of remainingToPack) {
      let iw = item.w;
      let ih = item.h;
      let rotated = false;

      // Try normal orientation first
      let fitsNormal = cursorX + iw <= sheetWidth - margin && cursorY + ih <= sheetHeight - margin;
      let fitsRotated = cursorX + ih <= sheetWidth - margin && cursorY + iw <= sheetHeight - margin;

      if (!fitsNormal && fitsRotated) {
        // Swap dimensions
        [iw, ih] = [ih, iw];
        rotated = true;
        fitsNormal = true;
      }

      // Check if we need to open a new shelf (row) on this sheet
      if (!fitsNormal && cursorX + iw > sheetWidth - margin) {
        cursorX = margin;
        cursorY += shelfHeight + gap;
        shelfHeight = 0;

        fitsNormal = cursorX + iw <= sheetWidth - margin && cursorY + ih <= sheetHeight - margin;
        fitsRotated = cursorX + ih <= sheetWidth - margin && cursorY + iw <= sheetHeight - margin;

        if (!fitsNormal && fitsRotated) {
          [iw, ih] = [ih, iw];
          rotated = true;
          fitsNormal = true;
        }
      }

      if (fitsNormal && cursorY + ih <= sheetHeight - margin) {
        // Fits on this sheet!
        packed.push({
          id: item.id,
          partId: item.part.id,
          partName: item.part.name,
          instanceIndex: item.instanceIndex,
          x: Math.round(cursorX * 10) / 10,
          y: Math.round(cursorY * 10) / 10,
          width: Math.round(iw * 10) / 10,
          height: Math.round(ih * 10) / 10,
          originalWidth: item.part.width,
          originalHeight: item.part.height,
          rotated,
          sheetIndex: currentSheetIndex,
        });

        cursorX += iw + gap;
        if (ih > shelfHeight) shelfHeight = ih;
      } else {
        // Doesn't fit on current sheet
        unplacedOnThisSheet.push(item);
      }
    }

    if (unplacedOnThisSheet.length === remainingToPack.length) {
      // Made no progress on this sheet (e.g. part is larger than entire sheet)
      for (const un of unplacedOnThisSheet) {
        unpacked.push({
          partId: un.part.id,
          partName: un.part.name,
          instanceIndex: un.instanceIndex,
        });
      }
      break;
    }

    remainingToPack = unplacedOnThisSheet;
    if (remainingToPack.length > 0) {
      currentSheetIndex++;
    }
  }

  const totalSheets = currentSheetIndex + 1;

  // Calculate efficiency
  const totalSheetArea = totalSheets * sheetWidth * sheetHeight;
  const packedArea = packed.reduce((acc, p) => acc + p.width * p.height, 0);
  const efficiency = Math.min(100, Math.round((packedArea / Math.max(1, totalSheetArea)) * 100));

  return {
    packed,
    unpacked,
    totalSheets,
    efficiency,
  };
}
