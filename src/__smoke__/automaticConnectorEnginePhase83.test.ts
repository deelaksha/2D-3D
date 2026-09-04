/**
 * Automatic Connector Generation Engine Smoke Tests (Phase 83).
 *
 * Tests:
 *  1. Tab-slot connector (planar 180° and orthogonal 90°)
 *  2. Notch connector (crossing half-lap 90°)
 *  3. Interlock connector (dovetail mechanical tension lock)
 *  4. Keyed connector (asymmetric anti-inversion)
 *  5. Hinge connector (1 rotational DOF, 0° to 180° range)
 *  6. Rotational connector (cylindrical boss/socket, 360° rotation)
 *  7. Custom connector (user-defined parametric options)
 *  8. Geometric complementarity and clearance verification
 *  9. Deterministic validation (rejection of invalid clearances / dimensions)
 */

import { describe, expect, it } from "vitest";
import { AutomaticConnectorEngine } from "../core/puzzle/connectorgeneration/automaticConnectorEngine";
import { ConnectorValidator } from "../core/puzzle/connectorgeneration/connectorValidator";
import type { ConnectorGenerationRequest } from "../core/puzzle/connectorgeneration/types";

function createBaseRequest(preferredType: any = "tab_slot", targetJoiningAngleDeg = 180): ConnectorGenerationRequest {
  return {
    pieceA: {
      id: "piece_A_1",
      name: "Wall Left",
      thicknessMm: 3.0,
      materialId: "cardboard_3mm",
      edgeLengthMm: 50.0,
    },
    pieceB: {
      id: "piece_B_1",
      name: "Base Plate",
      thicknessMm: 3.0,
      materialId: "cardboard_3mm",
      edgeLengthMm: 50.0,
    },
    interface: {
      contactCenter: { x: 25.0, y: 0.0 },
      contactNormal: { x: 0.0, y: 1.0 },
      contactTangent: { x: 1.0, y: 0.0 },
      edgeLengthMm: 50.0,
      preferredType,
      targetJoiningAngleDeg,
    },
  };
}

