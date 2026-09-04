/**
 * Mathematical Kinematic & Geometric Validator (Phase 65).
 *
 * Enforces rigorous mathematical verification of:
 *  - 3D Coordinate frame orthonormality and right-handedness
 *  - Kinematic degrees of freedom consistency per behavior (FIXED, HINGE, SLIDING...)
 *  - Angular range consistency and ordering
 *  - Insertion direction vector normalization
 *  - Contact patch geometry and surface normals
 *  - Non-negative clearance and tolerances
 */
import type { CoordinateFrame3D } from "../framesystem/types";
import type { Advanced3DConnection, ContactRegion3D } from "./types";
import { cross3, dot3, len3, sub3 } from "../geometry/math3d";

export interface MathValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConnectionMathValidator {
  private static readonly EPSILON = 1e-4;

  /**
   * Validates that a 3D coordinate frame is orthonormal and right-handed.
   */
  static validateFrameOrthonormality(
    frame: CoordinateFrame3D,
    frameLabel = "Frame"
  ): MathValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Check unit lengths
    const lenT = len3(frame.tangent);
    const lenN = len3(frame.normal);
    const lenB = len3(frame.binormal);

    if (Math.abs(lenT - 1.0) > this.EPSILON) {
      errors.push(`${frameLabel} tangent vector is not normalized (len=${lenT.toFixed(5)}).`);
    }
    if (Math.abs(lenN - 1.0) > this.EPSILON) {
      errors.push(`${frameLabel} normal vector is not normalized (len=${lenN.toFixed(5)}).`);
    }
    if (Math.abs(lenB - 1.0) > this.EPSILON) {
      errors.push(`${frameLabel} binormal vector is not normalized (len=${lenB.toFixed(5)}).`);
    }

    // 2. Check mutual orthogonality
    const dotTN = dot3(frame.tangent, frame.normal);
    const dotTB = dot3(frame.tangent, frame.binormal);
    const dotNB = dot3(frame.normal, frame.binormal);

    if (Math.abs(dotTN) > this.EPSILON) {
      errors.push(`${frameLabel} tangent and normal are not orthogonal (dot=${dotTN.toFixed(5)}).`);
    }
    if (Math.abs(dotTB) > this.EPSILON) {
      errors.push(`${frameLabel} tangent and binormal are not orthogonal (dot=${dotTB.toFixed(5)}).`);
    }
    if (Math.abs(dotNB) > this.EPSILON) {
      errors.push(`${frameLabel} normal and binormal are not orthogonal (dot=${dotNB.toFixed(5)}).`);
    }

