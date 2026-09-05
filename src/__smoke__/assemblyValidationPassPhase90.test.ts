/**
 * Assembly & Connector Validation Pass Smoke Tests (Phase 90).
 *
 * Validates:
 *  1. Fully valid complete assembly verification (100% pass on all 9 connection & 8 assembly criteria).
 *  2. Detection and exact reporting of connection-level defects:
 *     - invalid interface pairing (missing port, role clash)
 *     - incorrect connector type
 *     - incorrect geometry (tab width > slot width)
 *     - incorrect alignment (interface port offset > 0.5mm)
 *     - invalid joining angle (outside kinematic limits)
 *     - invalid clearance (< 0.05mm)
 *     - unintended penetration (fold-back condition)
 *     - impossible insertion trajectory (acute fold blocking approach)
 *  3. Detection and exact reporting of assembly-level defects:
 *     - missing piece from placements
 *     - unintended 3D body collisions
 *     - disconnected pieces (topological fragmentation)
 *     - mandatory connections unsatisfied
 *     - invalid transforms (non-finite coordinates, non-unit quaternions)
 *     - invalid material dimensions
 *     - invalid thickness
 *     - invalid geometry (unclosed boundary profile, non-positive area)
 *  4. Strict binary enforcement: NEVER return success if any mandatory validation fails.
 *  5. Granular diagnostics: exact identification of piece, interface, connection, position, angle, and failure reason.
 */

import { describe, expect, it } from "vitest";
import { Automatic2DGenerationEngine } from "../core/puzzle/automatic2d";
import { Piece3DConversionEngine } from "../core/puzzle/piece3d";
import { solveAutomaticAssembly } from "../core/puzzle/assemblysolver";
import { evaluatePuzzleJoiningAngles } from "../core/puzzle/anglegeneration";
import {
  AssemblyValidationPass,
  validateConnectorAndAssembly,
} from "../core/puzzle/assemblyvalidation";
import type { AssemblyValidationInput, AssemblyValidationReport } from "../core/puzzle/assemblyvalidation";
import type { ConvertedPuzzle3D } from "../core/puzzle/piece3d/types";
import { vec3, quatIdentity } from "../core/puzzle/geometry/math3d";

