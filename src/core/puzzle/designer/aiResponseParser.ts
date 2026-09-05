/**
 * Robust AI Response Parser (Prompt 121 Section 10).
 *
 * Safely parses and normalizes AI model outputs:
 *  - null / undefined
 *  - empty strings
 *  - raw JSON strings
 *  - JSON enclosed in markdown code fences (```json ... ```)
 *  - unstructured / conversational plain text
 *  - partial or malformed object structures
 *
 * Guaranteed never to throw exceptions.
 */

import type { DesignSpecification2D } from "../automatic2d/types";
import { uid } from "@/core/model/ids";

export interface ParsedAIIntent {
  pieceCount: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  connectionComplexity: "Simple" | "Moderate" | "Complex" | "Keyed";
  assemblyStyle: "Planar" | "Non-planar" | "Box" | "Multi-layer" | "Freeform 3D";
  nonPlanar: boolean;
  materialName: string;
  stockThicknessMm: number;
  overallWidthMm: number;
  overallHeightMm: number;
  rawText: string;
  extractedFrom: "json" | "markdown_json" | "nlp_heuristics" | "fallback";
}

export interface AIInterpretationResult {
  success: boolean;
  intent: ParsedAIIntent;
  designSpecification: DesignSpecification2D;
  error?: string;
}

const DEFAULT_INTENT: ParsedAIIntent = {
  pieceCount: 16,
  difficulty: "Advanced",
  connectionComplexity: "Complex",
  assemblyStyle: "Non-planar",
  nonPlanar: true,
  materialName: "Cardboard 3mm",
  stockThicknessMm: 3.0,
  overallWidthMm: 180,
  overallHeightMm: 140,
  rawText: "",
  extractedFrom: "fallback",
};

/**
 * Strips markdown code blocks if present (e.g. ```json ... ```).
 */
