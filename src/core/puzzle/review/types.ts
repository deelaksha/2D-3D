/**
 * Human-in-the-Loop Annotation & Review Subsystem Types (Phase 62).
 *
 * Implements strict data structures for inspecting machine-extracted puzzle
 * data across 11 domains, allowing manual edits across 9 targets, preserving
 * original source data immutability, tracking event history, and enforcing
 * reviewer-independent validation.
 */
import type { ID, Vec2, Vec3 } from "@/core/model/types";
import type { RealDatasetExample, TriStageValidationResult } from "../realdata/types";

/**
 * 5 Lifecycle states of a dataset example in the human review queue.
 */
export type AnnotationState =
  | "UNREVIEWED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "NEEDS_CORRECTION";

/**
 * The 9 allowed manual editing targets.
 */
export type ReviewEditableTarget =
  | "piece_boundary"
  | "piece_id"
  | "interface_id"
  | "interface_type"
  | "connection_relationship"
  | "parameter"
  | "assembly_transform"
  | "allowed_angle"
  | "constraint";

/**
 * Event-sourced modification record.
 * Every edit creates an immutable record in the session history.
 */
export interface AnnotationEvent {
  eventId: string;
  timestamp: string;
  reviewerId: string;
  target: ReviewEditableTarget;
  targetId: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  validationSummary?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * Strongly-typed Inspection Snapshot covering all 11 inspection domains.
 */
export interface InspectionSnapshot {
  exampleId: string;
  state: AnnotationState;

  // 1. Source Drawing
  sourceDrawing: {
    sourceFile: string;
    detectedFormat: string;
    sizeBytes: number;
    sha256: string;
    drawingPath?: string;
  };

  // 2. Pieces
  pieces: Array<{
    pieceId: ID;
    name: string;
    materialId: ID;
    vertexCount: number;
  }>;

  // 3. Piece Boundaries
  pieceBoundaries: Record<
    ID,
    {
      loop: Vec2[];
      area: number;
      perimeter: number;
      isClosed: boolean;
    }
  >;

  // 4. Interfaces
  interfaces: Array<{
    interfaceId: ID;
    owningPieceId: ID;
    type: string;
    genderRole: string;
    widthMm: number;
    depthMm: number;
    normal: Vec3;
  }>;

  // 5. Connection Graph
  connectionGraph: {
    nodeCount: number;
    edgeCount: number;
    isFullyConnected: boolean;
    connectedComponentsCount: number;
    edges: Array<{
      connectionId: ID;
      interfaceAId: ID;
      interfaceBId: ID;
      pieceAId?: ID;
      pieceBId?: ID;
      angleDeg: number;
    }>;
  };

  // 6. Dimensions
  dimensions: Record<
    ID,
    {
      widthMm: number;
      heightMm: number;
      thicknessMm: number;
    }
  >;

  // 7. Parametric Features
  parametricFeatures: Array<{
    featureId: string;
    owningPieceId: ID;
    name: string;
    type: string;
    value: number | string;
  }>;

  // 8. Material Constraints
  materialConstraints: {
    stockWidthMm: number;
    stockHeightMm: number;
    thicknessMm: number;
    materialId: ID;
    grainAngleDeg?: number;
    kerf?: number;
  };

  // 9. 3D Reconstruction
  reconstruction3D: Record<
    ID,
    {
      min: Vec3;
      max: Vec3;
      volumeEstimateMm3: number;
    }
  >;

  // 10. Assembly Transforms
  assemblyTransforms: {
    pieceTransforms: Record<
      ID,
      {
        position: Vec3;
        rotationQuaternion: { x: number; y: number; z: number; w: number };
      }
    >;
    assemblySequence: Array<{
      stepNumber: number;
      addedPieceId: ID;
      subAssemblyStateLabel: string;
    }>;
  };

  // 11. Validation Results
  validationResults: {
    isValid: boolean;
    overallScore: number;
    failureReasons: string[];
    reviewReasons: string[];
    geometryValid: boolean;
    connectionValid: boolean;
    assemblyValid: boolean;
  };
}

/**
 * Review session record holding original immutable data, current working copy,
 * event audit trail, and state machine transitions.
 */
export interface ReviewSessionRecord {
  sessionId: string;
  exampleId: string;
  sourceFile: string;
  state: AnnotationState;
  /**
   * IMMUTABLE: Original machine-extracted example from Phase 61 ingestion.
   * Never modified or overwritten.
   */
  readonly originalExample: RealDatasetExample;
  /**
   * Working draft copy with human reviewer edits applied.
   */
  currentExample: RealDatasetExample;
  /**
   * Append-only event history of all modifications.
   */
  history: AnnotationEvent[];
  assignedReviewerId?: string;
  createdIso: string;
  updatedIso: string;
  independentValidation: TriStageValidationResult;
  reviewNotes?: string;
  approvalAudit?: {
    approvedBy: string;
    approvedAt: string;
    validationScore: number;
  };
}

export interface ReviewSessionFilter {
  state?: AnnotationState;
  reviewerId?: string;
  sourceFormat?: string;
  searchQuery?: string;
}

export interface ReviewWorkflowSummary {
  totalSessions: number;
  unreviewedCount: number;
  inReviewCount: number;
  approvedCount: number;
  rejectedCount: number;
  needsCorrectionCount: number;
  totalEditsApplied: number;
  averageValidationScore: number;
}
