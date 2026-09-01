/**
 * Synthetic Puzzle Generator Engine (Phase 42).
 * Generates controlled synthetic examples (both valid and invalid assemblies)
 * for future AI training and evaluation. Deterministic when given a random seed.
 */
import type { SyntheticGeneratedExample, SyntheticGenerationConfig, SyntheticInvalidityReason } from "./types";
import { createCanonicalConnection, createCanonicalInterface, createCanonicalPiece, createEmptyCanonicalPuzzle } from "../canonical/defaults";
import { PuzzleAssemblyGraph } from "../graph/graph";
import { AssemblyTransformationSystem } from "../assemblytransforms/engine";
import type { AssemblyPlacement } from "../assemblytransforms/types";
import { DatasetQualityValidator } from "../validation/datasetQualityValidator";
import { PuzzleReviewManager } from "../annotation/reviewManager";
import type { Extracted2DGeometryResult } from "../ingestion/geometry/types";

/**
 * Seeded Pseudo-Random Number Generator (Mulberry32).
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  intRange(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  choice<T>(list: T[]): T {
    const idx = this.intRange(0, list.length - 1);
    return list[idx];
  }
}

export class SyntheticPuzzleGenerator {
  /**
   * Generates a controlled synthetic puzzle example based on configuration and random seed.
   */
  static generateExample(config: SyntheticGenerationConfig): SyntheticGeneratedExample {
    const rng = new SeededRandom(config.seed);
    const exampleId = `syn_puz_seed_${config.seed}`;

    // Determine target validity
    let isValid = true;
    let invalidityReason: SyntheticInvalidityReason | undefined = undefined;

    if (config.targetValidity === "invalid") {
      isValid = false;
      invalidityReason = config.specificInvalidityReason || "incompatible_interfaces";
    } else if (config.targetValidity === "random") {
      isValid = rng.nextFloat() > 0.3; // 70% valid, 30% invalid
      if (!isValid) {
        invalidityReason = rng.choice([
          "incompatible_interfaces",
          "collision",
          "insufficient_clearance",
          "disconnected_assembly",
          "invalid_dimensions",
        ]);
      }
    }

    const pieceCount = rng.intRange(config.pieceCountRange[0], config.pieceCountRange[1]);
    const thickness = invalidityReason === "invalid_dimensions" ? -3.0 : rng.range(config.thicknessMmRange[0], config.thicknessMmRange[1]);

    const canonicalPuzzle = createEmptyCanonicalPuzzle(`Synthetic Puzzle (${exampleId})`);
    canonicalPuzzle.metadata.id = exampleId;

    // 1. Generate Pieces
    for (let i = 1; i <= pieceCount; i++) {
      const pId = `p_${i}`;
      const w = invalidityReason === "invalid_dimensions" && i === 1 ? -10.0 : rng.range(config.dimensionMmRange[0], config.dimensionMmRange[1]);
      const h = rng.range(config.dimensionMmRange[0], config.dimensionMmRange[1]);

      const piece = createCanonicalPiece(`Piece ${i}`, { width: w, height: h, depth: thickness }, thickness);
      piece.id = pId;
      canonicalPuzzle.pieces.push(piece);
    }

    // 2. Generate Interfaces & Connections
    for (let i = 1; i < pieceCount; i++) {
      const pA = canonicalPuzzle.pieces[i - 1];
      const pB = canonicalPuzzle.pieces[i];

      const ifAId = `if_${pA.id}_out`;
      const ifBId = `if_${pB.id}_in`;

      const ifA = createCanonicalInterface(pA.id, `Interface ${pA.id}`, { x: 50, y: 0 }, { x: 0, y: -1 });
      ifA.id = ifAId;
      ifA.profile.width = rng.range(config.tabWidthMmRange[0], config.tabWidthMmRange[1]);
      ifA.compatibility.genderRole = "insert";

      const ifB = createCanonicalInterface(pB.id, `Interface ${pB.id}`, { x: 50, y: 100 }, { x: 0, y: 1 });
      ifB.id = ifBId;

      if (invalidityReason === "incompatible_interfaces") {
        ifB.compatibility.genderRole = "insert"; // Tab + Tab failure injection
        ifB.profile.width = ifA.profile.width;
      } else if (invalidityReason === "insufficient_clearance") {
        ifB.compatibility.genderRole = "receiver";
        ifB.profile.width = ifA.profile.width + 40.0; // 40mm width mismatch failure injection
      } else {
        ifB.compatibility.genderRole = "receiver";
        ifB.profile.width = ifA.profile.width;
      }

      canonicalPuzzle.interfaces.push(ifA, ifB);

      if (invalidityReason !== "disconnected_assembly") {
        const conn = createCanonicalConnection(ifAId, ifBId, rng.choice(config.joiningAnglesDeg));
        conn.id = `conn_${pA.id}_${pB.id}`;
        canonicalPuzzle.connections.push(conn);
      }
    }

    // 3. Construct Assembly Graph & Placements
    const nodes = canonicalPuzzle.pieces.map((p) => ({ pieceId: p.id, interfaceIds: p.interfaceIds }));
    const edges = canonicalPuzzle.connections.map((c) => ({
      connectionId: c.id,
      sourcePieceId: canonicalPuzzle.interfaces.find((iface) => iface.id === c.interfaceAId)?.owningPieceId || "unknown",
      sourceInterfaceId: c.interfaceAId,
      targetPieceId: canonicalPuzzle.interfaces.find((iface) => iface.id === c.interfaceBId)?.owningPieceId || "unknown",
      targetInterfaceId: c.interfaceBId,
      joiningAngleDeg: c.allowedAngleRange.targetAngleDeg,
      connectionType: "rigid" as const,
      status: "valid" as const,
    }));

    const connectionGraph = new PuzzleAssemblyGraph(nodes, edges);

    const transformSystem = new AssemblyTransformationSystem(`config_${exampleId}`);
    canonicalPuzzle.pieces.forEach((p, idx) => {
      transformSystem.placePiece(p.id, {
        position: { x: idx * 60.0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1.0 },
        scale: { x: 1, y: 1, z: 1 },
      });
    });

    const assemblyPlacements = new Map<string, AssemblyPlacement>();
    for (const p of transformSystem.getAllPlacements()) {
      assemblyPlacements.set(p.pieceId, p);
    }

    // 4. Geometry Result
    const mockGeometry: Extracted2DGeometryResult = {
      sourceFilename: `${exampleId}.svg`,
      primitives: [],
      topologies: [],
      dimensions: [],
      labels: [],
      canonicalPieces: canonicalPuzzle.pieces,
      validationIssues: [],
      isValid: isValid,
    };

    // 5. Execute Quality Validator
    const reviewManager = new PuzzleReviewManager();
    const annotation = reviewManager.startReviewSession(canonicalPuzzle, "synthetic_generator");
    if (isValid) {
      reviewManager.markStatus(exampleId, "CORRECT", "synthetic_generator");
    } else {
      reviewManager.markStatus(exampleId, "INCORRECT", "synthetic_generator", `Injected flaw: ${invalidityReason}`);
    }

    const latestAnnotation = reviewManager.getStore().getLatestAnnotation(exampleId);
    const validationResult = DatasetQualityValidator.validateItem(canonicalPuzzle, latestAnnotation);

    return {
      exampleId,
      seed: config.seed,
      inputParameters: config,
      canonicalPuzzle,
      geometry: mockGeometry,
      connectionGraph,
      assemblyPlacements,
      validationResult,
      isValid,
      invalidityReason,
    };
  }
}