function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = trimmed.match(jsonBlockRegex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * Extracts intent from natural language text using heuristic keywords.
 */
function parseTextHeuristics(text: string): ParsedAIIntent {
  const intent: ParsedAIIntent = { ...DEFAULT_INTENT, rawText: text, extractedFrom: "nlp_heuristics" };

  // Piece count extraction: "20 pieces", "20-piece", "count: 20", etc.
  const pieceMatch = text.match(/\b(\d{1,2})\s*[- ]?(?:piece|pieces|parts)\b/i) || text.match(/\bpiece[s]?\s*[:=]\s*(\d{1,2})\b/i);
  if (pieceMatch && pieceMatch[1]) {
    const count = parseInt(pieceMatch[1], 10);
    if (count >= 2 && count <= 64) {
      intent.pieceCount = count;
    }
  }

  // Non-planar vs planar
  if (/\b(?:non[- ]planar|3d\s+assembly|freeform|spatial|out[- ]of[- ]plane)\b/i.test(text)) {
    intent.nonPlanar = true;
    intent.assemblyStyle = "Non-planar";
  } else if (/\b(?:planar|flat|2d\s+assembly)\b/i.test(text)) {
    intent.nonPlanar = false;
    intent.assemblyStyle = "Planar";
  }

  // Difficulty
  if (/\b(?:beginner|easy|simple)\b/i.test(text)) {
    intent.difficulty = "Beginner";
  } else if (/\b(?:intermediate|moderate)\b/i.test(text)) {
    intent.difficulty = "Intermediate";
  } else if (/\b(?:expert|master|hardest)\b/i.test(text)) {
    intent.difficulty = "Expert";
  } else if (/\b(?:advanced|hard|complex)\b/i.test(text)) {
    intent.difficulty = "Advanced";
  }

  // Connection complexity
  if (/\b(?:keyed|interlocking|dove[- ]?tail|puzzle[- ]?tab)\b/i.test(text)) {
    intent.connectionComplexity = "Keyed";
  } else if (/\b(?:complex|intricate)\b/i.test(text)) {
    intent.connectionComplexity = "Complex";
  } else if (/\b(?:simple|basic)\b/i.test(text)) {
    intent.connectionComplexity = "Simple";
  }

  // Thickness
  const thickMatch = text.match(/\b(\d(?:\.\d)?)\s*mm\b/i);
  if (thickMatch && thickMatch[1]) {
    const th = parseFloat(thickMatch[1]);
    if (th > 0.5 && th <= 12) {
      intent.stockThicknessMm = th;
    }
  }

  return intent;
}

/**
 * Creates a valid DesignSpecification2D from intent.
 */
function buildSpecification(intent: ParsedAIIntent): DesignSpecification2D {
  return {
    id: uid("spec_ai_"),
    name: `AI Puzzle (${intent.pieceCount} pieces, ${intent.materialName})`,
    targetPieceCount: intent.pieceCount,
    overallSize: {
      width: intent.overallWidthMm,
      height: intent.overallHeightMm,
    },
    boundaryShape: "rectangle",
    partitionStyle: intent.nonPlanar ? "voronoi" : "grid",
    preferredConnectorType: intent.connectionComplexity === "Keyed" ? "keyed_slot" : "puzzle_tab",
    material: {
      id: "cardboard_3mm",
      name: intent.materialName,
      stockThicknessMm: intent.stockThicknessMm,
      kerfMm: 0.1,
    },
    thicknessMm: intent.stockThicknessMm,
    seed: Math.floor(Math.random() * 100000),
  };
}

/**
 * Master parser: takes any arbitrary raw response and produces a safe, structured result.
 */
export function parseAIResponse(response: unknown): AIInterpretationResult {
  if (response === null || response === undefined) {
    const intent = { ...DEFAULT_INTENT };
    return {
      success: false,
      intent,
      designSpecification: buildSpecification(intent),
      error: "AI response could not be interpreted: response was null or undefined.",
    };
  }

  // If response is an object with reply or message, extract the text payload
  let textToParse = "";
  if (typeof response === "string") {
    textToParse = response.trim();
  } else if (typeof response === "object") {
    const anyResp = response as any;
    textToParse = String(anyResp.reply || anyResp.text || anyResp.content || anyResp.message || "");
  }

  if (!textToParse) {
    const intent = { ...DEFAULT_INTENT };
    return {
      success: false,
      intent,
      designSpecification: buildSpecification(intent),
      error: "AI response could not be interpreted: response is empty.",
    };
  }

  // 1. Attempt JSON parsing (direct or from markdown code fence)
  const candidate = extractJsonCandidate(textToParse);
  try {
    const parsedObj = JSON.parse(candidate);
    if (parsedObj && typeof parsedObj === "object") {
      const intent: ParsedAIIntent = {
        pieceCount: typeof parsedObj.pieceCount === "number" ? Math.max(4, Math.min(64, parsedObj.pieceCount)) : DEFAULT_INTENT.pieceCount,
        difficulty: ["Beginner", "Intermediate", "Advanced", "Expert"].includes(parsedObj.difficulty) ? parsedObj.difficulty : DEFAULT_INTENT.difficulty,
        connectionComplexity: ["Simple", "Moderate", "Complex", "Keyed"].includes(parsedObj.connectionComplexity) ? parsedObj.connectionComplexity : DEFAULT_INTENT.connectionComplexity,
        assemblyStyle: typeof parsedObj.assemblyStyle === "string" ? parsedObj.assemblyStyle : (parsedObj.nonPlanar ? "Non-planar" : "Planar"),
        nonPlanar: typeof parsedObj.nonPlanar === "boolean" ? parsedObj.nonPlanar : (parsedObj.assemblyMode === "non-planar" || parsedObj.assemblyStyle === "Non-planar"),
        materialName: typeof parsedObj.material === "string" ? parsedObj.material : DEFAULT_INTENT.materialName,
        stockThicknessMm: typeof parsedObj.thickness === "number" ? parsedObj.thickness : DEFAULT_INTENT.stockThicknessMm,
        overallWidthMm: typeof parsedObj.overallWidthMm === "number" ? parsedObj.overallWidthMm : DEFAULT_INTENT.overallWidthMm,
        overallHeightMm: typeof parsedObj.overallHeightMm === "number" ? parsedObj.overallHeightMm : DEFAULT_INTENT.overallHeightMm,
        rawText: textToParse,
        extractedFrom: candidate !== textToParse ? "markdown_json" : "json",
      };

      return {
        success: true,
        intent,
        designSpecification: buildSpecification(intent),
      };
    }
  } catch {
    // JSON parse failed; fall back to text heuristics
  }

  // 2. Parse unstructured conversational text heuristics
  const intent = parseTextHeuristics(textToParse);
  return {
    success: true,
    intent,
    designSpecification: buildSpecification(intent),
  };
}
