/**
 * Automatic Connector Placement Engine Smoke Tests (Phase 84).
 *
 * Tests:
 *  1. Single connector placement (centered, corner margins safe)
 *  2. Multiple connector placement (long edge >= 80 mm)
 *  3. Asymmetric connector placement (breaks rotational symmetry)
 *  4. Corner proximity enforcement (no tab closer than m_corner)
 *  5. Rejection handling when edge is too short
 *  6. Slot intersection and collision detection
 *  7. Placement report completeness and quality metrics
 *  8. Deterministic repeatability (No ML)
 */

import { describe, expect, it } from "vitest";
import { ConnectorPlacementEngine } from "../core/puzzle/connectorplacement/connectorPlacementEngine";
import { SlotIntersectionDetector } from "../core/puzzle/connectorplacement/slotIntersectionDetector";
import type {
  ConnectorPlacementRequest,
  InterfaceEdgeInput,
  PlacementPieceInput,
} from "../core/puzzle/connectorplacement/types";

function createMockPieces(): PlacementPieceInput[] {
  return [
    {
      id: "piece_A",
      name: "Piece A",
      thicknessMm: 3.0,
      materialId: "cardboard_3mm",
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    },
    {
      id: "piece_B",
      name: "Piece B",
      thicknessMm: 3.0,
      materialId: "cardboard_3mm",
      vertices: [
        { x: 100, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 100 },
        { x: 100, y: 100 },
      ],
    },
  ];
}

