/**
 * Assembly State Transition Engine (Phase 66).
 *
 * Implements immutable, versioned state transitions:
 *   AssemblyState A -> insert piece -> AssemblyState B -> rotate piece -> AssemblyState C
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { Advanced3DConnection } from "../connection/types";
import type {
  AssemblyClearanceState,
  AssemblyCollisionState,
  AssemblyConstraintState,
  AssemblyPieceState,
  AssemblySequenceStep,
  AssemblyState,
  AssemblyTransition,
  ContactState3D,
} from "./types";
import { uid } from "@/core/model/ids";
import {
  add3,
  quatFromAxisAngle,
  quatIdentity,
  quatMultiply,
  vec3,
} from "../geometry/math3d";
import { DofCalculator } from "./dofCalculator";
import { CollisionClearanceEvaluator } from "./collisionClearanceEvaluator";

export class AssemblyStateEngine {
  /**
   * Initializes a formal AssemblyState (State A).
   */
  static createInitialState(
    pieces: AssemblyPieceState[],
    connections: Advanced3DConnection[] = [],
    initialTransforms: Record<ID, RigidTransform3D> = {}
  ): AssemblyState {
    const stateId = uid("state_");
    const activeConnections: Advanced3DConnection[] = [];
    const inactiveConnections = [...connections];
    const contactStates: ContactState3D[] = [];
    const assemblySequence: AssemblySequenceStep[] = [];

    // Ensure all pieces have a transform entry
    const pieceTransforms: Record<ID, RigidTransform3D> = { ...initialTransforms };
    for (const p of pieces) {
      if (!pieceTransforms[p.pieceId]) {
        pieceTransforms[p.pieceId] = {
          position: vec3(0, 0, 0),
          rotation: quatIdentity(),
          scale: vec3(1, 1, 1),
        };
      }
    }

    const dofs = DofCalculator.computeDOFs(pieces, activeConnections);
    const collisionState = CollisionClearanceEvaluator.evaluateCollision(pieces, pieceTransforms);
    const clearanceState = CollisionClearanceEvaluator.evaluateClearance(activeConnections);

    return Object.freeze({
      stateId,
      version: 1,
      timestamp: Date.now(),
      pieces: Object.freeze(pieces.map((p) => Object.freeze({ ...p }))),
      pieceTransforms: Object.freeze({ ...pieceTransforms }),
      activeConnections: Object.freeze(activeConnections),
      inactiveConnections: Object.freeze(inactiveConnections),
      contactStates: Object.freeze(contactStates),
      assemblySequence: Object.freeze(assemblySequence),
      degreesOfFreedom: Object.freeze(dofs),
      constraints: Object.freeze([]),
      collisionState,
      clearanceState,
      isLocked: false,
    });
  }

  /**
   * Inserts a piece into the assembly: State A -> insert piece -> State B.
   */
  static insertPiece(
    currentState: AssemblyState,
    pieceId: ID,
    transform?: RigidTransform3D
  ): { nextState: AssemblyState; transition: AssemblyTransition } {
    const piece = currentState.pieces.find((p) => p.pieceId === pieceId);
    if (!piece) {
      throw new Error(`Piece '${pieceId}' not found in assembly state '${currentState.stateId}'.`);
    }

    // New pieces list with target piece marked as placed
    const updatedPieces = currentState.pieces.map((p) =>
      p.pieceId === pieceId ? { ...p, isPlaced: true } : p
    );

    // Update transform
    const updatedTransforms = { ...currentState.pieceTransforms };
    if (transform) {
      updatedTransforms[pieceId] = transform;
    }

    // New sequence step
    const step: AssemblySequenceStep = {
      stepNumber: currentState.assemblySequence.length + 1,
      action: "INSERT_PIECE",
      targetPieceId: pieceId,
      description: `Inserted piece '${piece.name}' (${pieceId}) into assembly.`,
      timestamp: Date.now(),
    };

    const nextStateId = uid("state_");
    const dofs = DofCalculator.computeDOFs(updatedPieces, currentState.activeConnections);
    const collisionState = CollisionClearanceEvaluator.evaluateCollision(updatedPieces, updatedTransforms);
    const clearanceState = CollisionClearanceEvaluator.evaluateClearance(currentState.activeConnections);

    const nextState: AssemblyState = Object.freeze({
      stateId: nextStateId,
      version: currentState.version + 1,
      timestamp: Date.now(),
      pieces: Object.freeze(updatedPieces.map((p) => Object.freeze({ ...p }))),
      pieceTransforms: Object.freeze(updatedTransforms),
      activeConnections: currentState.activeConnections,
      inactiveConnections: currentState.inactiveConnections,
      contactStates: currentState.contactStates,
      assemblySequence: Object.freeze([...currentState.assemblySequence, step]),
      degreesOfFreedom: Object.freeze(dofs),
      constraints: currentState.constraints,
      collisionState,
      clearanceState,
      isLocked: currentState.isLocked,
    });

    const transition: AssemblyTransition = Object.freeze({
      transitionId: uid("trans_"),
      fromStateId: currentState.stateId,
      toStateId: nextStateId,
      type: "INSERT_PIECE",
      params: { pieceId, initialTransform: transform },
      timestamp: Date.now(),
      success: true,
      message: `Successfully inserted piece '${pieceId}'.`,
    });

    return { nextState, transition };
  }

  /**
   * Rotates a piece: State B -> rotate piece -> State C.
   */
  static rotatePiece(
    currentState: AssemblyState,
    pieceId: ID,
    rotationAxis: Vec3,
    angleDeg: number
  ): { nextState: AssemblyState; transition: AssemblyTransition } {
    const currentTransform = currentState.pieceTransforms[pieceId];
    if (!currentTransform) {
      throw new Error(`Piece '${pieceId}' transform not found in assembly state '${currentState.stateId}'.`);
    }

    const angleRad = (angleDeg * Math.PI) / 180.0;
    const qDelta = quatFromAxisAngle(rotationAxis, angleRad);
    const newRotation = quatMultiply(qDelta, currentTransform.rotation);

    const updatedTransforms = {
      ...currentState.pieceTransforms,
      [pieceId]: {
        ...currentTransform,
        rotation: newRotation,
      },
    };

    const step: AssemblySequenceStep = {
      stepNumber: currentState.assemblySequence.length + 1,
      action: "ROTATE_PIECE",
      targetPieceId: pieceId,
      description: `Rotated piece '${pieceId}' by ${angleDeg}° around axis [${rotationAxis.x}, ${rotationAxis.y}, ${rotationAxis.z}].`,
      timestamp: Date.now(),
    };

    const nextStateId = uid("state_");
    const collisionState = CollisionClearanceEvaluator.evaluateCollision(currentState.pieces, updatedTransforms);
    const clearanceState = CollisionClearanceEvaluator.evaluateClearance(currentState.activeConnections);

    const nextState: AssemblyState = Object.freeze({
      stateId: nextStateId,
      version: currentState.version + 1,
      timestamp: Date.now(),
      pieces: currentState.pieces,
      pieceTransforms: Object.freeze(updatedTransforms),
      activeConnections: currentState.activeConnections,
      inactiveConnections: currentState.inactiveConnections,
      contactStates: currentState.contactStates,
      assemblySequence: Object.freeze([...currentState.assemblySequence, step]),
      degreesOfFreedom: currentState.degreesOfFreedom,
      constraints: currentState.constraints,
      collisionState,
      clearanceState,
      isLocked: currentState.isLocked,
    });

    const transition: AssemblyTransition = Object.freeze({
      transitionId: uid("trans_"),
      fromStateId: currentState.stateId,
      toStateId: nextStateId,
      type: "ROTATE_PIECE",
      params: { pieceId, rotationAxis, rotationAngleDeg: angleDeg },
      timestamp: Date.now(),
      success: true,
      message: `Rotated piece '${pieceId}' by ${angleDeg}°.`,
    });

    return { nextState, transition };
  }

  /**
   * Translates a piece in 3D space.
   */
  static translatePiece(
    currentState: AssemblyState,
    pieceId: ID,
    translationVector: Vec3
  ): { nextState: AssemblyState; transition: AssemblyTransition } {
    const currentTransform = currentState.pieceTransforms[pieceId];
    if (!currentTransform) {
      throw new Error(`Piece '${pieceId}' transform not found in assembly state '${currentState.stateId}'.`);
    }

    const newPosition = add3(currentTransform.position, translationVector);
    const updatedTransforms = {
      ...currentState.pieceTransforms,
      [pieceId]: {
        ...currentTransform,
        position: newPosition,
      },
    };

    const step: AssemblySequenceStep = {
      stepNumber: currentState.assemblySequence.length + 1,
      action: "TRANSLATE_PIECE",
      targetPieceId: pieceId,
      description: `Translated piece '${pieceId}' by [${translationVector.x}, ${translationVector.y}, ${translationVector.z}].`,
      timestamp: Date.now(),
    };

    const nextStateId = uid("state_");
    const collisionState = CollisionClearanceEvaluator.evaluateCollision(currentState.pieces, updatedTransforms);
    const clearanceState = CollisionClearanceEvaluator.evaluateClearance(currentState.activeConnections);

    const nextState: AssemblyState = Object.freeze({
      stateId: nextStateId,
      version: currentState.version + 1,
      timestamp: Date.now(),
      pieces: currentState.pieces,
      pieceTransforms: Object.freeze(updatedTransforms),
      activeConnections: currentState.activeConnections,
      inactiveConnections: currentState.inactiveConnections,
      contactStates: currentState.contactStates,
      assemblySequence: Object.freeze([...currentState.assemblySequence, step]),
      degreesOfFreedom: currentState.degreesOfFreedom,
      constraints: currentState.constraints,
      collisionState,
      clearanceState,
      isLocked: currentState.isLocked,
    });

    const transition: AssemblyTransition = Object.freeze({
      transitionId: uid("trans_"),
      fromStateId: currentState.stateId,
      toStateId: nextStateId,
      type: "TRANSLATE_PIECE",
      params: { pieceId, translationVector },
      timestamp: Date.now(),
      success: true,
      message: `Translated piece '${pieceId}'.`,
    });

    return { nextState, transition };
  }

  /**
   * Activates a connection between pieces, generating contact states and updating DOFs.
   */
  static activateConnection(
    currentState: AssemblyState,
    connectionId: ID
  ): { nextState: AssemblyState; transition: AssemblyTransition } {
    const conn = currentState.inactiveConnections.find((c) => c.id === connectionId);
    if (!conn) {
      throw new Error(`Connection '${connectionId}' not found in inactive connections.`);
    }

    const updatedInactive = currentState.inactiveConnections.filter((c) => c.id !== connectionId);
    const updatedActive = [...currentState.activeConnections, conn];

    // Generate contact states for connection's contact regions
    const newContacts: ContactState3D[] = conn.contactRegions.map((cr) => ({
      contactId: uid("cnt_"),
      pieceAId: conn.interfaceA.pieceId || "piece_A",
      pieceBId: conn.interfaceB.pieceId || "piece_B",
      interfaceAId: conn.interfaceA.interfaceId,
      interfaceBId: conn.interfaceB.interfaceId,
      contactType: cr.contactType,
      surfaceNormal: cr.surfaceNormal,
      contactAreaMm2: cr.contactAreaMm2,
      separationMm: conn.clearance,
      isActive: true,
    }));

    const updatedContacts = [...currentState.contactStates, ...newContacts];
    const updatedDofs = DofCalculator.computeDOFs(currentState.pieces, updatedActive);

    // Check if all placed pieces are now fully constrained
    const placedPieces = currentState.pieces.filter((p) => p.isPlaced);
    const isLocked = placedPieces.every((p) => updatedDofs[p.pieceId]?.isFullyConstrained);

    const step: AssemblySequenceStep = {
      stepNumber: currentState.assemblySequence.length + 1,
      action: "ACTIVATE_CONNECTION",
      connectionId,
      description: `Activated connection '${conn.name || connectionId}' [${conn.behavior}].`,
      timestamp: Date.now(),
    };

    const nextStateId = uid("state_");
    const clearanceState = CollisionClearanceEvaluator.evaluateClearance(updatedActive);

    const nextState: AssemblyState = Object.freeze({
      stateId: nextStateId,
      version: currentState.version + 1,
      timestamp: Date.now(),
      pieces: currentState.pieces,
      pieceTransforms: currentState.pieceTransforms,
      activeConnections: Object.freeze(updatedActive),
      inactiveConnections: Object.freeze(updatedInactive),
      contactStates: Object.freeze(updatedContacts),
      assemblySequence: Object.freeze([...currentState.assemblySequence, step]),
      degreesOfFreedom: Object.freeze(updatedDofs),
      constraints: currentState.constraints,
      collisionState: currentState.collisionState,
      clearanceState,
      isLocked,
    });

    const transition: AssemblyTransition = Object.freeze({
      transitionId: uid("trans_"),
      fromStateId: currentState.stateId,
      toStateId: nextStateId,
      type: "ACTIVATE_CONNECTION",
      params: { connectionId },
      timestamp: Date.now(),
      success: true,
      message: `Activated connection '${connectionId}'.`,
    });

    return { nextState, transition };
  }
}
