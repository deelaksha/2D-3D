/**
 * Notch Connector Generator (Phase 83).
 *
 * Generates crossing half-lap notches for perpendicular (90°) interlocking joints.
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

export class NotchGenerator {
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
    const joiningAngle = ifReq.targetJoiningAngleDeg ?? 90.0;

    const { notchWidthA, notchDepthA, notchWidthB, notchDepthB, clearance } =
      ClearanceCalculator.calculateNotchDimensions(
        ifReq.edgeLengthMm,
        pieceA.thicknessMm,
        pieceB.thicknessMm,
        ifReq.clearanceOverrideMm
      );

    const ifAId = uid("if_notch_a_");
    const ifBId = uid("if_notch_b_");
    const tangent = ifReq.contactTangent ?? { x: -ifReq.contactNormal.y, y: ifReq.contactNormal.x };

    const interfaceA: CanonicalInterface = {
      id: ifAId,
      owningPieceId: pieceA.id,
      name: `Notch Port (${pieceA.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.4, parametricEnd: 0.6, length: notchWidthA },
      interfaceType: "slot",
      profile: { profileKind: "notch", width: notchWidthA, depth: notchDepthA, clearance },
      compatibility: {
        allowedTypes: ["notch", "slot"],
        genderRole: "receiver",
        complementaryPatterns: ["notch"],
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
      name: `Notch Port (${pieceB.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.4, parametricEnd: 0.6, length: notchWidthB },
      interfaceType: "slot",
      profile: { profileKind: "notch", width: notchWidthB, depth: notchDepthB, clearance },
      compatibility: {
        allowedTypes: ["notch", "slot"],
        genderRole: "receiver",
        complementaryPatterns: ["notch"],
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

    const geometry: ConnectorGeometry = {
      plugShape: {
        kind: "rect",
        x: -notchWidthA / 2,
        y: -notchDepthA,
        width: notchWidthA,
        height: notchDepthA,
        rotation: 0,
      },
      socketShape: {
        kind: "rect",
        x: -notchWidthB / 2,
        y: -notchDepthB,
        width: notchWidthB,
        height: notchDepthB,
        rotation: 0,
      },
      plugOutline: [
        { x: -notchWidthA / 2, y: 0 },
        { x: notchWidthA / 2, y: 0 },
        { x: notchWidthA / 2, y: -notchDepthA },
        { x: -notchWidthA / 2, y: -notchDepthA },
      ],
      socketOutline: [
        { x: -notchWidthB / 2, y: 0 },
        { x: notchWidthB / 2, y: 0 },
        { x: notchWidthB / 2, y: -notchDepthB },
        { x: -notchWidthB / 2, y: -notchDepthB },
      ],
    };

    const parameters: ConnectorParameters = {
      tabWidth: notchWidthA,
      tabDepth: notchDepthA,
      slotWidth: notchWidthB,
      slotDepth: notchDepthB,
      position: ifReq.contactCenter,
      clearance,
      materialThickness: pieceA.thicknessMm,
      joiningAngleDeg: joiningAngle,
      extraParams: { halfLapDepthA: notchDepthA, halfLapDepthB: notchDepthB },
    };

    const compatibility: CompatibilityRules = {
      allowedTypes: ["notch"],
      genderPair: { roleA: "receiver", roleB: "receiver" }, // Neutral/crossing joint
      materialCompatible: true,
      notes: ["Crossing half-lap notch joint."],
    };

    const allowedAngleRange: AllowedAngleRange = {
      nominalAngleDeg: joiningAngle,
      minAngleDeg: joiningAngle - 1.0,
      maxAngleDeg: joiningAngle + 1.0,
      rotationAxis: vec3(0, 0, 1),
    };

    const assemblyConstraints: AssemblyConstraints = {
      insertionDirection: vec3(0, 0, 1), // Slides along Z axis into crossing notch
      allowedDOF: {
        translation: { x: false, y: false, z: false },
        rotation: { rx: false, ry: false, rz: false },
      },
      lockingMechanism: "gravity",
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