describe("Phase 90: Complete Connector-and-Assembly Validation Pass", () => {
  function createTestSolvedAssembly(pieceCount = 4) {
    const puzzle2d = Automatic2DGenerationEngine.generatePuzzle({
      targetPieceCount: pieceCount,
      overallSize: { widthMm: 120, heightMm: 120 },
      boundaryShape: "rectangle",
      partitionStyle: "rectangular",
      material: {
        id: "plywood",
        name: "Birch Plywood",
        stockThicknessMm: 3.0,
      },
    });
    const puzzle3d = Piece3DConversionEngine.convertPuzzle(puzzle2d);
    const angleResult = evaluatePuzzleJoiningAngles(puzzle3d, { angleStepDeg: 30 });

    const solved = solveAutomaticAssembly({
      puzzle: puzzle3d,
      validAngleCandidates: angleResult.connectionAngles,
    });

    if (!solved.success) {
      throw new Error("Failed to solve test assembly for Phase 90 test setup.");
    }

    return {
      puzzle3d,
      solved,
      pieceTransforms: solved.pieceTransforms,
      appliedAngles: solved.appliedAngles,
    };
  }

  describe("Complete Assembly Validations (Positive Acceptance)", () => {
    it("successfully passes a complete, valid 4-piece 3D assembly satisfying all criteria", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const input: AssemblyValidationInput = {
        puzzle: puzzle3d,
        pieceTransforms,
        appliedAngles,
      };

      const report: AssemblyValidationReport = validateConnectorAndAssembly(input);

      // Strict Master Pass
      expect(report.isValid).toBe(true);

      // Verify all 8 Assembly-Level Criteria
      expect(report.totalPieces).toBe(4);
      expect(report.placedPiecesCount).toBe(4);
      expect(report.allPiecesIncluded).toBe(true);
      expect(report.noUnintendedCollisions).toBe(true);
      expect(report.noDisconnectedPieces).toBe(true);
      expect(report.allMandatoryConnectionsSatisfied).toBe(true);
      expect(report.validTransforms).toBe(true);
      expect(report.validMaterialDimensions).toBe(true);
      expect(report.validThickness).toBe(true);
      expect(report.validGeometry).toBe(true);

      // Verify all 9 Connection-Level Criteria across all connections
      expect(report.validConnectionsCount).toBe(report.totalConnections);
      for (const [connId, detail] of Object.entries(report.connectionDetails)) {
        expect(detail.connectionId).toBe(connId);
        expect(detail.isValid).toBe(true);
        expect(detail.interfacePairingValid).toBe(true);
        expect(detail.connectorTypeValid).toBe(true);
        expect(detail.geometryValid).toBe(true);
        expect(detail.alignmentValid).toBe(true);
        expect(detail.joiningAngleValid).toBe(true);
        expect(detail.clearanceValid).toBe(true);
        expect(detail.noUnintendedPenetration).toBe(true);
        expect(detail.insertionFeasible).toBe(true);
        expect(detail.finalConnectionState).toBe("MATED");
        expect(detail.failureReasons).toHaveLength(0);
      }

      // Verify Diagnostics
      expect(report.failures).toHaveLength(0);
      expect(report.summary.errorCount).toBe(0);
      expect(report.summary.message).toContain("PASSED");
    });
  });

  describe("Connection-Level Validation Failures", () => {
    it("detects and flags invalid interface pairing", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      // Corrupt interface ID on first connection
      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        connections: puzzle3d.connections.map((c, i) =>
          i === 0 ? { ...c, interfaceAId: "non_existent_port_xyz" } : c
        ),
      };

      const report = validateConnectorAndAssembly({
        puzzle: corruptPuzzle,
        pieceTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      expect(report.allMandatoryConnectionsSatisfied).toBe(false);

      const targetConnId = corruptPuzzle.connections[0].connectionId;
      const detail = report.connectionDetails[targetConnId];
      expect(detail.interfacePairingValid).toBe(false);
      expect(detail.isValid).toBe(false);
      expect(detail.finalConnectionState).toBe("FAILED");

      // Verify exact failure identification
      const failure = report.failures.find((f) => f.connectionId === targetConnId && f.category === "interface_pairing");
      expect(failure).toBeDefined();
      expect(failure?.pieceId).toBeDefined();
      expect(failure?.interfaceId).toBe("non_existent_port_xyz");
      expect(failure?.failureReason).toContain("not found on piece");
    });

    it("detects and flags incorrect connector type", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        connections: puzzle3d.connections.map((c, i) =>
          i === 0 ? { ...c, connectorType: "unsupported_alien_joint" as any } : c
        ),
      };

      const report = validateConnectorAndAssembly({
        puzzle: corruptPuzzle,
        pieceTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      const targetConnId = corruptPuzzle.connections[0].connectionId;
      const detail = report.connectionDetails[targetConnId];
      expect(detail.connectorTypeValid).toBe(false);

      const failure = report.failures.find((f) => f.connectionId === targetConnId && f.category === "connector_type");
      expect(failure).toBeDefined();
      expect(failure?.failureReason).toContain("Unrecognized or invalid connector type");
    });

    it("detects and flags incorrect connector geometry (tab width > slot width)", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      // Interfere with parameters: tab wider than slot
      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        connections: puzzle3d.connections.map((c, i) =>
          i === 0
            ? {
                ...c,
                parameters: {
                  ...c.parameters,
                  tabWidth: 50.0,
                  slotWidth: 20.0,
                },
              }
            : c
        ),
      };

      const report = validateConnectorAndAssembly({
        puzzle: corruptPuzzle,
        pieceTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      const targetConnId = corruptPuzzle.connections[0].connectionId;
      const detail = report.connectionDetails[targetConnId];
      expect(detail.geometryValid).toBe(false);

      const failure = report.failures.find((f) => f.connectionId === targetConnId && f.category === "geometry");
      expect(failure).toBeDefined();
      expect(failure?.failureReason).toContain("exceeds slot width");
    });

    it("detects and flags incorrect interface alignment offset", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      // Misalign piece 1 by shifting its transform by 5mm in X
      const displacedTransforms = {
        ...pieceTransforms,
        [puzzle3d.pieces[1].pieceId]: {
          ...pieceTransforms[puzzle3d.pieces[1].pieceId],
          position: vec3(
            pieceTransforms[puzzle3d.pieces[1].pieceId].position.x + 5.0,
            pieceTransforms[puzzle3d.pieces[1].pieceId].position.y,
            pieceTransforms[puzzle3d.pieces[1].pieceId].position.z
          ),
        },
      };

      const report = validateConnectorAndAssembly({
        puzzle: puzzle3d,
        pieceTransforms: displacedTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      const connWithPiece1 = puzzle3d.connections.find(
        (c) => c.pieceAId === puzzle3d.pieces[1].pieceId || c.pieceBId === puzzle3d.pieces[1].pieceId
      )!;

      const detail = report.connectionDetails[connWithPiece1.connectionId];
      expect(detail.alignmentValid).toBe(false);
      expect(detail.alignmentErrorMm).toBeGreaterThan(0.5);

      const failure = report.failures.find(
        (f) => f.connectionId === connWithPiece1.connectionId && f.category === "alignment"
      );
      expect(failure).toBeDefined();
      expect(failure?.position).toBeDefined();
      expect(failure?.failureReason).toContain("exceeds tolerance");
    });

    it("detects and flags invalid joining angle outside kinematic limits", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const connId = puzzle3d.connections[0].connectionId;
      const invalidAngles = {
        ...appliedAngles,
        [connId]: 250.0, // Outside valid [0°, 180°]
      };

      const report = validateConnectorAndAssembly({
        puzzle: puzzle3d,
        pieceTransforms,
        appliedAngles: invalidAngles,
      });

      expect(report.isValid).toBe(false);
      const detail = report.connectionDetails[connId];
      expect(detail.joiningAngleValid).toBe(false);

      const failure = report.failures.find((f) => f.connectionId === connId && f.category === "joining_angle");
      expect(failure).toBeDefined();
      expect(failure?.angleDeg).toBe(250.0);
      expect(failure?.failureReason).toContain("outside allowed kinematic range");
    });

    it("detects and flags insufficient clearance", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        connections: puzzle3d.connections.map((c, i) =>
          i === 0 ? { ...c, clearanceMm: 0.01 } : c // 0.01mm < 0.05mm minimum
        ),
      };

      const report = validateConnectorAndAssembly({
        puzzle: corruptPuzzle,
        pieceTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      const connId = corruptPuzzle.connections[0].connectionId;
      const detail = report.connectionDetails[connId];
      expect(detail.clearanceValid).toBe(false);

      const failure = report.failures.find((f) => f.connectionId === connId && f.category === "clearance");
      expect(failure).toBeDefined();
      expect(failure?.failureReason).toContain("below minimum allowable manufacturing threshold");
    });

    it("detects and flags unintended penetration and impossible insertion at 0° fold-back", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const connId = puzzle3d.connections[0].connectionId;
      const foldBackAngles = {
        ...appliedAngles,
        [connId]: 0.0, // 0° causes piece to fold flat onto mating neighbor
      };

      const report = validateConnectorAndAssembly({
        puzzle: puzzle3d,
        pieceTransforms,
        appliedAngles: foldBackAngles,
      });

      expect(report.isValid).toBe(false);
      const detail = report.connectionDetails[connId];
      expect(detail.noUnintendedPenetration).toBe(false);
      expect(detail.insertionFeasible).toBe(false);

      const penetrationFailure = report.failures.find((f) => f.connectionId === connId && f.category === "penetration");
      expect(penetrationFailure).toBeDefined();
      expect(penetrationFailure?.failureReason).toContain("Severe unintended penetration");

      const insertionFailure = report.failures.find((f) => f.connectionId === connId && f.category === "insertion");
      expect(insertionFailure).toBeDefined();
      expect(insertionFailure?.failureReason).toContain("Impossible insertion trajectory");
    });
  });

  describe("Assembly-Level Validation Failures", () => {
    it("detects and flags missing pieces (omitted piece transform)", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      // Omit piece 3 from pieceTransforms
      const missingPieceId = puzzle3d.pieces[3].pieceId;
      const partialTransforms = { ...pieceTransforms };
      delete partialTransforms[missingPieceId];

      const report = validateConnectorAndAssembly({
        puzzle: puzzle3d,
        pieceTransforms: partialTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      expect(report.allPiecesIncluded).toBe(false);
      expect(report.placedPiecesCount).toBe(3);

      const failure = report.failures.find((f) => f.pieceId === missingPieceId && f.category === "missing_piece");
      expect(failure).toBeDefined();
      expect(failure?.failureReason).toContain("omitted from assembly placements");
    });

    it("detects and flags unintended collisions between non-mating pieces", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      // Force piece 3 to occupy the exact same world position as piece 0
      const collidingTransforms = {
        ...pieceTransforms,
        [puzzle3d.pieces[3].pieceId]: {
          ...pieceTransforms[puzzle3d.pieces[0].pieceId],
        },
      };

      const report = validateConnectorAndAssembly({
        puzzle: puzzle3d,
        pieceTransforms: collidingTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      expect(report.noUnintendedCollisions).toBe(false);

      const failure = report.failures.find((f) => f.category === "collision");
      expect(failure).toBeDefined();
      expect(failure?.pieceId).toBeDefined();
      expect(failure?.failureReason).toContain("collision");
    });

    it("detects and flags disconnected pieces (topological fragmentation)", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      // Move piece 3 far away (1000mm in Z) so its connections fail, disconnecting it
      const disconnectedPieceId = puzzle3d.pieces[3].pieceId;
      const fragmentedTransforms = {
        ...pieceTransforms,
        [disconnectedPieceId]: {
          position: vec3(0, 0, 1000.0),
          rotation: quatIdentity(),
          scale: vec3(1, 1, 1),
        },
      };

      const report = validateConnectorAndAssembly({
        puzzle: puzzle3d,
        pieceTransforms: fragmentedTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      expect(report.noDisconnectedPieces).toBe(false);

      const failure = report.failures.find((f) => f.pieceId === disconnectedPieceId && f.category === "connectivity");
      expect(failure).toBeDefined();
      expect(failure?.failureReason).toContain("disconnected from the main assembly component");
    });

    it("detects and flags invalid transforms (NaN coordinates or non-unit quaternion)", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const invalidTransforms = {
        ...pieceTransforms,
        [puzzle3d.pieces[1].pieceId]: {
          position: vec3(Number.NaN, 0, 0),
          rotation: { x: 0, y: 0, z: 0, w: 5.0 }, // Non-unit quaternion
          scale: vec3(1, 1, 1),
        },
      };

      const report = validateConnectorAndAssembly({
        puzzle: puzzle3d,
        pieceTransforms: invalidTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      expect(report.validTransforms).toBe(false);

      const failure = report.failures.find(
        (f) => f.pieceId === puzzle3d.pieces[1].pieceId && f.category === "transform"
      );
      expect(failure).toBeDefined();
      expect(failure?.failureReason).toContain("non-finite");
    });

    it("detects and flags invalid thickness deviation from stock specification", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        pieces: puzzle3d.pieces.map((p, i) =>
          i === 0 ? { ...p, thickness: 12.0 } : p // stock is 3.0mm, piece is 12.0mm
        ),
      };

      const report = validateConnectorAndAssembly({
        puzzle: corruptPuzzle,
        pieceTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      expect(report.validThickness).toBe(false);

      const failure = report.failures.find(
        (f) => f.pieceId === corruptPuzzle.pieces[0].pieceId && f.category === "thickness"
      );
      expect(failure).toBeDefined();
      expect(failure?.failureReason).toContain("deviates from stock specification");
    });

    it("detects and flags unclosed geometry profile", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        pieces: puzzle3d.pieces.map((p, i) =>
          i === 0
            ? {
                ...p,
                profile: {
                  ...p.profile,
                  isClosed: false,
                },
              }
            : p
        ),
      };

      const report = validateConnectorAndAssembly({
        puzzle: corruptPuzzle,
        pieceTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      expect(report.validGeometry).toBe(false);

      const failure = report.failures.find(
        (f) => f.pieceId === corruptPuzzle.pieces[0].pieceId && f.category === "geometry"
      );
      expect(failure).toBeDefined();
      expect(failure?.failureReason).toContain("unclosed");
    });
  });

  describe("Exact Diagnostic Identification Contract", () => {
    it("guarantees every failure item populates all required diagnostic fields", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      // Create multiple defects simultaneously
      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        connections: puzzle3d.connections.map((c, i) => {
          if (i === 0) return { ...c, interfaceAId: "missing_iface_a" };
          if (i === 1) return { ...c, connectorType: "bad_type" as any };
          return c;
        }),
      };

      const report = validateConnectorAndAssembly({
        puzzle: corruptPuzzle,
        pieceTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      expect(report.failures.length).toBeGreaterThanOrEqual(2);

      for (const fail of report.failures) {
        expect(fail.failureReason).toBeDefined();
        expect(fail.failureReason.length).toBeGreaterThan(0);
        expect(fail.severity).toBe("error");
        expect(fail.category).toBeDefined();

        // Either pieceId or connectionId must be clearly identified
        const hasIdentifier = fail.pieceId !== undefined || fail.connectionId !== undefined;
        expect(hasIdentifier).toBe(true);
      }
    });

    it("strictly never returns isValid: true if any mandatory validation fails", () => {
      const { puzzle3d, pieceTransforms, appliedAngles } = createTestSolvedAssembly(4);

      // Corrupt just one mandatory connection
      const corruptPuzzle: ConvertedPuzzle3D = {
        ...puzzle3d,
        connections: puzzle3d.connections.map((c, i) =>
          i === 0 ? { ...c, clearanceMm: -1.0 } : c
        ),
      };

      const report = validateConnectorAndAssembly({
        puzzle: corruptPuzzle,
        pieceTransforms,
        appliedAngles,
      });

      expect(report.isValid).toBe(false);
      expect(report.summary.errorCount).toBeGreaterThan(0);
    });
  });

  describe("Non-Planar & Multi-Angle Assemblies", () => {
    it("validates a solved non-planar 90° box assembly", () => {
      const puzzle2d = Automatic2DGenerationEngine.generatePuzzle({
        targetPieceCount: 4,
        overallSize: { widthMm: 120, heightMm: 120 },
        boundaryShape: "rectangle",
        partitionStyle: "rectangular",
        material: {
          id: "plywood",
          name: "Birch Plywood",
          stockThicknessMm: 3.0,
        },
      });
      const puzzle3d = Piece3DConversionEngine.convertPuzzle(puzzle2d);

      const validAnglesMap: Record<string, any> = {};
      for (const conn of puzzle3d.connections) {
        validAnglesMap[conn.connectionId] = {
          connectionId: conn.connectionId,
          connectorType: conn.connectorType,
          validAngles: [90.0, 180.0],
          recommendedAngle: 90.0,
        };
      }

      const solved = solveAutomaticAssembly({
        puzzle: puzzle3d,
        validAngleCandidates: validAnglesMap,
        options: {
          searchStrategy: "most_connected",
        },
      });

      expect(solved.success).toBe(true);
      if (!solved.success) return;

      const report = validateConnectorAndAssembly({
        puzzle: puzzle3d,
        pieceTransforms: solved.pieceTransforms,
        appliedAngles: solved.appliedAngles,
      });

      expect(report.isValid).toBe(true);
      expect(report.noUnintendedCollisions).toBe(true);
      expect(report.allPiecesIncluded).toBe(true);
      expect(report.noDisconnectedPieces).toBe(true);
      expect(report.validTransforms).toBe(true);
    });
  });
});
