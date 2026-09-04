/**
 * Rotational Connector Generator (Phase 83).
 *
 * Generates cylindrical pivot / boss & socket connections allowing continuous
 * or bounded rotation around the mating normal axis (Z-axis).
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

export class RotationalGenerator {
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

    const bossDiameter = Number(Math.max(6.0, Math.min(ifReq.edgeLengthMm * 0.35, 18.0)).toFixed(2));
    const bossHeight = Number(Math.max(3.0, pieceA.thicknessMm).toFixed(2));
    const socketDiameter = Number((bossDiameter + 2 * clearance).toFixed(2));

    const ifAId = uid("if_rot_boss_");
    const ifBId = uid("if_rot_socket_");
    const tangent = ifReq.contactTangent ?? { x: -ifReq.contactNormal.y, y: ifReq.contactNormal.x };

    const interfaceA: CanonicalInterface = {
      id: ifAId,
      owningPieceId: pieceA.id,
      name: `Rotational Boss (${pieceA.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.4, parametricEnd: 0.6, length: bossDiameter },
      interfaceType: "peg",
      profile: { profileKind: "peg", width: bossDiameter, depth: bossHeight, clearance },
      compatibility: {
        allowedTypes: ["hole", "rotational"],
        genderRole: "insert",
        complementaryPatterns: ["rotational"],
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
        rotation: { rx: false, ry: false, rz: true }, // Rotation around Z axis
      },
    };

    const interfaceB: CanonicalInterface = {
      id: ifBId,
      owningPieceId: pieceB.id,
      name: `Rotational Socket (${pieceB.id})`,
      edgeGeometry: { edgeIndex: 0, parametricStart: 0.4, parametricEnd: 0.6, length: socketDiameter },
      interfaceType: "hole",
      profile: { profileKind: "hole", width: socketDiameter, depth: bossHeight + clearance, clearance },
      compatibility: {
        allowedTypes: ["peg", "rotational"],
        genderRole: "receiver",
        complementaryPatterns: ["rotational"],
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
        rotation: { rx: false, ry: false, rz: true },
      },
    };

    // Circular plug and socket approximations (16 points)
    const plugOutline = [];
    const socketOutline = [];
    const numPts = 16;
    for (let i = 0; i < numPts; i++) {
      const a = (i / numPts) * Math.PI * 2;
      plugOutline.push({
        x: (Math.cos(a) * bossDiameter) / 2,
        y: (Math.sin(a) * bossDiameter) / 2,
      });
      socketOutline.push({
        x: (Math.cos(a) * socketDiameter) / 2,
        y: (Math.sin(a) * socketDiameter) / 2,
      });
    }

    const geometry: ConnectorGeometry = {
      plugShape: {
        kind: "circle",
        x: -bossDiameter / 2,
        y: -bossDiameter / 2,
        width: bossDiameter,
        height: bossDiameter,
        rotation: 0,
      },
      socketShape: {
        kind: "circle",
        x: -socketDiameter / 2,
        y: -socketDiameter / 2,
        width: socketDiameter,
        height: socketDiameter,
        rotation: 0,
      },
      plugOutline,
      socketOutline,
    };

    const parameters: ConnectorParameters = {
      tabWidth: bossDiameter,
      tabDepth: bossHeight,
      slotWidth: socketDiameter,
      slotDepth: bossHeight + clearance,
      position: ifReq.contactCenter,
      clearance,
      materialThickness: pieceA.thicknessMm,
      joiningAngleDeg: joiningAngle,
      extraParams: { bossDiameter, socketDiameter, continuousRotation: true },
    };

    const compatibility: CompatibilityRules = {
      allowedTypes: ["rotational", "peg_hole"],
      genderPair: { roleA: "insert", roleB: "receiver" },
      materialCompatible: true,
      notes: ["Cylindrical rotational pivot with 360° continuous rotation."],
    };

    const allowedAngleRange: AllowedAngleRange = {
      nominalAngleDeg: joiningAngle,
      minAngleDeg: 0.0,
      maxAngleDeg: 360.0,
      rotationAxis: vec3(0, 0, 1),
    };

    const assemblyConstraints: AssemblyConstraints = {
      insertionDirection: vec3(0, 0, 1), // Snaps in along Z axis
      allowedDOF: {
        translation: { x: false, y: false, z: false },
        rotation: { rx: false, ry: false, rz: true }, // Full 360 rotation
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
