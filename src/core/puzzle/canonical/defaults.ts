/**
 * Factory defaults and object constructors for Canonical Internal Representation.
 */
import type { ID, Vec2, Vec3 } from "@/core/model/types";
import type {
  AllowedDOF,
  CanonicalAssemblyConfiguration,
  CanonicalConnection,
  CanonicalInterface,
  CanonicalLocalFrame3D,
  CanonicalPiece,
  CanonicalPuzzle,
  PieceDimensions,
} from "./types";
import { CANONICAL_SCHEMA_VERSION } from "./types";
import { DEFAULT_CARDBOARD_2MM } from "../domain/defaults";
import { uid } from "@/core/model/ids";
import { quatIdentity, vec3 } from "../geometry/math3d";

export function createDefaultCanonicalLocalFrame(): CanonicalLocalFrame3D {
  return {
    origin: vec3(0, 0, 0),
    tangent: vec3(1, 0, 0),
    normal: vec3(0, -1, 0),
    binormal: vec3(0, 0, -1),
  };
}

export function createDefaultAllowedDOF(rigid = true): AllowedDOF {
  if (rigid) {
    return {
      translation: { x: false, y: false, z: false },
      rotation: { rx: false, ry: false, rz: false },
    };
  }
  return {
    translation: { x: true, y: true, z: true },
    rotation: { rx: true, ry: true, rz: true },
  };
}

export function createCanonicalPiece(
  name = "Canonical Piece",
  dimensions: PieceDimensions = { width: 100, height: 100, depth: 2.0 },
  thickness = 2.0,
): CanonicalPiece {
  const pieceId = uid("p_can_");
  return {
    id: pieceId,
    name,
    geometryRef: {
      contour: {
        kind: "rect",
        x: 0,
        y: 0,
        width: dimensions.width,
        height: dimensions.height,
        rotation: 0,
      },
    },
    dimensions,
    thickness,
    materialId: DEFAULT_CARDBOARD_2MM.id,
    interfaceIds: [],
    localFrame: createDefaultCanonicalLocalFrame(),
    manufacturingParameters: {
      kerf: 0.1,
      grainAngleDeg: 0,
    },
  };
}

export function createCanonicalInterface(
  owningPieceId: ID,
  name = "Interface Port",
  position: Vec2 = { x: 50, y: 0 },
  normal: Vec2 = { x: 0, y: -1 },
): CanonicalInterface {
  return {
    id: uid("if_can_"),
    owningPieceId,
    name,
    edgeGeometry: {
      edgeIndex: 0,
      parametricStart: 0.4,
      parametricEnd: 0.6,
      length: 20.0,
    },
    interfaceType: "slot",
    profile: {
      profileKind: "rectangular_slot",
      width: 20.0,
      depth: 2.0,
      clearance: 0.1,
    },
    compatibility: {
      allowedTypes: ["slot", "tab"],
      genderRole: "receiver",
      complementaryPatterns: ["tab_slot"],
    },
    localFrame: {
      origin: vec3(position.x, position.y, 0),
      tangent: vec3(1, 0, 0),
      normal: vec3(normal.x, normal.y, 0),
      binormal: vec3(0, 0, -1),
    },
    tolerance: 0.1,
    allowedDOF: createDefaultAllowedDOF(true),
  };
}

export function createCanonicalConnection(
  interfaceAId: ID,
  interfaceBId: ID,
  joiningAngleDeg = 90.0,
): CanonicalConnection {
  return {
    id: uid("cn_can_"),
    interfaceAId,
    interfaceBId,
    connectionType: "rigid",
    compatibilityRules: {
      requireMatchingProfileWidth: true,
      maxToleranceDiff: 0.2,
    },
    allowedRelativeTransform: {
      positionOffset: vec3(0, 0, 0),
      rotationQuaternion: quatIdentity(),
    },
    allowedAngleRange: {
      minAngleDeg: joiningAngleDeg,
      maxAngleDeg: joiningAngleDeg,
      targetAngleDeg: joiningAngleDeg,
    },
    clearance: 0.0,
    constraintIds: [],
  };
}

export function createCanonicalAssemblyConfiguration(
  name = "Default Assembly Config",
): CanonicalAssemblyConfiguration {
  return {
    id: uid("cfg_can_"),
    name,
    pieceTransforms: {},
    position: vec3(0, 0, 0),
    rotation: quatIdentity(),
    connectionStates: {},
    assemblySequence: [],
    validationState: {
      overallSeverity: "ok",
      issues: [],
    },
  };
}

export function createEmptyCanonicalPuzzle(name = "Parametric Puzzle"): CanonicalPuzzle {
  return {
    metadata: {
      id: uid("puz_can_"),
      name,
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      displayUnit: "mm",
    },
    materialSpecification: [DEFAULT_CARDBOARD_2MM],
    globalParameters: {},
    pieces: [],
    interfaces: [],
    connections: [],
    constraints: [],
    assemblyConfigurations: [createCanonicalAssemblyConfiguration()],
    validationResults: {
      overallSeverity: "ok",
      issues: [],
    },
  };
}