describe("Automatic Connector Generation Engine (Phase 83)", () => {
  describe("Tab-Slot Connectors", () => {
    it("generates a planar tab-slot connector (180°) with complementary clearance", () => {
      const req = createBaseRequest("tab_slot", 180.0);
      const { connectorPair, validation } = AutomaticConnectorEngine.createConnector(req);

      expect(validation.isValid).toBe(true);
      expect(connectorPair.type).toBe("tab_slot");

      // Verify parametric calculations
      const p = connectorPair.parameters;
      expect(p.tabWidth).toBeGreaterThan(0);
      expect(p.tabDepth).toBeGreaterThan(0);
      expect(p.clearance).toBeCloseTo(0.15, 2);

      // Verify mathematical complementarity: slotWidth = tabWidth + 2*clearance
      expect(p.slotWidth).toBeCloseTo(p.tabWidth + 2 * p.clearance, 2);
      expect(p.slotDepth).toBeCloseTo(p.tabDepth + p.clearance, 2);

      // Verify interfaces
      expect(connectorPair.interfaceA.interfaceType).toBe("tab");
      expect(connectorPair.interfaceA.compatibility.genderRole).toBe("insert");
      expect(connectorPair.interfaceB.interfaceType).toBe("slot");
      expect(connectorPair.interfaceB.compatibility.genderRole).toBe("receiver");

      // Verify 3D joining angle
      expect(connectorPair.allowedAngleRange.nominalAngleDeg).toBe(180.0);
    });

    it("generates an orthogonal tab-slot connector (90°) matching mating piece thickness", () => {
      const req = createBaseRequest("tab_slot", 90.0);
      const { connectorPair, validation } = AutomaticConnectorEngine.createConnector(req);

      expect(validation.isValid).toBe(true);
      expect(connectorPair.allowedAngleRange.nominalAngleDeg).toBe(90.0);

      // For 90° joint, tab depth plugs through Piece B's thickness
      expect(connectorPair.parameters.tabDepth).toBe(req.pieceB.thicknessMm);
    });
  });

  describe("Notch Connectors", () => {
    it("generates crossing half-lap notches at 90° with matching half-depths", () => {
      const req = createBaseRequest("notch", 90.0);
      const { connectorPair, validation } = AutomaticConnectorEngine.createConnector(req);

      expect(validation.isValid).toBe(true);
      expect(connectorPair.type).toBe("notch");

      const p = connectorPair.parameters;
      // In half-lap, each notch cuts half the stock thickness
      expect(p.tabDepth).toBeCloseTo(req.pieceA.thicknessMm * 0.5, 2);
      expect(p.slotDepth).toBeCloseTo(req.pieceB.thicknessMm * 0.5, 2);

      // Assembly slides along Z
      expect(connectorPair.assemblyConstraints.insertionDirection.z).toBe(1);
    });
  });

  describe("Interlock Connectors", () => {
    it("generates dovetail interlocking joint resisting in-plane tension", () => {
      const req = createBaseRequest("interlock", 180.0);
      const { connectorPair, validation } = AutomaticConnectorEngine.createConnector(req);

      expect(validation.isValid).toBe(true);
      expect(connectorPair.type).toBe("interlock");

      // Verify neck vs head width
      const p = connectorPair.parameters;
      expect(p.extraParams.neckWidth).toBeLessThan(p.tabWidth);
      expect(p.extraParams.slotNeckWidth).toBeGreaterThan(p.extraParams.neckWidth);

      // Allows Z-slide insertion, prevents in-plane normal extraction
      expect(connectorPair.assemblyConstraints.allowedDOF.translation.z).toBe(true);
      expect(connectorPair.assemblyConstraints.allowedDOF.translation.x).toBe(false);
      expect(connectorPair.assemblyConstraints.allowedDOF.translation.y).toBe(false);
    });
  });

  describe("Keyed Connectors", () => {
    it("generates asymmetric keyed plug and socket enforcing 1-way insertion", () => {
      const req = createBaseRequest("keyed", 180.0);
      const { connectorPair, validation } = AutomaticConnectorEngine.createConnector(req);

      expect(validation.isValid).toBe(true);
      expect(connectorPair.type).toBe("keyed");

      // Strictly non-reversible
      expect(connectorPair.assemblyConstraints.reversible).toBe(false);
      expect(connectorPair.assemblyConstraints.lockingMechanism).toBe("keyed");

      // Extra key geometry
      expect(connectorPair.parameters.extraParams.keyWidth).toBe(4.0);
      expect(connectorPair.parameters.extraParams.keyExtraDepth).toBe(2.0);
    });
  });

  describe("Hinge Connectors", () => {
    it("generates 1-DOF rotational hinge connection bounded between 0° and 180°", () => {
      const req = createBaseRequest("hinge", 90.0);
      const { connectorPair, validation } = AutomaticConnectorEngine.createConnector(req);

      expect(validation.isValid).toBe(true);
      expect(connectorPair.type).toBe("hinge");

      // 1 Rotational DOF enabled
      expect(connectorPair.assemblyConstraints.allowedDOF.rotation.rx).toBe(true);
      expect(connectorPair.assemblyConstraints.allowedDOF.rotation.ry).toBe(false);
      expect(connectorPair.assemblyConstraints.allowedDOF.rotation.rz).toBe(false);

      // Dynamic angle limits [0°, 180°]
      expect(connectorPair.allowedAngleRange.minAngleDeg).toBe(0.0);
      expect(connectorPair.allowedAngleRange.maxAngleDeg).toBe(180.0);
      expect(connectorPair.allowedAngleRange.nominalAngleDeg).toBe(90.0);

      // Advanced3DConnection integration check
      expect(connectorPair.advancedConnection.behavior).toBe("HINGE");
    });
  });

  describe("Rotational Connectors", () => {
    it("generates cylindrical boss & socket allowing 360° continuous rotation", () => {
      const req = createBaseRequest("rotational", 180.0);
      const { connectorPair, validation } = AutomaticConnectorEngine.createConnector(req);

      expect(validation.isValid).toBe(true);
      expect(connectorPair.type).toBe("rotational");

      // Rotation around Z axis
      expect(connectorPair.assemblyConstraints.allowedDOF.rotation.rz).toBe(true);
      expect(connectorPair.allowedAngleRange.minAngleDeg).toBe(0.0);
      expect(connectorPair.allowedAngleRange.maxAngleDeg).toBe(360.0);

      expect(connectorPair.advancedConnection.behavior).toBe("ROTATIONAL");
    });
  });

  describe("Custom Connectors", () => {
    it("generates custom connector with user-defined parametric options", () => {
      const req = createBaseRequest("custom", 120.0);
      req.interface.customParameters = {
        widthMm: 18.0,
        depthMm: 7.5,
        patternName: "t_slot_custom",
        minAngleDeg: 110.0,
        maxAngleDeg: 130.0,
      };

      const { connectorPair, validation } = AutomaticConnectorEngine.createConnector(req);

      expect(validation.isValid).toBe(true);
      expect(connectorPair.type).toBe("custom");
      expect(connectorPair.parameters.tabWidth).toBe(18.0);
      expect(connectorPair.parameters.tabDepth).toBe(7.5);
      expect(connectorPair.allowedAngleRange.minAngleDeg).toBe(110.0);
      expect(connectorPair.allowedAngleRange.maxAngleDeg).toBe(130.0);
    });
  });

  describe("Deterministic Validation Suite", () => {
    it("detects geometric interference if slot is smaller than tab", () => {
      const req = createBaseRequest("tab_slot");
      const { connectorPair } = AutomaticConnectorEngine.createConnector(req);

      // Artificially corrupt parameters to simulate geometric interference
      connectorPair.parameters.slotWidth = connectorPair.parameters.tabWidth - 2.0;

      const val = ConnectorValidator.validate(connectorPair);
      expect(val.isValid).toBe(false);
      expect(val.checks.complementarityValid).toBe(false);
      expect(val.errors.some((e) => e.toLowerCase().includes("interference detected"))).toBe(true);
    });

    it("rejects non-positive clearance", () => {
      const req = createBaseRequest("tab_slot");
      const { connectorPair } = AutomaticConnectorEngine.createConnector(req);

      connectorPair.clearance = -0.1;

      const val = ConnectorValidator.validate(connectorPair);
      expect(val.isValid).toBe(false);
      expect(val.checks.clearanceValid).toBe(false);
    });

    it("rejects inverted angle range where minAngle > maxAngle", () => {
      const req = createBaseRequest("tab_slot");
      const { connectorPair } = AutomaticConnectorEngine.createConnector(req);

      connectorPair.allowedAngleRange.minAngleDeg = 200;
      connectorPair.allowedAngleRange.maxAngleDeg = 100;

      const val = ConnectorValidator.validate(connectorPair);
      expect(val.isValid).toBe(false);
      expect(val.checks.angleRangeValid).toBe(false);
    });
  });
});
