import { describe, expect, it } from "vitest";
import {
  CompleteDatasetItem,
  validateDatasetItem,
} from "@/core/puzzle";

describe("Phase 17: Training Data Architecture", () => {
  const validSyntheticItem: CompleteDatasetItem = {
    itemId: "ds_item_synthetic_001",
    version: "1.0.0",
    metadata: {
      createdAt: "2026-09-01T00:00:00Z",
      license: "Proprietary / Synthetic Test",
    },
    userRequirement: {
      prompt: "Create a 2-piece right-angle cardboard corner joint puzzle.",
      targetDifficulty: "easy",
    },
    source2DDrawingPath: "raw/drawings/corner_joint_sketch.png",
    segmentationContours: {
      P01: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
      P02: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
    },
    pieces: [
      {
        pieceId: "P01",
        name: "Base Plate P01",
        designParameters: { widthMm: 100, heightMm: 100, thicknessMm: 2.0, tabWidthMm: 20, tabDepthMm: 5 },
        localPolygon2D: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        localSolid3DBounds: { min: { x: 0, y: 0, z: -1 }, max: { x: 100, y: 100, z: 1 } },
      },
      {
        pieceId: "P02",
        name: "Side Wall P02",
        designParameters: { widthMm: 100, heightMm: 100, thicknessMm: 2.0, tabWidthMm: 20, tabDepthMm: 5 },
        localPolygon2D: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        localSolid3DBounds: { min: { x: 0, y: 0, z: -1 }, max: { x: 100, y: 100, z: 1 } },
      },
    ],
    interfaces: [
      {
        interfaceId: "if_p1_tab",
        owningPieceId: "P01",
        interfaceType: "tab",
        genderRole: "insert",
        profileWidthMm: 20,
        profileDepthMm: 5,
        localFrame: { origin: { x: 50, y: 0, z: 0 }, tangent: { x: 1, y: 0, z: 0 }, normal: { x: 0, y: -1, z: 0 }, binormal: { x: 0, y: 0, z: -1 } },
      },
      {
        interfaceId: "if_p2_slot",
        owningPieceId: "P02",
        interfaceType: "slot",
        genderRole: "receiver",
        profileWidthMm: 20,
        profileDepthMm: 5,
        localFrame: { origin: { x: 50, y: 0, z: 0 }, tangent: { x: 1, y: 0, z: 0 }, normal: { x: 0, y: -1, z: 0 }, binormal: { x: 0, y: 0, z: -1 } },
      },
    ],
    connections: [
      {
        connectionId: "conn_c12",
        interfaceAId: "if_p1_tab",
        interfaceBId: "if_p2_slot",
        connectionType: "tab_slot",
        joiningAngleDeg: 90.0,
      },
    ],
    puzzle: {
      puzzleId: "puz_synthetic_01",
      name: "Synthetic Corner Joint Puzzle",
      materialSpecification: { stockWidthMm: 600, stockHeightMm: 400, thicknessMm: 2.0, materialId: "cardboard-2mm" },
    },
    pieceSolids3D: {
      P01: { min: { x: 0, y: 0, z: -1 }, max: { x: 100, y: 100, z: 1 } },
      P02: { min: { x: 0, y: 0, z: -1 }, max: { x: 100, y: 100, z: 1 } },
    },
    assembly: {
      pieceTransforms: {
        P01: { position: { x: 0, y: 0, z: 0 }, rotationQuaternion: { x: 0, y: 0, z: 0, w: 1 } },
        P02: { position: { x: 100, y: 0, z: 0 }, rotationQuaternion: { x: 0, y: 0.7071, z: 0, w: 0.7071 } },
      },
      assemblySequence: [
        { stepNumber: 1, addedPieceId: "P01", subAssemblyStateLabel: "P01" },
        { stepNumber: 2, addedPieceId: "P02", subAssemblyStateLabel: "P01 + P02" },
      ],
    },
    constraints: [
      { constraintId: "const_angle_c12", constraintType: "angle", severity: "HARD", parameters: { joiningAngleDeg: 90.0 } },
    ],
    validation: {
      isValid: true,
      overallScore: 1.0,
      domainSummaries: {
        structural: { isValid: true, errorCount: 0, warningCount: 0 },
        geometric: { isValid: true, errorCount: 0, warningCount: 0 },
        connection: { isValid: true, errorCount: 0, warningCount: 0 },
        manufacturing: { isValid: true, errorCount: 0, warningCount: 0 },
        assembly: { isValid: true, errorCount: 0, warningCount: 0 },
      },
    },
    failureReasons: [],
    repairedDirectives: [],
  };

  it("validates a synthetic 17-step dataset item cleanly", () => {
    const report = validateDatasetItem(validSyntheticItem);
    expect(report.isValid).toBe(true);
    expect(report.errors.length).toBe(0);
  });

  it("rejects dataset items missing Design Parameters or Assembly Parameters", () => {
    const malformedItem: any = {
      ...validSyntheticItem,
      version: "2.0.0", // Invalid version
      pieces: [
        { pieceId: "P01", name: "P01" }, // Missing designParameters
      ],
    };
    delete malformedItem.assembly; // Missing assembly parameters

    const report = validateDatasetItem(malformedItem);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes("version"))).toBe(true);
    expect(report.errors.some((e) => e.includes("DESIGN PARAMETER"))).toBe(true);
    expect(report.errors.some((e) => e.includes("ASSEMBLY PARAMETER"))).toBe(true);
  });
});
