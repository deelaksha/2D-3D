/**
 * Assembly Animation System Domain Types (Phase 97).
 *
 * Models kinematic 3D puzzle assembly animations:
 *  - Generated directly from authoritative AssemblySequence and AssemblyTransitions
 *  - 4 physical animation phases: movement, rotation, interface alignment, connection completion
 *  - Interpolation keyframes and time tracking
 *  - Playback controller states (play, pause, restart, step forward, step backward, speed)
 *  - Collision-free valid intermediate transforms
 *  - Strict CAD geometry immutability guarantee
 */

import type { ID, Vec3 } from "@/core/model/types";
import type { RigidTransform3D } from "../framesystem/types";
import type { AssemblyTransition } from "../assemblystate/types";
import type { ExplicitAssemblySequence } from "../sequencesolver/types";

/**
 * Playback execution state.
 */
export type AnimationPlaybackState = "idle" | "playing" | "paused" | "completed";

/**
 * The 4 distinct physical phases of piece assembly.
 */
export type AnimationPhase = "movement" | "rotation" | "alignment" | "completion";

/**
 * Discrete keyframe for a piece along its assembly trajectory.
 */
export interface PieceAnimationKeyframe {
  /** Normalized progress within the step [0.0, 1.0]. */
  stepProgress: number;
  /** Absolute elapsed time in milliseconds within the entire timeline. */
  timelineTimeMs: number;
  /** Physical phase of this keyframe. */
  phase: AnimationPhase;
  /** 3D spatial transform at this moment. */
  transform: RigidTransform3D;
  /** Piece visibility flag. */
  visible: boolean;
  /** Collision-free confirmation flag. */
  isValidCollisionFree: boolean;
}

/**
 * Animation track corresponding to a single assembly step.
 */
export interface StepAnimationTrack {
  /** 1-indexed assembly step number. */
  stepNumber: number;
  /** ID of the piece being attached. */
  pieceId: string;
  /** Associated connection ID being formed (if any). */
  connectionId?: string;
  /** Start time of this step within the timeline in milliseconds. */
  startTimeMs: number;
  /** End time of this step within the timeline in milliseconds. */
  endTimeMs: number;
  /** Duration of this step in milliseconds. */
  durationMs: number;
  /** 3D insertion trajectory vector. */
  insertionVector: Vec3;
  /** Applied joining angle in degrees. */
  joiningAngleDeg?: number;
  /** Pre-calculated keyframes spanning the 4 physical phases. */
  keyframes: PieceAnimationKeyframe[];
  /** Assembly transitions associated with this step. */
  transitions: AssemblyTransition[];
  /** Human-readable explanation of this step. */
  stepDescription: string;
}

/**
 * Complete compiled assembly animation timeline.
 */
export interface AssemblyAnimationTimeline {
  /** Unique puzzle identifier. */
  puzzleId: string;
  /** Total duration of entire assembly animation in milliseconds. */
  totalDurationMs: number;
  /** Total discrete steps in the assembly sequence. */
  totalSteps: number;
  /** Ordered array of step animation tracks. */
  tracks: StepAnimationTrack[];
  /** Staging / approach standoff transforms per piece before insertion. */
  standoffTransforms: Record<string, RigidTransform3D>;
  /** Authoritative final assembled transforms per piece. */
  assembledTransforms: Record<string, RigidTransform3D>;
  /** Source authoritative assembly sequence. */
  assemblySequence: ExplicitAssemblySequence;
  /** All compiled assembly transitions. */
  transitions: AssemblyTransition[];
  /** Strict CAD immutability confirmation flag. */
  isOriginalGeometryUnchanged: boolean;
  /** Direct evaluation helper method. */
  evaluate?: (timeMs: number) => AnimationPlaybackStatus;
}

/**
 * Instantaneous playback status emitted to viewers and UI controls.
 */
export interface AnimationPlaybackStatus {
  /** Current playback state (idle, playing, paused, completed). */
  playbackState: AnimationPlaybackState;
  /** Current playback time in milliseconds. */
  currentTimeMs: number;
  /** Total timeline duration in milliseconds. */
  totalDurationMs: number;
  /** Overall animation progress in range [0.0, 1.0]. */
  progressFraction: number;
  /** Currently active step number (1 to totalSteps). */
  currentStepNumber: number;
  /** Total assembly steps. */
  totalSteps: number;
  /** Currently executing animation phase. */
  currentPhase: AnimationPhase;
  /** Playback speed multiplier (e.g. 0.5, 1.0, 1.5, 2.0). */
  speedMultiplier: number;
  /** Active incoming piece ID (if in progress). */
  activePieceId?: string;
  /** Active connection ID (if in progress). */
  activeConnectionId?: string;
  /** Connection completion state ("DISENGAGED" | "ENGAGED" | "MATED"). */
  connectionState: "DISENGAGED" | "ENGAGED" | "MATED";
  /** Human-readable description of current step and action. */
  stepDescription: string;
  /** Instantaneous 3D transforms for all pieces. */
  pieceTransforms: Record<string, RigidTransform3D>;
  /** Instantaneous visibility state per piece. */
  pieceVisibilities: Record<string, boolean>;
}

/**
 * Configuration options for generating an assembly animation.
 */
export interface AnimationGenerationOptions {
  /** Duration per assembly step in milliseconds (default: 2000 ms). */
  stepDurationMs?: number;
  /** Standoff approach distance in mm along insertion axis (default: 80 mm). */
  standoffDistanceMm?: number;
  /** Initial speed multiplier (default: 1.0). */
  initialSpeed?: number;
}
