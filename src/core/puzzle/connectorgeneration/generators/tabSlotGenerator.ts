/**
 * Tab-Slot Connector Generator (Phase 83).
 *
 * Generates complementary male tab on Piece A and female slot on Piece B,
 * supporting both planar (180°) and orthogonal (90°) joining.
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

export class TabSlotGenerator {
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

    const { tabWidth, tabDepth, slotWidth, slotDepth, clearance } =
      ClearanceCalculator.calculateTabSlotDimensions(
        ifReq.edgeLengthMm,
        pieceA.thicknessMm,
        pieceB.thicknessMm,
        joiningAngle,
        ifReq.clearanceOverrideMm
      );

    const ifAId = uid("if_tab_");
    const ifBId = uid("if_slot_");

    // Tangent in 2D
    const tangent = ifReq.contactTangent ?? { x: -ifReq.contactNormal.y, y: ifReq.contactNormal.x };

    // Interface A: Male Tab
    const interfaceA: CanonicalInterface = {
      id: ifAId,
      owningPieceId: pieceA.id,
      name: `Tab Port (${pieceA.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.3, parametricEnd: 0.7, length: tabWidth },
      interfaceType: "tab",
      profile: { profileKind: "tab", width: tabWidth, depth: tabDepth, clearance },
      compatibility: {
        allowedTypes: ["slot"],
        genderRole: "insert",
        complementaryPatterns: ["tab_slot"],
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

    // Interface B: Female Slot
    const interfaceB: CanonicalInterface = {
      id: ifBId,
      owningPieceId: pieceB.id,
      name: `Slot Port (${pieceB.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.3, parametricEnd: 0.7, length: slotWidth },
      interfaceType: "slot",
      profile: { profileKind: "slot", width: slotWidth, depth: slotDepth, clearance },
      compatibility: {
        allowedTypes: ["tab"],
        genderRole: "receiver",
        complementaryPatterns: ["tab_slot"],
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

    // 2D Outlines
    const plugOutline = [
      { x: -tabWidth / 2, y: 0 },
      { x: tabWidth / 2, y: 0 },
      { x: tabWidth / 2, y: tabDepth },
      { x: -tabWidth / 2, y: tabDepth },
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
        x: -tabWidth / 2,
        y: 0,
        width: tabWidth,
        height: tabDepth,
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
      tabWidth,
      tabDepth,
      slotWidth,
      slotDepth,
      position: ifReq.contactCenter,
      clearance,
      materialThickness: pieceA.thicknessMm,
      joiningAngleDeg: joiningAngle,
      extraParams: {},
    };

    const compatibility: CompatibilityRules = {
      allowedTypes: ["slot", "tab_slot"],
      genderPair: { roleA: "insert", roleB: "receiver" },
      materialCompatible: pieceA.materialId === pieceB.materialId || !pieceA.materialId,
      notes: [`Complementary tab-slot joint at ${joiningAngle}° joining angle.`],
    };

    const allowedAngleRange: AllowedAngleRange = {
      nominalAngleDeg: joiningAngle,
      minAngleDeg: joiningAngle - 2.0,
      maxAngleDeg: joiningAngle + 2.0,
      rotationAxis: vec3(tangent.x, tangent.y, 0),
    };

    const assemblyConstraints: AssemblyConstraints = {
      insertionDirection: vec3(ifReq.contactNormal.x, ifReq.contactNormal.y, 0),
      allowedDOF: {
        translation: { x: false, y: false, z: false },
        rotation: { rx: false, ry: false, rz: false },
      },
      lockingMechanism: "friction",
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
