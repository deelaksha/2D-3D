/**
 * Advanced 3D Connection Model Factory & Presets (Phase 65).
 *
 * Implements mathematically rigorous connection definitions with arbitrary
 * non-planar 3D spatial frames, relative transformation computation, contact regions,
 * and distinct kinematic behaviors (FIXED, HINGE, SLIDING, ROTATIONAL, INTERLOCK, SNAP, CUSTOM).
 */
import type { ID, Vec3 } from "@/core/model/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import type {
  Advanced3DConnection,
  AngleLimits3D,
  AssemblyState3D,
  ConnectionBehavior,
  ContactRegion3D,
} from "./types";
import { uid } from "@/core/model/ids";
import {
  add3,
  cross3,
  normalize3,
  quatFromAxisAngle,
  quatIdentity,
  quatMultiply,
  quatRotateVector,
  scale3,
  sub3,
  vec3,
} from "../geometry/math3d";

export interface CreateAdvancedConnectionOptions {
  id?: ID;
  name?: string;
  interfaceAId: ID;
  interfaceBId: ID;
  pieceAId?: ID;
  pieceBId?: ID;
  connectionType?: string;
  behavior?: ConnectionBehavior;
  frameA: CoordinateFrame3D;
  frameB: CoordinateFrame3D;
  joiningAngleDeg?: number;
  rollAngleDeg?: number;
  angleLimits?: Partial<AngleLimits3D>;
  allowedRotationAxes?: Vec3[];
  allowedTranslationAxes?: Vec3[];
  insertionDirection?: Vec3;
  clearance?: number;
  tolerance?: number;
  contactRegions?: ContactRegion3D[];
  metadata?: Record<string, string | number | boolean>;
}

export class ConnectionModelFactory {
  /**
   * Computes the intrinsic relative 3D rigid transform mapping Frame A to Frame B
   * at an arbitrary joining angle (theta) and roll angle (phi) with clearance.
   *
   * Fully general: makes NO planar horizontal or vertical assumptions.
   */
  static computeRelativeTransformation(
    frameA: CoordinateFrame3D,
    frameB: CoordinateFrame3D,
    joiningAngleDeg = 90.0,
    rollAngleDeg = 0.0,
    clearance = 0.0
  ): RigidTransform3D {
    const joiningRad = (joiningAngleDeg * Math.PI) / 180.0;
    const rollRad = (rollAngleDeg * Math.PI) / 180.0;

    // 1. Base mating rotation: 180° rotation around binormal to oppose surface normals
    const qOppose = quatFromAxisAngle(frameA.binormal, Math.PI);

    // 2. Joining angle rotation around tangent axis
    const qJoining = quatFromAxisAngle(frameA.tangent, joiningRad);

    // 3. Roll twist around normal axis
    const qRoll = quatFromAxisAngle(frameA.normal, rollRad);

    // Composite rotation: R = qJoining * (qRoll * qOppose)
    const relativeRotation = quatMultiply(qJoining, quatMultiply(qRoll, qOppose));

    // 4. Relative position offset:
    // When mated, origin of A is placed at origin of B plus clearance along frameB.normal
    const clearanceOffset = scale3(frameB.normal, clearance);
    const targetOriginInB = add3(frameB.origin, clearanceOffset);
    const rotatedAOrigin = quatRotateVector(relativeRotation, frameA.origin);
    const relativePosition = sub3(targetOriginInB, rotatedAOrigin);

    return {
      position: relativePosition,
      rotation: relativeRotation,
      scale: vec3(1, 1, 1),
    };
  }

