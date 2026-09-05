/**
 * Phase 100: End-to-End Autonomous Generation Demonstration & Test Suite.
 *
 * Verifies that the autonomous puzzle generation engine accepts ONLY a natural language requirement:
 * "Create a 20-piece puzzle using the configured cardboard size and thickness.
 *  Make the internal connections complex and allow the pieces to form a non-planar 3D assembly."
 *
 * And deterministically executes, audits, and proves all 23 distinct engineering stages:
 *  1. Requirement parsing
 *  2. Design specification
 *  3. Global 2D boundary generation
 *  4. Piece partitioning (20 pieces)
 *  5. Connection graph generation
 *  6. Connector generation
 *  7. Connector placement
 *  8. 2D geometry validation
 *  9. 3D piece generation
 *  10. Candidate angle generation
 *  11. 3D assembly solving
 *  12. Collision validation
 *  13. Clearance validation
 *  14. Connector compatibility validation
 *  15. Assembly feasibility validation
 *  16. Repair verification
 *  17. Final assembly production
 *  18. Renderer-independent 3D scene creation
 *  19. Interactive 3D preview display
 *  20. Assembly sequence timeline & animation
 *  21. Validation report generation
 *  22. Connection angle inspection & manipulation
 *  23. Production export package (SVG, DXF, STL, OBJ, glTF, STEP, JSON)
 */

import { describe, expect, it } from "vitest";
import {
  AutonomousDemonstrator,
  type AutonomousDemonstrationResult,
} from "../core/puzzle/demonstration";

