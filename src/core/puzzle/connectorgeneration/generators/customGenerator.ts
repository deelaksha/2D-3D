/**
 * Custom Connector Generator (Phase 83).
 *
 * Supports arbitrary user-specified parametric profiles, custom kinematics,
 * and custom degrees of freedom.
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

export class CustomGenerator {
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
    const custom = ifReq.customParameters || {};

    const clearance = ClearanceCalculator.calculateClearance(pieceA.thicknessMm, ifReq.clearanceOverrideMm);
    const featureWidth = custom.widthMm ?? Number(Math.max(8.0, Math.min(ifReq.edgeLengthMm * 0.4, 25.0)).toFixed(2));
    const featureDepth = custom.depthMm ?? Number(Math.max(3.0, pieceA.thicknessMm * 1.5).toFixed(2));
    const customPatternName = custom.patternName || "custom_profile";

    const slotWidth = Number((featureWidth + 2 * clearance).toFixed(2));
    const slotDepth = Number((featureDepth + clearance).toFixed(2));

    const ifAId = uid("if_cust_a_");
    const ifBId = uid("if_cust_b_");
    const tangent = ifReq.contactTangent ?? { x: -ifReq.contactNormal.y, y: ifReq.contactNormal.x };

    const interfaceA: CanonicalInterface = {
      id: ifAId,
      owningPieceId: pieceA.id,
      name: `Custom Connector (${pieceA.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.3, parametricEnd: 0.7, length: featureWidth },
      interfaceType: "custom",
      profile: { profileKind: "custom", width: featureWidth, depth: featureDepth, clearance },
      compatibility: {
        allowedTypes: [customPatternName, "custom"],
        genderRole: "insert",
        complementaryPatterns: [customPatternName],
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
      name: `Custom Socket (${pieceB.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.3, parametricEnd: 0.7, length: slotWidth },
      interfaceType: "custom",
      profile: { profileKind: "custom", width: slotWidth, depth: slotDepth, clearance },
      compatibility: {
        allowedTypes: [customPatternName, "custom"],
        genderRole: "receiver",
        complementaryPatterns: [customPatternName],
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

    const plugOutline = [
      { x: -featureWidth / 2, y: 0 },
      { x: featureWidth / 2, y: 0 },
      { x: featureWidth / 2, y: featureDepth },
      { x: -featureWidth / 2, y: featureDepth },
    ];

    const socketOutline = [
      { x: -slotWidth / 2, y: 0 },
      { x: slotWidth / 2, y: 0 },
      { x: slotWidth / 2, y: -slotDepth },
      { x: -slotWidth / 2, y: -slotDepth },
    ];

    const geometry: ConnectorGeometry = {
      plugShape: {
        kind: "rect",
        x: -featureWidth / 2,
        y: 0,
        width: featureWidth,
        height: featureDepth,
        rotation: 0,
      },
      socketShape: {
        kind: "rect",
        x: -slotWidth / 2,
        y: -slotDepth,
        width: slotWidth,
        height: slotDepth,
        rotation: 0,
      },
      plugOutline,
      socketOutline,
    };

    const parameters: ConnectorParameters = {
      tabWidth: featureWidth,
      tabDepth: featureDepth,
      slotWidth,
      slotDepth,
      position: ifReq.contactCenter,
      clearance,
      materialThickness: pieceA.thicknessMm,
      joiningAngleDeg: joiningAngle,
      extraParams: custom,
    };

    const compatibility: CompatibilityRules = {
      allowedTypes: [customPatternName, "custom"],
      genderPair: { roleA: "insert", roleB: "receiver" },
      materialCompatible: true,
      notes: [`Custom parameterized connector profile (${customPatternName}).`],
    };

    const allowedAngleRange: AllowedAngleRange = {
      nominalAngleDeg: joiningAngle,
      minAngleDeg: custom.minAngleDeg ?? joiningAngle - 5.0,
      maxAngleDeg: custom.maxAngleDeg ?? joiningAngle + 5.0,
      rotationAxis: custom.rotationAxis ?? vec3(0, 0, 1),
    };

    const assemblyConstraints: AssemblyConstraints = {
      insertionDirection: custom.insertionDirection ?? vec3(ifReq.contactNormal.x, ifReq.contactNormal.y, 0),
      allowedDOF: custom.allowedDOF ?? {
        translation: { x: false, y: false, z: false },
        rotation: { rx: false, ry: false, rz: false },
      },
      lockingMechanism: custom.lockingMechanism ?? "friction",
      reversible: custom.reversible ?? true,
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
