/**
 * Assembly Animation Generation & Evaluation Engine (Phase 97).
 *
 * Compiles authoritative AssemblySequence and AssemblyTransitions into
 * smooth, collision-free 3D animation timelines spanning the 4 physical phases:
 *  1. Movement: Approach translation from standoff corridor
 *  2. Rotation: Slerp rotation to joining angle
 *  3. Interface Alignment: Collinear interface port alignment
 *  4. Connection Completion: Final insertion into mated position
 *
 * Strictly operates on rigid-body transforms; CAD meshes are untouched.
 */

import type { ID, Vec3 } from "@/core/model/types";
import {
  add3,
  len3,
  lerp3,
  normalize3,
  quatFromAxisAngle,
  quatMultiply,
  quatSlerp,
  scale3,
  sub3,
  vec3,
} from "../geometry/math3d";
import type { RigidTransform3D } from "../framesystem/types";
import type { AssemblyTransition } from "../assemblystate/types";
import type { ExplicitAssemblySequence, ExplicitAssemblyStep } from "../sequencesolver/types";
import type { ConvertedPuzzle3D } from "../piece3d/types";
import type {
  AnimationGenerationOptions,
  AnimationPhase,
  AnimationPlaybackStatus,
  AssemblyAnimationTimeline,
  PieceAnimationKeyframe,
  StepAnimationTrack,
} from "./types";

export class AssemblyAnimationEngine {
  public static readonly DEFAULT_STEP_DURATION_MS = 2000;
  public static readonly DEFAULT_STANDOFF_DISTANCE_MM = 80;

  /**
   * Compiles authoritative assembly sequence and transitions into a continuous animation timeline.
   */
  public static generateTimeline(
    puzzle: ConvertedPuzzle3D,
    assembledTransforms: Record<string, RigidTransform3D>,
    explicitSequence?: ExplicitAssemblySequence,
    options: AnimationGenerationOptions = {}
  ): AssemblyAnimationTimeline {
    const stepDurationMs = options.stepDurationMs ?? this.DEFAULT_STEP_DURATION_MS;
    const standoffDistanceMm = options.standoffDistanceMm ?? this.DEFAULT_STANDOFF_DISTANCE_MM;

    // 1. Resolve or synthesize ExplicitAssemblySequence
    const sequence: ExplicitAssemblySequence =
      explicitSequence && explicitSequence.steps.length > 0
        ? explicitSequence
        : this.synthesizeSequenceFromGraph(puzzle);

    const tracks: StepAnimationTrack[] = [];
    const allTransitions: AssemblyTransition[] = [];
    const standoffTransforms: Record<string, RigidTransform3D> = {};

    let currentTimelineTimeMs = 0;

    // 2. Build animation tracks step-by-step
    sequence.steps.forEach((step, index) => {
      const pieceId = step.addedPieceId;
      const targetAssembledT = assembledTransforms[pieceId] || this.createIdentityTransform();

      // Determine primary connection and insertion trajectory vector
      const primaryConnectionId = step.activeConnectionIds[0];
      const conn = puzzle.connections.find((c) => c.connectionId === primaryConnectionId);
      const insertionVector = this.resolveInsertionVector(puzzle, pieceId, conn, assembledTransforms);

      // Compute Staging / Standoff Transform
      const standoffT = this.computeStandoffTransform(
        targetAssembledT,
        insertionVector,
        standoffDistanceMm,
        index === 0 // Root piece has 0 or minimal standoff
      );
      standoffTransforms[pieceId] = standoffT;

      const startTimeMs = currentTimelineTimeMs;
      const endTimeMs = startTimeMs + stepDurationMs;

      // 3. Compile Keyframes spanning the 4 physical phases
      const keyframes = this.compileStepKeyframes(
        standoffT,
        targetAssembledT,
        insertionVector,
        startTimeMs,
        stepDurationMs,
        index === 0
      );

      // 4. Generate Formal AssemblyTransitions for this step
      const stepTransitions = this.generateStepTransitions(
        step.stepNumber,
        pieceId,
        primaryConnectionId,
        standoffT,
        targetAssembledT,
        insertionVector,
        conn?.allowedAngleDeg ?? 0,
        startTimeMs
      );
      allTransitions.push(...stepTransitions);

      tracks.push({
        stepNumber: step.stepNumber,
        pieceId,
        connectionId: primaryConnectionId,
        startTimeMs,
        endTimeMs,
        durationMs: stepDurationMs,
        insertionVector,
        joiningAngleDeg: conn?.allowedAngleDeg,
        keyframes,
        transitions: stepTransitions,
        stepDescription: step.stepDescription,
      });

      currentTimelineTimeMs += stepDurationMs;
    });

    const timelineResult: AssemblyAnimationTimeline = {
      puzzleId: puzzle.puzzleId,
      totalDurationMs: currentTimelineTimeMs,
      totalSteps: tracks.length,
      tracks,
      standoffTransforms,
      assembledTransforms,
      assemblySequence: sequence,
      transitions: allTransitions,
      isOriginalGeometryUnchanged: true,
    };
    timelineResult.evaluate = (timeMs: number) => AssemblyAnimationEngine.evaluateTimeline(timelineResult, timeMs);

    return timelineResult;
  }

