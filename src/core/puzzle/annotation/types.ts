/**
 * Dataset Annotation & Human Review Subsystem Types (Step 37).
 */
export type AnnotationStatus = "CORRECT" | "INCORRECT" | "UNCERTAIN";

export type EditTarget =
  | "piece_id"
  | "interface_id"
  | "connection"
  | "parameter"
  | "joining_angle"
  | "constraint";

export interface ManualEditRecord {
  editId: string;
  timestamp: string;
  reviewerId: string;
  target: EditTarget;
  targetId: string;
  oldValue: unknown;
  newValue: unknown;
  reason?: string;
}

export interface VersionedPuzzleAnnotation {
  annotationId: string;
  puzzleId: string;
  version: number;
  status: AnnotationStatus;
  edits: ManualEditRecord[];
  reviewerId: string;
  notes?: string;
  createdIso: string;
  lastModifiedIso: string;
}

export interface AnnotationFilter {
  puzzleId?: string;
  status?: AnnotationStatus;
  reviewerId?: string;
  minVersion?: number;
}
