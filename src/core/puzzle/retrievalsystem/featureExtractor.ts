/**
 * Design Feature Extractor (Phase 70).
 *
 * Extracts and normalizes the 8 searchable design dimensions from a CanonicalPuzzle
 * into a formal NormalizedDesignFeature and 128-dimensional unit embedding vector.
 */
import type { CanonicalPuzzle } from "../canonical/types";
import type { NormalizedDesignFeature } from "./types";

export class DesignFeatureExtractor {
  /**
   * Extracts the full NormalizedDesignFeature from a CanonicalPuzzle.
   */
  public static extractFeatures(puzzle: CanonicalPuzzle): NormalizedDesignFeature {
    const pieces = puzzle.pieces || [];
    const connections = puzzle.connections || [];
    const N = Math.max(1, pieces.length);

    // 1. Natural Language Keywords
    const keywords = this.extractKeywords(puzzle);

    // 2. Piece Count
    const pieceCount = N;

    // 3. Dimensions
    const dimensions = this.extractDimensions(pieces);

    // 4. Connection Topology
    const connectionTopology = this.extractTopology(pieces, connections);

    // 5. Interface Types
    const interfaceTypes = this.extractInterfaceTypes(connections);

    // 6. Difficulty
    const difficulty = this.extractDifficulty(puzzle, pieces, connections);

    // 7. Assembly Characteristics
    const assemblyCharacteristics = this.extractAssemblyCharacteristics(pieces, connections);

    // 8. Geometry Features
    const geometryFeatures = this.extractGeometryFeatures(pieces);

    // 9. Dense 128-dim Unit Embedding Vector
    const embeddingVector = this.computeDenseEmbedding({
      keywords,
      pieceCount,
      dimensions,
      connectionTopology,
      interfaceTypes,
      difficulty,
      assemblyCharacteristics,
      geometryFeatures,
    });

    return {
      keywords,
      pieceCount,
      dimensions,
      connectionTopology,
      interfaceTypes,
      difficulty,
      assemblyCharacteristics,
      geometryFeatures,
      embeddingVector,
    };
  }

  private static extractKeywords(puzzle: CanonicalPuzzle): string[] {
    const rawTokens: string[] = [];

    const addText = (text?: string) => {
      if (!text) return;
      const clean = text.toLowerCase().replace(/[^a-z0-9\s_-]/g, " ");
      const words = clean.split(/[\s_-]+/).filter((w) => w.length > 1);
      rawTokens.push(...words);
    };

    addText(puzzle.metadata?.name);
    addText(puzzle.metadata?.description);
    if (puzzle.metadata?.tags) {
      puzzle.metadata.tags.forEach(addText);
    }
    for (const p of puzzle.pieces || []) {
      addText(p.name);
    }

    return Array.from(new Set(rawTokens));
  }

  private static extractDimensions(pieces: CanonicalPuzzle["pieces"]) {
    let maxW = 0;
    let maxH = 0;
    let maxD = 0;

    for (const p of pieces) {
      const w = p.dimensions?.width ?? 50;
      const h = p.dimensions?.height ?? 50;
      const d = p.dimensions?.depth ?? p.thickness ?? 3.0;
      maxW = Math.max(maxW, w);
      maxH = Math.max(maxH, h);
      maxD = Math.max(maxD, d);
    }

    const widthMm = Number(maxW.toFixed(2));
    const heightMm = Number(maxH.toFixed(2));
    const depthMm = Number(maxD.toFixed(2));
    const boundingVolumeMm3 = Number((widthMm * heightMm * depthMm).toFixed(2));
    const aspectRatio = Number((widthMm / Math.max(1, heightMm)).toFixed(2));

    return {
      widthMm,
      heightMm,
      depthMm,
      boundingVolumeMm3,
      aspectRatio,
    };
  }

  private static extractTopology(pieces: CanonicalPuzzle["pieces"], connections: CanonicalPuzzle["connections"]) {
    const N = Math.max(1, pieces.length);
    const E = connections.length;
    const maxPossiblePairs = (N * (N - 1)) / 2;
    const density = maxPossiblePairs > 0 ? Number((E / maxPossiblePairs).toFixed(4)) : 0.0;
    const averageDegree = Number(((2 * E) / N).toFixed(2));
    const isTreeStructure = E === N - 1 && N > 1;
    const cycleCount = Math.max(0, E - (N - 1));

    return {
      connectionCount: E,
      density: Math.min(1.0, density),
      averageDegree,
      isTreeStructure,
      cycleCount,
    };
  }

  private static extractInterfaceTypes(connections: CanonicalPuzzle["connections"]): string[] {
    const types = new Set<string>();
    for (const c of connections) {
      const type = (c as any).connectionType || (c as any).type || (c as any).behavior || "fixed";
      types.add(String(type).toLowerCase());
    }
    return types.size > 0 ? Array.from(types).sort() : ["fixed"];
  }

