import { describe, expect, it } from "vitest";
import { RealDataIngestionPipeline } from "../core/puzzle/realdata/realDataIngestionPipeline";
import {
  AnnotationEditor,
  ApprovalBlockedError,
  InspectionInspector,
  ReviewSessionManager,
  ReviewerIndependentValidator,
} from "../core/puzzle/review";
import type { RealDatasetExample } from "../core/puzzle/realdata/types";

// Standard valid fixture project JSON
const sampleProjectJson = JSON.stringify({
  schemaVersion: 1,
  meta: { id: "puz_review_test", name: "Review Test Project", displayUnit: "mm" },
  parts: [
    {
      id: "part_base",
      name: "Base Plate",
      width: 100,
      height: 100,
      thickness: 3.0,
      connectors: [
        {
          id: "conn_tab_1",
          partId: "part_base",
          name: "Tab 1",
          type: "tab",
          position: { x: 50, y: 0 },
          orientation: 0,
          width: 20,
          height: 5,
          depth: 5,
          tolerance: 0.1,
          compatibleWith: ["slot"],
        },
      ],
    },
    {
      id: "part_wall",
      name: "Wall Plate",
      width: 100,
      height: 80,
      thickness: 3.0,
      connectors: [
        {
          id: "conn_slot_1",
          partId: "part_wall",
          name: "Slot 1",
          type: "slot",
          position: { x: 50, y: 0 },
          orientation: 0,
          width: 20,
          height: 5,
          depth: 5,
          tolerance: 0.1,
          compatibleWith: ["tab"],
        },
      ],
    },
  ],
  materials: [{ id: "mat_cardboard_3mm", name: "Cardboard", thickness: 3.0 }],
  groups: [],
  dimensions: [],
  assembly: {
    placements: [
      { partId: "part_base", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
      { partId: "part_wall", position: { x: 0, y: 0, z: 50 }, rotation: { x: 90, y: 0, z: 0 } },
    ],
    connections: [
      {
        id: "c_joint_1",
        fromPartId: "part_base",
        fromConnectorId: "conn_tab_1",
        toPartId: "part_wall",
        toConnectorId: "conn_slot_1",
        joiningAngleDeg: 90.0,
        status: "valid",
      },
    ],
  },
});

function getIngestedExample(): RealDatasetExample {
  const result = RealDataIngestionPipeline.ingestFile({
    filename: "review_target.json",
    content: sampleProjectJson,
  });
  if (!result.datasetExample) {
    throw new Error("Failed to produce datasetExample for test setup.");
  }
  return result.datasetExample;
}

describe("Phase 62: Human-in-the-Loop Annotation & Review Workflow", () => {
  describe("1. 11-Domain Inspection Snapshot", () => {
    it("extracts all 11 required inspection domains from a dataset item", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_carol");

      const snapshot = manager.inspectSession(session.sessionId);

      // Domain 1: source drawing
      expect(snapshot.sourceDrawing.sourceFile).toBe("review_target.json");
      expect(snapshot.sourceDrawing.detectedFormat).toBe("JSON");
      expect(snapshot.sourceDrawing.sha256).toBeDefined();

      // Domain 2: pieces
      expect(snapshot.pieces.length).toBe(2);
      expect(snapshot.pieces.some((p) => p.pieceId === "part_base")).toBe(true);

      // Domain 3: piece boundaries
      expect(snapshot.pieceBoundaries["part_base"]).toBeDefined();
      expect(snapshot.pieceBoundaries["part_base"].loop.length).toBeGreaterThanOrEqual(3);
      expect(snapshot.pieceBoundaries["part_base"].area).toBeGreaterThan(0);
      expect(snapshot.pieceBoundaries["part_base"].isClosed).toBe(true);

      // Domain 4: interfaces
      expect(snapshot.interfaces.length).toBe(2);
      expect(snapshot.interfaces.some((i) => i.interfaceId === "conn_tab_1")).toBe(true);

      // Domain 5: connection graph
      expect(snapshot.connectionGraph.nodeCount).toBe(2);
      expect(snapshot.connectionGraph.edgeCount).toBe(1);
      expect(snapshot.connectionGraph.isFullyConnected).toBe(true);

      // Domain 6: dimensions
      expect(snapshot.dimensions["part_base"].widthMm).toBe(100);
      expect(snapshot.dimensions["part_base"].thicknessMm).toBe(3.0);

      // Domain 7: parametric features
      expect(snapshot.parametricFeatures.length).toBeGreaterThan(0);
      expect(snapshot.parametricFeatures.some((f) => f.name === "width")).toBe(true);

      // Domain 8: material constraints
      expect(snapshot.materialConstraints.thicknessMm).toBe(3.0);
      expect(snapshot.materialConstraints.stockWidthMm).toBe(600);

      // Domain 9: 3D reconstruction
      expect(snapshot.reconstruction3D["part_base"]).toBeDefined();
      expect(snapshot.reconstruction3D["part_base"].volumeEstimateMm3).toBeGreaterThan(0);

      // Domain 10: assembly transforms
      expect(snapshot.assemblyTransforms.pieceTransforms["part_wall"]).toBeDefined();
      expect(snapshot.assemblyTransforms.assemblySequence.length).toBe(2);

      // Domain 11: validation results
      expect(snapshot.validationResults.isValid).toBe(true);
      expect(snapshot.validationResults.geometryValid).toBe(true);
    });
  });

  describe("2. Editing across all 9 Editable Targets with Event Sourcing", () => {
    it("edits piece boundaries (Target 1) and records immutable event", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_dave");

      const newLoop = [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 90 },
        { x: 0, y: 90 },
      ];

      const evt = AnnotationEditor.editPieceBoundary(
        session,
        "part_base",
        newLoop,
        "reviewer_dave",
        "Adjusted base boundary to expand perimeter"
      );

      expect(evt.target).toBe("piece_boundary");
      expect(evt.reviewerId).toBe("reviewer_dave");
      expect(evt.reason).toContain("expand perimeter");
      expect(session.history.length).toBe(1);

      // Current working draft updated
      expect(session.currentExample.pieces.find((p) => p.pieceId === "part_base")?.localPolygon2D.length).toBe(4);
    });

    it("edits piece ID (Target 2) and cascades rename across references", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_dave");

      const evt = AnnotationEditor.editPieceId(
        session,
        "part_base",
        "part_base_renamed",
        "reviewer_dave",
        "Renamed base to standardized convention"
      );

      expect(evt.target).toBe("piece_id");
      expect(evt.oldValue).toBe("part_base");
      expect(evt.newValue).toBe("part_base_renamed");

      // Verify cascading updates
      expect(session.currentExample.pieces.some((p) => p.pieceId === "part_base_renamed")).toBe(true);
      expect(session.currentExample.interfaces.find((i) => i.interfaceId === "conn_tab_1")?.owningPieceId).toBe("part_base_renamed");
      expect(session.currentExample.assembly.pieceTransforms["part_base_renamed"]).toBeDefined();
    });

    it("edits interface ID (Target 3) and cascades into connections", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_dave");

      const evt = AnnotationEditor.editInterfaceId(
        session,
        "conn_tab_1",
        "port_tab_renamed",
        "reviewer_dave",
        "Renamed port ID"
      );

      expect(evt.target).toBe("interface_id");
      expect(session.currentExample.interfaces.some((i) => i.interfaceId === "port_tab_renamed")).toBe(true);
      expect(session.currentExample.connections[0].interfaceAId).toBe("port_tab_renamed");
    });

    it("edits interface type and gender (Target 4)", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_dave");

      const evt = AnnotationEditor.editInterfaceType(
        session,
        "conn_tab_1",
        "finger",
        "neutral",
        "reviewer_dave",
        "Changed from tab to finger joint"
      );

      expect(evt.target).toBe("interface_type");
      const iface = session.currentExample.interfaces.find((i) => i.interfaceId === "conn_tab_1");
      expect(iface?.interfaceType).toBe("finger");
      expect(iface?.genderRole).toBe("neutral");
    });

    it("edits connection relationships (Target 5)", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_dave");

      const evt = AnnotationEditor.editConnectionRelationship(
        session,
        "c_joint_1",
        "conn_slot_1",
        "conn_tab_1",
        "reviewer_dave",
        "Inverted connection orientation"
      );

      expect(evt.target).toBe("connection_relationship");
      const conn = session.currentExample.connections.find((c) => c.connectionId === "c_joint_1");
      expect(conn?.interfaceAId).toBe("conn_slot_1");
      expect(conn?.interfaceBId).toBe("conn_tab_1");
    });

    it("edits parameter dimensions (Target 6)", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_dave");

      const evt = AnnotationEditor.editParameter(
        session,
        "part_base",
        "thicknessMm",
        4.0,
        "reviewer_dave",
        "Updated cardboard thickness to 4mm"
      );

      expect(evt.target).toBe("parameter");
      const piece = session.currentExample.pieces.find((p) => p.pieceId === "part_base");
      expect(piece?.designParameters.thicknessMm).toBe(4.0);
    });

    it("edits assembly transform (Target 7)", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_dave");

      const newPos = { x: 10, y: 20, z: 30 };
      const newQuat = { x: 0, y: 0.7071, z: 0, w: 0.7071 };

      const evt = AnnotationEditor.editAssemblyTransform(
        session,
        "part_wall",
        newPos,
        newQuat,
        "reviewer_dave",
        "Refined 3D positioning"
      );

      expect(evt.target).toBe("assembly_transform");
      const transform = session.currentExample.assembly.pieceTransforms["part_wall"];
      expect(transform.position.x).toBe(10);
      expect(transform.position.z).toBe(30);
    });

    it("edits allowed joining angle (Target 8)", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_dave");

      const evt = AnnotationEditor.editAllowedAngle(
        session,
        "c_joint_1",
        45.0,
        "reviewer_dave",
        "Set angle to 45 degrees miter joint"
      );

      expect(evt.target).toBe("allowed_angle");
      const conn = session.currentExample.connections.find((c) => c.connectionId === "c_joint_1");
      expect(conn?.joiningAngleDeg).toBe(45.0);
    });

    it("edits constraints (Target 9)", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_dave");

      const evt = AnnotationEditor.editConstraint(
        session,
        "const_angle_custom",
        { joiningAngleDeg: 45.0 },
        "HARD",
        "reviewer_dave",
        "Added explicit angle constraint"
      );

      expect(evt.target).toBe("constraint");
      expect(session.currentExample.constraints.some((c) => c.constraintId === "const_angle_custom")).toBe(true);
    });
  });

  describe("3. Immutability of Original Source Data", () => {
    it("preserves original machine-extracted data unaltered after multiple edits", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_eva");

      const originalPieceCount = session.originalExample.pieces.length;
      const originalWidth = session.originalExample.pieces[0].designParameters.widthMm;
      const originalThickness = session.originalExample.pieces[0].designParameters.thicknessMm;
      const originalConnectionsCount = session.originalExample.connections.length;

      // Apply multiple edits to current draft
      AnnotationEditor.editParameter(session, "part_base", "widthMm", 250, "reviewer_eva", "Widened base");
      AnnotationEditor.editParameter(session, "part_base", "thicknessMm", 6.0, "reviewer_eva", "Thickened");
      AnnotationEditor.editAllowedAngle(session, "c_joint_1", 30.0, "reviewer_eva", "Changed angle");

      // Verify current copy was updated
      expect(session.currentExample.pieces[0].designParameters.widthMm).toBe(250);
      expect(session.currentExample.pieces[0].designParameters.thicknessMm).toBe(6.0);
      expect(session.currentExample.connections[0].joiningAngleDeg).toBe(30.0);

      // Verify originalExample is 100% UNTOUCHED
      expect(session.originalExample.pieces.length).toBe(originalPieceCount);
      expect(session.originalExample.pieces[0].designParameters.widthMm).toBe(originalWidth);
      expect(session.originalExample.pieces[0].designParameters.thicknessMm).toBe(originalThickness);
      expect(session.originalExample.connections.length).toBe(originalConnectionsCount);
    });
  });

  describe("4. 5 Annotation Lifecycle States & State Transitions", () => {
    it("supports UNREVIEWED -> IN_REVIEW -> NEEDS_CORRECTION -> APPROVED", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example);

      expect(session.state).toBe("UNREVIEWED");

      manager.transitionState(session.sessionId, "IN_REVIEW", "reviewer_frank", "Checking joint tolerances");
      expect(session.state).toBe("IN_REVIEW");

      manager.transitionState(session.sessionId, "NEEDS_CORRECTION", "reviewer_frank", "Slot width too loose");
      expect(session.state).toBe("NEEDS_CORRECTION");

      // Fix slot width
      AnnotationEditor.editParameter(session, "part_wall", "widthMm", 100, "reviewer_frank", "Corrected dimensions");

      manager.transitionState(session.sessionId, "APPROVED", "reviewer_frank", "All checks passed");
      expect(session.state).toBe("APPROVED");
      expect(session.approvalAudit).toBeDefined();
      expect(session.approvalAudit?.approvedBy).toBe("reviewer_frank");
    });

    it("supports transitioning to REJECTED with reason recorded", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example);

      manager.transitionState(session.sessionId, "REJECTED", "reviewer_frank", "Corrupted CAD source file");
      expect(session.state).toBe("REJECTED");
      expect(session.currentExample.qualityStatus).toBe("FAIL");
    });
  });

  describe("5. Reviewer-Independent Validation & Approval Safety Gate", () => {
    it("detects defective human edits and blocks approval transition", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_grace");

      // Reviewer accidentally inputs defective boundary with only 2 vertices (degenerate line)
      const defectiveLoop = [
        { x: 0, y: 0 },
        { x: 50, y: 50 },
      ];

      AnnotationEditor.editPieceBoundary(
        session,
        "part_base",
        defectiveLoop,
        "reviewer_grace",
        "Accidental truncation"
      );

      // Reviewer-independent validation should flag defective boundary
      const val = ReviewerIndependentValidator.validate(session.currentExample);
      expect(val.isValid).toBe(false);
      expect(val.errors.some((e) => e.includes("DEGENERATE_BOUNDARY"))).toBe(true);

      // Attempting to transition defective session to APPROVED MUST be blocked!
      expect(() => {
        manager.transitionState(session.sessionId, "APPROVED", "reviewer_grace", "Attempt approval");
      }).toThrow(ApprovalBlockedError);

      expect(session.state).not.toBe("APPROVED");
    });

    it("allows approval once defect is corrected", () => {
      const example = getIngestedExample();
      const manager = new ReviewSessionManager();
      const session = manager.createSession(example, "reviewer_grace");

      // 1. Break boundary
      AnnotationEditor.editPieceBoundary(session, "part_base", [{ x: 0, y: 0 }], "reviewer_grace", "Typo");
      expect(ReviewerIndependentValidator.validate(session.currentExample).isValid).toBe(false);

      // 2. Fix boundary with valid polygon
      AnnotationEditor.editPieceBoundary(
        session,
        "part_base",
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ],
        "reviewer_grace",
        "Restored valid rectangle"
      );

      expect(ReviewerIndependentValidator.validate(session.currentExample).isValid).toBe(true);

      // Now approval succeeds
      manager.transitionState(session.sessionId, "APPROVED", "reviewer_grace", "Approved after fix");
      expect(session.state).toBe("APPROVED");
    });
  });

  describe("6. Session Filtering and Workflow Summary", () => {
    it("summarizes and filters queue across annotation states", () => {
      const manager = new ReviewSessionManager();
      const example1 = getIngestedExample();
      const example2 = getIngestedExample();
      example2.itemId = "ds_item_2";

      const s1 = manager.createSession(example1);
      const s2 = manager.createSession(example2, "reviewer_helen");

      manager.transitionState(s2.sessionId, "APPROVED", "reviewer_helen", "Good to go");

      const summary = manager.getWorkflowSummary();
      expect(summary.totalSessions).toBe(2);
      expect(summary.unreviewedCount).toBe(1);
      expect(summary.approvedCount).toBe(1);

      const approvedSessions = manager.filterSessions({ state: "APPROVED" });
      expect(approvedSessions.length).toBe(1);
      expect(approvedSessions[0].sessionId).toBe(s2.sessionId);
    });
  });
});
