/**
 * Annotation Store.
 * Manages versioned human review annotations without mutating original source dataset files.
 */
import type { AnnotationFilter, VersionedPuzzleAnnotation } from "./types";

export class AnnotationStore {
  private store = new Map<string, VersionedPuzzleAnnotation[]>();

  saveAnnotation(annotation: VersionedPuzzleAnnotation): void {
    const list = this.store.get(annotation.puzzleId) || [];
    list.push(annotation);
    this.store.set(annotation.puzzleId, list);
  }

  getLatestAnnotation(puzzleId: string): VersionedPuzzleAnnotation | undefined {
    const list = this.store.get(puzzleId);
    if (!list || list.length === 0) return undefined;
    return list[list.length - 1];
  }

  getAllVersions(puzzleId: string): VersionedPuzzleAnnotation[] {
    return this.store.get(puzzleId) || [];
  }

  query(filter: AnnotationFilter): VersionedPuzzleAnnotation[] {
    const results: VersionedPuzzleAnnotation[] = [];
    for (const list of this.store.values()) {
      for (const item of list) {
        if (filter.puzzleId && item.puzzleId !== filter.puzzleId) continue;
        if (filter.status && item.status !== filter.status) continue;
        if (filter.reviewerId && item.reviewerId !== filter.reviewerId) continue;
        if (filter.minVersion && item.version < filter.minVersion) continue;
        results.push(item);
      }
    }
    return results;
  }
}
