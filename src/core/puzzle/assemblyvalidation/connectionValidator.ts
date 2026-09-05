/**
 * Connection Validator (Phase 90 - Pass 1).
 *
 * Evaluates every physical connection against the 9 required criteria:
 *  1. correct interface pairing
 *  2. correct connector type
 *  3. correct geometry
 *  4. correct alignment
 *  5. valid joining angle
 *  6. valid clearance
 *  7. no unintended penetration
 *  8. insertion feasibility
 *  9. final connection state
 *
 * Produces granular failure items identifying exact piece, interface, connection,
 * position, angle, and failure reason.
 */

import type { Vec3 } from "@/core/model/types";
import { localToWorld } from "../framesystem/transformEngine";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import { len3, sub3, vec3 } from "../geometry/math3d";
import type { GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import type {
  AssemblyValidationOptions,
  ConnectionValidationDetail,
  ValidationFailureItem,
} from "./types";

export class ConnectionValidator {
  /**
   * Validates a single connection against all 9 criteria.
   */
  public static validateConnection(
    connection: RetainedConnection3D,
    pieceA: GeneratedPiece3D,
    transformA: RigidTransform3D | undefined,
    pieceB: GeneratedPiece3D,
    transformB: RigidTransform3D | undefined,
    appliedAngleDeg: number,
    options: AssemblyValidationOptions = {}
  ): {
    detail: ConnectionValidationDetail;
    failures: ValidationFailureItem[];
  } {
    const maxAlignmentErrorMm = options.maxAlignmentErrorMm ?? 0.5;
    const minClearanceMm = options.minClearanceMm ?? 0.05;
    const failures: ValidationFailureItem[] = [];
    const failureReasons: string[] = [];

    // Fallback position for reporting (midpoint or interface origin)
    let contactWorldPos: Vec3 = vec3(0, 0, 0);

    // ─────────────────────────────────────────────────────────────
    // 1. Correct Interface Pairing
    // ─────────────────────────────────────────────────────────────
    let interfacePairingValid = true;
    const ifaceA = pieceA.interfaces?.find((i) => i.id === connection.interfaceAId);
    const ifaceB = pieceB.interfaces?.find((i) => i.id === connection.interfaceBId);

    if (!ifaceA) {
      interfacePairingValid = false;
      const msg = `Interface '${connection.interfaceAId}' not found on piece '${pieceA.pieceId}'.`;
      failureReasons.push(msg);
      failures.push({
        pieceId: pieceA.pieceId,
        interfaceId: connection.interfaceAId,
        connectionId: connection.connectionId,
        position: transformA?.position,
        angleDeg: appliedAngleDeg,
        failureReason: msg,
        severity: "error",
        category: "interface_pairing",
      });
    }

    if (!ifaceB) {
      interfacePairingValid = false;
      const msg = `Interface '${connection.interfaceBId}' not found on piece '${pieceB.pieceId}'.`;
      failureReasons.push(msg);
      failures.push({
        pieceId: pieceB.pieceId,
        interfaceId: connection.interfaceBId,
        connectionId: connection.connectionId,
        position: transformB?.position,
        angleDeg: appliedAngleDeg,
        failureReason: msg,
        severity: "error",
        category: "interface_pairing",
      });
    }

    // Role / Gender Complementarity Check
    if (ifaceA && ifaceB) {
      const roleA = ifaceA.compatibility?.genderRole;
      const roleB = ifaceB.compatibility?.genderRole;
      if (roleA && roleB && roleA === roleB && roleA !== "neutral") {
        interfacePairingValid = false;
        const msg = `Incompatible interface gender roles: both '${ifaceA.id}' and '${ifaceB.id}' are '${roleA}'.`;
        failureReasons.push(msg);
        failures.push({
          pieceId: pieceA.pieceId,
          interfaceId: ifaceA.id,
          connectionId: connection.connectionId,
          position: transformA ? localToWorld(transformA, ifaceA.localFrame.origin) : undefined,
          angleDeg: appliedAngleDeg,
          failureReason: msg,
          severity: "error",
          category: "interface_pairing",
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Correct Connector Type
    // ─────────────────────────────────────────────────────────────
    let connectorTypeValid = true;
    const recognizedTypes = new Set([
      "tab_slot",
      "notch",
      "interlock",
      "keyed",
      "hinge",
      "rotational",
      "custom",
    ]);

    if (!connection.connectorType || !recognizedTypes.has(connection.connectorType)) {
      connectorTypeValid = false;
      const msg = `Unrecognized or invalid connector type '${connection.connectorType}'.`;
      failureReasons.push(msg);
      failures.push({
        pieceId: pieceA.pieceId,
        connectionId: connection.connectionId,
        angleDeg: appliedAngleDeg,
        failureReason: msg,
        severity: "error",
        category: "connector_type",
      });
    }

    // Check connector type compatibility between interface profile and connector type
    if (ifaceA?.profile?.profileKind && ifaceB?.profile?.profileKind) {
      const kindA = ifaceA.profile.profileKind;
      const kindB = ifaceB.profile.profileKind;
      if (connection.connectorType === "tab_slot") {
        const isTabSlot = (kindA === "tab" && kindB === "slot") || (kindA === "slot" && kindB === "tab");
        if (!isTabSlot) {
          connectorTypeValid = false;
          const msg = `Connector type 'tab_slot' does not match interface kinds ('${kindA}' vs '${kindB}').`;
          failureReasons.push(msg);
          failures.push({
            pieceId: pieceA.pieceId,
            interfaceId: ifaceA.id,
            connectionId: connection.connectionId,
            angleDeg: appliedAngleDeg,
            failureReason: msg,
            severity: "error",
            category: "connector_type",
          });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Correct Geometry
    // ─────────────────────────────────────────────────────────────
    let geometryValid = true;
    const params = connection.parameters ?? {};

    if (connection.connectorType === "tab_slot") {
      const tabWidth = params.tabWidth ?? ifaceA?.profile?.width ?? 0;
      const slotWidth = params.slotWidth ?? ifaceB?.profile?.width ?? 0;
      const tabDepth = params.tabDepth ?? ifaceA?.profile?.depth ?? 0;
      const slotDepth = params.slotDepth ?? ifaceB?.profile?.depth ?? 0;

      if (tabWidth <= 0 || slotWidth <= 0) {
        geometryValid = false;
        const msg = `Invalid connector geometry: tab width (${tabWidth}mm) or slot width (${slotWidth}mm) <= 0.`;
        failureReasons.push(msg);
        failures.push({
          pieceId: pieceA.pieceId,
          connectionId: connection.connectionId,
          angleDeg: appliedAngleDeg,
          failureReason: msg,
          severity: "error",
          category: "geometry",
        });
      } else if (tabWidth > slotWidth + 1e-3) {
        geometryValid = false;
        const msg = `Geometric interference: tab width (${tabWidth}mm) exceeds slot width (${slotWidth}mm).`;
        failureReasons.push(msg);
        failures.push({
          pieceId: pieceA.pieceId,
          interfaceId: ifaceA?.id,
          connectionId: connection.connectionId,
          angleDeg: appliedAngleDeg,
          failureReason: msg,
          severity: "error",
          category: "geometry",
        });
      }

      if (tabDepth <= 0 || slotDepth <= 0) {
        geometryValid = false;
        const msg = `Invalid connector depth: tab depth (${tabDepth}mm) or slot depth (${slotDepth}mm) <= 0.`;
        failureReasons.push(msg);
        failures.push({
          pieceId: pieceA.pieceId,
          connectionId: connection.connectionId,
          angleDeg: appliedAngleDeg,
          failureReason: msg,
          severity: "error",
          category: "geometry",
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Correct Alignment
    // ─────────────────────────────────────────────────────────────
    let alignmentValid = true;
    let alignmentErrorMm = 0.0;

    if (!transformA || !transformB) {
      alignmentValid = false;
      alignmentErrorMm = Number.POSITIVE_INFINITY;
      const msg = `Missing 3D placement transform for piece '${!transformA ? pieceA.pieceId : pieceB.pieceId}'.`;
      failureReasons.push(msg);
      failures.push({
        pieceId: !transformA ? pieceA.pieceId : pieceB.pieceId,
        connectionId: connection.connectionId,
        angleDeg: appliedAngleDeg,
        failureReason: msg,
        severity: "error",
        category: "alignment",
      });
    } else if (ifaceA && ifaceB) {
      const worldOriginA = localToWorld(transformA, ifaceA.localFrame.origin);
      const worldOriginB = localToWorld(transformB, ifaceB.localFrame.origin);
      alignmentErrorMm = Number(len3(sub3(worldOriginA, worldOriginB)).toFixed(4));
      contactWorldPos = worldOriginA;

      if (alignmentErrorMm > maxAlignmentErrorMm) {
        alignmentValid = false;
        const msg = `Interface port alignment offset exceeds tolerance: ${alignmentErrorMm}mm > ${maxAlignmentErrorMm}mm.`;
        failureReasons.push(msg);
        failures.push({
          pieceId: pieceA.pieceId,
          interfaceId: ifaceA.id,
          connectionId: connection.connectionId,
          position: worldOriginA,
          angleDeg: appliedAngleDeg,
          failureReason: msg,
          severity: "error",
          category: "alignment",
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Valid Joining Angle
    // ─────────────────────────────────────────────────────────────
    let joiningAngleValid = true;
    const minAngle = params.minAngleDeg ?? 0.0;
    const maxAngle = params.maxAngleDeg ?? 180.0;

    if (appliedAngleDeg < minAngle - 1e-3 || appliedAngleDeg > maxAngle + 1e-3) {
      joiningAngleValid = false;
      const msg = `Applied angle ${appliedAngleDeg}° is outside allowed kinematic range [${minAngle}°, ${maxAngle}°].`;
      failureReasons.push(msg);
      failures.push({
        pieceId: pieceB.pieceId,
        interfaceId: ifaceB?.id,
        connectionId: connection.connectionId,
        position: contactWorldPos,
        angleDeg: appliedAngleDeg,
        failureReason: msg,
        severity: "error",
        category: "joining_angle",
      });
    }

    // Kinematic constraints per connector type
    if (connection.connectorType === "notch") {
      if (Math.abs(appliedAngleDeg - 90.0) > 1.0 && Math.abs(appliedAngleDeg - 270.0) > 1.0) {
        joiningAngleValid = false;
        const msg = `Notch connector requires 90° crossing alignment, but applied angle is ${appliedAngleDeg}°.`;
        failureReasons.push(msg);
        failures.push({
          pieceId: pieceB.pieceId,
          connectionId: connection.connectionId,
          position: contactWorldPos,
          angleDeg: appliedAngleDeg,
          failureReason: msg,
          severity: "error",
          category: "joining_angle",
        });
      }
    } else if (connection.connectorType === "interlock" || connection.connectorType === "keyed") {
      if (Math.abs(appliedAngleDeg - 180.0) > 1.0 && Math.abs(appliedAngleDeg - 90.0) > 1.0) {
        joiningAngleValid = false;
        const msg = `${connection.connectorType} connector requires 180° or 90°, but applied angle is ${appliedAngleDeg}°.`;
        failureReasons.push(msg);
        failures.push({
          pieceId: pieceB.pieceId,
          connectionId: connection.connectionId,
          position: contactWorldPos,
          angleDeg: appliedAngleDeg,
          failureReason: msg,
          severity: "error",
          category: "joining_angle",
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Valid Clearance
    // ─────────────────────────────────────────────────────────────
    let clearanceValid = true;
    const clearanceMm = connection.clearanceMm ?? params.clearance ?? 0.15;

    if (clearanceMm < minClearanceMm) {
      clearanceValid = false;
      const msg = `Clearance ${clearanceMm}mm is below minimum allowable manufacturing threshold ${minClearanceMm}mm.`;
      failureReasons.push(msg);
      failures.push({
        pieceId: pieceA.pieceId,
        interfaceId: ifaceA?.id,
        connectionId: connection.connectionId,
        position: contactWorldPos,
        angleDeg: appliedAngleDeg,
        failureReason: msg,
        severity: "error",
        category: "clearance",
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 7. No Unintended Penetration
    // ─────────────────────────────────────────────────────────────
    let noUnintendedPenetration = true;
    let penetrationDepthMm = 0.0;

    // Check fold-back overlap: angle <= 5° causes complete body overlap
    if (appliedAngleDeg <= 5.0) {
      noUnintendedPenetration = false;
      penetrationDepthMm = Math.max(pieceA.thickness ?? 3.0, pieceB.thickness ?? 3.0);
      const msg = `Severe unintended penetration: piece folded flat onto mating neighbor at ${appliedAngleDeg}° (depth: ${penetrationDepthMm}mm).`;
      failureReasons.push(msg);
      failures.push({
        pieceId: pieceB.pieceId,
        interfaceId: ifaceB?.id,
        connectionId: connection.connectionId,
        position: contactWorldPos,
        angleDeg: appliedAngleDeg,
        failureReason: msg,
        severity: "error",
        category: "penetration",
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 8. Insertion Feasibility
    // ─────────────────────────────────────────────────────────────
    let insertionFeasible = true;

    // At acute folding angles (< 15° for standard stock), adjacent stock prevents insertion
    if (appliedAngleDeg < 15.0) {
      insertionFeasible = false;
      const msg = `Impossible insertion trajectory: approach clearance blocked at acute angle ${appliedAngleDeg}°.`;
      failureReasons.push(msg);
      failures.push({
        pieceId: pieceB.pieceId,
        interfaceId: ifaceB?.id,
        connectionId: connection.connectionId,
        position: contactWorldPos,
        angleDeg: appliedAngleDeg,
        failureReason: msg,
        severity: "error",
        category: "insertion",
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 9. Final Connection State
    // ─────────────────────────────────────────────────────────────
    const isValid =
      interfacePairingValid &&
      connectorTypeValid &&
      geometryValid &&
      alignmentValid &&
      joiningAngleValid &&
      clearanceValid &&
      noUnintendedPenetration &&
      insertionFeasible;

    const finalConnectionState = isValid
      ? "MATED"
      : !transformA || !transformB
      ? "DISENGAGED"
      : "FAILED";

    if (!isValid && failureReasons.length === 0) {
      failureReasons.push("Connection failed validation.");
    }

    return {
      detail: {
        connectionId: connection.connectionId,
        pieceAId: connection.pieceAId,
        pieceBId: connection.pieceBId,
        interfaceAId: connection.interfaceAId,
        interfaceBId: connection.interfaceBId,
        connectorType: connection.connectorType,
        isValid,
        interfacePairingValid,
        connectorTypeValid,
        geometryValid,
        alignmentValid,
        alignmentErrorMm,
        joiningAngleValid,
        appliedAngleDeg,
        clearanceValid,
        clearanceMm,
        noUnintendedPenetration,
        penetrationDepthMm,
        insertionFeasible,
        finalConnectionState,
        failureReasons,
      },
      failures,
    };
  }
}
