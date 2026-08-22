import { describe, it, expect } from "vitest";
import { store } from "@/core/store/store";
import {
  createPart,
  addConnector,
  createReceiverForConnector,
  updateConnector,
  findConnector,
  createPortPair,
} from "@/core/store/actions";
import { connectorFeature } from "@/core/connectors/feature";
import type { ConnectorPattern } from "@/core/model/types";

describe("Joint Automation & Connector Sync Engine", () => {
  it("automatically creates a receiver referencing the source connector ID", () => {
    const partA = createPart("Panel A", { width: 100, height: 100 });
    const partB = createPart("Panel B", { width: 100, height: 100 });

    const plugId = addConnector(partA, "tab", { x: 50, y: 0 }, {
      width: 16,
      height: 4,
      depth: 4,
      pattern: "dovetail",
    });

    const receiverId = createReceiverForConnector(plugId, partB);
    expect(receiverId).toBeTruthy();

    const plug = findConnector(plugId);
    const receiver = findConnector(receiverId!);

    expect(plug).toBeTruthy();
    expect(receiver).toBeTruthy();

    expect(receiver?.role).toBe("receiver");
    expect(receiver?.type).toBe("slot");
    expect(receiver?.referencedConnectorId).toBe(plugId);
    expect(receiver?.width).toBe(16);
    expect(receiver?.height).toBe(4);
    expect(receiver?.pattern).toBe("dovetail");
    expect(plug?.compatibleWith).toContain(receiverId);
    expect(receiver?.compatibleWith).toContain(plugId);
  });

  it("automatically synchronizes physical dimensions when editing a connector", () => {
    const partA = createPart("Wall A", { width: 120, height: 80 });
    const partB = createPart("Base B", { width: 120, height: 80 });

    const pair = createPortPair(partA, partB, "tab", { width: 10, height: 4, depth: 4 });
    expect(pair).toBeTruthy();
    if (!pair) return;

    const plugBefore = findConnector(pair.plugId);
    const recBefore = findConnector(pair.receiverId);
    expect(plugBefore?.width).toBe(10);
    expect(recBefore?.width).toBeCloseTo(10.4, 1);

    // Edit plug width to 24mm & depth to 6mm
    updateConnector(pair.plugId, { width: 24, depth: 6, pattern: "shoulder" });

    const plugAfter = findConnector(pair.plugId);
    const recAfter = findConnector(pair.receiverId);

    expect(plugAfter?.width).toBe(24);
    expect(plugAfter?.depth).toBe(6);
    expect(plugAfter?.pattern).toBe("shoulder");

    // Receiver should be automatically updated!
    expect(recAfter?.width).toBe(24);
    expect(recAfter?.depth).toBe(6);
    expect(recAfter?.pattern).toBe("shoulder");
  });

  it("generates correct 2D shape modifiers for all 6 wooden joint styles", () => {
    const patterns: ConnectorPattern[] = [
      "standard",
      "shoulder",
      "halflap",
      "finger",
      "dovetail",
      "peg_hole",
    ];

    const dummyPart = createPart("Test Panel");

    for (const pattern of patterns) {
      const cId = addConnector(dummyPart, pattern === "peg_hole" ? "peg" : "tab", { x: 20, y: 20 }, {
        width: 15,
        height: 5,
        depth: 4,
        pattern,
        role: "insert",
      });

      const conn = findConnector(cId);
      expect(conn).toBeTruthy();

      const feat = connectorFeature(conn!);
      expect(feat).toBeTruthy();
      expect(feat?.op).toBe("union");
      expect(feat?.shape.width).toBeGreaterThan(0);
      expect(feat?.shape.height).toBeGreaterThan(0);
    }
  });
});
