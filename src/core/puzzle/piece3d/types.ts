/**
 * Exact 3D Piece Conversion Subsystem Domain Types (Phase 86).
 *
 * Requirements:
 *  - Convert every generated 2D piece from GeneratedPuzzle2D into an exact 3D piece.
 *  - Every piece must retain:
 *      1. piece ID
 *      2. interface IDs
 *      3. connector IDs
 *      4. material
 *      5. thickness
 *      6. local coordinate frame
 *  - Do NOT assign final assembly positions yet.
 *  - Each piece exists independently in local coordinates (z in [-thickness/2, +thickness/2]).
 *  - Deterministic validation: closed profile, valid solid, correct thickness, valid connector geometry.
 */

import type { ID, Vec2, Vec3 } from "@/core/model/types";
import type { CoordinateFrame3D } from "../framesystem/types";
import type { SolidRepresentation3D } from "../solid3d/types";
import type { CanonicalInterface } from "../canonical/types";
import type { ConnectorParameters } from "../connectorgeneration/types";
import type { DesignSpecification2D, GeneratedConnection2D } from "../automatic2d/types";

/**
 * 2D Piece profile representation prepared for extrusion.
 */
export interface ExtrudablePieceProfile {
  /** Vertices in original global/sheet coordinates. */
  globalVertices: Vec2[];
  /** Vertices normalized into piece-local coordinate space (centered around local origin). */
  localVertices: Vec2[];
  /** 2D centroid of the piece in sheet coordinates. */
  centroid: Vec2;
  /** Whether the profile forms a valid closed loop. */
  isClosed: boolean;
  /** 2D planar area in mm^2. */
  areaMm2: number;
  /** 2D perimeter in mm. */
  perimeterMm: number;
  /** Local 2D bounds. */
  localBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

/**
 * Represents a single converted 3D piece in local coordinates.
 * Conforms strictly to Phase 86 specifications.
 */
export interface GeneratedPiece3D {
  /** Unique piece ID. */
  pieceId: ID;
  /** Human-readable name. */
  name: string;

  /** IDs of all canonical interfaces attached to this piece. */
  interfaceIds: string[];

  /** IDs of all connections attached to this piece. */
  connectorIds: string[];

  /** Material definition. */
  material: {
    id: string;
    name: string;
    stockThicknessMm: number;
    kerfMm: number;
  };

  /** Stock material thickness in mm. */
  thickness: number;

  /**
   * Orthonormal local coordinate frame for this piece.
   * Defines the piece's independent local coordinate space:
   * origin at (0, 0, 0), tangent (+X), normal (+Y), binormal (+Z).
   */
  localCoordinateFrame: CoordinateFrame3D;

  /** Extrudable 2D profile used to generate the 3D solid. */
  profile: ExtrudablePieceProfile;

  /** 3D watertight solid mesh and physical properties. */
  solid: SolidRepresentation3D;

  /** Canonical interface objects on this piece with local coordinate frames. */
  interfaces: CanonicalInterface[];

  /** Sizing parameters for all connectors attached to this piece. */
  connectorParameters: ConnectorParameters[];

  /** Centroid of the piece in original 2D sheet space. */
  sheetCentroid: Vec2;

  /** Neighbor piece IDs in assembly topology. */
  neighborPieceIds: string[];

  /** Whether the piece touches the outer puzzle boundary. */
  isBorderPiece: boolean;
}

/**
 * Retained connection reference in 3D representation.
 */
export interface RetainedConnection3D {
  connectionId: string;
  pieceAId: string;
  pieceBId: string;
  interfaceAId: string;
  interfaceBId: string;
  connectorType: string;
  parameters: ConnectorParameters;
  clearanceMm: number;
  allowedAngleDeg: number;
}

/**
 * Validation issue details for Phase 86.
 */
export interface Piece3DValidationIssue {
  code: string;
  severity: "error" | "warning";
  pieceId?: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * 3D Piece conversion validation report.
 */
export interface Piece3DValidationReport {
  isValid: boolean;
  totalPieces: number;
  validPieces: number;
  closedProfilesCount: number;
  validSolidsCount: number;
  correctThicknessCount: number;
  validConnectorGeometriesCount: number;
  issues: Piece3DValidationIssue[];
  metrics: {
    totalSolidVolumeMm3: number;
    totalSurfaceAreaMm2: number;
    totalMassGrams: number;
  };
}

/**
 * Single converted 3D puzzle container holding all converted 3D pieces.
 */
export interface ConvertedPuzzle3D {
  puzzleId: string;
  specification: DesignSpecification2D;
  pieces: GeneratedPiece3D[];
  connections: RetainedConnection3D[];
  validation: Piece3DValidationReport;
  metadata: {
    convertedAt: string;
    executionDurationMs: number;
    generatorVersion: string;
  };
}
