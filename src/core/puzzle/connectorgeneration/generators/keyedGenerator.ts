/**
 * Keyed Connector Generator (Phase 83).
 *
 * Generates asymmetric keyed plug and keyway slot enforcing 1-way insertion
 * and preventing inverted or 180°-rotated erroneous assembly.
 */

import type { CanonicalInterface } from "../../canonical/types";
import type {
  AllowedAngleRange,
  AssemblyConstraints,
  CompatibilityRules,
  ConnectorGeometry,
  ConnectorGenerationRequest,
  ConnectorParameters,
} from "../types";
import { ClearanceCalculator } from "../clearanceCalculator";
import { vec3 } from "../../geometry/math3d";
import { uid } from "@/core/model/ids";

export class KeyedGenerator {
  public static generate(request: ConnectorGenerationRequest): {
    interfaceA: CanonicalInterface;
    interfaceB: CanonicalInterface;
    geometry: ConnectorGeometry;
    parameters: ConnectorParameters;
    compatibility: CompatibilityRules;
    allowedAngleRange: AllowedAngleRange;
    assemblyConstraints: AssemblyConstraints;
    clearance: number;
  } {
    const { pieceA, pieceB, interface: ifReq } = request;
    const joiningAngle = ifReq.targetJoiningAngleDeg ?? 180.0;
    const clearance = ClearanceCalculator.calculateClearance(pieceA.thicknessMm, ifReq.clearanceOverrideMm);

    const baseWidth = Number(Math.max(12.0, Math.min(ifReq.edgeLengthMm * 0.45, 26.0)).toFixed(2));
    const baseDepth = Number(Math.max(4.0, Math.min(pieceA.thicknessMm * 1.5, 10.0)).toFixed(2));
    const keyWidth = 4.0;
    const keyExtraDepth = 2.0;

    const slotBaseWidth = Number((baseWidth + 2 * clearance).toFixed(2));
    const slotBaseDepth = Number((baseDepth + clearance).toFixed(2));
    const slotKeyWidth = Number((keyWidth + 2 * clearance).toFixed(2));
    const slotKeyExtraDepth = Number((keyExtraDepth + clearance).toFixed(2));

    const ifAId = uid("if_keyed_plug_");
    const ifBId = uid("if_keyed_slot_");
    const tangent = ifReq.contactTangent ?? { x: -ifReq.contactNormal.y, y: ifReq.contactNormal.x };

    const interfaceA: CanonicalInterface = {
      id: ifAId,
      owningPieceId: pieceA.id,
      name: `Keyed Plug (${pieceA.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.3, parametricEnd: 0.7, length: baseWidth },
      interfaceType: "custom",
      profile: { profileKind: "keyed", width: baseWidth, depth: baseDepth + keyExtraDepth, clearance },
      compatibility: {
        allowedTypes: ["keyed_slot"],
        genderRole: "insert",
        complementaryPatterns: ["keyed"],
      },
      localFrame: {
        origin: vec3(ifReq.contactCenter.x, ifReq.contactCenter.y, 0),
        tangent: vec3(tangent.x, tangent.y, 0),
        normal: vec3(ifReq.contactNormal.x, ifReq.contactNormal.y, 0),
        binormal: vec3(0, 0, 1),
      },
      tolerance: clearance,
      allowedDOF: {
        translation: { x: false, y: false, z: false },
        rotation: { rx: false, ry: false, rz: false },
      },
    };

    const interfaceB: CanonicalInterface = {
      id: ifBId,
      owningPieceId: pieceB.id,
      name: `Keyed Keyway (${pieceB.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.3, parametricEnd: 0.7, length: slotBaseWidth },
      interfaceType: "custom",
      profile: { profileKind: "keyed", width: slotBaseWidth, depth: slotBaseDepth + slotKeyExtraDepth, clearance },
      compatibility: {
        allowedTypes: ["keyed_plug"],
        genderRole: "receiver",
        complementaryPatterns: ["keyed"],
      },
      localFrame: {
        origin: vec3(ifReq.contactCenter.x, ifReq.contactCenter.y, 0),
        tangent: vec3(-tangent.x, -tangent.y, 0),
        normal: vec3(-ifReq.contactNormal.x, -ifReq.contactNormal.y, 0),
        binormal: vec3(0, 0, -1),
      },
      tolerance: clearance,
      allowedDOF: {
        translation: { x: false, y: false, z: false },
        rotation: { rx: false, ry: false, rz: false },
      },
    };

    // Asymmetric polygon with key bump on right side
    const plugOutline = [
      { x: -baseWidth / 2, y: 0 },
      { x: baseWidth / 2, y: 0 },
      { x: baseWidth / 2, y: baseDepth },
      { x: baseWidth / 2 - keyWidth, y: baseDepth + keyExtraDepth }, // Key bump
      { x: baseWidth / 4, y: baseDepth },
      { x: -baseWidth / 2, y: baseDepth },
    ];

    const socketOutline = [
      { x: -slotBaseWidth / 2, y: 0 },
      { x: slotBaseWidth / 2, y: 0 },
      { x: slotBaseWidth / 2, y: -slotBaseDepth },
      { x: slotBaseWidth / 2 - slotKeyWidth, y: -(slotBaseDepth + slotKeyExtraDepth) },
      { x: slotBaseWidth / 4, y: -slotBaseDepth },
      { x: -slotBaseWidth / 2, y: -slotBaseDepth },
    ];

    const geometry: ConnectorGeometry = {
      plugShape: {
        kind: "polygon",
        x: -baseWidth / 2,
        y: 0,
        width: baseWidth,
        height: baseDepth + keyExtraDepth,
        rotation: 0,
        nodes: plugOutline,
        closed: true,
      },
      socketShape: {
        kind: "polygon",
        x: -slotBaseWidth / 2,
        y: -(slotBaseDepth + slotKeyExtraDepth),
        width: slotBaseWidth,
        height: slotBaseDepth + slotKeyExtraDepth,
        rotation: 0,
        nodes: socketOutline,
        closed: true,
      },
      plugOutline,
      socketOutline,
    };

    const parameters: ConnectorParameters = {
      tabWidth: baseWidth,
      tabDepth: baseDepth + keyExtraDepth,
      slotWidth: slotBaseWidth,
      slotDepth: slotBaseDepth + slotKeyExtraDepth,
      position: ifReq.contactCenter,
      clearance,
      materialThickness: pieceA.thicknessMm,
      joiningAngleDeg: joiningAngle,
      extraParams: { keyWidth, keyExtraDepth },
    };

    const compatibility: CompatibilityRules = {
      allowedTypes: ["keyed"],
      genderPair: { roleA: "insert", roleB: "receiver" },
      materialCompatible: true,
      notes: ["Keyed asymmetric joint with anti-inversion geometry."],
    };

    const allowedAngleRange: AllowedAngleRange = {
      nominalAngleDeg: joiningAngle,
      minAngleDeg: joiningAngle,
      maxAngleDeg: joiningAngle,
      rotationAxis: vec3(0, 0, 1),
    };

    const assemblyConstraints: AssemblyConstraints = {
      insertionDirection: vec3(ifReq.contactNormal.x, ifReq.contactNormal.y, 0),
      allowedDOF: {
        translation: { x: false, y: false, z: false },
        rotation: { rx: false, ry: false, rz: false },
      },
      lockingMechanism: "keyed",
      reversible: false, // strictly 1-way
    };

    return {
      interfaceA,
      interfaceB,
      geometry,
      parameters,
      compatibility,
      allowedAngleRange,
      assemblyConstraints,
      clearance,
    };
  }
}
