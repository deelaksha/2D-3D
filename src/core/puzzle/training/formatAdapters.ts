/**
 * Extensible Multi-Format Adapter Registry.
 *
 * Enables plugging in CAD & graphic file formats (PNG, SVG, DXF, STEP, STL, JSON)
 * without altering or mutating the authoritative canonical internal representation.
 */
import type { FormatAdapter, FormatKind } from "./types";
import { createEmptyCanonicalPuzzle } from "../canonical/defaults";

export class FormatAdapterRegistry {
  private adapters: Map<FormatKind, FormatAdapter> = new Map();

  constructor() {
    this.registerDefaultMockAdapters();
  }

  registerAdapter(adapter: FormatAdapter): void {
    this.adapters.set(adapter.formatKind, adapter);
  }

  getAdapter(kind: FormatKind): FormatAdapter | undefined {
    return this.adapters.get(kind);
  }

  hasAdapter(kind: FormatKind): boolean {
    return this.adapters.has(kind);
  }

  /**
   * Registers default mock format adapters for PNG, SVG, DXF, STEP, STL, and JSON.
   */
  private registerDefaultMockAdapters(): void {
    this.registerAdapter({
      formatKind: "JSON",
      description: "Canonical JSON serialization adapter",
      importToCanonical: async (jsonString: string) => JSON.parse(jsonString),
      exportFromCanonical: async (puzzle: any) => JSON.stringify(puzzle, null, 2),
    });

    this.registerAdapter({
      formatKind: "SVG",
      description: "2D SVG Vector Contour graphics adapter",
      importToCanonical: async (svgXml: string) => {
        const puzzle = createEmptyCanonicalPuzzle("SVG Imported Puzzle");
        return puzzle;
      },
      exportFromCanonical: async (puzzle: any) => {
        return `<svg width="100%" height="100%"><!-- SVG Export Placeholder --></svg>`;
      },
    });

    this.registerAdapter({
      formatKind: "DXF",
      description: "2D DXF CAD Polyline & Arc layer adapter",
      importToCanonical: async (dxfContent: string) => {
        return createEmptyCanonicalPuzzle("DXF Imported Puzzle");
      },
      exportFromCanonical: async (puzzle: any) => {
        return "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF";
      },
    });

    this.registerAdapter({
      formatKind: "STEP",
      description: "3D STEP B-Rep solid CAD model adapter",
      importToCanonical: async (stepData: string) => {
        return createEmptyCanonicalPuzzle("STEP Imported Puzzle");
      },
      exportFromCanonical: async (puzzle: any) => {
        return "ISO-10303-21; /* STEP Solid Export Placeholder */;";
      },
    });

    this.registerAdapter({
      formatKind: "STL",
      description: "3D STL Triangulated surface mesh export adapter",
      importToCanonical: async (stlData: string) => {
        return createEmptyCanonicalPuzzle("STL Imported Puzzle");
      },
      exportFromCanonical: async (puzzle: any) => {
        return "solid puzzle_export\nendsolid puzzle_export";
      },
    });

    this.registerAdapter({
      formatKind: "PNG",
      description: "2D PNG Raster Sketch & Drawing image adapter",
      importToCanonical: async (pngBase64: string) => {
        return createEmptyCanonicalPuzzle("PNG Sketch Imported Puzzle");
      },
      exportFromCanonical: async (puzzle: any) => {
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      },
    });
  }
}
