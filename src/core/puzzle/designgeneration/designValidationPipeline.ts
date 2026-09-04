/**
 * 5-Gate Deterministic Design Validation Pipeline (Phase 71).
 *
 * Subject every AI-proposed ParametricDesignSpecification and its compiled
 * geometry to 5 rigorous validation gates:
 *  1. Schema Validation
 *  2. Hard Constraint Validation
 *  3. 2D Geometry Validation
 *  4. Connection Validation
 *  5. 3D Assembly Validation
 */
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { AIValidationPasses } from "./types";
import { validateParametricDesignSpecification } from "../ailayer/validator";

export class DesignValidationPipeline {
  /**
   * Runs all 5 deterministic validation gates over a specification and optional compiled puzzle.
   */
  public static validateDesign(
    spec: ParametricDesignSpecification,
    puzzle?: CanonicalPuzzle
  ): {
    passes: AIValidationPasses;
    errors: string[];
    warnings: string[];
    overallPassed: boolean;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // -------------------------------------------------------------
    // GATE 1: Schema Validation
    // -------------------------------------------------------------
    const schemaReport = validateParametricDesignSpecification(spec);
    const schemaValidation = schemaReport.isValid;
    if (!schemaValidation) {
      errors.push(...schemaReport.errors.map((e) => `[Gate 1: Schema] ${e}`));
    }
    warnings.push(...schemaReport.warnings.map((w) => `[Gate 1: Schema Warning] ${w}`));

    // -------------------------------------------------------------
    // GATE 2: Hard Constraint Validation
    // -------------------------------------------------------------
    let hardConstraintValidation = true;

    if (spec.piece_count < 2) {
      hardConstraintValidation = false;
      errors.push("[Gate 2: Hard Constraint] Puzzle piece count must be >= 2 for an assembly.");
    }
    if (spec.piece_count > 100) {
      hardConstraintValidation = false;
      errors.push("[Gate 2: Hard Constraint] Piece count exceeds safety threshold of 100 pieces.");
    }

    if (spec.layers < 1) {
      hardConstraintValidation = false;
      errors.push("[Gate 2: Hard Constraint] Layer count must be >= 1.");
    }

    // Material sheet stock boundary check
    if (spec.overall_size && spec.material) {
      if (spec.overall_size.widthMm > spec.material.stockWidthMm) {
        hardConstraintValidation = false;
        errors.push(
          `[Gate 2: Hard Constraint] Overall width (${spec.overall_size.widthMm}mm) exceeds stock width (${spec.material.stockWidthMm}mm).`
        );
      }
      if (spec.overall_size.heightMm > spec.material.stockHeightMm) {
        hardConstraintValidation = false;
        errors.push(
          `[Gate 2: Hard Constraint] Overall height (${spec.overall_size.heightMm}mm) exceeds stock height (${spec.material.stockHeightMm}mm).`
        );
      }
    }

    // Declarative constraints check
    if (spec.constraints && Array.isArray(spec.constraints)) {
      for (const c of spec.constraints) {
        if ((c as any).isViolated) {
          hardConstraintValidation = false;
          errors.push(`[Gate 2: Hard Constraint] Declarative constraint '${c.id}' violated: ${c.type}`);
        }
      }
    }

    // -------------------------------------------------------------
    // GATE 3: 2D Geometry Validation
    // -------------------------------------------------------------
    let geometryValidation = true;
    if (puzzle) {
      if (puzzle.pieces.length === 0) {
        geometryValidation = false;
        errors.push("[Gate 3: 2D Geometry] Compiled puzzle contains 0 pieces.");
      }

      for (const p of puzzle.pieces) {
        if (!p.dimensions || p.dimensions.width <= 0 || p.dimensions.height <= 0 || p.thickness <= 0) {
          geometryValidation = false;
          errors.push(`[Gate 3: 2D Geometry] Piece '${p.id}' has invalid non-positive dimensions.`);
        }
      }
    }

    // -------------------------------------------------------------
    // GATE 4: Connection Validation
    // -------------------------------------------------------------
    let connectionValidation = true;
    if (puzzle) {
      const ifMap = new Map(puzzle.interfaces.map((i) => [i.id, i]));

      for (const conn of puzzle.connections) {
        const ifA = ifMap.get(conn.interfaceAId);
        const ifB = ifMap.get(conn.interfaceBId);

        if (!ifA || !ifB) {
          connectionValidation = false;
          errors.push(`[Gate 4: Connection] Connection '${conn.id}' references non-existent interface.`);
          continue;
        }

        // Complementary gender check if defined
        const roleA = ifA.compatibility?.genderRole;
        const roleB = ifB.compatibility?.genderRole;
        if (roleA && roleB && roleA === roleB && (roleA === "insert" || roleA === "receiver")) {
          connectionValidation = false;
          errors.push(
            `[Gate 4: Connection] Interface '${ifA.id}' and '${ifB.id}' have conflicting identical gender roles ('${roleA}').`
          );
        }

        // Tolerance check
        if (conn.clearance !== undefined && (conn.clearance < 0.0 || conn.clearance > 2.0)) {
          connectionValidation = false;
          errors.push(`[Gate 4: Connection] Connection '${conn.id}' clearance ${conn.clearance}mm is out of physical bounds [0, 2.0mm].`);
        }
      }
    }

    // -------------------------------------------------------------
    // GATE 5: 3D Assembly Validation
    // -------------------------------------------------------------
    let validation3D = true;
    const prefAngle = spec.connection_preferences?.preferredJoiningAngleDeg ?? 90.0;
    if (prefAngle < 0.0 || prefAngle > 180.0) {
      validation3D = false;
      errors.push(`[Gate 5: 3D Assembly] Joining angle ${prefAngle}° is outside valid physical interval [0°, 180°].`);
    }

    if (puzzle) {
      for (const p of puzzle.pieces) {
        if (!p.localFrame || !p.localFrame.origin || !p.localFrame.normal) {
          validation3D = false;
          errors.push(`[Gate 5: 3D Assembly] Piece '${p.id}' missing valid 3D coordinate frame.`);
        }
      }
    }

    const overallPassed =
      schemaValidation &&
      hardConstraintValidation &&
      geometryValidation &&
      connectionValidation &&
      validation3D &&
      errors.length === 0;

    return {
      passes: {
        schemaValidation,
        hardConstraintValidation,
        geometryValidation,
        connectionValidation,
        validation3D,
        overallPassed,
      },
      errors,
      warnings,
      overallPassed,
    };
  }
}
