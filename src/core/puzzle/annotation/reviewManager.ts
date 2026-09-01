/**
 * Puzzle Review Manager.
 * Lightweight human review manager allowing inspection of extracted puzzle features,
 * marking evaluation status (CORRECT, INCORRECT, UNCERTAIN), and recording versioned edits.
 */
import type { CanonicalPuzzle } from "../canonical/types";
import type { AnnotationStatus, EditTarget, ManualEditRecord, VersionedPuzzleAnnotation } from "./types";
import { AnnotationStore } from "./annotationStore";

export class PuzzleReviewManager {
  private store: AnnotationStore;

  constructor(store?: AnnotationStore) {
    this.store = store || new AnnotationStore();
  }

  getStore(): AnnotationStore {
    return this.store;
  }

  /**
   * Initializes or fetches a human review session for a puzzle.
   */
  startReviewSession(puzzle: CanonicalPuzzle, reviewerId: string): VersionedPuzzleAnnotation {
    const existing = this.store.getLatestAnnotation(puzzle.metadata.id);
    if (existing) return existing;

    const initial: VersionedPuzzleAnnotation = {
      annotationId: `ann_${puzzle.metadata.id}_v1`,
      puzzleId: puzzle.metadata.id,
      version: 1,
      status: "UNCERTAIN",
      edits: [],
      reviewerId,
      createdIso: new Date().toISOString(),
      lastModifiedIso: new Date().toISOString(),
    };

    this.store.saveAnnotation(initial);
    return initial;
  }

  /**
   * Marks reviewer evaluation status (CORRECT, INCORRECT, UNCERTAIN).
   */
  markStatus(puzzleId: string, status: AnnotationStatus, reviewerId: string, notes?: string): VersionedPuzzleAnnotation {
    const current = this.store.getLatestAnnotation(puzzleId);
    const newVersion = current ? current.version + 1 : 1;

    const updated: VersionedPuzzleAnnotation = {
      annotationId: `ann_${puzzleId}_v${newVersion}`,
      puzzleId,
      version: newVersion,
      status,
      edits: current ? [...current.edits] : [],
      reviewerId,
      notes: notes || current?.notes,
      createdIso: current ? current.createdIso : new Date().toISOString(),
      lastModifiedIso: new Date().toISOString(),
    };

    this.store.saveAnnotation(updated);
    return updated;
  }

  /**
   * Records a manual edit (piece ID, interface ID, connection, parameter, joining angle, constraint).
   */
  recordEdit(
    puzzleId: string,
    reviewerId: string,
    target: EditTarget,
    targetId: string,
    oldValue: unknown,
    newValue: unknown,
    reason?: string
  ): VersionedPuzzleAnnotation {
    const current = this.store.getLatestAnnotation(puzzleId);
    const newVersion = current ? current.version + 1 : 1;

    const editRecord: ManualEditRecord = {
      editId: `edit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      reviewerId,
      target,
      targetId,
      oldValue,
      newValue,
      reason,
    };

    const updatedEdits = current ? [...current.edits, editRecord] : [editRecord];

    const updated: VersionedPuzzleAnnotation = {
      annotationId: `ann_${puzzleId}_v${newVersion}`,
      puzzleId,
      version: newVersion,
      status: current ? current.status : "UNCERTAIN",
      edits: updatedEdits,
      reviewerId,
      notes: current?.notes,
      createdIso: current ? current.createdIso : new Date().toISOString(),
      lastModifiedIso: new Date().toISOString(),
    };

    this.store.saveAnnotation(updated);
    return updated;
  }
}
