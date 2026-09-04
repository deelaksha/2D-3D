/**
 * Deterministic AI Design Critic (Phase 72).
 *
 * Implements AIDesignCritic:
 *  - Evaluates 8 domains deterministically.
 *  - Strictly distinguishes HARD_FAILURE, WARNING, and STYLE_PREFERENCE.
 *  - Enforces the invariant that deterministic validation results are NEVER overridden.
 *  - Emits actionable SuggestedParameter recommendations without mutating geometry.
 */

import type {
  AIDesignCritic,
  CritiqueIssue,
  DesignCritique,
  DesignCritiqueDomainScores,
} from "./types";
import type { CanonicalPuzzle } from "../canonical/types";
import type { ParametricDesignSpecification } from "../ailayer/types";
import type { AIValidationPasses } from "../designgeneration/types";
import { uid } from "@/core/model/ids";

export class DeterministicDesignCritic implements AIDesignCritic {
  public readonly criticId = "deterministic_design_critic_v1";
  public readonly version = "1.0.0";

  public critique(
    design: CanonicalPuzzle,
    specification?: ParametricDesignSpecification,
    validationPasses?: AIValidationPasses
  ): DesignCritique {
    const critiqueId = uid("critique_");
    const designId = design.metadata?.id || "unknown_design";
    const issues: CritiqueIssue[] = [];

    // -------------------------------------------------------------
    // 0. DETERMINISTIC VALIDATION NON-OVERRIDE CHECK
    // -------------------------------------------------------------
    if (validationPasses && !validationPasses.overallPassed) {
      if (!validationPasses.schemaValidation) {
        issues.push({
          id: uid("iss_hard_"),
          category: "geometry_quality",
          severity: "HARD_FAILURE",
          affectedEntity: { type: "specification", id: specification?.specificationId || "spec" },
          reason: "Deterministic schema validation failed: specification payload violates structural invariants.",
        });
      }
      if (!validationPasses.hardConstraintValidation) {
        issues.push({
          id: uid("iss_hard_"),
          category: "geometry_quality",
          severity: "HARD_FAILURE",
          affectedEntity: { type: "specification", id: specification?.specificationId || "spec" },
          reason: "Deterministic hard constraints violated (e.g. piece count < 2 or sheet dimensions exceeded).",
        });
      }
      if (!validationPasses.geometryValidation) {
        issues.push({
          id: uid("iss_hard_"),
          category: "geometry_quality",
          severity: "HARD_FAILURE",
          affectedEntity: { type: "assembly", id: designId },
          reason: "Deterministic 2D geometry validation failed (e.g. zero or degenerate piece dimensions).",
        });
      }
      if (!validationPasses.connectionValidation) {
        issues.push({
          id: uid("iss_hard_"),
          category: "connection_quality",
          severity: "HARD_FAILURE",
          affectedEntity: { type: "connection", id: "all_connections" },
          reason: "Deterministic connection validation failed (e.g. non-complementary interface roles or invalid clearance).",
        });
      }
      if (!validationPasses.validation3D) {
        issues.push({
          id: uid("iss_hard_"),
          category: "assembly_flexibility",
          severity: "HARD_FAILURE",
          affectedEntity: { type: "assembly", id: designId },
          reason: "Deterministic 3D assembly validation failed (e.g. unphysical joining angle or impossible insertion path).",
        });
      }
    }

    // -------------------------------------------------------------
    // 1. GEOMETRY QUALITY EVALUATION
    // -------------------------------------------------------------
    let geomScore = 95.0;
    for (const piece of design.pieces || []) {
      const w = piece.dimensions?.width ?? 0;
      const h = piece.dimensions?.height ?? 0;
      const t = piece.thickness ?? 0;

      if (w <= 0 || h <= 0 || t <= 0) {
        geomScore = 0.0;
        issues.push({
          id: uid("iss_geom_"),
          category: "geometry_quality",
          severity: "HARD_FAILURE",
          affectedEntity: { type: "piece", id: piece.id, name: piece.name },
          reason: `Piece '${piece.id}' has non-positive dimension (${w}x${h}x${t} mm).`,
          suggestedParameter: {
            parameterName: "dimensions",
            currentValue: `${w}x${h}`,
            suggestedValue: "100x100",
            rationale: "Dimensions must be strictly positive non-zero values.",
          },
        });
        continue;
      }

      // Aspect ratio check
      const aspect = Math.max(w, h) / Math.min(w, h);
      if (aspect > 6.0) {
        geomScore = Math.max(40.0, geomScore - 15.0);
        issues.push({
          id: uid("iss_geom_"),
          category: "geometry_quality",
          severity: "WARNING",
          affectedEntity: { type: "piece", id: piece.id, name: piece.name },
          reason: `High aspect ratio (${aspect.toFixed(1)}:1) creates a thin structural strip susceptible to warping or bending.`,
          suggestedParameter: {
            parameterName: "dimensions.width",
            currentValue: w,
            suggestedValue: Math.round(w * 0.7),
            rationale: "Broaden the narrow dimension to increase structural rigidity.",
          },
        });
      }
    }

    // -------------------------------------------------------------
    // 2. CONNECTION QUALITY EVALUATION
    // -------------------------------------------------------------
    let connScore = 95.0;
    for (const conn of design.connections || []) {
      const clearance = conn.clearance ?? 0.15;
      if (clearance < 0.08) {
        connScore = Math.max(50.0, connScore - 15.0);
        issues.push({
          id: uid("iss_conn_"),
          category: "connection_quality",
          severity: "WARNING",
          affectedEntity: { type: "connection", id: conn.id },
          reason: `Connection clearance of ${clearance}mm is overly tight for cardboard; thermal laser kerf variations may cause jamming.`,
          suggestedParameter: {
            parameterName: "clearance",
            currentValue: clearance,
            suggestedValue: 0.15,
            rationale: "Increase clearance to 0.15mm for reliable slip-fit assembly in corrugated cardboard.",
          },
        });
      } else if (clearance > 0.35) {
        connScore = Math.max(50.0, connScore - 10.0);
        issues.push({
          id: uid("iss_conn_"),
          category: "connection_quality",
          severity: "WARNING",
          affectedEntity: { type: "connection", id: conn.id },
          reason: `Connection clearance of ${clearance}mm is loose; joint may wobble or fail to hold alignment.`,
          suggestedParameter: {
            parameterName: "clearance",
            currentValue: clearance,
            suggestedValue: 0.18,
            rationale: "Reduce clearance to 0.18mm to maintain joint stability without binding.",
          },
        });
      }
    }

    // -------------------------------------------------------------
    // 3. ASSEMBLY FLEXIBILITY EVALUATION
    // -------------------------------------------------------------
    let flexScore = 90.0;
    const prefAngle = specification?.connection_preferences?.preferredJoiningAngleDeg ?? 90.0;
    if (prefAngle !== 90.0 && prefAngle !== 45.0 && prefAngle !== 60.0 && prefAngle !== 120.0) {
      flexScore -= 10.0;
      issues.push({
        id: uid("iss_flex_"),
        category: "assembly_flexibility",
        severity: "STYLE_PREFERENCE",
        affectedEntity: { type: "specification", id: specification?.specificationId || "spec" },
        reason: `Non-standard joining angle (${prefAngle}°) may require specialized assembly jigs or chamfered edges.`,
        suggestedParameter: {
          parameterName: "preferredJoiningAngleDeg",
          currentValue: prefAngle,
          suggestedValue: 90.0,
          rationale: "Orthogonal 90° or standard 45° miter angles facilitate easy self-locating alignment.",
        },
      });
    }

    // -------------------------------------------------------------
    // 4. DIFFICULTY ALIGNMENT EVALUATION
    // -------------------------------------------------------------
    let diffScore = 95.0;
    const pieceCount = design.pieces.length;
    const reqDifficulty = specification?.difficulty?.level;

    if (reqDifficulty === "easy" && pieceCount > 6) {
      diffScore -= 20.0;
      issues.push({
        id: uid("iss_diff_"),
        category: "difficulty",
        severity: "WARNING",
        affectedEntity: { type: "specification", id: specification?.specificationId || "spec" },
        reason: `Requested difficulty is 'easy', but piece count (${pieceCount}) introduces higher cognitive load.`,
        suggestedParameter: {
          parameterName: "piece_count",
          currentValue: pieceCount,
          suggestedValue: 4,
          rationale: "Reduce piece count to 3-4 pieces to match 'easy' difficulty rating.",
        },
      });
    }

    // -------------------------------------------------------------
    // 5. MATERIAL UTILIZATION EVALUATION
    // -------------------------------------------------------------
    let utilScore = 90.0;
    if (specification?.material) {
      const stockArea = specification.material.stockWidthMm * specification.material.stockHeightMm;
      let pieceAreaSum = 0;
      for (const p of design.pieces) {
        pieceAreaSum += (p.dimensions?.width ?? 0) * (p.dimensions?.height ?? 0);
      }

      const utilization = stockArea > 0 ? pieceAreaSum / stockArea : 0.5;
      if (utilization < 0.25) {
        utilScore = Math.max(10.0, Number((utilization * 300).toFixed(1)));
        const targetSide = Math.max(250, Math.round(Math.sqrt(pieceAreaSum / 0.35)));

        if (specification.material.stockWidthMm > targetSide) {
          issues.push({
            id: uid("iss_util_w_"),
            category: "material_utilization",
            severity: "WARNING",
            affectedEntity: { type: "material", id: specification.material.materialId },
            reason: `Low sheet material utilization (${(utilization * 100).toFixed(1)}%). Significant cardboard waste generated.`,
            suggestedParameter: {
              parameterName: "stockWidthMm",
              currentValue: specification.material.stockWidthMm,
              suggestedValue: targetSide,
              rationale: "Downsize stock sheet width to reduce scrap waste.",
            },
          });
        }
        if (specification.material.stockHeightMm > targetSide) {
          issues.push({
            id: uid("iss_util_h_"),
            category: "material_utilization",
            severity: "WARNING",
            affectedEntity: { type: "material", id: specification.material.materialId },
            reason: `Low sheet material utilization (${(utilization * 100).toFixed(1)}%). Significant cardboard waste generated.`,
            suggestedParameter: {
              parameterName: "stockHeightMm",
              currentValue: specification.material.stockHeightMm,
              suggestedValue: targetSide,
              rationale: "Downsize stock sheet height to reduce scrap waste.",
            },
          });
        }
      }
    }

    // -------------------------------------------------------------
    // 6. MANUFACTURABILITY EVALUATION
    // -------------------------------------------------------------
    let mfgScore = 95.0;
    for (const p of design.pieces) {
      const kerf = p.manufacturingParameters?.kerf ?? 0.1;
      if (kerf < 0.05 || kerf > 0.3) {
        mfgScore = Math.max(60.0, mfgScore - 15.0);
        issues.push({
          id: uid("iss_mfg_"),
          category: "manufacturability",
          severity: "WARNING",
          affectedEntity: { type: "piece", id: piece.id, name: piece.name },
          reason: `Laser kerf ${kerf}mm deviates from standard cardboard laser cutting allowances (0.08 - 0.20 mm).`,
          suggestedParameter: {
            parameterName: "manufacturingParameters.kerf",
            currentValue: kerf,
            suggestedValue: 0.1,
            rationale: "Standard CO2 laser kerf for cardboard is approximately 0.10mm.",
          },
        });
      }
    }

    // -------------------------------------------------------------
    // 7. SYMMETRY EVALUATION
    // -------------------------------------------------------------
    let symScore = 95.0;
    if (specification?.symmetry?.isSymmetrical) {
      // If symmetrical design was requested, verify even distribution of wall pieces
      const nonBasePieces = design.pieces.filter((p) => !p.name.toLowerCase().includes("base"));
      if (nonBasePieces.length % 2 !== 0) {
        symScore -= 15.0;
        issues.push({
          id: uid("iss_sym_"),
          category: "symmetry",
          severity: "STYLE_PREFERENCE",
          affectedEntity: { type: "specification", id: specification.specificationId },
          reason: `Symmetrical construction requested, but assembly features ${nonBasePieces.length} wall pieces (odd count violates bilateral balance).`,
          suggestedParameter: {
            parameterName: "piece_count",
            currentValue: design.pieces.length,
            suggestedValue: design.pieces.length + 1,
            rationale: "Adjust piece count to allow mirrored pairs for bilateral symmetry.",
          },
        });
      }
    }

    // -------------------------------------------------------------
    // 8. AESTHETIC & DESIGN PREFERENCES EVALUATION
    // -------------------------------------------------------------
    let aesScore = 90.0;
    const overallW = specification?.overall_size?.widthMm ?? 200;
    const overallH = specification?.overall_size?.heightMm ?? 150;
    const overallAspect = overallW / Math.max(1, overallH);
    if (overallAspect > 3.0 || overallAspect < 0.4) {
      aesScore -= 15.0;
      issues.push({
        id: uid("iss_aes_"),
        category: "aesthetic_preference",
        severity: "STYLE_PREFERENCE",
        affectedEntity: { type: "specification", id: specification?.specificationId || "spec" },
        reason: `Overall aspect ratio (${overallAspect.toFixed(2)}) is disproportionately elongated or squashed.`,
        suggestedParameter: {
          parameterName: "overall_size.widthMm",
          currentValue: overallW,
          suggestedValue: Math.round(overallH * 1.4),
          rationale: "Proportions closer to 1.4:1 improve visual stability and ergonomic appeal.",
        },
      });
    }

    // Count severities
    const hardFailuresCount = issues.filter((i) => i.severity === "HARD_FAILURE").length;
    const warningsCount = issues.filter((i) => i.severity === "WARNING").length;
    const stylePreferencesCount = issues.filter((i) => i.severity === "STYLE_PREFERENCE").length;

    // Determine overall assessment
    let overallAssessment: "PASS" | "NEEDS_REVISION" | "REJECTED" = "PASS";
    if (hardFailuresCount > 0) {
      overallAssessment = "REJECTED";
      geomScore = Math.min(30.0, geomScore);
    } else if (warningsCount > 0) {
      overallAssessment = "NEEDS_REVISION";
    }

    // Composite quality score
    const domainWeights = [0.20, 0.15, 0.15, 0.10, 0.10, 0.15, 0.08, 0.07];
    const rawScores = [geomScore, connScore, flexScore, diffScore, utilScore, mfgScore, symScore, aesScore];
    let compositeQualityScore = 0;
    for (let i = 0; i < domainWeights.length; i++) {
      compositeQualityScore += rawScores[i] * domainWeights[i];
    }
    if (hardFailuresCount > 0) {
      compositeQualityScore = Math.min(35.0, compositeQualityScore);
    }
    compositeQualityScore = Number(compositeQualityScore.toFixed(1));

    const scores: DesignCritiqueDomainScores = {
      geometryQuality: Number(geomScore.toFixed(1)),
      connectionQuality: Number(connScore.toFixed(1)),
      assemblyFlexibility: Number(flexScore.toFixed(1)),
      difficultyAlignment: Number(diffScore.toFixed(1)),
      materialUtilization: Number(utilScore.toFixed(1)),
      manufacturability: Number(mfgScore.toFixed(1)),
      symmetry: Number(symScore.toFixed(1)),
      aestheticPreference: Number(aesScore.toFixed(1)),
      compositeQualityScore,
    };

    const summary =
      hardFailuresCount > 0
        ? `Critique REJECTED: ${hardFailuresCount} hard failure(s) detected. Physical/validation constraints violated.`
        : warningsCount > 0
        ? `Critique NEEDS_REVISION: ${warningsCount} warning(s) identified for engineering/manufacturing optimization.`
        : `Critique PASS: Design satisfies all quality, kinematic, and manufacturing criteria (Score: ${compositeQualityScore}/100).`;

    return {
      critiqueId,
      designId,
      overallAssessment,
      scores,
      issues,
      hardFailuresCount,
      warningsCount,
      stylePreferencesCount,
      deterministicValidationUnaltered: true,
      summary,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
