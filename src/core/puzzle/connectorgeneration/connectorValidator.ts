/**
 * Deterministic Connector Validator (Phase 83).
 *
 * Enforces geometric complementarity, valid positive clearances, physical feasibility,
 * 3D angle range validity, and kinematic DOF consistency. Strictly NO AI.
 */

import type {
  ConnectorParameters,
  ConnectorValidationResult,
  GeneratedConnectorPair,
} from "./types";

export class ConnectorValidator {
  public static validate(connectorPair: GeneratedConnectorPair, edgeLengthMm?: number): ConnectorValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const checks = {
      complementarityValid: true,
      clearanceValid: true,
      physicalProportionsValid: true,
      angleRangeValid: true,
      dofConsistent: true,
    };

    const params: ConnectorParameters = connectorPair.parameters;

    // 1. Geometric Complementarity
    if (params.slotWidth < params.tabWidth) {
      checks.complementarityValid = false;
      errors.push(
        `Socket slot width (${params.slotWidth} mm) is smaller than plug tab width (${params.tabWidth} mm). Geometric interference detected.`
      );
    }

    if (params.slotDepth < params.tabDepth) {
      checks.complementarityValid = false;
      errors.push(
        `Socket slot depth (${params.slotDepth} mm) is smaller than plug tab depth (${params.tabDepth} mm). Geometric interference detected.`
      );
    }

    // Clearance check
    if (connectorPair.clearance <= 0) {
      checks.clearanceValid = false;
      errors.push(`Clearance (${connectorPair.clearance} mm) must be strictly positive to permit physical assembly.`);
    } else if (connectorPair.clearance > 1.5) {
      warnings.push(`Clearance (${connectorPair.clearance} mm) is unusually loose (> 1.5 mm).`);
    }

    // 2. Physical Proportions
    if (params.tabWidth <= 0 || params.tabDepth <= 0) {
      checks.physicalProportionsValid = false;
      errors.push(`Connector feature dimensions must be strictly positive (w: ${params.tabWidth}, d: ${params.tabDepth}).`);
    }

    if (edgeLengthMm && edgeLengthMm > 0) {
      if (params.tabWidth > edgeLengthMm) {
        checks.physicalProportionsValid = false;
        errors.push(
          `Connector width (${params.tabWidth} mm) exceeds edge length (${edgeLengthMm} mm). Feature will protrude beyond piece bounds.`
        );
      } else if (params.tabWidth > edgeLengthMm * 0.9) {
        warnings.push(`Connector width occupies > 90% of edge length.`);
      }
    }

    // 3. Allowed Angle Range
    const angles = connectorPair.allowedAngleRange;
    if (angles.minAngleDeg > angles.maxAngleDeg) {
      checks.angleRangeValid = false;
      errors.push(
        `Invalid angle range: minAngleDeg (${angles.minAngleDeg}°) exceeds maxAngleDeg (${angles.maxAngleDeg}°).`
      );
    }

    if (
      angles.nominalAngleDeg < angles.minAngleDeg ||
      angles.nominalAngleDeg > angles.maxAngleDeg
    ) {
      checks.angleRangeValid = false;
      errors.push(
        `Nominal joining angle (${angles.nominalAngleDeg}°) lies outside allowed range [${angles.minAngleDeg}°, ${angles.maxAngleDeg}°].`
      );
    }

    // 4. Kinematic DOF Consistency
    const dof = connectorPair.assemblyConstraints.allowedDOF;
    if (connectorPair.type === "hinge") {
      const hasRotationalDOF = dof.rotation.rx || dof.rotation.ry || dof.rotation.rz;
      if (!hasRotationalDOF) {
        checks.dofConsistent = false;
        errors.push("Hinge connector must possess at least 1 rotational degree of freedom.");
      }
    } else if (connectorPair.type === "tab_slot" || connectorPair.type === "notch") {
      // In locked/engaged state, fixed joint has 0 DOFs
      if (dof.rotation.rx || dof.rotation.ry || dof.rotation.rz) {
        warnings.push("Fixed joint has non-zero rotational degrees of freedom specified.");
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      checks,
    };
  }
}
