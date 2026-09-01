/**
 * Connection Inferencer (Step 31).
 * Matches complementary interface ports across pieces to infer topological assembly graph edges.
 */
import type { DetectedInterfacePort, InferredConnection } from "./types";

export class ConnectionInferencer {
  /**
   * Infers connections between detected interface ports across pieces.
   */
  static inferConnections(
    portsByPiece: Map<string, DetectedInterfacePort[]>,
    defaultJoiningAngleDeg: number = 45.0
  ): InferredConnection[] {
    const connections: InferredConnection[] = [];
    const allPorts: DetectedInterfacePort[] = [];

    for (const ports of portsByPiece.values()) {
      allPorts.push(...ports);
    }

    const usedPorts = new Set<string>();
    let connCounter = 1;

    for (let i = 0; i < allPorts.length; i++) {
      const pA = allPorts[i];
      if (usedPorts.has(pA.id)) continue;

      for (let j = i + 1; j < allPorts.length; j++) {
        const pB = allPorts[j];
        if (usedPorts.has(pB.id)) continue;
        if (pA.pieceId === pB.pieceId) continue; // Must be distinct pieces

        // Check complementary type compatibility
        if (this.areComplementary(pA.type, pB.type)) {
          // Dimensional matching tolerance (within 2.0mm)
          const widthDiff = Math.abs(pA.widthMm - pB.widthMm);
          const depthDiff = Math.abs(pA.depthMm - pB.depthMm);

          if (widthDiff <= 3.0 && depthDiff <= 1.5) {
            connections.push({
              connectionId: `conn_inf_${connCounter++}`,
              sourcePieceId: pA.pieceId,
              sourcePortId: pA.id,
              targetPieceId: pB.pieceId,
              targetPortId: pB.id,
              joiningAngleDeg: defaultJoiningAngleDeg,
              confidenceScore: 0.95 - widthDiff * 0.1,
              reason: `Complementary ${pA.type} <-> ${pB.type} match (width delta=${widthDiff.toFixed(1)}mm)`,
            });

            usedPorts.add(pA.id);
            usedPorts.add(pB.id);
            break;
          }
        }
      }
    }

    return connections;
  }

  /**
   * Complementary port type checker.
   */
  private static areComplementary(typeA: string, typeB: string): boolean {
    const pair = `${typeA}_${typeB}`;
    const reversePair = `${typeB}_${typeA}`;
    const validPairs = new Set([
      "tab_slot",
      "slot_tab",
      "peg_hole",
      "hole_peg",
      "pin_hole",
      "hole_pin",
      "notch_tab",
      "tab_notch",
    ]);

    return validPairs.has(pair) || validPairs.has(reversePair);
  }
}
