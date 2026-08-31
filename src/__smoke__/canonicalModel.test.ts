import { describe, expect, it } from "vitest";
import {
  createCanonicalAssemblyConfiguration,
  createCanonicalConnection,
  createCanonicalInterface,
  createCanonicalPiece,
  createEmptyCanonicalPuzzle,
  deserializeCanonicalPuzzle,
  serializeCanonicalPuzzle,
  validateCanonicalPuzzle,
} from "@/core/puzzle";

describe("Phase 2 Canonical Internal Representation", () => {
  it("creates an orientation-neutral CanonicalPiece template", () => {
    const piece = createCanonicalPiece("Base Board", { width: 120, height: 80, depth: 2.0 }, 2.0);
    expect(piece.id).toBeDefined();
    expect(piece.name).toBe("Base Board");
    expect(piece.dimensions.width).toBe(120);
    expect(piece.thickness).toBe(2.0);
    expect(piece.localFrame.normal.y).toBe(-1);
    // Verified: No horizontal/vertical orientation flags encoded on piece model
    expect((piece as any).orientationKind).toBeUndefined();
  });

  it("creates canonical interfaces with local coordinate frames and allowed DOF", () => {
    const piece = createCanonicalPiece("Wall Piece");
    const iface = createCanonicalInterface(piece.id, "Side Interface", { x: 0, y: 40 }, { x: -1, y: 0 });

    expect(iface.owningPieceId).toBe(piece.id);
    expect(iface.localFrame.normal.x).toBe(-1);
    expect(iface.allowedDOF.translation.x).toBe(false);
    expect(iface.tolerance).toBe(0.1);
  });

  it("creates canonical connections with joining angle ranges and relative transforms", () => {
    const conn = createCanonicalConnection("if_1", "if_2", 90.0);
    expect(conn.interfaceAId).toBe("if_1");
    expect(conn.interfaceBId).toBe("if_2");
    expect(conn.allowedAngleRange.targetAngleDeg).toBe(90.0);
    expect(conn.allowedAngleRange.minAngleDeg).toBe(90.0);
    expect(conn.allowedAngleRange.maxAngleDeg).toBe(90.0);
  });

  it("serializes and deserializes a canonical puzzle project losslessly", () => {
    const puzzle = createEmptyCanonicalPuzzle("Test Box Project");
    const piece = createCanonicalPiece("Plate A");
    const iface = createCanonicalInterface(piece.id, "Slot Port");
    piece.interfaceIds.push(iface.id);

    puzzle.pieces.push(piece);
    puzzle.interfaces.push(iface);

    const json = serializeCanonicalPuzzle(puzzle);
    expect(json).toContain("Test Box Project");
    expect(json).toContain("Plate A");

    const { puzzle: restored, validationReport } = deserializeCanonicalPuzzle(json);
    expect(restored.metadata.name).toBe("Test Box Project");
    expect(restored.pieces).toHaveLength(1);
    expect(restored.interfaces).toHaveLength(1);
    expect(validationReport.overallSeverity).toBe("ok");
  });

  it("validates and detects malformed data (dangling refs & negative dimensions)", () => {
    const puzzle = createEmptyCanonicalPuzzle("Broken Project");

    // 1. Piece with negative dimensions
    const badPiece = createCanonicalPiece("Bad Piece", { width: -10, height: 100, depth: 2.0 });
    puzzle.pieces.push(badPiece);

    // 2. Interface referencing dangling owning piece ID
    const danglingIface = createCanonicalInterface("nonexistent_piece_id", "Orphan Port");
    puzzle.interfaces.push(danglingIface);

    // 3. Connection with invalid angle range (min > max)
    const badConn = createCanonicalConnection(danglingIface.id, "missing_iface_b", 45.0);
    badConn.allowedAngleRange.minAngleDeg = 120.0;
    badConn.allowedAngleRange.maxAngleDeg = 60.0;
    puzzle.connections.push(badConn);

    const report = validateCanonicalPuzzle(puzzle);
    expect(report.overallSeverity).toBe("error");

    const codes = report.issues.map((i) => i.code);
    expect(codes).toContain("INVALID_PIECE_DIMENSIONS");
    expect(codes).toContain("DANGLING_OWNING_PIECE_REF");
    expect(codes).toContain("DANGLING_INTERFACE_B_REF");
    expect(codes).toContain("INVALID_ANGLE_RANGE");
  });

  it("rejects deserialization of malformed canonical puzzle JSON", () => {
    const badJson = JSON.stringify({
      metadata: { id: "p1", name: "Bad", schemaVersion: 2 },
      pieces: [{ id: "p1", dimensions: { width: -5, height: 10 }, thickness: -1 }],
    });

    expect(() => deserializeCanonicalPuzzle(badJson)).toThrowError(
      /Deserialized canonical puzzle failed validation/,
    );
  });
});