describe("Phase 100: End-to-End Autonomous Generation Demonstration", () => {
  const PROMPT_20_PIECE =
    "Create a 20-piece puzzle using the configured cardboard size and thickness. Make the internal connections complex and allow the pieces to form a non-planar 3D assembly.";

  it("autonomously executes and audits all 23 stages from the single natural language prompt", async () => {
    const result: AutonomousDemonstrationResult =
      await AutonomousDemonstrator.runCompletePipeline(PROMPT_20_PIECE);

    // 1. Root result integrity
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.rawPrompt).toBe(PROMPT_20_PIECE);

    // 2. Continuous 23 stages verification
    expect(result.steps).toHaveLength(23);
    for (let i = 0; i < 23; i++) {
      const step = result.steps[i];
      expect(step.stepNumber).toBe(i + 1);
      expect(step.status).toBe("PASS");
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
      expect(step.details.length).toBeGreaterThan(0);
    }

    // Verify key stage names in sequence
    expect(result.steps[0].name).toBe("REQUIREMENT_UNDERSTANDING");
    expect(result.steps[1].name).toBe("DESIGN_SPECIFICATION");
    expect(result.steps[2].name).toBe("GLOBAL_2D_BOUNDARY");
    expect(result.steps[3].name).toBe("PIECE_PARTITIONING");
    expect(result.steps[4].name).toBe("CONNECTION_GRAPH");
    expect(result.steps[5].name).toBe("CONNECTOR_GENERATION");
    expect(result.steps[6].name).toBe("CONNECTOR_PLACEMENT");
    expect(result.steps[7].name).toBe("VALIDATE_2D_GEOMETRY");
    expect(result.steps[8].name).toBe("CREATE_3D_PIECES");
    expect(result.steps[9].name).toBe("GENERATE_JOINING_ANGLES");
    expect(result.steps[10].name).toBe("SOLVE_3D_ASSEMBLY");
    expect(result.steps[11].name).toBe("CHECK_COLLISIONS");
    expect(result.steps[12].name).toBe("CHECK_CLEARANCES");
    expect(result.steps[13].name).toBe("CHECK_CONNECTOR_COMPATIBILITY");
    expect(result.steps[14].name).toBe("CHECK_ASSEMBLY_FEASIBILITY");
    expect(result.steps[15].name).toBe("REPAIR_FAILURES");
    expect(result.steps[16].name).toBe("PRODUCE_FINAL_ASSEMBLY");
    expect(result.steps[17].name).toBe("GENERATE_RENDERER_INDEPENDENT_SCENE");
    expect(result.steps[18].name).toBe("DISPLAY_INTERACTIVE_3D_PREVIEW");
    expect(result.steps[19].name).toBe("PROVIDE_ASSEMBLY_SEQUENCE");
    expect(result.steps[20].name).toBe("PROVIDE_VALIDATION_RESULTS");
    expect(result.steps[21].name).toBe("ALLOW_ANGLE_INSPECTION");
    expect(result.steps[22].name).toBe("EXPORT_FINAL_VALIDATED_DESIGN");

    // 3. Telemetry & engineering measurements
    expect(result.measurements.pieceCount).toBe(20);
    expect(result.measurements.finalValidity).toBe(true);
    expect(result.measurements.assemblySuccess).toBe(true);
    expect(result.measurements.nonPlanar).toBe(true);
    expect(result.measurements.connectionCount).toBeGreaterThanOrEqual(19);
    expect(result.measurements.repairIterations).toBeGreaterThanOrEqual(0);
    expect(result.measurements.validationFailures).toBe(0);
    expect(result.measurements.exportFormatCount).toBeGreaterThanOrEqual(6);
    expect(result.measurements.generationTimeMs).toBeGreaterThan(0);

    // 4. Authoritative CAD generation results
    expect(result.generationResult.pieces2D).toHaveLength(20);
    expect(result.generationResult.pieces3D).toHaveLength(20);
    expect(Object.keys(result.generationResult.assembly.pieceTransforms)).toHaveLength(20);
    expect(result.generationResult.validationReport.isValid).toBe(true);

    // 5. Renderer-independent scene
    expect(result.scene.id).toBeDefined();
    expect(result.scene.pieces.length).toBeGreaterThanOrEqual(20);
    expect(result.scene.coordinateAxes).toBeDefined();

    // 6. Interactive 3D preview
    expect(result.preview.visualState).toBe("VALID");
    expect(result.preview.pieceCount).toBe(20);
    expect(result.preview.cameraState.target).toBeDefined();

    // 7. Assembly animation timeline
    expect(result.animationTimeline.tracks.length).toBeGreaterThanOrEqual(19);
    expect(result.animationTimeline.totalDurationMs).toBeGreaterThan(0);

    // 8. Connection angle inspector
    expect(result.angleInspections.length).toBeGreaterThanOrEqual(1);
    const firstConn = result.angleInspections[0];
    expect(firstConn.connectionId).toBeDefined();
    expect(firstConn.allowedAngleRange.validCandidates.length).toBeGreaterThan(0);
    expect(typeof firstConn.currentAngleDeg).toBe("number");

    // 9. Multi-format production export package
    expect(result.exportPackage.isValidated).toBe(true);
    expect(result.exportPackage.pieceCount).toBe(20);
    expect(Object.keys(result.exportPackage.exports2D.individualPieces).length).toBe(20);
    expect(result.exportPackage.exports2D.combinedLayout.svg).toContain("<svg");
    expect(result.exportPackage.exports2D.combinedLayout.dxf).toContain("SECTION");
    expect(result.exportPackage.exports3D.assembled.stl).toContain("solid");
    expect(result.exportPackage.exports3D.assembled.obj).toContain("# Wavefront OBJ");
    expect(result.exportPackage.exports3D.assembled.gltf).toContain("asset");
    expect(result.exportPackage.exports3D.assembled.step).toContain("ISO-10303-21");
    expect(result.exportPackage.metadata.piecesJson).toContain("pieceId");
    expect(result.exportPackage.manifest.length).toBeGreaterThanOrEqual(6);
  });

  it("supports parameterized object configuration through AutonomousDemonstrator", async () => {
    const customResult = await AutonomousDemonstrator.runCompletePipeline({
      targetPieceCount: 20,
      material: "cardboard",
      materialThickness: 3.0,
      nonPlanar: true,
      maxDimensions: { width: 200, height: 160 },
    });

    expect(customResult.success).toBe(true);
    expect(customResult.measurements.pieceCount).toBe(20);
    expect(customResult.measurements.nonPlanar).toBe(true);
    expect(customResult.generationResult.designSpecification.material.stockThicknessMm).toBe(3.0);
    expect(customResult.steps).toHaveLength(23);
  });

});
