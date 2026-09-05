/**
 * Interactive 3D Preview Types (Phase 94).
 *
 * Implements data structures for:
 *  - 3D Viewer Camera & Viewport States
 *  - Interactive Piece & Connection Selection States
 *  - Diagnostic Visual States: VALID, WARNING, COLLISION, INVALID_CONNECTION, SELECTED_PIECE
 *  - Component Props and Event Callbacks
 */

import type { PuzzleGenerationResult } from "@/core/puzzle/highlevelapi/types";
import type { Scene } from "@/core/puzzle/scene/types";

/**
 * Diagnostic visual states for pieces and connections in the 3D viewport.
 */
export type Puzzle3DVisualState =
  | "VALID"
  | "WARNING"
  | "COLLISION"
  | "INVALID_CONNECTION"
  | "SELECTED_PIECE"
  | "DEFAULT";

/**
 * Camera perspective presets.
 */
export type ViewerCameraPreset = "iso" | "top" | "front" | "side";

/**
 * Mouse interaction modes for the viewport canvas.
 */
export type ViewerInteractionMode = "orbit" | "pan" | "select";

/**
 * Internal selection and visibility state of the 3D preview.
 */
export interface ViewerSelectionState {
  /** Currently selected piece ID (null if none). */
  selectedPieceId: string | null;
  /** Currently highlighted connection ID (null if none). */
  highlightedConnectionId: string | null;
  /** Set of piece IDs that are hidden by the user. */
  hiddenPieceIds: Set<string>;
  /** Piece ID that is isolated (all others hidden). Null if not isolated. */
  isolatedPieceId: string | null;
  /** Overridden visual state per piece ID or connection ID. */
  visualStateOverrides: Map<string, Puzzle3DVisualState>;
}

/**
 * Camera state representation.
 */
export interface ViewerCameraState {
  /** Azimuthal orbit angle in radians. */
  theta: number;
  /** Polar elevation angle in radians. */
  phi: number;
  /** Distance from camera target point in mm. */
  radius: number;
  /** 3D target focus point [x, y, z] in mm. */
  target: { x: number; y: number; z: number };
  /** Camera FOV in degrees. */
  fov: number;
}

/**
 * Props for the interactive Puzzle3DPreview React component.
 */
export interface Puzzle3DPreviewProps {
  /**
   * Authoritative puzzle generation result from Phase 92.
   * If provided, the viewer automatically generates the Phase 93 Scene.
   */
  puzzleResult?: PuzzleGenerationResult | null;

  /**
   * Direct renderer-independent Scene representation from Phase 93.
   * If provided, takes precedence over puzzleResult.
   */
  scene?: Scene | null;

  /** Whether the generation or rendering pipeline is actively loading. */
  isLoading?: boolean;

  /** Loading message or stage description. */
  loadingMessage?: string;

  /** Optional error object or message if generation or solving failed. */
  error?: string | Error | null;

  /** Callback invoked when the user clicks Retry on an error view. */
  onRetry?: () => void;

  /** Callback fired when a piece is selected or deselected. */
  onPieceSelect?: (pieceId: string | null) => void;

  /** Callback fired when a connection is highlighted or unhighlighted. */
  onConnectionSelect?: (connectionId: string | null) => void;

  /** Whether to show the floating glassmorphic viewport controls HUD (default: true). */
  showControlsHUD?: boolean;

  /** Whether to show the collapsible pieces drawer (default: true). */
  showPiecesDrawer?: boolean;

  /** Whether to show the collapsible connections drawer (default: true). */
  showConnectionsDrawer?: boolean;

  /** Whether to show the global visual state pill (default: true). */
  showStatusPill?: boolean;

  /** Optional container CSS class name. */
  className?: string;

  /** Optional container style object. */
  style?: React.CSSProperties;
}
