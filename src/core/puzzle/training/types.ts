/**
 * Training Data Architecture Types & Schemas.
 *
 * Defines the complete 17-stage parametric puzzle lifecycle schema for future ML dataset collection.
 *
 * Explicitly preserves the distinction between:
 *  - DESIGN PARAMETERS (native 2D geometry, dimensions, local frames, profiles)
 *  - ASSEMBLY PARAMETERS (3D spatial transforms, joining angles, insertion sequences)
 */
import type { ID, Vec2, Vec3 } from "@/core/model/types";
import type { ValidationDomain } from "../unifiedvalidation/types";

export interface PieceExample {
  pieceId: ID;
  name: string;
  /** DESIGN PARAMETER: Native 2D dimensions in piece-local space (mm). */
  designParameters: {
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
    tabWidthMm?: number;
    tabDepthMm?: number;
  };
  /** 2D boundary polygon vertices in piece-local coordinate space. */
  localPolygon2D: Vec2[];
  /** 3D local solid representation mesh bounds. */
  localSolid3DBounds: {
    min: Vec3;
    max: Vec3;
  };
}

export interface InterfaceExample {
  interfaceId: ID;
  owningPieceId: ID;
  interfaceType: "tab" | "slot" | "finger" | "dovetail" | "miter" | "butt" | "custom";
  genderRole: "insert" | "receiver" | "neutral";
  profileWidthMm: number;
  profileDepthMm: number;
  /** Local 3D coordinate frame. */
  localFrame: {
    origin: Vec3;
    tangent: Vec3;
    normal: Vec3;
    binormal: Vec3;
  };
}

export interface ConnectionExample {
  connectionId: ID;
  interfaceAId: ID;
  interfaceBId: ID;
  connectionType: string;
  /** ASSEMBLY PARAMETER: 3D joining angle at joint (degrees, e.g. 0, 30, 45, 60, 90). */
  joiningAngleDeg: number;
}

export interface AssemblyExample {
  /** ASSEMBLY PARAMETER: 3D spatial rigid transforms per piece. */
  pieceTransforms: Record<
    ID,
    {
      position: Vec3;
      rotationQuaternion: { x: number; y: number; z: number; w: number };
    }
  >;
  /** ASSEMBLY PARAMETER: Explicit step-by-step assembly sequence (e.g. ["P01", "P01 + P02"]). */
  assemblySequence: Array<{
    stepNumber: number;
    addedPieceId: ID;
    subAssemblyStateLabel: string;
  }>;
}

export interface ConstraintExample {
  constraintId: ID;
  constraintType: string;
  severity: "HARD" | "SOFT";
  parameters: Record<string, number | string | boolean>;
}

export interface ValidationExample {
  isValid: boolean;
  overallScore: number;
  domainSummaries: Record<
    ValidationDomain,
    {
      isValid: boolean;
      errorCount: number;
      warningCount: number;
    }
  >;
}

export interface RepairExample {
  issueId: ID;
  domain: ValidationDomain;
  targetEntityId: ID;
  defectCode: string;
  suggestedRemediation: string;
  remediationParams?: Record<string, number | string | boolean>;
}

export interface PuzzleExample {
  puzzleId: ID;
  name: string;
  materialSpecification: {
    stockWidthMm: number;
    stockHeightMm: number;
    thicknessMm: number;
    materialId: ID;
  };
}

/**
 * Complete 17-Step Parametric Puzzle Lifecycle Dataset Item Schema.
 */
export interface CompleteDatasetItem {
  /** Dataset item unique identifier. */
  itemId: ID;
  version: "1.0.0";
  metadata: {
    createdAt: string;
    license: "Proprietary / Synthetic Test";
  };

  // 1. User Requirement
  userRequirement: {
    prompt: string;
    targetDifficulty: "easy" | "medium" | "hard" | "expert";
  };

  // 2. Source 2D Drawing (optional path)
  source2DDrawingPath?: string;

  // 3. Piece Segmentation
  segmentationContours: Record<ID, Vec2[]>;

  // 4. Piece Geometry & 7. Parametric Dimensions
  pieces: PieceExample[];

  // 5. Interface Definitions
  interfaces: InterfaceExample[];

  // 6. Connection Graph & 11. Joining Angles
  connections: ConnectionExample[];

  // 8. Material Specification & Puzzle Metadata
  puzzle: PuzzleExample;

  // 9. 3D Piece Representation (local solid bounds)
  pieceSolids3D: Record<ID, { min: Vec3; max: Vec3 }>;

  // 10. Assembly Transforms & 12. Assembly Sequence
  assembly: AssemblyExample;

  // 13. Constraints
  constraints: ConstraintExample[];

  // 14. Validation Results & 15. Valid/Invalid Status
  validation: ValidationExample;

  // 16. Failure Reasons
  failureReasons: string[];

  // 17. Repaired Design If Available
  repairedDirectives: RepairExample[];

  // Legacy compatibility optional fields
  sampleId?: ID;
  category?: string;
  edgeFeatures?: any[];
  groundTruthAssembly?: any;
  joiningAngleTargets?: Record<string, number>;
}

export type TrainingSample = Partial<CompleteDatasetItem>;

export interface DatasetExportOptions {
  includeSolids?: boolean;
  includeValidation?: boolean;
  license?: string;
}

export interface DatasetExporter {
  exportSample(sample: TrainingSample): Promise<string>;
  batchGenerateSamples(count: number): Promise<TrainingSample[]>;
  exportPuzzleToDatasetItem(
    puzzle: any,
    placements?: any,
    solids?: any,
    graph?: any,
    validationReport?: any,
    options?: DatasetExportOptions,
  ): Promise<CompleteDatasetItem>;
}

export interface DatasetImporter {
  importDatasetItem(jsonInput: string): Promise<CompleteDatasetItem>;
  reconstructCanonicalPuzzle(item: CompleteDatasetItem): Promise<{
    puzzle: any;
    placements: any;
    graph: any;
  }>;
}

export type FormatKind = "PNG" | "SVG" | "DXF" | "STEP" | "STL" | "JSON";

export interface FormatAdapter<TInput = any, TOutput = any> {
  formatKind: FormatKind;
  description: string;
  importToCanonical(inputData: TInput): Promise<any>;
  exportFromCanonical(puzzle: any): Promise<TOutput>;
}
