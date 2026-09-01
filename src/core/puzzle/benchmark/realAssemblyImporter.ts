/**
 * Real Assembly Importer (Step 35).
 * Loads 3D ground-truth reference CAD assemblies and spatial manifests.
 */
import type { Vec3 } from "@/core/model/types";
import type { GroundTruthAssemblyManifest } from "./types";
import { vec3 } from "../geometry/math3d";

export class RealAssemblyImporter {
  /**
   * Loads a GroundTruthAssemblyManifest from JSON string or manifest object.
   */
  static loadManifest(jsonString: string): GroundTruthAssemblyManifest {
    const raw = JSON.parse(jsonString);
    const placements = new Map<string, { position: Vec3; rotationQuaternion: [number, number, number, number] }>();

    if (raw.placements) {
      for (const key of Object.keys(raw.placements)) {
        const p = raw.placements[key];
        placements.set(key, {
          position: vec3(p.position[0], p.position[1], p.position[2]),
          rotationQuaternion: p.rotationQuaternion || [1, 0, 0, 0],
        });
      }
    }

    return {
      assemblyId: raw.assemblyId || "gt_asm_default",
      name: raw.name || "Default Ground Truth Assembly",
      sourceCadFile: raw.sourceCadFile,
      piecesCount: raw.piecesCount || placements.size,
      expectedJoiningAnglesDeg: raw.expectedJoiningAnglesDeg || [45.0],
      groundTruthPlacements: placements,
      annotations: raw.annotations,
    };
  }

  /**
   * Synthesizes a mock ground-truth manifest for synthetic / reference benchmark testing.
   */
  static createMockManifest(assemblyId: string, name: string, pieceIds: string[]): GroundTruthAssemblyManifest {
    const placements = new Map<string, { position: Vec3; rotationQuaternion: [number, number, number, number] }>();
    
    pieceIds.forEach((id, idx) => {
      placements.set(id, {
        position: vec3(idx * 50.0, 0, 0),
        rotationQuaternion: [1, 0, 0, 0],
      });
    });

    return {
      assemblyId,
      name,
      piecesCount: pieceIds.length,
      expectedJoiningAnglesDeg: [45.0],
      groundTruthPlacements: placements,
    };
  }
}
