/**
 * Mock Design Knowledge & Retrieval Subsystem Implementation.
 *
 * Implements RetrievalInterface for multi-attribute design search (piece count, connection type,
 * difficulty, geometry style, material, dimensions, topology, interface patterns).
 *
 * CRITICAL RULE:
 * Every retrieved design includes explicit referenceAdaptationGuidelines enforcing that the AI
 * MUST NEVER blindly copy the design, but use it purely as a parametric reference.
 */
import type {
  DesignExample,
  DesignQuery,
  DesignSimilarity,
  RetrievalInterface,
} from "./types";

export class MockDesignRetrievalSystem implements RetrievalInterface {
  private indexedDesigns: Map<string, DesignExample> = new Map();

  constructor() {
    this.populateMockDatabase();
  }

  async indexDesign(design: DesignExample): Promise<void> {
    this.indexedDesigns.set(design.designId, design);
  }

  async findSimilarDesigns(query: DesignQuery, limit = 5): Promise<DesignSimilarity[]> {
    const results: DesignSimilarity[] = [];

    for (const design of this.indexedDesigns.values()) {
      let scoreAcc = 0.0;
      let totalWeights = 0.0;
      const matchingCriteria: string[] = [];

      // 1. Piece Count Match
      if (query.targetPieceCount !== undefined) {
        totalWeights += 0.3;
        const diff = Math.abs(query.targetPieceCount - design.metadata.pieceCount);
        const maxP = Math.max(query.targetPieceCount, design.metadata.pieceCount, 1);
        const pScore = Math.max(0, 1.0 - diff / maxP);
        scoreAcc += pScore * 0.3;
        if (pScore > 0.7) matchingCriteria.push(`Piece count (${design.metadata.pieceCount})`);
      }

      // 2. Connection Type Match
      if (query.preferredConnectionType) {
        totalWeights += 0.25;
        if (design.metadata.connectionTypes.includes(query.preferredConnectionType)) {
          scoreAcc += 0.25;
          matchingCriteria.push(`Connection type ('${query.preferredConnectionType}')`);
        }
      }

      // 3. Geometry Style Match
      if (query.geometryStyle) {
        totalWeights += 0.25;
        if (design.metadata.geometryStyle.toLowerCase() === query.geometryStyle.toLowerCase()) {
          scoreAcc += 0.25;
          matchingCriteria.push(`Geometry style ('${query.geometryStyle}')`);
        }
      }

      // 4. Difficulty Match
      if (query.difficulty) {
        totalWeights += 0.2;
        if (design.metadata.difficulty === query.difficulty) {
          scoreAcc += 0.2;
          matchingCriteria.push(`Difficulty level ('${query.difficulty}')`);
        }
      }

      const similarityScore = totalWeights > 0 ? Math.min(1.0, scoreAcc / totalWeights) : 0.5;

      results.push({
        design,
        similarityScore,
        matchingCriteria,
        referenceAdaptationGuidelines:
          "DO NOT BLINDLY COPY THIS DESIGN. Treat strictly as a structural & parametric reference. Re-evaluate piece dimensions, interface positions, and 3D joining angles using the authoritative deterministic engine.",
      });
    }

    // Rank by similarity score descending
    results.sort((a, b) => b.similarityScore - a.similarityScore);

    return results.slice(0, limit);
  }

  /**
   * Pre-populates mock retrieval database with reference design examples.
   */
  private populateMockDatabase(): void {
    const mockCastle: DesignExample = {
      designId: "design_castle_3d",
      name: "Castle Fortress 3D Box",
      metadata: {
        pieceCount: 20,
        connectionTypes: ["tab_slot", "interlock"],
        difficulty: "medium",
        geometryStyle: "castle",
        materialId: "cardboard-2mm",
        dimensions: { widthMm: 300, heightMm: 200, depthMm: 200 },
        assemblyCharacteristics: { maxJoiningAngleDeg: 90.0, isNonPlanar: true, totalSteps: 4 },
        topology: { connectedComponents: 1, isTreeStructure: false, averageDegree: 2.4 },
        interfacePatterns: ["male_tab_female_slot", "interlocking_corners"],
        tags: ["castle", "3d_box", "interlocking"],
      },
      parametricSpec: {
        specificationId: "spec_castle_mock",
        overall_size: { widthMm: 300, heightMm: 200, depthMm: 200 },
        piece_count: 20,
        layers: 3,
        material: { stockThicknessMm: 2.0, stockWidthMm: 600, stockHeightMm: 400, materialId: "cardboard-2mm" },
        connection_preferences: { defaultType: "tab_slot", preferredJoiningAngleDeg: 90.0, genderStyle: "complementary" },
        difficulty: { level: "medium", maxUniquePieces: 8 },
        symmetry: { isSymmetrical: true, symmetryAxis: "y" },
        constraints: [],
      },
      canonicalModelSummary: "3D Cardboard Castle Box with 20 interlocking pieces and 90° corner joints.",
    };

    const mockBridge: DesignExample = {
      designId: "design_bridge_truss",
      name: "Parametric Cardboard Arch Bridge",
      metadata: {
        pieceCount: 12,
        connectionTypes: ["tab_slot", "finger"],
        difficulty: "easy",
        geometryStyle: "bridge",
        materialId: "cardboard-2mm",
        dimensions: { widthMm: 400, heightMm: 120, depthMm: 80 },
        assemblyCharacteristics: { maxJoiningAngleDeg: 45.0, isNonPlanar: true, totalSteps: 3 },
        topology: { connectedComponents: 1, isTreeStructure: true, averageDegree: 2.0 },
        interfacePatterns: ["finger_joint", "slotted_arch"],
        tags: ["bridge", "arch", "truss"],
      },
      parametricSpec: {
        specificationId: "spec_bridge_mock",
        overall_size: { widthMm: 400, heightMm: 120, depthMm: 80 },
        piece_count: 12,
        layers: 2,
        material: { stockThicknessMm: 2.0, stockWidthMm: 600, stockHeightMm: 400, materialId: "cardboard-2mm" },
        connection_preferences: { defaultType: "finger", preferredJoiningAngleDeg: 45.0, genderStyle: "neutral" },
        difficulty: { level: "easy", maxUniquePieces: 4 },
        symmetry: { isSymmetrical: true, symmetryAxis: "x" },
        constraints: [],
      },
      canonicalModelSummary: "Parametric Cardboard Arch Bridge with 12 pieces and 45° angled truss joints.",
    };

    this.indexedDesigns.set(mockCastle.designId, mockCastle);
    this.indexedDesigns.set(mockBridge.designId, mockBridge);
  }
}
