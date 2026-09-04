/**
 * Interlock Connector Generator (Phase 83).
 *
 * Generates dovetail / puzzle bulb interlocking joints providing mechanical
 * lock against in-plane tension / pull-out.
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

export class InterlockGenerator {
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

    const headWidth = Number(Math.max(10.0, Math.min(ifReq.edgeLengthMm * 0.45, 22.0)).toFixed(2));
    const neckWidth = Number((headWidth * 0.6).toFixed(2));
    const depth = Number(Math.max(4.0, Math.min(pieceA.thicknessMm * 1.8, 12.0)).toFixed(2));

    const slotHeadWidth = Number((headWidth + 2 * clearance).toFixed(2));
    const slotNeckWidth = Number((neckWidth + 2 * clearance).toFixed(2));
    const slotDepth = Number((depth + clearance).toFixed(2));

    const ifAId = uid("if_interlock_a_");
    const ifBId = uid("if_interlock_b_");
    const tangent = ifReq.contactTangent ?? { x: -ifReq.contactNormal.y, y: ifReq.contactNormal.x };

    const interfaceA: CanonicalInterface = {
      id: ifAId,
      owningPieceId: pieceA.id,
      name: `Dovetail Port (${pieceA.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.35, parametricEnd: 0.65, length: headWidth },
      interfaceType: "dovetail",
      profile: { profileKind: "dovetail", width: headWidth, depth, clearance },
      compatibility: {
        allowedTypes: ["dovetail", "interlock"],
        genderRole: "insert",
        complementaryPatterns: ["dovetail"],
      },
      localFrame: {
        origin: vec3(ifReq.contactCenter.x, ifReq.contactCenter.y, 0),
        tangent: vec3(tangent.x, tangent.y, 0),
        normal: vec3(ifReq.contactNormal.x, ifReq.contactNormal.y, 0),
        binormal: vec3(0, 0, 1),
      },
      tolerance: clearance,
      allowedDOF: {
        translation: { x: false, y: false, z: true }, // Can slide in along Z (extrusion axis)
        rotation: { rx: false, ry: false, rz: false },
      },
    };

    const interfaceB: CanonicalInterface = {
      id: ifBId,
      owningPieceId: pieceB.id,
      name: `Dovetail Socket Port (${pieceB.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.35, parametricEnd: 0.65, length: slotHeadWidth },
      interfaceType: "slot",
      profile: { profileKind: "dovetail", width: slotHeadWidth, depth: slotDepth, clearance },
      compatibility: {
        allowedTypes: ["dovetail", "interlock"],
        genderRole: "receiver",
        complementaryPatterns: ["dovetail"],
      },
      localFrame: {
        origin: vec3(ifReq.contactCenter.x, ifReq.contactCenter.y, 0),
        tangent: vec3(-tangent.x, -tangent.y, 0),
        normal: vec3(-ifReq.contactNormal.x, -ifReq.contactNormal.y, 0),
        binormal: vec3(0, 0, -1),
      },
      tolerance: clearance,
      allowedDOF: {
        translation: { x: false, y: false, z: true },
        rotation: { rx: false, ry: false, rz: false },
      },
    };

    // Dovetail trapezoidal contour
    const plugOutline = [
      { x: -neckWidth / 2, y: 0 },
      { x: neckWidth / 2, y: 0 },
      { x: headWidth / 2, y: depth },
      { x: -headWidth / 2, y: depth },
    ];

    const socketOutline = [
      { x: -slotNeckWidth / 2, y: 0 },
      { x: slotNeckWidth / 2, y: 0 },
      { x: slotHeadWidth / 2, y: -slotDepth },
      { x: -slotHeadWidth / 2, y: -slotDepth },
    ];

    const geometry: ConnectorGeometry = {
      plugShape: {
        kind: "polygon",
        x: -headWidth / 2,
        y: 0,
        width: headWidth,
        height: depth,
        rotation: 0,
        nodes: plugOutline,
        closed: true,
      },
      socketShape: {
        kind: "polygon",
        x: -slotHeadWidth / 2,
        y: -slotDepth,
        width: slotHeadWidth,
        height: slotDepth,
        rotation: 0,
        nodes: socketOutline,
        closed: true,
      },
      plugOutline,
      socketOutline,
    };

    const parameters: ConnectorParameters = {
      tabWidth: headWidth,
      tabDepth: depth,
      slotWidth: slotHeadWidth,
      slotDepth,
      position: ifReq.contactCenter,
      clearance,
      materialThickness: pieceA.thicknessMm,
      joiningAngleDeg: joiningAngle,
      extraParams: { neckWidth, slotNeckWidth },
    };

    const compatibility: CompatibilityRules = {
      allowedTypes: ["dovetail", "interlock"],
      genderPair: { roleA: "insert", roleB: "receiver" },
      materialCompatible: true,
      notes: ["Interlocking dovetail joint with tension resistance."],
    };

    const allowedAngleRange: AllowedAngleRange = {
      nominalAngleDeg: joiningAngle,
      minAngleDeg: joiningAngle,
      maxAngleDeg: joiningAngle,
      rotationAxis: vec3(0, 0, 1),
    };

    const assemblyConstraints: AssemblyConstraints = {
      insertionDirection: vec3(0, 0, 1), // Slides into dovetail slot along Z axis
      allowedDOF: {
        translation: { x: false, y: false, z: true },
        rotation: { rx: false, ry: false, rz: false },
      },
      lockingMechanism: "detent",
      reversible: true,
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
