import { describe, expect, it } from "vitest";
import {
  AssemblyHistory,
  AssemblyStateEngine,
  type AssemblyPieceState,
} from "../core/puzzle/assemblystate";
import {
  ConnectionModelFactory,
  type Advanced3DConnection,
} from "../core/puzzle/connection";
import type { CoordinateFrame3D, RigidTransform3D } from "../core/puzzle/framesystem/types";
import { quatIdentity, vec3 } from "../core/puzzle/geometry/math3d";

function makeFrame(origin = vec3(0, 0, 0)): CoordinateFrame3D {
  return {
    origin,
    tangent: vec3(1, 0, 0),
    normal: vec3(0, 1, 0),
    binormal: vec3(0, 0, 1),
  };
}

function makePieces(): AssemblyPieceState[] {
  return [
    {
      pieceId: "p1_base",
      name: "Base Board",
      dimensions: { width: 120, height: 80, thickness: 3.0 },
      interfaceIds: ["if_p1_1"],
      isPlaced: false,
    },
    {
      pieceId: "p2_wall",
      name: "Side Wall",
      dimensions: { width: 80, height: 60, thickness: 3.0 },
      interfaceIds: ["if_p2_1"],
      isPlaced: false,
    },
  ];
}

function makeConnection(): Advanced3DConnection {
  return ConnectionModelFactory.createFixedConnection({
    interfaceAId: "if_p1_1",
    interfaceBId: "if_p2_1",
    pieceAId: "p1_base",
    pieceBId: "p2_wall",
    frameA: makeFrame(vec3(60, 0, 0)),
    frameB: makeFrame(vec3(0, 0, 0)),
    joiningAngleDeg: 90.0,
    clearance: 0.1,
  });
}

