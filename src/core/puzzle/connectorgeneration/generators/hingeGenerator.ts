/**
 * Hinge Connector Generator (Phase 83).
 *
 * Generates knuckle/pin hinge connections providing 1 rotational DOF along a defined
 * spatial axis, bounded by configurable angle limits (e.g. 0° to 180°).
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

export class HingeGenerator {
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
    const clearance = ClearanceCalculator.calculateClearance(pieceA.thicknessMm, ifReq.clearanceOverrideMm);

    const hingeWidth = Number(Math.max(12.0, Math.min(ifReq.edgeLengthMm * 0.4, 28.0)).toFixed(2));
    const pinDiameter = Number(Math.max(2.5, Math.min(pieceA.thicknessMm * 0.8, 6.0)).toFixed(2));
    const knuckleDepth = Number((pinDiameter * 1.6).toFixed(2));

    const ifAId = uid("if_hinge_a_");
    const ifBId = uid("if_hinge_b_");
    const tangent = ifReq.contactTangent ?? { x: -ifReq.contactNormal.y, y: ifReq.contactNormal.x };

    const interfaceA: CanonicalInterface = {
      id: ifAId,
      owningPieceId: pieceA.id,
      name: `Hinge Knuckle (${pieceA.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.3, parametricEnd: 0.7, length: hingeWidth },
      interfaceType: "hinge",
      profile: { profileKind: "hinge", width: hingeWidth, depth: knuckleDepth, clearance },
      compatibility: {
        allowedTypes: ["hinge"],
        genderRole: "neutral",
        complementaryPatterns: ["hinge"],
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
        rotation: { rx: true, ry: false, rz: false }, // 1 rotational DOF along tangent axis
      },
    };

    const interfaceB: CanonicalInterface = {
      id: ifBId,
      owningPieceId: pieceB.id,
      name: `Hinge Receiver (${pieceB.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.3, parametricEnd: 0.7, length: hingeWidth },
      interfaceType: "hinge",
      profile: { profileKind: "hinge", width: hingeWidth + 2 * clearance, depth: knuckleDepth + clearance, clearance },
      compatibility: {
        allowedTypes: ["hinge"],
        genderRole: "neutral",
        complementaryPatterns: ["hinge"],
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
        rotation: { rx: true, ry: false, rz: false },
      },
    };

    const plugOutline = [
      { x: -hingeWidth / 2, y: 0 },
      { x: hingeWidth / 2, y: 0 },
      { x: hingeWidth / 2, y: knuckleDepth },
      { x: -hingeWidth / 2, y: knuckleDepth },
    ];

    const socketOutline = [
      { x: -(hingeWidth / 2 + clearance), y: 0 },
      { x: hingeWidth / 2 + clearance, y: 0 },
      { x: hingeWidth / 2 + clearance, y: -(knuckleDepth + clearance) },
      { x: -(hingeWidth / 2 + clearance), y: -(knuckleDepth + clearance) },
    ];

    const geometry: ConnectorGeometry = {
      plugShape: {
        kind: "roundedRect",
        x: -hingeWidth / 2,
        y: 0,
        width: hingeWidth,
        height: knuckleDepth,
        radius: pinDiameter / 2,
        rotation: 0,
      },
      socketShape: {
        kind: "roundedRect",
        x: -(hingeWidth / 2 + clearance),
        y: -(knuckleDepth + clearance),
        width: hingeWidth + 2 * clearance,
        height: knuckleDepth + clearance,
        radius: pinDiameter / 2 + clearance,
        rotation: 0,
      },
      plugOutline,
      socketOutline,
    };

    const parameters: ConnectorParameters = {
      tabWidth: hingeWidth,
      tabDepth: knuckleDepth,
      slotWidth: hingeWidth + 2 * clearance,
      slotDepth: knuckleDepth + clearance,
      position: ifReq.contactCenter,
      clearance,
      materialThickness: pieceA.thicknessMm,
      joiningAngleDeg: joiningAngle,
      extraParams: { pinDiameter, minAngleDeg: 0.0, maxAngleDeg: 180.0 },
    };

    const compatibility: CompatibilityRules = {
      allowedTypes: ["hinge"],
      genderPair: { roleA: "insert", roleB: "receiver" },
      materialCompatible: true,
      notes: ["1-DOF rotational hinge connection."],
    };

    const allowedAngleRange: AllowedAngleRange = {
      nominalAngleDeg: joiningAngle,
      minAngleDeg: 0.0,
      maxAngleDeg: 180.0,
      rotationAxis: vec3(tangent.x, tangent.y, 0), // Hinge axis along edge tangent
    };

    const assemblyConstraints: AssemblyConstraints = {
      insertionDirection: vec3(tangent.x, tangent.y, 0), // Pin slides along tangent axis
      allowedDOF: {
        translation: { x: false, y: false, z: false },
        rotation: { rx: true, ry: false, rz: false }, // 1 rotational DOF
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
