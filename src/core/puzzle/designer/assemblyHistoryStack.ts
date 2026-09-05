/**
 * Assembly State History Stack (Prompt 109).
 *
 * Professional undo/redo for assembly operations:
 *  - Stores immutable snapshots of PieceTransforms and applied angles
 *  - Supports Undo, Redo, Reset, and Checkpoint restore
 *  - Formats human-readable chronological event logs
 *  - Zero geometry mutation: tracks transforms only
 */

import type { PieceTransforms } from "../assembly3d/types";
import type { AssemblyStepHistoryEntry } from "./types";

export interface AssemblyCheckpoint {
  id: string;
  name: string;
  timestamp: string;
  entry: AssemblyStepHistoryEntry;
}

export class AssemblyHistoryStack {
  private history: AssemblyStepHistoryEntry[] = [];
  private currentIndex = -1;
  private checkpoints: Map<string, AssemblyCheckpoint> = new Map();
  private maxStackDepth = 100;

  constructor(initialEntry?: Omit<AssemblyStepHistoryEntry, "id" | "timestamp">) {
    if (initialEntry) {
      this.pushAction(initialEntry);
    }
  }

  public getHistory(): readonly AssemblyStepHistoryEntry[] {
    return this.history;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentEntry(): AssemblyStepHistoryEntry | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) return null;
    return this.history[this.currentIndex];
  }

  public canUndo(): boolean {
    return this.currentIndex > 0;
  }

  public canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  public pushAction(action: Omit<AssemblyStepHistoryEntry, "id" | "timestamp">): AssemblyStepHistoryEntry {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const id = `hist_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`;

    const newEntry: AssemblyStepHistoryEntry = {
      id,
      timestamp: timeStr,
      description: action.description,
      actionType: action.actionType,
      pieceTransforms: JSON.parse(JSON.stringify(action.pieceTransforms)),
      appliedAngles: { ...action.appliedAngles },
      connectedPairs: [...action.connectedPairs],
      validationStatus: action.validationStatus,
    };

    // Drop any redo history beyond current index
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(newEntry);

    // Limit stack size
    if (this.history.length > this.maxStackDepth) {
      this.history.shift();
    }

    this.currentIndex = this.history.length - 1;
    return newEntry;
  }

  public undo(): AssemblyStepHistoryEntry | null {
    if (!this.canUndo()) return null;
    this.currentIndex--;
    return this.history[this.currentIndex];
  }

  public redo(): AssemblyStepHistoryEntry | null {
    if (!this.canRedo()) return null;
    this.currentIndex++;
    return this.history[this.currentIndex];
  }

  public resetToStart(): AssemblyStepHistoryEntry | null {
    if (this.history.length === 0) return null;
    this.currentIndex = 0;
    return this.history[0];
  }

  public saveCheckpoint(name: string): AssemblyCheckpoint | null {
    const current = this.getCurrentEntry();
    if (!current) return null;

    const checkpoint: AssemblyCheckpoint = {
      id: `chk_${Date.now()}`,
      name,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      entry: JSON.parse(JSON.stringify(current)),
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
    return checkpoint;
  }

  public restoreCheckpoint(checkpointId: string): AssemblyStepHistoryEntry | null {
    const cp = this.checkpoints.get(checkpointId);
    if (!cp) return null;

    return this.pushAction({
      description: `Restored checkpoint: ${cp.name}`,
      actionType: "reset",
      pieceTransforms: cp.entry.pieceTransforms,
      appliedAngles: cp.entry.appliedAngles,
      connectedPairs: cp.entry.connectedPairs,
      validationStatus: cp.entry.validationStatus,
    });
  }

  public clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.checkpoints.clear();
  }
}
