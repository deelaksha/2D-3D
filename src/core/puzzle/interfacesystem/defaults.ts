/**
 * Factory defaults & constructors for extensible connection interfaces.
 */
import type { ID, Vec2, Vec3 } from "@/core/model/types";
import type { ConnectionInterfaceSystem, ConnectionType } from "./types";
import { createInterfaceLocalFrame3D } from "./frame";
import { uid } from "@/core/model/ids";
import { vec3 } from "../geometry/math3d";

export function createTabInterface(
  owningPieceId: ID,
  name = "Male Tab Interface",
  position: Vec2 = { x: 50, y: 0 },
  normal: Vec2 = { x: 0, y: -1 },
  width = 20.0,
  depth = 5.0,
): ConnectionInterfaceSystem {
  return {
    id: uid("if_tab_"),
    owningPieceId,
    name,
    type: "tab_slot",
    localFrame: createInterfaceLocalFrame3D(
      vec3(position.x, position.y, 0),
      vec3(1, 0, 0),
      vec3(normal.x, normal.y, 0),
    ),
    interfaceGeometry: {
      edgeIndex: 0,
      parametricStart: 0.4,
      parametricEnd: 0.6,
      length: width,
    },
    profile: {
      kind: "male_tab",
      width,
      depth,
      height: 2.0,
      chamfer: 1.0,
    },
    compatibility: {
      genderRole: "insert",
      allowedTypes: ["tab_slot", "slot"],
      compatibleGenderRoles: ["receiver"],
    },
    tolerance: 0.15,
    clearance: 0.0,
    insertionDirection: vec3(normal.x, normal.y, 0),
    kinematicConstraints: {
      insertionDirection: vec3(normal.x, normal.y, 0),
      translationConstraints: { tx: true, ty: true, tz: true },
      rotationConstraints: { rx: true, ry: true, rz: true },
      allowedAngleRange: { minAngleDeg: 90, maxAngleDeg: 90, targetAngleDeg: 90 },
      allowedDOF: {
        translation: { x: false, y: false, z: false },
        rotation: { rx: false, ry: false, rz: false },
      },
    },
  };
}

export function createSlotInterface(
  owningPieceId: ID,
  name = "Female Slot Interface",
  position: Vec2 = { x: 50, y: 0 },
  normal: Vec2 = { x: 0, y: -1 },
  width = 20.0,
  depth = 5.0,
): ConnectionInterfaceSystem {
  return {
    id: uid("if_slot_"),
    owningPieceId,
    name,
    type: "tab_slot",
    localFrame: createInterfaceLocalFrame3D(
      vec3(position.x, position.y, 0),
      vec3(1, 0, 0),
      vec3(normal.x, normal.y, 0),
    ),
    interfaceGeometry: {
      edgeIndex: 0,
      parametricStart: 0.4,
      parametricEnd: 0.6,
      length: width,
    },
    profile: {
      kind: "female_slot",
      width,
      depth,
      height: 2.0,
    },
    compatibility: {
      genderRole: "receiver",
      allowedTypes: ["tab_slot", "slot"],
      compatibleGenderRoles: ["insert"],
    },
    tolerance: 0.15,
    clearance: 0.0,
    insertionDirection: vec3(-normal.x, -normal.y, 0),
    kinematicConstraints: {
      insertionDirection: vec3(-normal.x, -normal.y, 0),
      translationConstraints: { tx: true, ty: true, tz: true },
      rotationConstraints: { rx: true, ry: true, rz: true },
      allowedAngleRange: { minAngleDeg: 90, maxAngleDeg: 90, targetAngleDeg: 90 },
      allowedDOF: {
        translation: { x: false, y: false, z: false },
        rotation: { rx: false, ry: false, rz: false },
      },
    },
  };
}

export function createInterlockInterface(
  owningPieceId: ID,
  name = "Interlock Finger Interface",
  width = 15.0,
): ConnectionInterfaceSystem {
  return {
    id: uid("if_lock_"),
    owningPieceId,
    name,
    type: "interlock",
    localFrame: createInterfaceLocalFrame3D(vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, -1, 0)),
    interfaceGeometry: { edgeIndex: 0, parametricStart: 0.0, parametricEnd: 1.0, length: width },
    profile: { kind: "interlock_finger", width, depth: 5.0, height: 2.0 },
    compatibility: {
      genderRole: "insert",
      allowedTypes: ["interlock"],
      compatibleGenderRoles: ["receiver", "insert"],
      allowSameGenderOverride: true,
    },
    tolerance: 0.1,
    clearance: 0.0,
    insertionDirection: vec3(0, -1, 0),
    kinematicConstraints: {
      insertionDirection: vec3(0, -1, 0),
      translationConstraints: { tx: true, ty: true, tz: true },
      rotationConstraints: { rx: true, ry: true, rz: true },
      allowedAngleRange: { minAngleDeg: 90, maxAngleDeg: 90, targetAngleDeg: 90 },
      allowedDOF: {
        translation: { x: false, y: false, z: false },
        rotation: { rx: false, ry: false, rz: false },
      },
    },
  };
}

export function createHingeInterface(
  owningPieceId: ID,
  name = "Hinge Joint Interface",
): ConnectionInterfaceSystem {
  return {
    id: uid("if_hinge_"),
    owningPieceId,
    name,
    type: "hinge_like",
    localFrame: createInterfaceLocalFrame3D(vec3(0, 0, 0), vec3(1, 0, 0), vec3(0, -1, 0)),
    interfaceGeometry: { edgeIndex: 0, parametricStart: 0.0, parametricEnd: 1.0, length: 30.0 },
    profile: { kind: "hinge_knuckle", width: 30.0, depth: 3.0, height: 2.0 },
    compatibility: {
      genderRole: "neutral",
      allowedTypes: ["hinge_like"],
      compatibleGenderRoles: ["neutral"],
    },
    tolerance: 0.2,
    clearance: 0.0,
    insertionDirection: vec3(1, 0, 0), // Slides along hinge pin axis
    kinematicConstraints: {
      insertionDirection: vec3(1, 0, 0),
      translationConstraints: { tx: true, ty: true, tz: true },
      rotationConstraints: { rx: false, ry: true, rz: true }, // Rotational freedom around hinge axis Rx
      allowedAngleRange: { minAngleDeg: 0, maxAngleDeg: 180, targetAngleDeg: 90 },
      allowedDOF: {
        translation: { x: false, y: false, z: false },
        rotation: { rx: true, ry: false, rz: false }, // 1 DOF rotational freedom around X
      },
    },
  };
}
