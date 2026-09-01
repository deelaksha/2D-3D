/**
 * 2D to Canonical IR Converter (Step 33).
 * Maps extracted 2D pieces, interface ports, and inferred connections into a CanonicalPuzzle IR model.
 */
import type { SegmentedPiece2D } from "../ingestion/types";
import type { DetectedInterfacePort, ExtractedParametricFeatures, InferredConnection } from "./types";
import type { CanonicalConnection, CanonicalInterface, CanonicalPiece, CanonicalPuzzle } from "../canonical/types";
import {
  createCanonicalConnection,
  createCanonicalInterface,
  createCanonicalPiece,
  createEmptyCanonicalPuzzle,
} from "../canonical/defaults";

export class CanonicalConverter2D {
  /**
   * Converts segmented pieces, detected interfaces, and inferred connections into CanonicalPuzzle IR.
   */
  static convertToCanonicalIR(
    puzzleId: string,
    pieces: SegmentedPiece2D[],
    portsByPiece: Map<string, DetectedInterfacePort[]>,
    connections: InferredConnection[],
    features: ExtractedParametricFeatures
  ): CanonicalPuzzle {
    const canonicalPuzzle = createEmptyCanonicalPuzzle(`Reconstructed Puzzle ${puzzleId}`);
    canonicalPuzzle.metadata.id = puzzleId;

    const canonicalPieces: CanonicalPiece[] = [];
    const canonicalInterfaces: CanonicalInterface[] = [];
    const canonicalConnections: CanonicalConnection[] = [];

    for (const p of pieces) {
      const piecePorts = portsByPiece.get(p.pieceId) || [];
      const interfaceIds = piecePorts.map((pt) => pt.id);

      const w = p.contour.bounds.width;
      const h = p.contour.bounds.height;

      const cPiece = createCanonicalPiece(
        p.pieceName,
        { width: w, height: h, depth: p.materialThicknessMm },
        p.materialThicknessMm
      );
      cPiece.id = p.pieceId;
      cPiece.interfaceIds = interfaceIds;
      canonicalPieces.push(cPiece);

      for (const pt of piecePorts) {
        const cInterface = createCanonicalInterface(
          pt.pieceId,
          `Port ${pt.id}`,
          { x: pt.localCenter2D.x, y: pt.localCenter2D.y },
          { x: pt.localNormal2D.x, y: pt.localNormal2D.y }
        );
        cInterface.id = pt.id;
        cInterface.interfaceType = pt.type;
        cInterface.profile.width = pt.widthMm;
        cInterface.profile.depth = pt.depthMm;
        canonicalInterfaces.push(cInterface);
      }
    }

    for (const c of connections) {
      const cConn = createCanonicalConnection(c.sourcePortId, c.targetPortId, c.joiningAngleDeg);
      cConn.id = c.connectionId;
      canonicalConnections.push(cConn);
    }

    canonicalPuzzle.pieces = canonicalPieces;
    canonicalPuzzle.interfaces = canonicalInterfaces;
    canonicalPuzzle.connections = canonicalConnections;

    return canonicalPuzzle;
  }
}
