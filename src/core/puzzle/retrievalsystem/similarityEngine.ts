/**
 * Design Similarity Engine (Phase 70).
 *
 * Implements dual similarity evaluation:
 *  1. Structured multi-attribute similarity across 8 searchable dimensions
 *  2. Dense vector cosine embedding similarity
 * Computes granular matching features, explicit differences, and anti-cloning adaptation guidance.
 */
import type {
  AdvancedDesignQuery,
  FeatureDifference,
  MatchingFeatureSummary,
  NormalizedDesignFeature,
} from "./types";

export class DesignSimilarityEngine {
  /**
   * Evaluates overall similarity between an AdvancedDesignQuery and a NormalizedDesignFeature.
   */
  public static evaluateSimilarity(
    query: AdvancedDesignQuery,
    feature: NormalizedDesignFeature
  ): {
    overallScore: number;
    structuredScore: number;
    embeddingScore: number;
    topologyScore: number;
    dimensionScore: number;
    connectionTypeScore: number;
    keywordScore: number;
    difficultyScore: number;
    matchingFeatures: MatchingFeatureSummary[];
    differences: FeatureDifference[];
    referenceAdaptationGuidance: string;
  } {
    const matchingFeatures: MatchingFeatureSummary[] = [];
    const differences: FeatureDifference[] = [];

    // --- 1. Natural Language / Keyword Similarity ---
    let keywordScore = 0.5; // Neutral default if not queried
    if (query.naturalLanguagePrompt) {
      const queryTokens = query.naturalLanguagePrompt
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, " ")
        .split(/[\s_-]+/)
        .filter((w) => w.length > 1);

      if (queryTokens.length > 0) {
        let matchCount = 0;
        const matchedWords: string[] = [];
        for (const qt of queryTokens) {
          if (feature.keywords.some((kw) => kw.includes(qt) || qt.includes(kw))) {
            matchCount++;
            matchedWords.push(qt);
          }
        }
        keywordScore = matchCount / queryTokens.length;

        if (keywordScore >= 0.5) {
          matchingFeatures.push({
            dimension: "naturalLanguage",
            description: `Keywords matched: '${matchedWords.slice(0, 3).join(", ")}'`,
            similarity: Number(keywordScore.toFixed(3)),
          });
        } else {
          differences.push({
            dimension: "naturalLanguage",
            queryTarget: query.naturalLanguagePrompt,
            designValue: feature.keywords.slice(0, 5).join(", "),
            deltaDescription: `Low keyword overlap with query prompt.`,
          });
        }
      }
    }

    // --- 2. Piece Count Similarity ---
    let pieceScore = 0.5;
    let targetPieceCount: number | undefined;
    if (typeof query.pieceCount === "number") {
      targetPieceCount = query.pieceCount;
    } else if (query.pieceCount && typeof query.pieceCount.target === "number") {
      targetPieceCount = query.pieceCount.target;
    }

    if (targetPieceCount !== undefined) {
      const diff = Math.abs(targetPieceCount - feature.pieceCount);
      pieceScore = Math.max(0.0, 1.0 - diff / Math.max(targetPieceCount, feature.pieceCount, 1));

      if (pieceScore >= 0.8) {
        matchingFeatures.push({
          dimension: "pieceCount",
          description: `Piece count matches query (${feature.pieceCount} pieces)`,
          similarity: Number(pieceScore.toFixed(3)),
        });
      } else {
        const deltaSign = feature.pieceCount > targetPieceCount ? `+${diff}` : `-${diff}`;
        differences.push({
          dimension: "pieceCount",
          queryTarget: targetPieceCount,
          designValue: feature.pieceCount,
          deltaDescription: `Target requested ${targetPieceCount} pieces, design has ${feature.pieceCount} (${deltaSign} pieces).`,
        });
      }
    }