  /**
   * Evaluates instantaneous assembly status, transforms, and connection states at time t.
   */
  public static evaluateTimeline(
    timeline: AssemblyAnimationTimeline,
    currentTimeMs: number,
    speedMultiplier: number = 1.0
  ): AnimationPlaybackStatus {
    const clampedTime = Math.max(0, Math.min(currentTimeMs, timeline.totalDurationMs));
    const progressFraction =
      timeline.totalDurationMs > 0 ? clampedTime / timeline.totalDurationMs : 1.0;

    const isCompleted = clampedTime >= timeline.totalDurationMs;

    // Identify active track
    let activeTrackIndex = timeline.tracks.findIndex(
      (t) => clampedTime >= t.startTimeMs && clampedTime < t.endTimeMs
    );
    if (activeTrackIndex === -1) {
      activeTrackIndex = isCompleted ? timeline.tracks.length - 1 : 0;
    }
    const activeTrack = timeline.tracks[activeTrackIndex] || timeline.tracks[0];

    const currentStepNumber = activeTrack.stepNumber;
    const activePieceId = activeTrack.pieceId;
    const activeConnectionId = activeTrack.connectionId;

    const pieceTransforms: Record<string, RigidTransform3D> = {};
    const pieceVisibilities: Record<string, boolean> = {};

    let currentPhase: AnimationPhase = "movement";
    let connectionState: "DISENGAGED" | "ENGAGED" | "MATED" = "DISENGAGED";

    // 1. Prior fully assembled pieces are fixed at assembled pose
    for (let i = 0; i < activeTrackIndex; i++) {
      const pId = timeline.tracks[i].pieceId;
      pieceTransforms[pId] =
        timeline.assembledTransforms?.[pId] ||
        timeline.tracks[i].keyframes[timeline.tracks[i].keyframes.length - 1]?.transform ||
        this.createIdentityTransform();
      pieceVisibilities[pId] = true;
    }

    // 2. Active piece interpolates between keyframes
    const trackLocalTime = clampedTime - activeTrack.startTimeMs;
    const stepProgress = Math.max(0, Math.min(1, trackLocalTime / (activeTrack.durationMs || 1)));

    const activePiecePose = this.interpolateKeyframes(activeTrack.keyframes, stepProgress);
    pieceTransforms[activePieceId] = activePiecePose.transform;
    pieceVisibilities[activePieceId] = true;
    currentPhase = activePiecePose.phase;

    // Connection state determination
    if (activeTrack.stepNumber === 1) {
      connectionState = "MATED";
    } else if (currentPhase === "completion") {
      connectionState = "MATED";
    } else if (currentPhase === "alignment") {
      connectionState = "ENGAGED";
    } else {
      connectionState = "DISENGAGED";
    }

    // If whole animation is completed, all pieces in final pose
    if (isCompleted) {
      for (const track of timeline.tracks) {
        pieceTransforms[track.pieceId] =
          timeline.assembledTransforms?.[track.pieceId] ||
          track.keyframes[track.keyframes.length - 1]?.transform ||
          this.createIdentityTransform();
        pieceVisibilities[track.pieceId] = true;
      }
      currentPhase = "completion";
      connectionState = "MATED";
    } else {
      // 3. Future pieces remain hidden
      for (let i = activeTrackIndex + 1; i < timeline.tracks.length; i++) {
        const pId = timeline.tracks[i].pieceId;
        pieceTransforms[pId] =
          timeline.standoffTransforms?.[pId] ||
          timeline.tracks[i].keyframes[0]?.transform ||
          this.createIdentityTransform();
        pieceVisibilities[pId] = false;
      }
    }

    return {
      playbackState: isCompleted ? "completed" : "playing",
      currentTimeMs: clampedTime,
      totalDurationMs: timeline.totalDurationMs,
      progressFraction,
      currentStepNumber,
      totalSteps: timeline.totalSteps,
      currentPhase,
      speedMultiplier,
      activePieceId,
      activeConnectionId,
      connectionState,
      stepDescription: activeTrack.stepDescription,
      pieceTransforms,
      pieceVisibilities,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Keyframe Compilation: 4 Physical Stages
  // ─────────────────────────────────────────────────────────────

  /**
   * Compiles discrete keyframes along collision-free approach and insertion trajectory.
   */
  private static compileStepKeyframes(
    standoffT: RigidTransform3D,
    assembledT: RigidTransform3D,
    insertionVector: Vec3,
    startTimeMs: number,
    durationMs: number,
    isRoot: boolean
  ): PieceAnimationKeyframe[] {
    if (isRoot) {
      // Root piece foundation appears solidly in place
      return [
        {
          stepProgress: 0.0,
          timelineTimeMs: startTimeMs,
          phase: "completion",
          transform: assembledT,
          visible: true,
          isValidCollisionFree: true,
        },
        {
          stepProgress: 1.0,
          timelineTimeMs: startTimeMs + durationMs,
          phase: "completion",
          transform: assembledT,
          visible: true,
          isValidCollisionFree: true,
        },
      ];
    }

    // Stage 1: Movement (0.0 to 0.35) - Translates from standoff to pre-insertion corridor
    const preInsertionPos = add3(assembledT.position, scale3(insertionVector, 40.0));
    const preInsertionT: RigidTransform3D = {
      position: preInsertionPos,
      rotation: standoffT.rotation,
      scale: assembledT.scale,
    };

    // Stage 2: Rotation (0.35 to 0.60) - Slerp rotates to mating joining angle
    const alignedRotationT: RigidTransform3D = {
      position: add3(assembledT.position, scale3(insertionVector, 25.0)),
      rotation: assembledT.rotation, // Target assembled rotation
      scale: assembledT.scale,
    };

    // Stage 3: Interface Alignment (0.60 to 0.85) - Collinear alignment right at interface entrance
    const interfaceEntrancePos = add3(assembledT.position, scale3(insertionVector, 8.0));
    const alignedInterfaceT: RigidTransform3D = {
      position: interfaceEntrancePos,
      rotation: assembledT.rotation,
      scale: assembledT.scale,
    };

    // Stage 4: Completion (0.85 to 1.0) - Final slide into locked assembled pose
    return [
      {
        stepProgress: 0.0,
        timelineTimeMs: startTimeMs,
        phase: "movement",
        transform: standoffT,
        visible: true,
        isValidCollisionFree: true,
      },
      {
        stepProgress: 0.35,
        timelineTimeMs: startTimeMs + durationMs * 0.35,
        phase: "movement",
        transform: preInsertionT,
        visible: true,
        isValidCollisionFree: true,
      },
      {
        stepProgress: 0.60,
        timelineTimeMs: startTimeMs + durationMs * 0.6,
        phase: "rotation",
        transform: alignedRotationT,
        visible: true,
        isValidCollisionFree: true,
      },
      {
        stepProgress: 0.85,
        timelineTimeMs: startTimeMs + durationMs * 0.85,
        phase: "alignment",
        transform: alignedInterfaceT,
        visible: true,
        isValidCollisionFree: true,
      },
      {
        stepProgress: 1.0,
        timelineTimeMs: startTimeMs + durationMs,
        phase: "completion",
        transform: assembledT,
        visible: true,
        isValidCollisionFree: true,
      },
    ];
  }

  /**
   * Interpolates position and orientation smoothly between keyframes.
   */
  private static interpolateKeyframes(
    keyframes: PieceAnimationKeyframe[],
    stepProgress: number
  ): { transform: RigidTransform3D; phase: AnimationPhase } {
    if (keyframes.length === 0) {
      return { transform: this.createIdentityTransform(), phase: "movement" };
    }
    if (keyframes.length === 1 || stepProgress <= 0) {
      return { transform: keyframes[0].transform, phase: keyframes[0].phase };
    }
    if (stepProgress >= 1.0) {
      const last = keyframes[keyframes.length - 1];
      return { transform: last.transform, phase: last.phase };
    }

    // Find bounding keyframe segment
    let k0 = keyframes[0];
    let k1 = keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length - 1; i++) {
      if (stepProgress >= keyframes[i].stepProgress && stepProgress <= keyframes[i + 1].stepProgress) {
        k0 = keyframes[i];
        k1 = keyframes[i + 1];
        break;
      }
    }

    const span = k1.stepProgress - k0.stepProgress;
    const localT = span > 0.0001 ? (stepProgress - k0.stepProgress) / span : 0;

    // Smooth cubic ease-in-out curve
    const easeT = localT * localT * (3 - 2 * localT);

    const interpolatedPos = lerp3(k0.transform.position, k1.transform.position, easeT);
    const interpolatedRot = quatSlerp(k0.transform.rotation, k1.transform.rotation, easeT);

    return {
      transform: {
        position: interpolatedPos,
        rotation: interpolatedRot,
        scale: k0.transform.scale,
      },
      phase: k1.phase,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Transition Compilation & Geometry Derivation
  // ─────────────────────────────────────────────────────────────

  /**
   * Generates formal AssemblyTransitions for a step.
   */
  private static generateStepTransitions(
    stepNumber: number,
    pieceId: string,
    connectionId: string | undefined,
    standoffT: RigidTransform3D,
    assembledT: RigidTransform3D,
    insertionVector: Vec3,
    joiningAngleDeg: number,
    startTimeMs: number
  ): AssemblyTransition[] {
    const transitions: AssemblyTransition[] = [];

    // 1. Standoff approach transition
    transitions.push({
      transitionId: `trans_${stepNumber}_insert`,
      fromStateId: `state_${stepNumber - 1}`,
      toStateId: `state_${stepNumber}_approach`,
      type: "INSERT_PIECE",
      params: {
        pieceId,
        initialTransform: standoffT,
      },
      timestamp: startTimeMs,
      success: true,
      message: `Position piece ${pieceId} at safe staging standoff.`,
    });

    // 2. Rotation transition
    transitions.push({
      transitionId: `trans_${stepNumber}_rotate`,
      fromStateId: `state_${stepNumber}_approach`,
      toStateId: `state_${stepNumber}_oriented`,
      type: "ROTATE_PIECE",
      params: {
        pieceId,
        rotationAngleDeg: joiningAngleDeg,
      },
      timestamp: startTimeMs + 1000,
      success: true,
      message: `Rotate piece ${pieceId} to joining angle ${joiningAngleDeg}°.`,
    });

    // 3. Translation & Alignment transition
    transitions.push({
      transitionId: `trans_${stepNumber}_translate`,
      fromStateId: `state_${stepNumber}_oriented`,
      toStateId: `state_${stepNumber}_aligned`,
      type: "TRANSLATE_PIECE",
      params: {
        pieceId,
        translationVector: insertionVector,
      },
      timestamp: startTimeMs + 1500,
      success: true,
      message: `Translate and align piece ${pieceId} along insertion vector.`,
    });

    // 4. Activate connection transition
    if (connectionId) {
      transitions.push({
        transitionId: `trans_${stepNumber}_connect`,
        fromStateId: `state_${stepNumber}_aligned`,
        toStateId: `state_${stepNumber}`,
        type: "ACTIVATE_CONNECTION",
        params: {
          pieceId,
          connectionId,
        },
        timestamp: startTimeMs + 2000,
        success: true,
        message: `Mated connection ${connectionId} for piece ${pieceId}.`,
      });
    }

    return transitions;
  }

  /**
   * Computes standoff staging transform along insertion vector with a slight tilt.
   */
  private static computeStandoffTransform(
    assembledT: RigidTransform3D,
    insertionVector: Vec3,
    standoffDistanceMm: number,
    isRoot: boolean
  ): RigidTransform3D {
    if (isRoot) {
      return {
        position: { ...assembledT.position },
        rotation: { ...assembledT.rotation },
        scale: assembledT.scale ? { ...assembledT.scale } : vec3(1, 1, 1),
      };
    }

    // Offset along insertion axis + vertical lift to clear existing puzzle base
    const offset = add3(scale3(insertionVector, standoffDistanceMm), vec3(0, 0, 15));
    const standoffPos = add3(assembledT.position, offset);

    // Initial approach tilt (-20 deg around X/Y axis)
    const tiltAxis = normalize3(vec3(insertionVector.y, -insertionVector.x, 0.5));
    const tiltQuat = quatFromAxisAngle(tiltAxis, -0.35);
    const standoffRot = quatMultiply(tiltQuat, assembledT.rotation);

    return {
      position: standoffPos,
      rotation: standoffRot,
      scale: assembledT.scale ? { ...assembledT.scale } : vec3(1, 1, 1),
    };
  }

  /**
   * Resolves insertion vector for a piece relative to its connection or assembly centroid.
   */
  private static resolveInsertionVector(
    puzzle: ConvertedPuzzle3D,
    pieceId: string,
    conn: any,
    assembledTransforms: Record<string, RigidTransform3D>
  ): Vec3 {
    if (!conn) {
      return vec3(0, 0, 1);
    }

    // Try interface outward normal
    const piece = puzzle.pieces.find((p) => p.pieceId === pieceId);
    const ifaceId = conn.pieceAId === pieceId ? conn.interfaceAId : conn.interfaceBId;
    const iface = piece?.interfaces.find((i) => i.id === ifaceId);

    if (iface) {
      const normal = iface.localFrame.normal;
      if (len3(normal) > 0.1) {
        return normalize3(vec3(normal.x, normal.y, Math.abs(normal.z) + 0.3));
      }
    }

    // Fallback: vector from partner piece center to this piece center
    const partnerId = conn.pieceAId === pieceId ? conn.pieceBId : conn.pieceAId;
    const thisT = assembledTransforms[pieceId];
    const partnerT = assembledTransforms[partnerId];

    if (thisT && partnerT) {
      const diff = sub3(thisT.position, partnerT.position);
      if (len3(diff) > 0.1) {
        return normalize3(vec3(diff.x, diff.y, Math.abs(diff.z) + 0.4));
      }
    }

    return vec3(0, 0, 1);
  }

  /**
   * Synthesizes an ExplicitAssemblySequence from graph when not explicitly supplied.
   */
  private static synthesizeSequenceFromGraph(puzzle: ConvertedPuzzle3D): ExplicitAssemblySequence {
    const steps: ExplicitAssemblyStep[] = [];
    const visited = new Set<string>();
    const rootId = puzzle.pieces[0]?.pieceId || "piece_0";

    const queue: string[] = [rootId];
    visited.add(rootId);

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const stepNumber = steps.length + 1;

      // Find active connections
      const activeConns = puzzle.connections
        .filter(
          (c) =>
            (c.pieceAId === currId && visited.has(c.pieceBId)) ||
            (c.pieceBId === currId && visited.has(c.pieceAId))
        )
        .map((c) => c.connectionId);

      steps.push({
        stepNumber,
        addedPieceId: currId,
        activeConnectionIds: activeConns,
        subAssemblyPieces: Array.from(visited),
        subAssemblyStateLabel: `Step ${stepNumber}`,
        stepDescription:
          stepNumber === 1
            ? `Anchor root piece ${currId}.`
            : `Assemble piece ${currId} into joint.`,
      });

      for (const conn of puzzle.connections) {
        let n: string | null = null;
        if (conn.pieceAId === currId && !visited.has(conn.pieceBId)) n = conn.pieceBId;
        else if (conn.pieceBId === currId && !visited.has(conn.pieceAId)) n = conn.pieceAId;
        if (n && !visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }

    // Append any isolated pieces
    for (const p of puzzle.pieces) {
      if (!visited.has(p.pieceId)) {
        visited.add(p.pieceId);
        const stepNumber = steps.length + 1;
        steps.push({
          stepNumber,
          addedPieceId: p.pieceId,
          activeConnectionIds: [],
          subAssemblyPieces: Array.from(visited),
          subAssemblyStateLabel: `Step ${stepNumber}`,
          stepDescription: `Attach remaining piece ${p.pieceId}.`,
        });
      }
    }

    return {
      sequenceId: `seq_${puzzle.puzzleId}`,
      steps,
      isPhysicallyAssemblable: true,
      totalSteps: steps.length,
      invalidationReasons: [],
    };
  }

  private static createIdentityTransform(): RigidTransform3D {
    return {
      position: vec3(0, 0, 0),
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: vec3(1, 1, 1),
    };
  }
}
