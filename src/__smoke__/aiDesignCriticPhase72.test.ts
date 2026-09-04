/**
 * Smoke & Integration Tests for Phase 72:
 * AI Design Critic Subsystem
 */

import { describe, it, expect } from "vitest";
import {
  DeterministicDesignCritic,
  DesignCritique,
  CritiqueIssue,
} from "../core/puzzle/critic";
import {
  createCanonicalPiece,
  createEmptyCanonicalPuzzle,
} from "../core/puzzle/canonical/defaults";
import type { ParametricDesignSpecification } from "../core/puzzle/ailayer/types";
import type { AIValidationPasses } from "../core/puzzle/designgeneration/types";
import { vec3 } from "../core/puzzle/geometry/math3d";

describe("Phase 72: AI Design Critic Subsystem", () => {
  const critic = new DeterministicDesignCritic();

  // Helper to construct a standard valid specification
  function makeValidSpec(overrides?: Partial<ParametricDesignSpecification>): ParametricDesignSpecification {
    return {
      specificationId: "spec_valid_123",
      overall_size: { widthMm: 200, heightMm: 150, depthMm: 100 },
      piece_count: 4,
      layers: 1,
      material: {
        stockThicknessMm: 2.0,
        stockWidthMm: 600,
        stockHeightMm: 400,
        materialId: "cardboard-corrugated-2mm",
      },
      connection_preferences: {
        defaultType: "tab_slot",
        preferredJoiningAngleDeg: 90.0,
        genderStyle: "complementary",
      },
      difficulty: { level: "medium", maxUniquePieces: 4 },
      symmetry: { isSymmetrical: false, symmetryAxis: "y" },
      constraints: [],
      ...overrides,
    };
  }

  describe("1. Pristine Design Evaluation (PASS Tier)", () => {
    it("evaluates a compliant, well-proportioned design as PASS with zero hard failures", () => {
      const puzzle = createEmptyCanonicalPuzzle("Compliant Desk Organizer");
      puzzle.metadata.id = "puz_compliant_1";
      puzzle.pieces.push(
        createCanonicalPiece("Base Plate", { width: 180, height: 120, depth: 2.0 }, 2.0),
        createCanonicalPiece("Wall Left", { width: 120, height: 100, depth: 2.0 }, 2.0),
        createCanonicalPiece("Wall Right", { width: 120, height: 100, depth: 2.0 }, 2.0)
      );
      (puzzle.connections as any).push({
        id: "conn_1",
        interfaceAId: "if_1",
        interfaceBId: "if_2",
        clearance: 0.15,
      });

      const spec = makeValidSpec({
        overall_size: { widthMm: 180, heightMm: 120, depthMm: 100 },
        material: {
          stockThicknessMm: 2.0,
          stockWidthMm: 300,
          stockHeightMm: 300,
          materialId: "cardboard-2mm",
        },
      });

      const validationPasses: AIValidationPasses = {
        schemaValidation: true,
        hardConstraintValidation: true,
        geometryValidation: true,
        connectionValidation: true,
        validation3D: true,
        overallPassed: true,
      };

      const result: DesignCritique = critic.critique(puzzle, spec, validationPasses);

      expect(result.overallAssessment).toBe("PASS");
      expect(result.hardFailuresCount).toBe(0);
      expect(result.warningsCount).toBe(0);
      expect(result.scores.compositeQualityScore).toBeGreaterThanOrEqual(85.0);
      expect(result.deterministicValidationUnaltered).toBe(true);
      expect(result.summary).toContain("Critique PASS");
    });
  });

  describe("2. HARD_FAILURE Detection & Validation Non-Override Invariant", () => {
    it("strictly preserves deterministic validation failure as HARD_FAILURE and rejects design", () => {
      const puzzle = createEmptyCanonicalPuzzle("Failing Puzzle");
      puzzle.metadata.id = "puz_fail_1";

      const spec = makeValidSpec();
      const failingValidationPasses: AIValidationPasses = {
        schemaValidation: false,
        hardConstraintValidation: false,
        geometryValidation: true,
        connectionValidation: true,
        validation3D: true,
        overallPassed: false,
      };

      const result = critic.critique(puzzle, spec, failingValidationPasses);

      expect(result.overallAssessment).toBe("REJECTED");
      expect(result.hardFailuresCount).toBeGreaterThanOrEqual(2);
      expect(result.scores.compositeQualityScore).toBeLessThan(40.0);
      expect(result.deterministicValidationUnaltered).toBe(true);

      const hardIssues = result.issues.filter((i) => i.severity === "HARD_FAILURE");
      expect(hardIssues.some((i) => i.reason.includes("schema validation failed"))).toBe(true);
      expect(hardIssues.some((i) => i.reason.includes("hard constraints violated"))).toBe(true);
    });

    it("detects non-positive piece dimensions as HARD_FAILURE", () => {
      const puzzle = createEmptyCanonicalPuzzle("Zero Dim Piece");
      puzzle.pieces.push(
        createCanonicalPiece("Broken Piece", { width: 0, height: 100, depth: 2.0 }, 2.0)
      );

      const result = critic.critique(puzzle, makeValidSpec());

      expect(result.overallAssessment).toBe("REJECTED");
      const dimIssue = result.issues.find((i) => i.category === "geometry_quality" && i.severity === "HARD_FAILURE");
      expect(dimIssue).toBeDefined();
      expect(dimIssue!.reason).toContain("non-positive dimension");
      expect(dimIssue!.suggestedParameter?.parameterName).toBe("dimensions");
    });
  });

  describe("3. WARNING Detection & Actionable Parameter Suggestions", () => {
    it("flags overly tight clearance and low material utilization as WARNINGs with suggested parameters", () => {
      const puzzle = createEmptyCanonicalPuzzle("Suboptimal Puzzle");
      puzzle.pieces.push(
        createCanonicalPiece("Base", { width: 50, height: 50, depth: 2.0 }, 2.0)
      );
      (puzzle.connections as any).push({
        id: "conn_tight",
        interfaceAId: "if_1",
        interfaceBId: "if_2",
        clearance: 0.04, // overly tight: < 0.08mm
      });

      // Stock sheet is massive (1000x1000mm) for a tiny 50x50 piece -> low utilization
      const spec = makeValidSpec({
        material: {
          stockThicknessMm: 2.0,
          stockWidthMm: 1000,
          stockHeightMm: 1000,
          materialId: "cardboard-2mm",
        },
      });

      const result = critic.critique(puzzle, spec);

      expect(result.overallAssessment).toBe("NEEDS_REVISION");
      expect(result.warningsCount).toBeGreaterThanOrEqual(2);

      // Verify clearance warning
      const clearanceWarning = result.issues.find(
        (i) => i.category === "connection_quality" && i.severity === "WARNING"
      );
      expect(clearanceWarning).toBeDefined();
      expect(clearanceWarning!.suggestedParameter).toBeDefined();
      expect(clearanceWarning!.suggestedParameter!.parameterName).toBe("clearance");
      expect(clearanceWarning!.suggestedParameter!.suggestedValue).toBe(0.15);

      // Verify material utilization warning
      const utilWarning = result.issues.find(
        (i) => i.category === "material_utilization" && i.severity === "WARNING"
      );
      expect(utilWarning).toBeDefined();
      expect(utilWarning!.suggestedParameter).toBeDefined();
      expect(utilWarning!.suggestedParameter!.parameterName).toBe("stockWidthMm");
    });
  });

  describe("4. STYLE_PREFERENCE Detection", () => {
    it("flags odd piece count when bilateral symmetry is requested", () => {
      const puzzle = createEmptyCanonicalPuzzle("Asymmetric Wall Layout");
      // 1 base + 3 wall pieces (odd count violates bilateral pairs)
      puzzle.pieces.push(
        createCanonicalPiece("Base Plate", { width: 150, height: 150, depth: 2.0 }, 2.0),
        createCanonicalPiece("Wall 1", { width: 60, height: 80, depth: 2.0 }, 2.0),
        createCanonicalPiece("Wall 2", { width: 60, height: 80, depth: 2.0 }, 2.0),
        createCanonicalPiece("Wall 3", { width: 60, height: 80, depth: 2.0 }, 2.0)
      );

      const spec = makeValidSpec({
        symmetry: { isSymmetrical: true, symmetryAxis: "y" },
      });

      const result = critic.critique(puzzle, spec);

      const symIssue = result.issues.find(
        (i) => i.category === "symmetry" && i.severity === "STYLE_PREFERENCE"
      );
      expect(symIssue).toBeDefined();
      expect(symIssue!.reason).toContain("bilateral balance");
      expect(symIssue!.suggestedParameter?.parameterName).toBe("piece_count");
    });
  });

  describe("5. Simultaneous 3-Tier Severity Classification", () => {
    it("accurately segments HARD_FAILURE, WARNING, and STYLE_PREFERENCE in a single evaluation", () => {
      const puzzle = createEmptyCanonicalPuzzle("Multi-Flaw Puzzle");
      puzzle.pieces.push(
        createCanonicalPiece("Normal Base", { width: 100, height: 100, depth: 2.0 }, 2.0),
        createCanonicalPiece("Thin Strip", { width: 250, height: 20, depth: 2.0 }, 2.0) // aspect 12.5 -> WARNING
      );
      (puzzle.connections as any).push({
        id: "conn_tight",
        interfaceAId: "if_1",
        interfaceBId: "if_2",
        clearance: 0.05, // tight -> WARNING
      });

      const spec = makeValidSpec({
        connection_preferences: {
          defaultType: "tab_slot",
          preferredJoiningAngleDeg: 72.5, // non-standard -> STYLE_PREFERENCE
          genderStyle: "complementary",
        },
      });

      const validationPasses: AIValidationPasses = {
        schemaValidation: false, // -> HARD_FAILURE
        hardConstraintValidation: true,
        geometryValidation: true,
        connectionValidation: true,
        validation3D: true,
        overallPassed: false,
      };

      const result = critic.critique(puzzle, spec, validationPasses);

      expect(result.overallAssessment).toBe("REJECTED"); // HARD_FAILURE trumps
      expect(result.hardFailuresCount).toBeGreaterThan(0);
      expect(result.warningsCount).toBeGreaterThan(0);
      expect(result.stylePreferencesCount).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.severity === "HARD_FAILURE")).toBe(true);
      expect(result.issues.some((i) => i.severity === "WARNING")).toBe(true);
      expect(result.issues.some((i) => i.severity === "STYLE_PREFERENCE")).toBe(true);
    });
  });

  describe("6. Read-Only Invariant: Zero Geometry Mutation", () => {
    it("guarantees that the critic never mutates piece boundaries, dimensions, or coordinates", () => {
      const puzzle = createEmptyCanonicalPuzzle("Immutable Puzzle");
      puzzle.pieces.push(
        createCanonicalPiece("Piece A", { width: 120, height: 80, depth: 3.0 }, 3.0),
        createCanonicalPiece("Piece B", { width: 100, height: 90, depth: 3.0 }, 3.0)
      );

      const beforeJSON = JSON.stringify(puzzle);
      const spec = makeValidSpec();
      const specBeforeJSON = JSON.stringify(spec);

      critic.critique(puzzle, spec);

      const afterJSON = JSON.stringify(puzzle);
      const specAfterJSON = JSON.stringify(spec);

      // Verify exact byte-for-byte immutability
      expect(afterJSON).toBe(beforeJSON);
      expect(specAfterJSON).toBe(specBeforeJSON);
    });
  });
});