    // --- 3. Dimensions Similarity ---
    let dimensionScore = 0.5;
    if (query.dimensions) {
      let dimMatches = 0;
      let dimCount = 0;

      const checkDim = (qVal?: number, dVal?: number, name?: string) => {
        if (qVal !== undefined && dVal !== undefined && qVal > 0) {
          dimCount++;
          const ratio = Math.min(qVal, dVal) / Math.max(qVal, dVal);
          dimMatches += ratio;
          if (ratio < 0.75) {
            differences.push({
              dimension: `dimension_${name}`,
              queryTarget: `${qVal}mm`,
              designValue: `${dVal}mm`,
              deltaDescription: `${name} mismatch: query ${qVal}mm vs reference ${dVal}mm.`,
            });
          }
        }
      };

      checkDim(query.dimensions.widthMm, feature.dimensions.widthMm, "width");
      checkDim(query.dimensions.heightMm, feature.dimensions.heightMm, "height");
      checkDim(query.dimensions.depthMm, feature.dimensions.depthMm, "depth");

      if (dimCount > 0) {
        dimensionScore = dimMatches / dimCount;
        if (dimensionScore >= 0.75) {
          matchingFeatures.push({
            dimension: "dimensions",
            description: `Bounding dimensions closely match target (similarity: ${(dimensionScore * 100).toFixed(0)}%)`,
            similarity: Number(dimensionScore.toFixed(3)),
          });
        }
      }
    }

    // --- 4. Connection Topology Similarity ---
    let topologyScore = 0.5;
    if (query.connectionTopology) {
      let scoreAcc = 0;
      let checks = 0;

      if (query.connectionTopology.preferredDensity !== undefined) {
        checks++;
        const delta = Math.abs(query.connectionTopology.preferredDensity - feature.connectionTopology.density);
        scoreAcc += Math.max(0.0, 1.0 - delta);
      }

      if (query.connectionTopology.requireTree !== undefined) {
        checks++;
        scoreAcc += query.connectionTopology.requireTree === feature.connectionTopology.isTreeStructure ? 1.0 : 0.0;
      }

      topologyScore = checks > 0 ? scoreAcc / checks : 0.5;

      if (topologyScore >= 0.75) {
        matchingFeatures.push({
          dimension: "connectionTopology",
          description: `Topology matches requested graph structure (tree: ${feature.connectionTopology.isTreeStructure})`,
          similarity: Number(topologyScore.toFixed(3)),
        });
      }
    }

    // --- 5. Interface Types Overlap ---
    let connectionTypeScore = 0.5;
    if (query.interfaceTypes && query.interfaceTypes.length > 0) {
      const qTypes = new Set(query.interfaceTypes.map((t) => t.toLowerCase()));
      const dTypes = new Set(feature.interfaceTypes.map((t) => t.toLowerCase()));

      let intersection = 0;
      for (const t of qTypes) {
        if (dTypes.has(t)) intersection++;
      }

      const union = new Set([...qTypes, ...dTypes]).size;
      connectionTypeScore = union > 0 ? intersection / union : 0.0;

      if (connectionTypeScore > 0) {
        matchingFeatures.push({
          dimension: "interfaceTypes",
          description: `Shared joint types: ${Array.from(qTypes).filter((t) => dTypes.has(t)).join(", ")}`,
          similarity: Number(connectionTypeScore.toFixed(3)),
        });
      }

      if (intersection < qTypes.size) {
        const missing = Array.from(qTypes).filter((t) => !dTypes.has(t));
        differences.push({
          dimension: "interfaceTypes",
          queryTarget: query.interfaceTypes.join(", "),
          designValue: feature.interfaceTypes.join(", "),
          deltaDescription: `Missing requested joint types: ${missing.join(", ")}.`,
        });
      }
    }

    // --- 6. Difficulty Similarity ---
    let difficultyScore = 0.5;
    if (query.difficulty) {
      const targetLevel = typeof query.difficulty === "string" ? query.difficulty : undefined;
      const targetNumeric =
        typeof query.difficulty === "object" && typeof query.difficulty.targetScore === "number"
          ? query.difficulty.targetScore
          : undefined;

      if (targetLevel) {
        if (feature.difficulty.level === targetLevel) {
          difficultyScore = 1.0;
          matchingFeatures.push({
            dimension: "difficulty",
            description: `Exact difficulty tier match: '${feature.difficulty.level}'`,
            similarity: 1.0,
          });
        } else {
          difficultyScore = 0.4;
          differences.push({
            dimension: "difficulty",
            queryTarget: targetLevel,
            designValue: feature.difficulty.level,
            deltaDescription: `Target level '${targetLevel}' differs from reference '${feature.difficulty.level}'.`,
          });
        }
      } else if (targetNumeric !== undefined) {
        const delta = Math.abs(targetNumeric - feature.difficulty.score);
        difficultyScore = Math.max(0.0, 1.0 - delta / 100.0);
      }
    }

