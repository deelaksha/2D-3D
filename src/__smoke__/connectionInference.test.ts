import { describe, expect, it } from "vitest";
import { ConnectionInferencer2D } from "../core/puzzle/ingestion/connections/connectionInferencer2D";
import { InferenceDiagnostics } from "../core/puzzle/ingestion/connections/diagnostics";
import type { Detected2DInterface } from "../core/puzzle/ingestion/interfaces/types";

describe("Connection Inference Subsystem", () => {
  const mockTab: Detected2DInterface = {
    id: "if_p1_tab1",
    owningPieceId: "p1",
    name: "Tab 1",
    featureKind: "tab",
    canonicalType: "tab",
    local2DFrame: { origin: { x: 50, y: 0 }, normal: { x: 0, y: -1 }, tangent: { x: 1, y: 0 } },
    edgeGeometry: { edgeIndex: 0, parametricStart: 0, parametricEnd: 1, length: 15.0 },
    profile: { kind: "tab_profile", width: 15.0, depth: 3.0, height: 3.0, clearance: 0.1 },
    genderRole: "insert",
    toleranceMm: 0.1,
    clearanceMm: 0.1,
    confidence: 0.95,
    uncertain: false,
  };

  const mockSlot: Detected2DInterface = {
    id: "if_p2_slot1",
    owningPieceId: "p2",
    name: "Slot 1",
    featureKind: "slot",
    canonicalType: "slot",
    local2DFrame: { origin: { x: 50, y: 100 }, normal: { x: 0, y: 1 }, tangent: { x: 1, y: 0 } },
    edgeGeometry: { edgeIndex: 2, parametricStart: 0, parametricEnd: 1, length: 15.0 },
    profile: { kind: "slot_profile", width: 15.0, depth: 3.0, height: 3.0, clearance: 0.1 },
    genderRole: "receiver",
    toleranceMm: 0.1,
    clearanceMm: 0.1,
    confidence: 0.95,
    uncertain: false,
  };

  const mockTab2: Detected2DInterface = {
    ...mockTab,
    id: "if_p2_tab2",
    owningPieceId: "p2",
    name: "Tab 2",
  };

  const mockFlatA: Detected2DInterface = {
    id: "if_p1_flat",
    owningPieceId: "p1",
    name: "Flat A",
    featureKind: "flat_contact",
    canonicalType: "butt",
    local2DFrame: { origin: { x: 0, y: 50 }, normal: { x: -1, y: 0 }, tangent: { x: 0, y: 1 } },
    edgeGeometry: { edgeIndex: 3, parametricStart: 0, parametricEnd: 1, length: 50.0 },
    profile: { kind: "flat_profile", width: 50.0, depth: 3.0, height: 3.0, clearance: 0.1 },
    genderRole: "neutral",
    toleranceMm: 0.1,
    clearanceMm: 0.1,
    confidence: 0.90,
    uncertain: false,
  };

  const mockFlatB: Detected2DInterface = {
    ...mockFlatA,
    id: "if_p2_flat",
    owningPieceId: "p2",
    name: "Flat B",
  };

  it("1. positive test: infers valid TAB + SLOT candidate connection", () => {
    const diag = new InferenceDiagnostics();
    const map = new Map<string, Detected2DInterface[]>([
      ["p1", [mockTab]],
      ["p2", [mockSlot]],
    ]);

    const result = ConnectionInferencer2D.inferConnections(map, diag);

    expect(result.compatibleCount).toBe(1);
    expect(result.candidates.length).toBe(1);
    const cand = result.candidates[0];
    expect(cand.compatible).toBe(true);
    expect(cand.connectionType).toBe("tab_slot");
    expect(cand.confidence).toBeGreaterThan(0.8);
    expect(cand.orientationConstraint.allowedAngleRange.targetAngleDeg).toBe(90.0);
    expect(result.canonicalConnections.length).toBe(1);
  });

  it("2. negative test: rejects TAB + TAB same-gender pairing", () => {
    const diag = new InferenceDiagnostics();
    const map = new Map<string, Detected2DInterface[]>([
      ["p1", [mockTab]],
      ["p2", [mockTab2]],
    ]);

    const result = ConnectionInferencer2D.inferConnections(map, diag);

    expect(result.compatibleCount).toBe(0);
    expect(result.candidates[0].compatible).toBe(false);
    expect(result.candidates[0].reason).toContain("Incompatible gender roles");
  });

  it("3. negative test: rejects unrelated flat contact edges", () => {
    const diag = new InferenceDiagnostics();
    const map = new Map<string, Detected2DInterface[]>([
      ["p1", [mockFlatA]],
      ["p2", [mockFlatB]],
    ]);

    const result = ConnectionInferencer2D.inferConnections(map, diag);

    expect(result.compatibleCount).toBe(0);
    expect(result.candidates[0].compatible).toBe(false);
    expect(result.candidates[0].reason).toContain("Unrelated flat edges");
  });

  it("4. rejects profile width mismatches exceeding tolerance threshold", () => {
    const MismatchedSlot: Detected2DInterface = {
      ...mockSlot,
      profile: { ...mockSlot.profile, width: 40.0 }, // 40mm vs 15mm tab width
    };

    const diag = new InferenceDiagnostics();
    const map = new Map<string, Detected2DInterface[]>([
      ["p1", [mockTab]],
      ["p2", [MismatchedSlot]],
    ]);

    const result = ConnectionInferencer2D.inferConnections(map, diag);

    expect(result.compatibleCount).toBe(0);
    expect(result.candidates[0].compatible).toBe(false);
    expect(result.candidates[0].profileCompatibility.fitQuality).toBe("incompatible");
  });
});
