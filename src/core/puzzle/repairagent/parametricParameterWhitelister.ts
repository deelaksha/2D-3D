/**
 * Parametric Parameter Whitelister & Safe Applicator (Phase 73).
 *
 * Enforces the strict rule that only approved parametric variables may be adjusted.
 * Direct modification of arbitrary mesh coordinates or uncontrolled CAD geometry is prohibited.
 */

import type { ParametricDesignSpecification } from "../ailayer/types";
import type { ApprovedParametricVariable, ParametricModificationProposal } from "./types";

export const APPROVED_PARAMETRIC_VARIABLES: ReadonlySet<ApprovedParametricVariable> = new Set([
  "tab_width",
  "slot_width",
  "clearance",
  "interface_position",
  "angle_range",
  "piece_dimension",
  "connection_density",
  "stock_dimension",
]);

export class ParametricParameterWhitelister {
  /**
   * Checks whether a variable is in the approved parametric whitelist.
   */
  public static isWhitelisted(variable: string): variable is ApprovedParametricVariable {
    return APPROVED_PARAMETRIC_VARIABLES.has(variable as ApprovedParametricVariable);
  }

  /**
   * Validates that a proposal targets an approved variable within valid physical bounds.
   */
  public static validateProposal(proposal: ParametricModificationProposal): {
    isValid: boolean;
    reason?: string;
  } {
    if (!this.isWhitelisted(proposal.variable)) {
      return {
        isValid: false,
        reason: `Variable '${proposal.variable}' is NOT in the approved parametric whitelist.`,
      };
    }

    const val = typeof proposal.newValue === "number" ? proposal.newValue : Number(proposal.newValue);

    switch (proposal.variable) {
      case "clearance":
        if (isNaN(val) || val < 0.08 || val > 0.40) {
          return { isValid: false, reason: `Clearance ${val}mm outside safe physical bounds [0.08mm, 0.40mm].` };
        }
        break;
      case "tab_width":
      case "slot_width":
        if (isNaN(val) || val < 10.0 || val > 60.0) {
          return { isValid: false, reason: `Tab/slot width ${val}mm outside safe bounds [10mm, 60mm].` };
        }
        break;
      case "angle_range":
        if (isNaN(val) || val < 0.0 || val > 180.0) {
          return { isValid: false, reason: `Angle ${val}° outside physical interval [0°, 180°].` };
        }
        break;
      case "piece_dimension":
        if (isNaN(val) || val < 15.0 || val > 1000.0) {
          return { isValid: false, reason: `Dimension ${val}mm outside safe bounds [15mm, 1000mm].` };
        }
        break;
      case "connection_density":
        if (isNaN(val) || val < 2 || val > 50) {
          return { isValid: false, reason: `Piece count ${val} outside assembly bounds [2, 50].` };
        }
        break;
      case "stock_dimension":
        if (isNaN(val) || val < 100.0 || val > 2000.0) {
          return { isValid: false, reason: `Stock dimension ${val}mm outside standard sheet limits [100mm, 2000mm].` };
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * Applies approved proposals to a ParametricDesignSpecification, returning a new modified specification.
   */
  public static applyProposals(
    spec: ParametricDesignSpecification,
    proposals: ParametricModificationProposal[]
  ): ParametricDesignSpecification {
    const updated: ParametricDesignSpecification = JSON.parse(JSON.stringify(spec));

    for (const prop of proposals) {
      const check = this.validateProposal(prop);
      if (!check.isValid) {
        continue;
      }

      const numVal = typeof prop.newValue === "number" ? prop.newValue : Number(prop.newValue);

      switch (prop.variable) {
        case "clearance":
          // Stored on connection preferences or tolerance metadata
          (updated.connection_preferences as any).clearance = numVal;
          break;
        case "tab_width":
        case "slot_width":
          (updated.connection_preferences as any).profileWidthMm = numVal;
          break;
        case "angle_range":
          updated.connection_preferences.preferredJoiningAngleDeg = numVal;
          break;
        case "piece_dimension":
          if (prop.parameterPath.includes("width")) {
            updated.overall_size.widthMm = numVal;
          } else if (prop.parameterPath.includes("height")) {
            updated.overall_size.heightMm = numVal;
          } else if (prop.parameterPath.includes("depth")) {
            updated.overall_size.depthMm = numVal;
          }
          break;
        case "connection_density":
          updated.piece_count = Math.round(numVal);
          break;
        case "stock_dimension":
          if (prop.parameterPath.includes("Width")) {
            updated.material.stockWidthMm = numVal;
          } else if (prop.parameterPath.includes("Height")) {
            updated.material.stockHeightMm = numVal;
          }
          break;
      }
    }

    return updated;
  }

  /**
   * Generates a deterministic state hash from a specification's key parametric variables
   * to detect oscillating loops during repair.
   */
  public static computeStateHash(spec: ParametricDesignSpecification): string {
    const clearance = (spec.connection_preferences as any).clearance ?? 0.15;
    const tabWidth = (spec.connection_preferences as any).profileWidthMm ?? 20.0;
    const angle = spec.connection_preferences.preferredJoiningAngleDeg ?? 90.0;
    const W = spec.overall_size.widthMm;
    const H = spec.overall_size.heightMm;
    const D = spec.overall_size.depthMm;
    const N = spec.piece_count;
    const stockW = spec.material.stockWidthMm;
    const stockH = spec.material.stockHeightMm;

    return `h_${N}_${W}x${H}x${D}_a${angle}_c${clearance}_t${tabWidth}_stk${stockW}x${stockH}`;
  }
}