  /**
   * Creates a fully specified Advanced3DConnection.
   */
  static createConnection(options: CreateAdvancedConnectionOptions): Advanced3DConnection {
    const id = options.id || uid("conn_3d_");
    const behavior = options.behavior || "FIXED";
    const joiningAngleDeg = options.joiningAngleDeg ?? 90.0;
    const rollAngleDeg = options.rollAngleDeg ?? 0.0;
    const clearance = options.clearance ?? 0.0;
    const tolerance = options.tolerance ?? 0.1;

    // Relative transform
    const relativeTransformation = this.computeRelativeTransformation(
      options.frameA,
      options.frameB,
      joiningAngleDeg,
      rollAngleDeg,
      clearance
    );

    // Insertion direction (default is opposite to Frame A normal, entering A)
    const insertionDirection = options.insertionDirection
      ? normalize3(options.insertionDirection)
      : scale3(normalize3(options.frameA.normal), -1);

    // Angle limits
    const angleLimits: AngleLimits3D = {
      minAngleDeg: options.angleLimits?.minAngleDeg ?? joiningAngleDeg,
      maxAngleDeg: options.angleLimits?.maxAngleDeg ?? joiningAngleDeg,
      nominalAngleDeg: options.angleLimits?.nominalAngleDeg ?? joiningAngleDeg,
    };

    // Kinematic axes based on behavior
    const { rotAxes, transAxes } = this.deriveKinematicAxes(
      behavior,
      options.frameA,
      options.frameB,
      options.allowedRotationAxes,
      options.allowedTranslationAxes
    );

    // Default contact region if none provided
    const contactRegions = options.contactRegions || [
      this.createDefaultContactRegion(options.frameB, clearance),
    ];

    // Assembly state
    const assemblyState: AssemblyState3D = {
      lifecycle: "UNASSEMBLED",
      progress: 0.0,
      currentAngleDeg: joiningAngleDeg,
      currentDisplacementMm: vec3(0, 0, 0),
      actualClearanceMm: clearance,
      isLocked: behavior === "FIXED",
    };

    return {
      id,
      name: options.name || `Connection (${behavior})`,
      interfaceA: {
        interfaceId: options.interfaceAId,
        pieceId: options.pieceAId,
      },
      interfaceB: {
        interfaceId: options.interfaceBId,
        pieceId: options.pieceBId,
      },
      connectionType: options.connectionType || "tab_slot",
      behavior,
      localFrames: {
        frameA: options.frameA,
        frameB: options.frameB,
      },
      relativeTransformation,
      allowedRotationAxes: rotAxes,
      allowedTranslationAxes: transAxes,
      angleLimits,
      insertionDirection,
      clearance,
      tolerance,
      contactRegions,
      assemblyState,
      metadata: options.metadata,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Specific Behavior Presets                                          */
  /* ------------------------------------------------------------------ */

  /** FIXED connection: 0 rotational DOF, 0 translational DOF once engaged. */
  static createFixedConnection(
    options: Omit<CreateAdvancedConnectionOptions, "behavior">
  ): Advanced3DConnection {
    return this.createConnection({ ...options, behavior: "FIXED" });
  }

  /** HINGE connection: 1 rotational DOF along a defined hinge axis (default binormal). */
  static createHingeConnection(
    options: Omit<CreateAdvancedConnectionOptions, "behavior"> & {
      hingeAxis?: Vec3;
      minAngleDeg?: number;
      maxAngleDeg?: number;
    }
  ): Advanced3DConnection {
    const hingeAxis = options.hingeAxis || options.frameA.binormal;
    const nominal = options.joiningAngleDeg ?? 90.0;
    return this.createConnection({
      ...options,
      behavior: "HINGE",
      allowedRotationAxes: [normalize3(hingeAxis)],
      allowedTranslationAxes: [],
      angleLimits: {
        minAngleDeg: options.minAngleDeg ?? 0.0,
        maxAngleDeg: options.maxAngleDeg ?? 180.0,
        nominalAngleDeg: nominal,
      },
    });
  }

  /** SLIDING connection: 1 translational DOF along slide vector, 0 rotation. */
  static createSlidingConnection(
    options: Omit<CreateAdvancedConnectionOptions, "behavior"> & {
      slideAxis?: Vec3;
    }
  ): Advanced3DConnection {
    const slideAxis = options.slideAxis || options.frameA.tangent;
    return this.createConnection({
      ...options,
      behavior: "SLIDING",
      allowedRotationAxes: [],
      allowedTranslationAxes: [normalize3(slideAxis)],
    });
  }

  /** ROTATIONAL connection: Multi-axis rotational swivel (e.g. ball-and-socket or gimbal). */
  static createRotationalConnection(
    options: Omit<CreateAdvancedConnectionOptions, "behavior"> & {
      rotationAxes?: Vec3[];
    }
  ): Advanced3DConnection {
    const axes = options.rotationAxes || [
      options.frameA.tangent,
      options.frameA.binormal,
    ];
    return this.createConnection({
      ...options,
      behavior: "ROTATIONAL",
      allowedRotationAxes: axes.map(normalize3),
      allowedTranslationAxes: [],
      angleLimits: options.angleLimits || {
        minAngleDeg: 0.0,
        maxAngleDeg: 360.0,
        nominalAngleDeg: options.joiningAngleDeg ?? 0.0,
      },
    });
  }

  /** INTERLOCK connection: Keyed multi-stage insertion path. */
  static createInterlockConnection(
    options: Omit<CreateAdvancedConnectionOptions, "behavior">
  ): Advanced3DConnection {
    return this.createConnection({
      ...options,
      behavior: "INTERLOCK",
      allowedRotationAxes: [],
      allowedTranslationAxes: [],
    });
  }

  /** SNAP connection: Cantilever snap fit with locking detent. */
  static createSnapConnection(
    options: Omit<CreateAdvancedConnectionOptions, "behavior">
  ): Advanced3DConnection {
    return this.createConnection({
      ...options,
      behavior: "SNAP",
      allowedRotationAxes: [],
      allowedTranslationAxes: [],
    });
  }

  /** CUSTOM connection: Configurable kinematics. */
  static createCustomConnection(options: CreateAdvancedConnectionOptions): Advanced3DConnection {
    return this.createConnection({ ...options, behavior: "CUSTOM" });
  }

  /* ------------------------------------------------------------------ */
  /* Internal Helpers                                                   */
  /* ------------------------------------------------------------------ */

  private static deriveKinematicAxes(
    behavior: ConnectionBehavior,
    frameA: CoordinateFrame3D,
    frameB: CoordinateFrame3D,
    customRot?: Vec3[],
    customTrans?: Vec3[]
  ): { rotAxes: Vec3[]; transAxes: Vec3[] } {
    switch (behavior) {
      case "FIXED":
      case "INTERLOCK":
      case "SNAP":
        return { rotAxes: [], transAxes: [] };

      case "HINGE":
        return {
          rotAxes: customRot && customRot.length > 0 ? customRot.map(normalize3) : [normalize3(frameA.binormal)],
          transAxes: [],
        };

      case "SLIDING":
        return {
          rotAxes: [],
          transAxes: customTrans && customTrans.length > 0 ? customTrans.map(normalize3) : [normalize3(frameA.tangent)],
        };

      case "ROTATIONAL":
        return {
          rotAxes: customRot && customRot.length > 0
            ? customRot.map(normalize3)
            : [normalize3(frameA.tangent), normalize3(frameA.binormal)],
          transAxes: [],
        };

      case "CUSTOM":
      default:
        return {
          rotAxes: customRot ? customRot.map(normalize3) : [],
          transAxes: customTrans ? customTrans.map(normalize3) : [],
        };
    }
  }

  private static createDefaultContactRegion(
    frameB: CoordinateFrame3D,
    clearance: number
  ): ContactRegion3D {
    return {
      regionId: uid("cr_"),
      surfaceNormal: frameB.normal,
      contactAreaMm2: 50.0,
      bounds: {
        min: vec3(-10, -2, -1),
        max: vec3(10, 2, 1),
      },
      contactType: "face_to_face",
    };
  }
}