describe("Automatic Connector Placement Engine (Phase 84)", () => {
  it("places a single centered connector on a medium edge with safe corner margins", () => {
    const pieces = createMockPieces();
    const edge: InterfaceEdgeInput = {
      id: "edge_A_B",
      pieceAId: "piece_A",
      pieceBId: "piece_B",
      start: { x: 100, y: 0 },
      end: { x: 100, y: 50 },
      lengthMm: 50.0,
      normal: { x: 1, y: 0 },
      tangent: { x: 0, y: 1 },
      preferredPlacementMode: "single",
    };

    const res = ConnectorPlacementEngine.optimizePlacements({
      pieces,
      edges: [edge],
    });

    expect(res.success).toBe(true);
    expect(res.allPlacedConnectors.length).toBe(1);

    const conn = res.allPlacedConnectors[0];
    // Centered at t = 0.5
    expect(conn.parametricOffsetT).toBeCloseTo(0.5, 2);
    expect(conn.worldPosition.x).toBe(100);
    expect(conn.worldPosition.y).toBe(25);

    // Corner margins must be safe (>= 5.0 mm)
    expect(conn.cornerMarginStartMm).toBeGreaterThanOrEqual(5.0);
    expect(conn.cornerMarginEndMm).toBeGreaterThanOrEqual(5.0);

    // Report metrics
    expect(res.report.singleConnectorEdgesCount).toBe(1);
    expect(res.report.qualityMetrics.structuralBalanceScore).toBe(1.0);
  });

  it("places multiple connectors on a long edge with sufficient inter-connector spacing", () => {
    const pieces = createMockPieces();
    const edge: InterfaceEdgeInput = {
      id: "edge_long",
      pieceAId: "piece_A",
      pieceBId: "piece_B",
      start: { x: 100, y: 0 },
      end: { x: 100, y: 100 },
      lengthMm: 100.0,
      normal: { x: 1, y: 0 },
      tangent: { x: 0, y: 1 },
      preferredPlacementMode: "multiple",
    };

    const res = ConnectorPlacementEngine.optimizePlacements({
      pieces,
      edges: [edge],
    });

    expect(res.success).toBe(true);
    expect(res.allPlacedConnectors.length).toBe(2);

    const c1 = res.allPlacedConnectors[0];
    const c2 = res.allPlacedConnectors[1];

    expect(c1.parametricOffsetT).toBeLessThan(c2.parametricOffsetT);
    // Gap between connectors
    const gap = Math.abs(c2.worldPosition.y - c1.worldPosition.y) - (c1.widthMm + c2.widthMm) / 2;
    expect(gap).toBeGreaterThanOrEqual(8.0); // Safe inter-connector gap

    // Corner clearances
    expect(c1.cornerMarginStartMm).toBeGreaterThanOrEqual(5.0);
    expect(c2.cornerMarginEndMm).toBeGreaterThanOrEqual(5.0);

    expect(res.report.multiConnectorEdgesCount).toBe(1);
  });

  it("supports asymmetric placement breaking rotational symmetry", () => {
    const pieces = createMockPieces();
    const edge: InterfaceEdgeInput = {
      id: "edge_asym",
      pieceAId: "piece_A",
      pieceBId: "piece_B",
      start: { x: 100, y: 0 },
      end: { x: 100, y: 80 },
      lengthMm: 80.0,
      normal: { x: 1, y: 0 },
      tangent: { x: 0, y: 1 },
      preferredPlacementMode: "asymmetric",
    };

    const res = ConnectorPlacementEngine.optimizePlacements({
      pieces,
      edges: [edge],
      forceAsymmetric: true,
    });

    expect(res.success).toBe(true);
    expect(res.allPlacedConnectors.length).toBe(2);

    const c1 = res.allPlacedConnectors[0];
    const c2 = res.allPlacedConnectors[1];

    // Asymmetric offsets (0.28 and 0.74) do not sum to 1.0 (non-symmetric around midpoint)
    expect(c1.placementMode).toBe("asymmetric");
    expect(c2.placementMode).toBe("asymmetric");
    expect(c1.parametricOffsetT + c2.parametricOffsetT).not.toBeCloseTo(1.0, 2);
    expect(res.report.asymmetricEdgesCount).toBe(1);
  });

  it("rejects placement when edge is too short to host a connector safely", () => {
    const pieces = createMockPieces();
    const shortEdge: InterfaceEdgeInput = {
      id: "edge_tiny",
      pieceAId: "piece_A",
      pieceBId: "piece_B",
      start: { x: 100, y: 0 },
      end: { x: 100, y: 8 },
      lengthMm: 8.0, // Only 8 mm long
      normal: { x: 1, y: 0 },
      tangent: { x: 0, y: 1 },
    };

    const res = ConnectorPlacementEngine.optimizePlacements({
      pieces,
      edges: [shortEdge],
    });

    expect(res.allPlacedConnectors.length).toBe(0);
    expect(res.report.rejections.length).toBe(1);
    expect(res.report.rejections[0].reasonCode).toBe("REJECTED_EDGE_TOO_SHORT");
  });

  it("detects and prevents slot intersection collisions on adjacent edges of the same piece", () => {
    const conn1 = {
      connectorId: "conn_1",
      edgeId: "e1",
      pieceAId: "p1",
      pieceBId: "p2",
      parametricOffsetT: 0.5,
      worldPosition: { x: 10, y: 10 },
      normal: { x: 1, y: 0 },
      tangent: { x: 0, y: 1 },
      widthMm: 12,
      depthMm: 8,
      clearanceMm: 0.15,
      cornerMarginStartMm: 5,
      cornerMarginEndMm: 5,
      placementMode: "single" as const,
    };

    // Close perpendicular connector on same piece whose cutouts collide
    const conn2 = {
      connectorId: "conn_2",
      edgeId: "e2",
      pieceAId: "p1",
      pieceBId: "p3",
      parametricOffsetT: 0.5,
      worldPosition: { x: 12, y: 12 },
      normal: { x: 0, y: 1 },
      tangent: { x: 1, y: 0 },
      widthMm: 12,
      depthMm: 8,
      clearanceMm: 0.15,
      cornerMarginStartMm: 5,
      cornerMarginEndMm: 5,
      placementMode: "single" as const,
    };

    const collision = SlotIntersectionDetector.checkCollision(conn1, conn2, 4.0);
    expect(collision.hasIntersection).toBe(true);
    expect(collision.message).toContain("Internal cutouts on adjacent edges are too close");
  });

  it("is strictly deterministic when evaluating identical requests", () => {
    const pieces = createMockPieces();
    const edge: InterfaceEdgeInput = {
      id: "edge_det",
      pieceAId: "piece_A",
      pieceBId: "piece_B",
      start: { x: 100, y: 0 },
      end: { x: 100, y: 60 },
      lengthMm: 60.0,
      normal: { x: 1, y: 0 },
      tangent: { x: 0, y: 1 },
    };

    const req: ConnectorPlacementRequest = { pieces, edges: [edge] };
    const run1 = ConnectorPlacementEngine.optimizePlacements(req);
    const run2 = ConnectorPlacementEngine.optimizePlacements(req);

    expect(run1.allPlacedConnectors.length).toBe(run2.allPlacedConnectors.length);
    const c1 = run1.allPlacedConnectors[0];
    const c2 = run2.allPlacedConnectors[0];

    expect(c1.parametricOffsetT).toBe(c2.parametricOffsetT);
    expect(c1.worldPosition.x).toBe(c2.worldPosition.x);
    expect(c1.worldPosition.y).toBe(c2.worldPosition.y);
    expect(c1.widthMm).toBe(c2.widthMm);
  });

  it("places 3 connectors on very long edges in expert difficulty mode", () => {
    const pieces = createMockPieces();
    const longEdge: InterfaceEdgeInput = {
      id: "edge_extra_long",
      pieceAId: "piece_A",
      pieceBId: "piece_B",
      start: { x: 100, y: 0 },
      end: { x: 100, y: 150 },
      lengthMm: 150.0,
      normal: { x: 1, y: 0 },
      tangent: { x: 0, y: 1 },
      preferredPlacementMode: "auto",
    };

    const res = ConnectorPlacementEngine.optimizePlacements({
      pieces,
      edges: [longEdge],
      difficulty: "expert",
    });

    expect(res.success).toBe(true);
    expect(res.allPlacedConnectors.length).toBe(3);

    const [c1, c2, c3] = res.allPlacedConnectors;
    expect(c1.parametricOffsetT).toBeCloseTo(0.25, 2);
    expect(c2.parametricOffsetT).toBeCloseTo(0.50, 2);
    expect(c3.parametricOffsetT).toBeCloseTo(0.75, 2);

    expect(res.report.multiConnectorEdgesCount).toBe(1);
    expect(res.report.qualityMetrics.overallQualityScore).toBeGreaterThan(0.8);
  });

  it("produces a comprehensive placement report with all metrics and scores", () => {
    const pieces = createMockPieces();
    const edges: InterfaceEdgeInput[] = [
      {
        id: "e1",
        pieceAId: "piece_A",
        pieceBId: "piece_B",
        start: { x: 100, y: 0 },
        end: { x: 100, y: 40 },
        lengthMm: 40.0,
        normal: { x: 1, y: 0 },
        tangent: { x: 0, y: 1 },
      },
      {
        id: "e2",
        pieceAId: "piece_A",
        pieceBId: "piece_B",
        start: { x: 100, y: 40 },
        end: { x: 100, y: 140 },
        lengthMm: 100.0,
        normal: { x: 1, y: 0 },
        tangent: { x: 0, y: 1 },
        preferredPlacementMode: "asymmetric",
      },
    ];

    const res = ConnectorPlacementEngine.optimizePlacements({ pieces, edges });
    expect(res.success).toBe(true);

    const report = res.report;
    expect(report.totalEdgesEvaluated).toBe(2);
    expect(report.totalConnectorsPlaced).toBe(3); // 1 on e1, 2 on e2
    expect(report.singleConnectorEdgesCount).toBe(1);
    expect(report.asymmetricEdgesCount).toBe(1);
    expect(report.qualityMetrics.structuralBalanceScore).toBeGreaterThan(0);
    expect(report.qualityMetrics.manufacturabilityScore).toBeGreaterThan(0);
    expect(report.qualityMetrics.assemblyAccessibilityScore).toBeGreaterThan(0);
    expect(report.qualityMetrics.overallQualityScore).toBeGreaterThan(0);
  });
});
