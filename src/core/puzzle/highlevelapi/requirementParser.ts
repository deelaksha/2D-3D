/**
 * Natural Language Requirement Parser (Phase 92 - Stage 1).
 *
 * Deterministically parses natural language prompts or structured requirement inputs
 * into fully resolved, validated design intent.
 */

import type { PartitionStyle } from "../boundarypartition/types";
import type { ConnectorType } from "../connectorgeneration/types";
import type { ParsedRequirement, PuzzleRequirementInput } from "./types";

export class RequirementParser {
  /**
   * Translates a natural language user prompt or structured request into a ParsedRequirement.
   */
  public static parse(input: PuzzleRequirementInput): ParsedRequirement {
    if (typeof input === "object" && input !== null) {
      return this.parseStructured(input);
    }
    return this.parseNaturalLanguage(String(input || ""));
  }

  /**
   * Parses natural language requirement strings (e.g. "Generate a 16-piece puzzle using 3 mm cardboard with non-planar connections.")
   */
  private static parseNaturalLanguage(prompt: string): ParsedRequirement {
    const pLower = prompt.toLowerCase();

    // 1. Piece Count Extraction
    let targetPieceCount = 16;
    const pieceMatch = pLower.match(/(\d+)\s*[- ]?\s*(?:pieces?|piece)/);
    if (pieceMatch) {
      const parsed = parseInt(pieceMatch[1], 10);
      if (parsed > 0) targetPieceCount = parsed;
    }

    // 2. Thickness Extraction (e.g. "3 mm", "3mm", "6.0 mm", or configured cardboard)
    let stockThicknessMm = 3.0;
    const thickMatch = pLower.match(/(\d+(?:\.\d+)?)\s*mm/);
    if (thickMatch) {
      const parsed = parseFloat(thickMatch[1]);
      if (parsed > 0) stockThicknessMm = parsed;
    } else if (pLower.includes("configured") && pLower.includes("cardboard")) {
      stockThicknessMm = 3.0; // Configured standard cardboard stock thickness
    }

    // 3. Material Extraction
    let materialId = "cardboard";
    let materialName = "Cardboard Stock";

    if (pLower.includes("plywood") || pLower.includes("birch")) {
      materialId = "plywood";
      materialName = "Birch Plywood";
    } else if (pLower.includes("acrylic") || pLower.includes("plastic")) {
      materialId = "acrylic";
      materialName = "Cast Acrylic";
    } else if (pLower.includes("wooden") || pLower.includes("wood") || pLower.includes("hardwood")) {
      materialId = "wood";
      materialName = "Hardwood";
    } else if (pLower.includes("cardboard")) {
      materialId = "cardboard";
      materialName = "Cardboard Stock";
    }

    // 4. Non-Planar / 3D Assembly Extraction
    const nonPlanar =
      pLower.includes("non-planar") ||
      pLower.includes("nonplanar") ||
      pLower.includes("3d") ||
      pLower.includes("3-d") ||
      pLower.includes("box") ||
      pLower.includes("perpendicular") ||
      pLower.includes("90 degree") ||
      pLower.includes("90°") ||
      pLower.includes("orthogonal") ||
      pLower.includes("folding") ||
      pLower.includes("angled");

    // 5. Partition Style Extraction
    let partitionStyle: PartitionStyle = "rectangular";
    if (pLower.includes("polygonal") || pLower.includes("voronoi")) {
      partitionStyle = "polygonal";
    } else if (pLower.includes("organic") || pLower.includes("curved")) {
      partitionStyle = "organic";
    } else if (pLower.includes("irregular")) {
      partitionStyle = "irregular";
    }

    // 6. Connector Type Extraction
    let preferredConnectorType: ConnectorType = "tab_slot";
    if (pLower.includes("notch")) {
      preferredConnectorType = "notch";
    } else if (pLower.includes("interlock") || pLower.includes("dovetail")) {
      preferredConnectorType = "interlock";
    } else if (pLower.includes("keyed")) {
      preferredConnectorType = "keyed";
    }

    // 7. Overall Dimension Calculation
    const gridCols = Math.max(2, Math.ceil(Math.sqrt(targetPieceCount)));
    const gridRows = Math.ceil(targetPieceCount / gridCols);
    const pieceSpanMm = targetPieceCount <= 4 ? 60 : 40;

    const overallSize = {
      widthMm: gridCols * pieceSpanMm,
      heightMm: gridRows * pieceSpanMm,
    };

    return {
      rawPrompt: prompt,
      pieceCount: targetPieceCount,
      targetPieceCount,
      thickness: stockThicknessMm,
      stockThicknessMm,
      material: materialId,
      materialId,
      materialName,
      nonPlanar,
      boundaryShape: "rectangle",
      partitionStyle,
      preferredConnectorType,
      overallSize,
      gridDimensions: {
        rows: gridRows,
        cols: gridCols,
      },
      seed: 42,
    };
  }

  /**
   * Parses structured input objects with fallbacks.
   */
  private static parseStructured(input: {
    prompt?: string;
    pieceCount?: number;
    targetPieceCount?: number;
    thickness?: number;
    stockThicknessMm?: number;
    material?: string;
    nonPlanar?: boolean;
    boundaryShape?: "rectangle" | "circle" | "polygon" | "l_shaped";
    partitionStyle?: PartitionStyle;
    preferredConnectorType?: ConnectorType;
    overallSize?: { width?: number; height?: number; widthMm?: number; heightMm?: number };
    seed?: number;
  }): ParsedRequirement {
    const fallback = this.parseNaturalLanguage(input.prompt || "");

    const targetPieceCount = input.targetPieceCount ?? input.pieceCount ?? fallback.targetPieceCount;
    const stockThicknessMm = input.stockThicknessMm ?? input.thickness ?? fallback.stockThicknessMm;
    const nonPlanar = input.nonPlanar ?? fallback.nonPlanar;
    const boundaryShape = input.boundaryShape ?? fallback.boundaryShape;
    const partitionStyle = input.partitionStyle ?? fallback.partitionStyle;
    const preferredConnectorType = input.preferredConnectorType ?? fallback.preferredConnectorType;

    let materialId = fallback.materialId;
    let materialName = fallback.materialName;
    if (input.material) {
      materialId = input.material.toLowerCase();
      materialName = input.material;
    }

    const gridCols = Math.max(2, Math.ceil(Math.sqrt(targetPieceCount)));
    const gridRows = Math.ceil(targetPieceCount / gridCols);
    const pieceSpanMm = targetPieceCount <= 4 ? 60 : 40;

    let overallSize = {
      widthMm: gridCols * pieceSpanMm,
      heightMm: gridRows * pieceSpanMm,
    };

    if (input.overallSize) {
      overallSize = {
        widthMm: input.overallSize.widthMm ?? input.overallSize.width ?? overallSize.widthMm,
        heightMm: input.overallSize.heightMm ?? input.overallSize.height ?? overallSize.heightMm,
      };
    }

    return {
      rawPrompt: input.prompt || "Structured Puzzle Request",
      pieceCount: targetPieceCount,
      targetPieceCount,
      thickness: stockThicknessMm,
      stockThicknessMm,
      material: materialId,
      materialId,
      materialName,
      nonPlanar,
      boundaryShape,
      partitionStyle,
      preferredConnectorType,
      overallSize,
      gridDimensions: {
        rows: gridRows,
        cols: gridCols,
      },
      seed: input.seed ?? 42,
    };
  }
}

/**
 * Functional export for requirement parsing.
 */
export function parseRequirement(input: PuzzleRequirementInput): ParsedRequirement {
  return RequirementParser.parse(input);
}
