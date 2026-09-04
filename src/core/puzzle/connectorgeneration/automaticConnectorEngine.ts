/**
 * Automatic Connector Generation Engine (Phase 83).
 *
 * Automatically generates, sizes, and validates geometrically complementary
 * connectors between pieces supporting arbitrary non-coplanar 3D assembly angles.
 */

import type {
  ConnectorGenerationRequest,
  ConnectorType,
  ConnectorValidationResult,
  GeneratedConnectorPair,
} from "./types";
import { TabSlotGenerator } from "./generators/tabSlotGenerator";
import { NotchGenerator } from "./generators/notchGenerator";
import { InterlockGenerator } from "./generators/interlockGenerator";
import { KeyedGenerator } from "./generators/keyedGenerator";
import { HingeGenerator } from "./generators/hingeGenerator";
import { RotationalGenerator } from "./generators/rotationalGenerator";
import { CustomGenerator } from "./generators/customGenerator";
import { ConnectorValidator } from "./connectorValidator";
import { ConnectionModelFactory } from "../connection/connectionModel";
import { uid } from "@/core/model/ids";

export class AutomaticConnectorEngine {
  /**
   * Automatically creates a complete, validated, complementary connector pair.
   */
  public static createConnector(request: ConnectorGenerationRequest): {
    connectorPair: GeneratedConnectorPair;
    validation: ConnectorValidationResult;
  } {
    const type: ConnectorType = request.interface.preferredType ?? "tab_slot";

    let genResult;
    switch (type) {
      case "notch":
        genResult = NotchGenerator.generate(request);
        break;
      case "interlock":
        genResult = InterlockGenerator.generate(request);
        break;
      case "keyed":
        genResult = KeyedGenerator.generate(request);
        break;
      case "hinge":
        genResult = HingeGenerator.generate(request);
        break;
      case "rotational":
        genResult = RotationalGenerator.generate(request);
        break;
      case "custom":
        genResult = CustomGenerator.generate(request);
        break;
      case "tab_slot":
      default:
        genResult = TabSlotGenerator.generate(request);
        break;
    }

    const connectionId = uid(`conn_${type}_`);

    // Build Advanced 3D Connection model
    const frameA = {
      origin: genResult.interfaceA.localFrame.origin,
      tangent: genResult.interfaceA.localFrame.tangent,
      normal: genResult.interfaceA.localFrame.normal,
      binormal: genResult.interfaceA.localFrame.binormal,
    };

    const frameB = {
      origin: genResult.interfaceB.localFrame.origin,
      tangent: genResult.interfaceB.localFrame.tangent,
      normal: genResult.interfaceB.localFrame.normal,
      binormal: genResult.interfaceB.localFrame.binormal,
    };

    const advancedConnection = ConnectionModelFactory.createConnection({
      id: connectionId,
      name: `${type} Connection (${request.pieceA.id} <-> ${request.pieceB.id})`,
      interfaceAId: genResult.interfaceA.id,
      interfaceBId: genResult.interfaceB.id,
      pieceAId: request.pieceA.id,
      pieceBId: request.pieceB.id,
      connectionType: type,
      behavior:
        type === "hinge"
          ? "HINGE"
          : type === "rotational"
          ? "ROTATIONAL"
          : type === "interlock"
          ? "INTERLOCK"
          : "FIXED",
      frameA,
      frameB,
      joiningAngleDeg: genResult.allowedAngleRange.nominalAngleDeg,
      angleLimits: {
        minAngleDeg: genResult.allowedAngleRange.minAngleDeg,
        maxAngleDeg: genResult.allowedAngleRange.maxAngleDeg,
        nominalAngleDeg: genResult.allowedAngleRange.nominalAngleDeg,
      },
      clearance: genResult.clearance,
    });

    const connectorPair: GeneratedConnectorPair = {
      connectionId,
      type,
      interfaceA: genResult.interfaceA,
      interfaceB: genResult.interfaceB,
      geometry: genResult.geometry,
      parameters: genResult.parameters,
      compatibility: genResult.compatibility,
      clearance: genResult.clearance,
      allowedAngleRange: genResult.allowedAngleRange,
      assemblyConstraints: genResult.assemblyConstraints,
      advancedConnection,
    };

    const validation = ConnectorValidator.validate(connectorPair, request.interface.edgeLengthMm);

    return {
      connectorPair,
      validation,
    };
  }
}
