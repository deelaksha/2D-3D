/**
 * Smoke & Integration Tests for Phase 70:
 * Upgraded Design Retrieval System with Normalized DesignFeature,
 * Dual Similarity, and Strict Anti-Cloning Invariants.
 */

import { describe, it, expect } from "vitest";
import {
  DesignRetriever,
  DesignFeatureExtractor,
  DesignSimilarityEngine,
  ReferenceDesignProtector,
  AdvancedDesignQuery,
} from "../core/puzzle/retrievalsystem";
import { createCanonicalPiece, createEmptyCanonicalPuzzle } from "../core/puzzle/canonical/defaults";

describe("Phase 70: Upgraded Design Retrieval Subsystem", () => {
  const retriever = new DesignRetriever();

  describe("1. Natural-Language Requirements Search", () => {
    it("retrieves the 3-piece box when querying with natural language requirements", async () => {
      const query: AdvancedDesignQuery = {
        naturalLanguagePrompt: "compact wooden storage box with finger joints",
        topK: 2,
      };

      const result = await retriever.retrieveDesigns(query);

      expect(result.retrievedDesigns.length).toBeGreaterThanOrEqual(1);
      const top = result.topMatch;
      expect(top).toBeDefined();
      expect(top!.designId).toBe("tpl_box_3pc");
      expect(top!.similarity.overallScore).toBeGreaterThan(0.5);
      expect(top!.isReferenceOnly).toBe(true);

      // Verify keyword match was recognized
      const hasKeywordMatch = top!.matchingFeatures.some((m) => m.dimension === "naturalLanguage");
      expect(hasKeywordMatch).toBe(true);
    });

    it("retrieves the folding phone stand when searching for folding desktop hinge", async () => {
      const query: AdvancedDesignQuery = {
        naturalLanguagePrompt: "portable folding desktop phone stand with hinge",
        topK: 2,
      };

      const result = await retriever.retrieveDesigns(query);
      const top = result.topMatch;
      expect(top).toBeDefined();
      expect(top!.designId).toBe("tpl_stand_2pc");
      expect(top!.features.pieceCount).toBe(2);
      expect(top!.isReferenceOnly).toBe(true);
    });
  });

  describe("2. Multi-Attribute Search Across 8 Dimensions", () => {
    it("retrieves the 5-piece chair matching piece count, interface types, and dimensions", async () => {
      const query: AdvancedDesignQuery = {
        pieceCount: 5,
        dimensions: {
          widthMm: 120,
          heightMm: 150,
          depthMm: 3.0,
        },
        interfaceTypes: ["mortise_tenon"],
        difficulty: "medium",
        topK: 3,
      };

      const result = await retriever.retrieveDesigns(query);
      const top = result.topMatch;
      expect(top).toBeDefined();
      expect(top!.designId).toBe("tpl_chair_5pc");
      expect(top!.features.pieceCount).toBe(5);
      expect(top!.similarity.structuredScore).toBeGreaterThan(0.7);

      // Verify matching features
      const pieceCountMatch = top!.matchingFeatures.find((m) => m.dimension === "pieceCount");
      expect(pieceCountMatch).toBeDefined();
      expect(pieceCountMatch!.similarity).toBe(1.0);

      const diffMatch = top!.matchingFeatures.find((m) => m.dimension === "difficulty");
      expect(diffMatch).toBeDefined();
      expect(diffMatch!.similarity).toBe(1.0);
    });

    it("retrieves the 6-piece burr puzzle when querying for interlocking joints and hard difficulty", async () => {
      const query: AdvancedDesignQuery = {
        pieceCount: 6,
        interfaceTypes: ["sliding_interlock"],
        difficulty: "hard",
        topK: 1,
      };

      const result = await retriever.retrieveDesigns(query);
      const top = result.topMatch;
      expect(top).toBeDefined();
      expect(top!.designId).toBe("tpl_burr_6pc");
      expect(top!.features.difficulty.level).toBe("hard");
      expect(top!.features.connectionTopology.connectionCount).toBe(5);
    });
  });

  describe("3. Dual Similarity (Structured + Dense Embedding)", () => {
    it("computes both structured and embedding similarity scores and blends them via alpha", async () => {
      const query: AdvancedDesignQuery = {
        pieceCount: 3,
        dimensions: { widthMm: 150, heightMm: 150 },
        interfaceTypes: ["tab_slot"],
        structuredEmbeddingAlpha: 0.7, // 70% structured, 30% embedding
      };

      const result = await retriever.retrieveDesigns(query);
      const top = result.topMatch!;

      expect(top.similarity.structuredScore).toBeGreaterThanOrEqual(0.0);
      expect(top.similarity.structuredScore).toBeLessThanOrEqual(1.0);
      expect(top.similarity.embeddingScore).toBeGreaterThanOrEqual(0.0);
      expect(top.similarity.embeddingScore).toBeLessThanOrEqual(1.0);
      expect(top.similarity.overallScore).toBeGreaterThanOrEqual(0.0);
      expect(top.similarity.overallScore).toBeLessThanOrEqual(1.0);

      // Verify composite score formula: alpha * structured + (1 - alpha) * embedding
      const expectedOverall = Number(
        (0.7 * top.similarity.structuredScore + 0.3 * top.similarity.embeddingScore).toFixed(4)
      );
      expect(Math.abs(top.similarity.overallScore - expectedOverall)).toBeLessThan(0.01);
    });
  });

  describe("4. Detailed Matching Features and Differences Reporting", () => {
    it("reports specific differences when a reference deviates from query targets", async () => {
      // Query 4 pieces and 200mm width, but reference box has 3 pieces and 150mm width
      const query: AdvancedDesignQuery = {
        pieceCount: 4,
        dimensions: { widthMm: 250, heightMm: 150 },
        naturalLanguagePrompt: "storage box",
        topK: 1,
      };

      const result = await retriever.retrieveDesigns(query);
      const top = result.topMatch!;
      expect(top.designId).toBe("tpl_box_3pc");

      // Verify differences array contains pieceCount and width deltas
      expect(top.differences.length).toBeGreaterThan(0);
      const pieceDiff = top.differences.find((d) => d.dimension === "pieceCount");
      expect(pieceDiff).toBeDefined();
      expect(pieceDiff!.queryTarget).toBe(4);
      expect(pieceDiff!.designValue).toBe(3);
      expect(pieceDiff!.deltaDescription).toContain("Target requested 4 pieces");

      const widthDiff = top.differences.find((d) => d.dimension === "dimension_width");
      expect(widthDiff).toBeDefined();
      expect(widthDiff!.deltaDescription).toContain("mismatch: query 250mm vs reference 150mm");
    });
  });

  describe("5. Strict Anti-Cloning Invariant & Reference Safeguards", () => {
    it("locks isReferenceOnly=true on all retrieved designs", async () => {
      const result = await retriever.retrieveDesigns({ pieceCount: 3 });
      for (const item of result.retrievedDesigns) {
        expect(item.isReferenceOnly).toBe(true);
        expect(item.referenceAdaptationGuidance).toContain("CRITICAL ANTI-CLONING DIRECTIVE");
      }
    });

    it("ReferenceDesignProtector blocks direct clones sharing identical IDs or geometry", () => {
      const ref = createEmptyCanonicalPuzzle("Original Reference Box");
      ref.metadata.id = "ref_box_123";
      ref.pieces.push(createCanonicalPiece("Base", { width: 100, height: 100, depth: 3 }, 3));

      // 1. Direct metadata ID clone should throw
      const clone1 = createEmptyCanonicalPuzzle("Copy");
      clone1.metadata.id = "ref_box_123";
      expect(() => ReferenceDesignProtector.assertNotCloned(ref, clone1)).toThrow(/identical metadata ID/);

      // 2. Direct piece ID duplicates should throw
      const clone2 = createEmptyCanonicalPuzzle("Copy 2");
      clone2.metadata.id = "new_gen_456";
      clone2.pieces.push(createCanonicalPiece("Base", { width: 100, height: 100, depth: 3 }, 3));
      clone2.pieces[0].id = ref.pieces[0].id; // Duplicated piece ID!
      expect(() => ReferenceDesignProtector.assertNotCloned(ref, clone2)).toThrow(/duplicates all piece IDs/);

      // 3. Legitimate parametric modification with distinct IDs should succeed
      const adapted = createEmptyCanonicalPuzzle("Parametric Adapted Box");
      adapted.metadata.id = "gen_adapted_789";
      adapted.pieces.push(createCanonicalPiece("Adapted Base", { width: 140, height: 120, depth: 3 }, 3));
      const audit = ReferenceDesignProtector.assertNotCloned(ref, adapted);
      expect(audit.isDifferent).toBe(true);
      expect(audit.auditReasons.length).toBeGreaterThan(0);
    });
  });
});