describe("Phase 66: Formal 3D Assembly State & Transition Representation", () => {
  describe("1. Formal Complete 3D AssemblyState Representation", () => {
    it("initializes complete AssemblyState with all 10 required domains", () => {
      const pieces = makePieces();
      const conn = makeConnection();
      const stateA = AssemblyStateEngine.createInitialState(pieces, [conn]);

      // 1. All pieces
      expect(stateA.pieces).toHaveLength(2);
      expect(stateA.pieces[0].pieceId).toBe("p1_base");

      // 2. Piece transforms
      expect(stateA.pieceTransforms).toBeDefined();
      expect(stateA.pieceTransforms["p1_base"]).toBeDefined();
      expect(stateA.pieceTransforms["p2_wall"]).toBeDefined();

      // 3 & 4. Active and Inactive connections
      expect(stateA.activeConnections).toHaveLength(0);
      expect(stateA.inactiveConnections).toHaveLength(1);
      expect(stateA.inactiveConnections[0].id).toBe(conn.id);

      // 5. Contact states
      expect(stateA.contactStates).toBeDefined();
      expect(Array.isArray(stateA.contactStates)).toBe(true);

      // 6. Assembly sequence
      expect(stateA.assemblySequence).toHaveLength(0);

      // 7. Degrees of freedom
      expect(stateA.degreesOfFreedom).toBeDefined();
      expect(stateA.degreesOfFreedom["p1_base"]).toBeDefined();

      // 8. Constraints
      expect(stateA.constraints).toBeDefined();

      // 9. Collision state
      expect(stateA.collisionState).toBeDefined();
      expect(stateA.collisionState.hasCollision).toBe(false);

      // 10. Clearance state
      expect(stateA.clearanceState).toBeDefined();
      expect(stateA.clearanceState.isWithinTolerance).toBe(true);

      // Immutability
      expect(Object.isFrozen(stateA)).toBe(true);
      expect(stateA.version).toBe(1);
    });
  });

  describe("2. State Transition Pipeline: State A -> Insert -> State B -> Rotate -> State C", () => {
    it("executes immutable transitions and verifies state evolution", () => {
      const pieces = makePieces();
      const conn = makeConnection();

      // Step 1: Initial State A
      const stateA = AssemblyStateEngine.createInitialState(pieces, [conn]);
      expect(stateA.version).toBe(1);
      expect(stateA.pieces[0].isPlaced).toBe(false);
      expect(stateA.assemblySequence).toHaveLength(0);

      // Step 2: Insert piece -> State B
      const initialTransform: RigidTransform3D = {
        position: vec3(0, 0, 0),
        rotation: quatIdentity(),
        scale: vec3(1, 1, 1),
      };
      const { nextState: stateB, transition: trans1 } = AssemblyStateEngine.insertPiece(
        stateA,
        "p1_base",
        initialTransform
      );

      expect(stateB.version).toBe(2);
      expect(stateB.pieces[0].isPlaced).toBe(true);
      expect(stateB.assemblySequence).toHaveLength(1);
      expect(stateB.assemblySequence[0].action).toBe("INSERT_PIECE");
      expect(trans1.type).toBe("INSERT_PIECE");

      // CRITICAL IMMUTABILITY CHECK: State A must remain strictly untouched!
      expect(stateA.version).toBe(1);
      expect(stateA.pieces[0].isPlaced).toBe(false);
      expect(stateA.assemblySequence).toHaveLength(0);

      // Step 3: Rotate piece -> State C
      const { nextState: stateC, transition: trans2 } = AssemblyStateEngine.rotatePiece(
        stateB,
        "p1_base",
        vec3(0, 0, 1),
        45.0
      );

      expect(stateC.version).toBe(3);
      expect(stateC.assemblySequence).toHaveLength(2);
      expect(stateC.assemblySequence[1].action).toBe("ROTATE_PIECE");
      expect(trans2.type).toBe("ROTATE_PIECE");

      // Verify rotation transform changed in State C but remained original in State B
      expect(stateC.pieceTransforms["p1_base"].rotation).not.toEqual(
        stateB.pieceTransforms["p1_base"].rotation
      );
      expect(stateB.version).toBe(2);
    });
  });

  describe("3. Active vs Inactive Connections & Contact States", () => {
    it("activates connections, generates contact patches, and reduces DOFs", () => {
      const pieces = makePieces();
      const conn = makeConnection();
      const stateA = AssemblyStateEngine.createInitialState(pieces, [conn]);

      // Place both pieces
      const { nextState: stateB } = AssemblyStateEngine.insertPiece(stateA, "p1_base");
      const { nextState: stateC } = AssemblyStateEngine.insertPiece(stateB, "p2_wall");

      expect(stateC.activeConnections).toHaveLength(0);
      expect(stateC.inactiveConnections).toHaveLength(1);
      expect(stateC.contactStates).toHaveLength(0);

      // Activate connection
      const { nextState: stateD, transition } = AssemblyStateEngine.activateConnection(
        stateC,
        conn.id
      );

      expect(transition.success).toBe(true);
      expect(stateD.activeConnections).toHaveLength(1);
      expect(stateD.inactiveConnections).toHaveLength(0);
      expect(stateD.activeConnections[0].id).toBe(conn.id);

      // Contact states generated
      expect(stateD.contactStates.length).toBeGreaterThan(0);
      expect(stateD.contactStates[0].isActive).toBe(true);
      expect(stateD.contactStates[0].separationMm).toBe(0.1);

      // DOFs updated: placed pieces connected by FIXED joint become fully constrained
      const dofP2 = stateD.degreesOfFreedom["p2_wall"];
      expect(dofP2.isFullyConstrained).toBe(true);
      expect(dofP2.translationalDOF).toBe(0);
      expect(dofP2.rotationalDOF).toBe(0);
      expect(stateD.isLocked).toBe(true);
    });
  });

  describe("4. AssemblyHistory & Snapshot Management (Undo / Redo / Checksums)", () => {
    it("manages linear history, supports undo/redo, and produces valid cryptographic snapshots", () => {
      const pieces = makePieces();
      const conn = makeConnection();
      const history = AssemblyHistory.fromPieces(pieces, [conn]);

      expect(history.currentStepIndex).toBe(0);
      expect(history.currentState.version).toBe(1);
      expect(history.canUndo()).toBe(false);

      // Transition 1: Insert p1
      history.insertPiece("p1_base");
      expect(history.currentStepIndex).toBe(1);
      expect(history.currentState.version).toBe(2);
      expect(history.canUndo()).toBe(true);

      // Transition 2: Insert p2
      history.insertPiece("p2_wall");
      expect(history.currentStepIndex).toBe(2);
      expect(history.currentState.version).toBe(3);

      // Transition 3: Rotate p2
      history.rotatePiece("p2_wall", vec3(0, 1, 0), 90.0);
      expect(history.currentStepIndex).toBe(3);
      expect(history.currentState.version).toBe(4);

      // Verify snapshots generated at each step
      expect(history.snapshots.length).toBeGreaterThanOrEqual(4);
      for (const snap of history.snapshots) {
        expect(snap.checksum).toBeDefined();
        expect(snap.checksum).toHaveLength(64); // SHA-256 hex string length
        expect(snap.state).toBeDefined();
      }

      // Undo 1 step (back to step 2)
      const undoneState1 = history.undo();
      expect(history.currentStepIndex).toBe(2);
      expect(undoneState1.version).toBe(3);
      expect(history.canRedo()).toBe(true);

      // Undo another step (back to step 1)
      const undoneState2 = history.undo();
      expect(history.currentStepIndex).toBe(1);
      expect(undoneState2.version).toBe(2);

      // Redo back to step 2
      const redoneState = history.redo();
      expect(history.currentStepIndex).toBe(2);
      expect(redoneState.version).toBe(3);
    });
  });
});
