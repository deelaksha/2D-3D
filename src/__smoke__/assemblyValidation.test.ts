import { describe, it, expect } from "vitest";
import { store } from "@/core/store/store";
import {
  createPart,
  addConnector,
  createReceiverForConnector,
  findConnector,
  connectPortPair,
  placePart,
  addConnection,
} from "@/core/store/actions";
import { connectorStatuses, validateAssembly, partConnectorSummaries } from "@/core/assembly/validate";

describe("Puzzle connector foundation: end-to-end 2D -> 3D mate + assembly validation", () => {
  it("creates a matching receiver from real connector geometry, preserves the G1<->G1 relationship into 3D, auto-mates, and is recognized as connected", () => {
    const partA = createPart("Panel A", { width: 100, height: 100 });
    const partB = createPart("Panel B", { width: 100, height: 100 });

    // 1/2. Create a connector (tab) on Part A — this is Part A's "G1".
    const plugId = addConnector(partA, "tab", { x: 50, y: 0 }, {
      name: "G1",
      width: 16,
      height: 4,
      depth: 4,
      pattern: "dovetail",
    });

    // 3. Generate the matching receiver on Part B FROM the connector's actual
    // geometry (not a generic default) — this is Part B's "G1".
    const receiverId = createReceiverForConnector(plugId, partB);
    expect(receiverId).toBeTruthy();
    const plug = findConnector(plugId)!;
    const receiver = findConnector(receiverId!)!;
    expect(receiver.width).toBe(plug.width);
    expect(receiver.depth).toBe(plug.depth);
    expect(receiver.pattern).toBe(plug.pattern);
    // The system knows Part A.G1 <-> Part B.G1 are intended to connect.
    expect(plug.compatibleWith).toContain(receiverId);
    expect(receiver.compatibleWith).toContain(plugId);

    // 4. Before any join, both are unplaced and only "paired" (matched, not yet joined in 3D).
    let statuses = connectorStatuses(store.getState().project);
    const plugStatus = statuses.find((s) => s.connectorId === plugId);
    const receiverStatus = statuses.find((s) => s.connectorId === receiverId);
    expect(plugStatus?.state).toBe("paired");
    expect(receiverStatus?.state).toBe("paired");

    // Move to 3D: place Part A first (simulating drag-to-scene).
    placePart(partA, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });

    // 5. Select G1 on Part A + G1 on Part B, click Join -> auto-mate.
    const joined = connectPortPair(plugId);
    expect(joined).toBe(true);

    const project = store.getState().project;
    const cnx = project.assembly.connections.find(
      (c) => c.sourceConnector === plugId || c.targetConnector === plugId
    );
    expect(cnx).toBeTruthy();
    expect(cnx?.status).toBe("valid");

    const placementB = project.assembly.placements.find((p) => p.partId === partB);
    expect(placementB?.placed).toBe(true);

    // The connection is recognized as connected, and alignment is exact (no drift).
    statuses = connectorStatuses(project);
    expect(statuses.find((s) => s.connectorId === plugId)?.state).toBe("joined");
    expect(statuses.find((s) => s.connectorId === receiverId)?.state).toBe("joined");

    const report = validateAssembly(project);
    expect(report.issues.some((i) => i.code === "connection-misaligned")).toBe(false);
    expect(report.issues.some((i) => i.code === "connector-unmatched" && (i.refs?.includes(plugId) || i.refs?.includes(receiverId!)))).toBe(false);

    const summaries = partConnectorSummaries(project);
    const partASummary = summaries.find((s) => s.partId === partA);
    expect(partASummary?.connectors.every((c) => c.state === "joined")).toBe(true);
  });

  it("flags a connector with no matching receiver/connector anywhere as unmatched", () => {
    const lonelyPart = createPart("Lonely Panel", { width: 60, height: 60 });
    const orphanId = addConnector(lonelyPart, "hinge", { x: 10, y: 10 }, { width: 10, height: 4, depth: 4 });

    const statuses = connectorStatuses(store.getState().project);
    expect(statuses.find((s) => s.connectorId === orphanId)?.state).toBe("unmatched");

    const report = validateAssembly(store.getState().project);
    expect(report.level).not.toBe("ok");
    expect(report.issues.some((i) => i.code === "connector-unmatched" && i.refs?.includes(orphanId))).toBe(true);
  });

  it("flags a realized connection between incompatible connector types as invalid, and duplicate connections", () => {
    const partA = createPart("Mismatch A", { width: 80, height: 80 });
    const partB = createPart("Mismatch B", { width: 80, height: 80 });
    // tab (insert family) and peg (also insert family) are not complementary.
    const tabId = addConnector(partA, "tab", { x: 0, y: 0 }, { width: 12, height: 4, depth: 4 });
    const pegId = addConnector(partB, "peg", { x: 0, y: 0 }, { width: 12, height: 4, depth: 4 });

    addConnection({ sourcePart: partA, sourceConnector: tabId, targetPart: partB, targetConnector: pegId, status: "unknown" });
    addConnection({ sourcePart: partA, sourceConnector: tabId, targetPart: partB, targetConnector: pegId, status: "unknown" });

    const report = validateAssembly(store.getState().project);
    expect(report.level).toBe("error");
    expect(report.issues.some((i) => i.code === "connection-invalid")).toBe(true);
    expect(report.issues.some((i) => i.code === "connection-duplicate")).toBe(true);
  });
});
