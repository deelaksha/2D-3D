/**
 * Assembly History & Snapshot Management (Phase 66).
 *
 * Manages versioned assembly snapshots, transition logs, undo/redo state stacks,
 * and deterministic checksums for state integrity verification.
 */
import { createHash } from "crypto";
import type { ID, Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type {
  AssemblyPieceState,
  AssemblySnapshot,
  AssemblyState,
  AssemblyTransition,
} from "./types";
import { AssemblyStateEngine } from "./assemblyStateEngine";
import type { Advanced3DConnection } from "../connection/types";
import { uid } from "@/core/model/ids";

export class AssemblyHistory {
  private _snapshots: AssemblySnapshot[] = [];
  private _transitions: AssemblyTransition[] = [];
  private _historyStates: AssemblyState[] = [];
  private _currentIndex = 0;

  constructor(initialState: AssemblyState) {
    this._historyStates = [initialState];
    this._snapshots = [this.buildSnapshot(initialState, 0, "Initial State")];
    this._currentIndex = 0;
  }

  /**
   * Initializes history from raw pieces and connections.
   */
  static fromPieces(
    pieces: AssemblyPieceState[],
    connections: Advanced3DConnection[] = []
  ): AssemblyHistory {
    const init = AssemblyStateEngine.createInitialState(pieces, connections);
    return new AssemblyHistory(init);
  }

  get currentState(): AssemblyState {
    return this._historyStates[this._currentIndex];
  }

  get currentStepIndex(): number {
    return this._currentIndex;
  }

  get snapshots(): readonly AssemblySnapshot[] {
    return this._snapshots;
  }

  get transitions(): readonly AssemblyTransition[] {
    return this._transitions;
  }

  canUndo(): boolean {
    return this._currentIndex > 0;
  }

  canRedo(): boolean {
    return this._currentIndex < this._historyStates.length - 1;
  }

  /**
   * Undoes the last transition step.
   */
  undo(): AssemblyState {
    if (!this.canUndo()) {
      throw new Error("Cannot undo: already at the earliest assembly state.");
    }
    this._currentIndex--;
    return this.currentState;
  }

  /**
   * Redoes the previously undone transition step.
   */
  redo(): AssemblyState {
    if (!this.canRedo()) {
      throw new Error("Cannot redo: already at the latest assembly state.");
    }
    this._currentIndex++;
    return this.currentState;
  }

  /**
   * Inserts a piece into the assembly.
   */
  insertPiece(pieceId: ID, transform?: RigidTransform3D): AssemblyState {
    const { nextState, transition } = AssemblyStateEngine.insertPiece(
      this.currentState,
      pieceId,
      transform
    );
    return this.commitTransition(nextState, transition, `Insert piece '${pieceId}'`);
  }

  /**
   * Rotates a piece in the assembly.
   */
  rotatePiece(pieceId: ID, rotationAxis: Vec3, angleDeg: number): AssemblyState {
    const { nextState, transition } = AssemblyStateEngine.rotatePiece(
      this.currentState,
      pieceId,
      rotationAxis,
      angleDeg
    );
    return this.commitTransition(
      nextState,
      transition,
      `Rotate piece '${pieceId}' ${angleDeg}°`
    );
  }

  /**
   * Translates a piece in the assembly.
   */
  translatePiece(pieceId: ID, translationVector: Vec3): AssemblyState {
    const { nextState, transition } = AssemblyStateEngine.translatePiece(
      this.currentState,
      pieceId,
      translationVector
    );
    return this.commitTransition(
      nextState,
      transition,
      `Translate piece '${pieceId}'`
    );
  }

  /**
   * Activates a connection between pieces.
   */
  activateConnection(connectionId: ID): AssemblyState {
    const { nextState, transition } = AssemblyStateEngine.activateConnection(
      this.currentState,
      connectionId
    );
    return this.commitTransition(
      nextState,
      transition,
      `Activate connection '${connectionId}'`
    );
  }

  /**
   * Creates an explicit named snapshot at the current state.
   */
  createNamedSnapshot(label: string): AssemblySnapshot {
    const snap = this.buildSnapshot(this.currentState, this._currentIndex, label);
    this._snapshots.push(snap);
    return snap;
  }

  /**
   * Retrieves a snapshot by step index.
   */
  getSnapshotByStep(stepIndex: number): AssemblySnapshot | undefined {
    return this._snapshots.find((s) => s.stepIndex === stepIndex);
  }

  /* ------------------------------------------------------------------ */
  /* Internal helpers                                                   */
  /* ------------------------------------------------------------------ */

  private commitTransition(
    nextState: AssemblyState,
    transition: AssemblyTransition,
    label: string
  ): AssemblyState {
    // Truncate forward redo history if we are in the middle of undo stack
    if (this._currentIndex < this._historyStates.length - 1) {
      this._historyStates = this._historyStates.slice(0, this._currentIndex + 1);
      this._transitions = this._transitions.slice(0, this._currentIndex);
      this._snapshots = this._snapshots.filter((s) => s.stepIndex <= this._currentIndex);
    }

    this._historyStates.push(nextState);
    this._transitions.push(transition);
    this._currentIndex++;

    const snap = this.buildSnapshot(nextState, this._currentIndex, label);
    this._snapshots.push(snap);

    return nextState;
  }

  private buildSnapshot(state: AssemblyState, stepIndex: number, label: string): AssemblySnapshot {
    const checksum = this.computeStateChecksum(state);
    return Object.freeze({
      snapshotId: uid("snap_"),
      stepIndex,
      state,
      checksum,
      label,
      createdAt: Date.now(),
    });
  }

  private computeStateChecksum(state: AssemblyState): string {
    const summary = {
      stateId: state.stateId,
      version: state.version,
      pieces: state.pieces.map((p) => ({ id: p.pieceId, placed: p.isPlaced })),
      transforms: state.pieceTransforms,
      activeConns: state.activeConnections.map((c) => c.id),
      inactiveConns: state.inactiveConnections.map((c) => c.id),
      contacts: state.contactStates.length,
      sequenceLength: state.assemblySequence.length,
      isLocked: state.isLocked,
    };
    return createHash("sha256").update(JSON.stringify(summary)).digest("hex");
  }
}