    // --- 7. Assembly Characteristics Similarity ---
    let assemblyScore = 0.5;
    if (query.assemblyCharacteristics) {
      let checks = 0;
      let scoreAcc = 0;
      if (query.assemblyCharacteristics.allowNonPlanar !== undefined) {
        checks++;
        const match = query.assemblyCharacteristics.allowNonPlanar === feature.assemblyCharacteristics.isNonPlanar;
        scoreAcc += match ? 1.0 : 0.3;
      }
      if (query.assemblyCharacteristics.maxSteps !== undefined) {
        checks++;
        const delta = Math.abs(query.assemblyCharacteristics.maxSteps - feature.assemblyCharacteristics.sequenceLength);
        scoreAcc += Math.max(0.0, 1.0 - delta / 10.0);
      }
      assemblyScore = checks > 0 ? scoreAcc / checks : 0.5;
    }

    // --- 8. Geometry Features Similarity ---
    let geometryScore = 0.5;
    if (query.geometryFeatures) {
      if (query.geometryFeatures.preferredThicknessMm !== undefined) {
        const delta = Math.abs(query.geometryFeatures.preferredThicknessMm - feature.geometryFeatures.averageThicknessMm);
        geometryScore = Math.max(0.0, 1.0 - delta / 5.0);
      }
    }

    // Weighted structured score: only weight dimensions that were actively queried
    const activeWeights: Array<{ score: number; weight: number }> = [];

    if (query.naturalLanguagePrompt) {
      activeWeights.push({ score: keywordScore, weight: query.weights?.naturalLanguage ?? 0.30 });
    }
    if (targetPieceCount !== undefined) {
      activeWeights.push({ score: pieceScore, weight: query.weights?.pieceCount ?? 0.35 });
    }
    if (query.dimensions) {
      activeWeights.push({ score: dimensionScore, weight: query.weights?.dimensions ?? 0.20 });
    }
    if (query.interfaceTypes && query.interfaceTypes.length > 0) {
      activeWeights.push({ score: connectionTypeScore, weight: query.weights?.interfaceTypes ?? 0.20 });
    }
    if (query.difficulty) {
      activeWeights.push({ score: difficultyScore, weight: query.weights?.difficulty ?? 0.15 });
    }
    if (query.connectionTopology) {
      activeWeights.push({ score: topologyScore, weight: query.weights?.topology ?? 0.10 });
    }
    if (query.assemblyCharacteristics) {
      activeWeights.push({ score: assemblyScore, weight: query.weights?.assemblyCharacteristics ?? 0.10 });
    }
    if (query.geometryFeatures) {
      activeWeights.push({ score: geometryScore, weight: query.weights?.geometryFeatures ?? 0.10 });
    }

    let structuredScore = 0.5;
    if (activeWeights.length > 0) {
      const totalW = activeWeights.reduce((sum, item) => sum + item.weight, 0);
      const sumS = activeWeights.reduce((sum, item) => sum + item.score * item.weight, 0);
      structuredScore = totalW > 0 ? Number((sumS / totalW).toFixed(4)) : 0.5;
    }

    // --- Dense Vector Embedding Cosine Similarity ---
    const queryEmb = this.synthesizeQueryEmbedding(query);
    const embeddingScore = Number(this.computeCosineSimilarity(queryEmb, feature.embeddingVector).toFixed(4));

    // --- Composite Similarity ---
    // If specific structured targets (like piece count or interface types) are queried, favor structured score
    const defaultAlpha = (targetPieceCount !== undefined || query.dimensions || query.interfaceTypes) ? 0.75 : 0.60;
    const alpha = query.structuredEmbeddingAlpha ?? defaultAlpha;
    const overallScore = Number((alpha * structuredScore + (1.0 - alpha) * embeddingScore).toFixed(4));

