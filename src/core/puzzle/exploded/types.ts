/**
 * Exploded Assembly Visualization Domain Types (Phase 96).
 *
 * Implements domain models for:
 *  - Exploded view layout calculation derived from authoritative assembly graph
 *  - Three viewing modes: Normal View, Exploded View, Assembly-Step View
 *  - Piece identity, connection relationship, and assembly order preservation
 *  - Visual indicators: Piece numbers, connection indicators, assembly directions, joining interfaces
 *  - Strict CAD geometry immutability guarantee
 */

import type { Vec3 } from "@/core/model/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";

/**
 * The three primary visualization modes supported by the viewer.
 */
export type ExplodedViewMode = "normal" | "exploded" | "assembly_step";

/**
 * Visual indicator of a joining interface on a piece.
 */
export interface ExplodedInterfaceIndicator {
  /** Unique interface identifier. */
  interfaceId: string;
  /** Owning piece identifier. */
  pieceId: string;
  /** Local coordinate frame on the piece. */
  localFrame: CoordinateFrame3D;
  /** Evaluated 3D world position under current piece transform. */
  worldPosition: Vec3;
  /** Evaluated 3D normal pointing outward along joining axis. */
  worldNormal: Vec3;
  /** Mating partner piece ID (if connected). */
  pairingPieceId?: string;
  /** Mating partner interface ID (if connected). */
  pairingInterfaceId?: string;
}

/**
 * Representation of a piece in the exploded assembly context.
 */
export interface ExplodedPieceState {
  /** Unique authoritative piece identifier. */
  pieceId: string;
  /** 1-indexed assembly order number (e.g. 1 = root, 2 = first attached piece, etc.). */
  pieceNumber: number;
  /** Assembly step index at which this piece is physically attached (1-indexed). */
  stepIndex: number;
  /** Topological depth from root in assembly graph (root = 0). */
  graphDepth: number;
  /** Parent piece ID in the kinematic assembly tree (undefined for root). */
  parentPieceId?: string;
  /** Normalized unit vector indicating direction of explosion displacement. */
  explosionVector: Vec3;
  /** Maximum explosion distance along explosionVector (in mm) at 100% explosion. */
  maxExplosionDistanceMm: number;
  /** Original authoritative assembled transform (0% explosion). */
  assembledTransform: RigidTransform3D;
  /** Fully exploded transform (100% explosion). */
  explodedTransform: RigidTransform3D;
  /** Currently active transform evaluated for active view mode and explosion factor. */
  currentTransform: RigidTransform3D;
  /** All joining interfaces belonging to this piece. */
  interfaces: ExplodedInterfaceIndicator[];
  /** Visibility toggle for current view state. */
  isVisible: boolean;
  /** Visual highlighting state (e.g. active incoming piece during assembly step). */
  isHighlighted: boolean;
}

/**
 * Visual connection indicator between two mating interfaces.
 */
export interface ExplodedConnectionIndicator {
  /** Physical connection ID. */
  connectionId: string;
  /** Piece A ID. */
  pieceAId: string;
  /** Piece B ID. */
  pieceBId: string;
  /** Interface A ID. */
  interfaceAId: string;
  /** Interface B ID. */
  interfaceBId: string;
  /** Physical connector type (tab_slot, notch, etc.). */
  connectorType: string;
  /** Current 3D position of interface A in world coordinates. */
  pointA: Vec3;
  /** Current 3D position of interface B in world coordinates. */
  pointB: Vec3;
  /** Midpoint connecting interface A and interface B. */
  midPoint: Vec3;
  /** Normalized 3D assembly/insertion trajectory vector (from piece B to piece A or vice-versa). */
  assemblyDirection: Vec3;
  /** Physical connection state. */
  state: "MATED" | "ENGAGED" | "DISENGAGED" | "FAILED";
  /** Assembly step at which this connection is formed. */
  stepIntroduced: number;
  /** Whether this connection indicator line is currently visible. */
  isVisible: boolean;
}

/**
 * State representing a discrete step in the physical assembly sequence.
 */
export interface AssemblyStepState {
  /** 1-indexed step number (1 = Base root piece, 2..N = successive additions). */
  stepNumber: number;
  /** Total steps in the sequence. */
  totalSteps: number;
  /** Piece ID newly introduced / attached in this step. */
  incomingPieceId: string;
  /** 1-indexed piece number of the incoming piece. */
  incomingPieceNumber: number;
  /** Piece IDs already assembled in prior steps. */
  assembledPieceIds: string[];
  /** All piece IDs visible at the completion of this step. */
  visiblePieceIds: string[];
  /** 3D insertion trajectory vector along which incoming piece moves into place. */
  insertionVector: Vec3;
  /** Connection IDs formed during this step. */
  activeConnectionIds: string[];
  /** Human-readable explanation of this assembly step. */
  stepDescription: string;
}

/**
 * Configurable display options for exploded assembly visualization.
 */
export interface ExplodedIndicatorOptions {
  /** Whether to render piece number badges/billboards (1, 2, 3...). */
  showPieceNumbers: boolean;
  /** Whether to render dashed/colored connection indicator lines between interfaces. */
  showConnectionIndicators: boolean;
  /** Whether to render 3D assembly direction arrows. */
  showAssemblyDirections: boolean;
  /** Whether to render joining interface port frames/discs. */
  showJoiningInterfaces: boolean;
}

/**
 * Runtime configuration for the exploded assembly view.
 */
export interface ExplodedAssemblyConfig {
  /** Active visualization mode. */
  mode: ExplodedViewMode;
  /** Continuous explosion factor in range [0.0, 1.0] (0 = fully assembled, 1 = fully exploded). */
  explosionFactor: number;
  /** Active step number for assembly-step mode (1 to totalSteps). */
  currentStep: number;
  /** Base explosion distance in mm per graph depth level (default: 60 mm). */
  baseExplosionDistanceMm: number;
  /** Visual indicator display options. */
  indicators: ExplodedIndicatorOptions;
}

/**
 * Complete calculated exploded assembly result.
 */
export interface ExplodedAssemblyResult {
  /** Unique puzzle identifier. */
  puzzleId: string;
  /** Active configuration. */
  config: ExplodedAssemblyConfig;
  /** Total count of pieces in assembly. */
  totalPieces: number;
  /** Total count of assembly steps. */
  totalSteps: number;
  /** Root piece ID anchoring the assembly. */
  rootPieceId: string;
  /** Ordered list of exploded piece states. */
  pieces: ExplodedPieceState[];
  /** Dictionary of exploded piece states keyed by pieceId. */
  pieceMap: Record<string, ExplodedPieceState>;
  /** Dictionary of evaluated piece transforms for the active view state. */
  currentPieceTransforms: Record<string, RigidTransform3D>;
  /** Visual connection indicators between separated interfaces. */
  connections: ExplodedConnectionIndicator[];
  /** Discrete assembly sequence steps. */
  steps: AssemblyStepState[];
  /** Strict guarantee flag confirming original CAD solid mesh geometry was NOT altered. */
  isOriginalGeometryUnchanged: boolean;
}