    // 3. Check right-handed orientation (T x N = B)
    const expectedB = cross3(frame.tangent, frame.normal);
    const diffB = len3(sub3(expectedB, frame.binormal));
    if (diffB > this.EPSILON) {
      errors.push(
        `${frameLabel} is not right-handed: tangent x normal differs from binormal (diff=${diffB.toFixed(5)}).`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Complete mathematical and kinematic validation of an Advanced3DConnection.
   */
  static validateConnection(connection: Advanced3DConnection): MathValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Frame orthonormality
    const reportA = this.validateFrameOrthonormality(connection.localFrames.frameA, `Frame A [${connection.id}]`);
    const reportB = this.validateFrameOrthonormality(connection.localFrames.frameB, `Frame B [${connection.id}]`);
    errors.push(...reportA.errors, ...reportB.errors);
    warnings.push(...reportA.warnings, ...reportB.warnings);

    // 2. Insertion direction normalization
    const insLen = len3(connection.insertionDirection);
    if (Math.abs(insLen - 1.0) > this.EPSILON) {
      errors.push(`Insertion direction is not normalized (len=${insLen.toFixed(5)}).`);
    }

    // 3. Clearance & Tolerance non-negativity
    if (connection.clearance < 0) {
      errors.push(`Clearance must be non-negative (received ${connection.clearance}).`);
    }
    if (connection.tolerance < 0) {
      errors.push(`Tolerance must be non-negative (received ${connection.tolerance}).`);
    }

    // 4. Angle limits ordering
    const limits = connection.angleLimits;
    if (limits.minAngleDeg > limits.maxAngleDeg) {
      errors.push(
        `Angle limits inverted: min (${limits.minAngleDeg}°) > max (${limits.maxAngleDeg}°).`
      );
    }
    if (limits.nominalAngleDeg < limits.minAngleDeg || limits.nominalAngleDeg > limits.maxAngleDeg) {
      errors.push(
        `Nominal angle (${limits.nominalAngleDeg}°) outside permitted range [${limits.minAngleDeg}°, ${limits.maxAngleDeg}°].`
      );
    }

    // 5. Kinematic DOFs consistency with behavior
    switch (connection.behavior) {
      case "FIXED":
      case "INTERLOCK":
      case "SNAP":
        if (connection.allowedRotationAxes.length > 0) {
          errors.push(`${connection.behavior} connection cannot have allowed rotation axes.`);
        }
        if (connection.allowedTranslationAxes.length > 0) {
          errors.push(`${connection.behavior} connection cannot have allowed translation axes.`);
        }
        break;

      case "HINGE":
        if (connection.allowedRotationAxes.length !== 1) {
          errors.push(`HINGE connection must have exactly 1 allowed rotation axis (found ${connection.allowedRotationAxes.length}).`);
        }
        if (connection.allowedTranslationAxes.length > 0) {
          errors.push(`HINGE connection cannot have allowed translation axes.`);
        }
        break;

      case "SLIDING":
        if (connection.allowedTranslationAxes.length !== 1) {
          errors.push(`SLIDING connection must have exactly 1 allowed translation axis (found ${connection.allowedTranslationAxes.length}).`);
        }
        if (connection.allowedRotationAxes.length > 0) {
          errors.push(`SLIDING connection cannot have allowed rotation axes.`);
        }
        break;

      case "ROTATIONAL":
        if (connection.allowedRotationAxes.length < 1) {
          errors.push(`ROTATIONAL connection must have at least 1 allowed rotation axis.`);
        }
        break;

      case "CUSTOM":
        break;
    }

    // 6. Normalization of allowed motion axes
    for (let i = 0; i < connection.allowedRotationAxes.length; i++) {
      const axisLen = len3(connection.allowedRotationAxes[i]);
      if (Math.abs(axisLen - 1.0) > this.EPSILON) {
        errors.push(`Allowed rotation axis [${i}] is not normalized (len=${axisLen.toFixed(5)}).`);
      }
    }
    for (let i = 0; i < connection.allowedTranslationAxes.length; i++) {
      const axisLen = len3(connection.allowedTranslationAxes[i]);
      if (Math.abs(axisLen - 1.0) > this.EPSILON) {
        errors.push(`Allowed translation axis [${i}] is not normalized (len=${axisLen.toFixed(5)}).`);
      }
    }

    // 7. Contact regions validation
    if (!connection.contactRegions || connection.contactRegions.length === 0) {
      warnings.push(`Connection defines no contact regions.`);
    } else {
      for (const cr of connection.contactRegions) {
        if (cr.contactAreaMm2 <= 0) {
          errors.push(`Contact region '${cr.regionId}' has non-positive area (${cr.contactAreaMm2} mm²).`);
        }
        const normLen = len3(cr.surfaceNormal);
        if (Math.abs(normLen - 1.0) > this.EPSILON) {
          errors.push(`Contact region '${cr.regionId}' surface normal is not normalized.`);
        }
      }
    }

    // 8. Assembly state validation
    if (connection.assemblyState.progress < 0 || connection.assemblyState.progress > 1.0) {
      errors.push(`Assembly progress must be between 0.0 and 1.0 (found ${connection.assemblyState.progress}).`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