    // --- Anti-Cloning Reference Adaptation Guidance ---
    const referenceAdaptationGuidance = this.generateAdaptationGuidance(feature, differences);

    return {
      overallScore: Math.min(1.0, Math.max(0.0, overallScore)),
      structuredScore,
      embeddingScore,
      topologyScore: Number(topologyScore.toFixed(3)),
      dimensionScore: Number(dimensionScore.toFixed(3)),
      connectionTypeScore: Number(connectionTypeScore.toFixed(3)),
      keywordScore: Number(keywordScore.toFixed(3)),
      difficultyScore: Number(difficultyScore.toFixed(3)),
      matchingFeatures,
      differences,
      referenceAdaptationGuidance,
    };
  }

  /**
   * Computes cosine similarity between two unit vectors.
   */
  public static computeCosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0.0;
    const len = Math.min(vecA.length, vecB.length);
    for (let i = 0; i < len; i++) {
      dot += vecA[i] * vecB[i];
    }
    return Math.min(1.0, Math.max(0.0, dot));
  }

  /**
   * Synthesizes a 128-dimensional unit query embedding vector from query constraints.
   */
  private static synthesizeQueryEmbedding(query: AdvancedDesignQuery): number[] {
    const values = new Array(128).fill(0.0);

    const pieceCount = typeof query.pieceCount === "number" ? query.pieceCount : query.pieceCount?.target ?? 4;
    values[0] = Math.min(1.0, pieceCount / 32.0);
    values[1] = Math.min(1.0, (query.dimensions?.widthMm ?? 100) / 500.0);
    values[2] = Math.min(1.0, (query.dimensions?.heightMm ?? 100) / 500.0);
    values[3] = Math.min(1.0, (query.dimensions?.depthMm ?? 10) / 100.0);

    if (query.naturalLanguagePrompt) {
      const tokens = query.naturalLanguagePrompt.toLowerCase().split(/\s+/);
      for (const t of tokens) {
        let hash = 0;
        for (let i = 0; i < t.length; i++) {
          hash = (hash * 31 + t.charCodeAt(i)) & 0xffffffff;
        }
        const slot = 13 + (Math.abs(hash) % 32);
        values[slot] = Math.min(1.0, values[slot] + 0.3);
      }
    }

    // Multi-hot interface types
    for (const it of query.interfaceTypes || []) {
      let hash = 0;
      for (let i = 0; i < it.length; i++) {
        hash = (hash * 17 + it.charCodeAt(i)) & 0xffffffff;
      }
      const slot = 45 + (Math.abs(hash) % 16);
      values[slot] = 1.0;
    }

    // Harmonic projection
    for (let i = 61; i < 128; i++) {
      values[i] = Math.abs(Math.sin(i * 0.17 + pieceCount * 0.41));
    }

    // Normalize to unit L2 norm
    let norm = 0.0;
    for (let i = 0; i < 128; i++) {
      norm += values[i] * values[i];
    }
    const l2 = Math.sqrt(norm);
    if (l2 > 0) {
      for (let i = 0; i < 128; i++) {
        values[i] = Number((values[i] / l2).toFixed(6));
      }
    }

    return values;
  }

  /**
   * Generates instructions ensuring downstream AI generative steps never clone reference designs.
   */
  private static generateAdaptationGuidance(
    feature: NormalizedDesignFeature,
    differences: FeatureDifference[]
  ): string {
    const lines: string[] = [
      "CRITICAL ANTI-CLONING DIRECTIVE:",
      "- This retrieved design is a structural REFERENCE exemplar only.",
      "- Downstream AI generators MUST NOT copy piece IDs, exact contour paths, or raw coordinates.",
      "- Parameterize new dimensions based on the target requirements.",
    ];

    if (differences.length > 0) {
      lines.push("PARAMETRIC ADAPTATION TARGETS:");
      for (const d of differences) {
        lines.push(`  * ${d.deltaDescription}`);
      }
    }

    return lines.join("\n");
  }
}