  private static extractDifficulty(
    puzzle: CanonicalPuzzle,
    pieces: CanonicalPuzzle["pieces"],
    connections: CanonicalPuzzle["connections"]
  ): { level: "easy" | "medium" | "hard" | "expert"; score: number } {
    const rawDiff = (puzzle.metadata as any)?.difficulty;
    let score = 20.0; // Baseline easy

    // Heuristic score approximation based on Phase 69 properties
    const N = pieces.length;
    const E = connections.length;
    score += Math.min(30, (Math.log2(Math.max(1, N)) / Math.log2(64)) * 30);
    score += Math.min(20, (E / Math.max(1, N)) * 20);

    let level: "easy" | "medium" | "hard" | "expert" = "easy";

    if (rawDiff === "expert" || score >= 80.0) {
      level = "expert";
      score = Math.max(score, 85.0);
    } else if (rawDiff === "hard" || score >= 55.0) {
      level = "hard";
      score = Math.max(score, 65.0);
    } else if (rawDiff === "medium" || score >= 25.0) {
      level = "medium";
      score = Math.max(score, 40.0);
    } else {
      level = "easy";
      score = Math.min(score, 24.0);
    }

    return { level, score: Number(score.toFixed(1)) };
  }

  private static extractAssemblyCharacteristics(
    pieces: CanonicalPuzzle["pieces"],
    connections: CanonicalPuzzle["connections"]
  ) {
    const sequenceLength = Math.max(1, pieces.length - 1);
    let maxAngle = 90.0;
    let isNonPlanar = false;

    for (const c of connections) {
      const angle = (c as any).joiningAngleDeg;
      if (typeof angle === "number") {
        maxAngle = Math.max(maxAngle, angle);
        if (angle !== 0.0 && angle !== 90.0 && angle !== 180.0) {
          isNonPlanar = true;
        }
      }
    }

    return {
      sequenceLength,
      isNonPlanar,
      maxJoiningAngleDeg: maxAngle,
      dofCount: connections.filter((c) => (c as any).behavior === "HINGE" || (c as any).behavior === "SLIDING").length,
    };
  }

  private static extractGeometryFeatures(pieces: CanonicalPuzzle["pieces"]) {
    let thicknessSum = 0;
    let areaSum = 0;

    for (const p of pieces) {
      const t = p.thickness ?? p.dimensions?.depth ?? 3.0;
      const w = p.dimensions?.width ?? 50;
      const h = p.dimensions?.height ?? 50;
      thicknessSum += t;
      areaSum += w * h;
    }

    const averageThicknessMm = pieces.length > 0 ? Number((thicknessSum / pieces.length).toFixed(2)) : 3.0;
    const totalSurfaceAreaMm2 = Number(areaSum.toFixed(2));

    return {
      averageThicknessMm,
      totalSurfaceAreaMm2,
      symmetryOrder: 1,
      style: "parametric_cardboard",
    };
  }

  /**
   * Generates a 128-dimensional dense L2-normalized unit vector for cosine similarity.
   */
  private static computeDenseEmbedding(f: Omit<NormalizedDesignFeature, "embeddingVector">): number[] {
    const values = new Array(128).fill(0.0);

    // Continuous normalized features
    values[0] = Math.min(1.0, f.pieceCount / 32.0);
    values[1] = Math.min(1.0, f.dimensions.widthMm / 500.0);
    values[2] = Math.min(1.0, f.dimensions.heightMm / 500.0);
    values[3] = Math.min(1.0, f.dimensions.depthMm / 100.0);
    values[4] = Math.min(1.0, f.dimensions.aspectRatio / 5.0);
    values[5] = f.connectionTopology.density;
    values[6] = Math.min(1.0, f.connectionTopology.averageDegree / 6.0);
    values[7] = f.connectionTopology.isTreeStructure ? 1.0 : 0.0;
    values[8] = f.difficulty.score / 100.0;
    values[9] = Math.min(1.0, f.assemblyCharacteristics.sequenceLength / 20.0);
    values[10] = f.assemblyCharacteristics.isNonPlanar ? 1.0 : 0.0;
    values[11] = Math.min(1.0, f.assemblyCharacteristics.maxJoiningAngleDeg / 180.0);
    values[12] = Math.min(1.0, f.geometryFeatures.averageThicknessMm / 10.0);

    // Hash keyword tokens into vector space (indices 13..44)
    for (const kw of f.keywords) {
      let hash = 0;
      for (let i = 0; i < kw.length; i++) {
        hash = (hash * 31 + kw.charCodeAt(i)) & 0xffffffff;
      }
      const slot = 13 + (Math.abs(hash) % 32);
      values[slot] = Math.min(1.0, values[slot] + 0.3);
    }

    // Hash interface types (indices 45..60)
    for (const it of f.interfaceTypes) {
      let hash = 0;
      for (let i = 0; i < it.length; i++) {
        hash = (hash * 17 + it.charCodeAt(i)) & 0xffffffff;
      }
      const slot = 45 + (Math.abs(hash) % 16);
      values[slot] = 1.0;
    }

    // Deterministic geometric harmonic projections (indices 61..127)
    for (let i = 61; i < 128; i++) {
      const harmonic = Math.sin(i * 0.17 + f.pieceCount * 0.41 + f.difficulty.score * 0.05);
      values[i] = Math.abs(harmonic);
    }

    // L2 normalization: normalize to unit length ||values||_2 = 1.0
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
}
