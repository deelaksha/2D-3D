import { describe, expect, it } from "vitest";
import { RealDataIngestionPipeline } from "../core/puzzle/ingestion/pipeline/realDataIngestionPipeline";

describe("Real-Data Ingestion Pipeline Integration (Synthetic End-to-End)", () => {
  const syntheticHouseSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" units="mm">
      <!-- Wall A with male tab (insert) -->
      <path d="M 0 0 L 30 0 L 30 -10 L 50 -10 L 50 0 L 100 0 L 100 80 L 0 80 Z" />
      <!-- Wall B with matching female slot receiver -->
      <path d="M 150 0 L 250 0 L 250 80 L 150 80 Z" />
      <rect x="180" y="30" width="20" height="3" />
    </svg>
  `;

  it("executes full 8-stage real-data ingestion pipeline end-to-end without AI/ML", () => {
    const result = RealDataIngestionPipeline.processDrawing({
      filename: "synthetic_house.svg",
      content: syntheticHouseSvg,
    });

    // 1. Overall Pipeline Status
    expect(result.success).toBe(true);
    expect(result.totalDurationMs).toBeGreaterThan(0);

    // 2. Canonical Puzzle Metadata
    expect(result.puzzle).toBeDefined();
    expect(result.puzzle.metadata.id).toContain("synthetic_house");

    // 3. Stock Material
    expect(result.material).toBeDefined();
    expect(result.material.thicknessMm).toBe(3.0);

    // 4. Segmented Pieces
    expect(result.pieces.length).toBeGreaterThan(0);
    expect(result.pieces[0].id).toBeDefined();

    // 5. Extracted Geometry
    expect(result.geometry.primitives.length).toBeGreaterThan(0);
    expect(result.geometry.isValid).toBe(true);

    // 6. Detected Interfaces
    expect(result.interfaces.length).toBeGreaterThan(0);
    expect(result.interfaces.some((iface) => iface.featureKind === "tab" || iface.featureKind === "slot")).toBe(true);

    // 7. Inferred Connections
    expect(result.connections.length).toBeGreaterThan(0);

    // 8. Extracted Parametric Features
    expect(result.parameters.length).toBeGreaterThan(0);
    expect(result.parameters.some((p) => p.name === "width")).toBe(true);

    // 9. Pipeline Diagnostics & Traceability
    expect(result.diagnostics.traces.length).toBeGreaterThanOrEqual(8);
    expect(result.diagnostics.hasErrors()).toBe(false);
  });
});
