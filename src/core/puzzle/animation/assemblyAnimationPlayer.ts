/**
 * Assembly Animation Playback Controller (Phase 97).
 *
 * Manages timeline playback:
 *  - Play, Pause, Restart, Seek
 *  - Step Forward, Step Backward
 *  - Variable playback speed multipliers (0.5x, 1x, 1.5x, 2x, 4x)
 *  - Frame-rate independent delta time updates (tick)
 *  - Emits real-time AnimationPlaybackStatus for UI HUD
 */

import { AssemblyAnimationEngine } from "./assemblyAnimationEngine";
import type {
  AnimationPlaybackState,
  AnimationPlaybackStatus,
  AssemblyAnimationTimeline,
} from "./types";

export type AnimationStatusListener = (status: AnimationPlaybackStatus) => void;

export class AssemblyAnimationPlayer {
  private timeline: AssemblyAnimationTimeline;
  private playbackState: AnimationPlaybackState = "idle";
  private currentTimeMs: number = 0;
  private speedMultiplier: number = 1.0;
  private listeners: Set<AnimationStatusListener> = new Set();

  constructor(timeline: AssemblyAnimationTimeline, initialSpeed: number = 1.0) {
    this.timeline = timeline;
    this.speedMultiplier = Math.max(0.1, Math.min(10.0, initialSpeed));
  }

  /**
   * Starts or resumes playback.
   */
  public play(): void {
    if (this.playbackState === "completed" || this.currentTimeMs >= this.timeline.totalDurationMs) {
      this.currentTimeMs = 0;
    }
    this.playbackState = "playing";
    this.notify();
  }

  /**
   * Pauses active playback.
   */
  public pause(): void {
    if (this.playbackState === "playing") {
      this.playbackState = "paused";
      this.notify();
    }
  }

  /**
   * Toggles between play and pause.
   */
  public togglePlayPause(): void {
    if (this.playbackState === "playing") {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Restarts playback from time 0 (Step 1).
   */
  public restart(): void {
    this.currentTimeMs = 0;
    this.playbackState = "playing";
    this.notify();
  }

  /**
   * Advances immediately to the start of the next assembly step.
   */
  public stepForward(): void {
    const currentStatus = this.getStatus();
    const nextStepNum = Math.min(this.timeline.totalSteps, currentStatus.currentStepNumber + 1);
    const nextTrack = this.timeline.tracks.find((t) => t.stepNumber === nextStepNum);

    if (nextTrack) {
      this.currentTimeMs = nextTrack.startTimeMs;
      this.playbackState = "paused";
      this.notify();
    } else {
      this.currentTimeMs = this.timeline.totalDurationMs;
      this.playbackState = "completed";
      this.notify();
    }
  }

  /**
   * Rewinds immediately to the start of the current or previous assembly step.
   */
  public stepBackward(): void {
    const currentStatus = this.getStatus();
    const activeTrack = this.timeline.tracks.find(
      (t) => t.stepNumber === currentStatus.currentStepNumber
    );

    // If more than 300ms into current step, rewind to start of current step; otherwise jump to prior step
    if (activeTrack && this.currentTimeMs - activeTrack.startTimeMs > 300) {
      this.currentTimeMs = activeTrack.startTimeMs;
    } else {
      const prevStepNum = Math.max(1, currentStatus.currentStepNumber - 1);
      const prevTrack = this.timeline.tracks.find((t) => t.stepNumber === prevStepNum);
      if (prevTrack) {
        this.currentTimeMs = prevTrack.startTimeMs;
      } else {
        this.currentTimeMs = 0;
      }
    }

    this.playbackState = "paused";
    this.notify();
  }

  /**
   * Sets playback speed multiplier (e.g. 0.5, 1.0, 2.0).
   */
  public setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(10.0, multiplier));
    this.notify();
  }

  /**
   * Seeks to a normalized progress fraction in range [0.0, 1.0] or absolute time in ms.
   */
  public seek(target: number): void {
    if (target > 1.0) {
      this.currentTimeMs = Math.max(0, Math.min(this.timeline.totalDurationMs, target));
    } else {
      const clamped = Math.max(0, Math.min(1, target));
      this.currentTimeMs = clamped * this.timeline.totalDurationMs;
    }
    if (this.currentTimeMs >= this.timeline.totalDurationMs) {
      this.playbackState = "completed";
    }
    this.notify();
  }

  /**
   * Advances timeline by delta milliseconds scaled by active speed multiplier.
   */
  public tick(deltaMs: number): AnimationPlaybackStatus {
    if (this.playbackState === "playing") {
      this.currentTimeMs += deltaMs * this.speedMultiplier;
      if (this.currentTimeMs >= this.timeline.totalDurationMs) {
        this.currentTimeMs = this.timeline.totalDurationMs;
        this.playbackState = "completed";
      }
      this.notify();
    }
    return this.getStatus();
  }

  /**
   * Returns current instantaneous status for UI and rendering consumption.
   */
  public getStatus(): AnimationPlaybackStatus {
    const status = AssemblyAnimationEngine.evaluateTimeline(
      this.timeline,
      this.currentTimeMs,
      this.speedMultiplier
    );
    status.playbackState = this.playbackState;
    return status;
  }

  /**
   * Replaces current timeline with a newly compiled one.
   */
  public updateTimeline(newTimeline: AssemblyAnimationTimeline): void {
    this.timeline = newTimeline;
    this.currentTimeMs = 0;
    this.playbackState = "idle";
    this.notify();
  }

  /**
   * Subscribes to status update events.
   */
  public subscribe(listener: AnimationStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch {
        // Prevent listener errors from stopping engine loop
      }
    });
  }
}
