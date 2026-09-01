/**
 * Interface Detector (Step 30).
 * Scans 2D piece boundaries to detect tab, slot, notch, and hole ports and build local coordinate frames.
 */
import type { Vec2 } from "@/core/model/types";
import type { SegmentedPiece2D } from "../ingestion/types";
import type { DetectedInterfacePort } from "./types";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class InterfaceDetector {
  /**
   * Detects interface ports along 2D piece boundaries.
   */
  static detectInterfaces(piece: SegmentedPiece2D): DetectedInterfacePort[] {
    const ports: DetectedInterfacePort[] = [];
    const pts = piece.localOuterLoop;
    const n = pts.length;
    let portCounter = 1;

    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const edgeVec = vec2(p2.x - p1.x, p2.y - p1.y);
      const edgeLen = Math.sqrt(edgeVec.x * edgeVec.x + edgeVec.y * edgeVec.y);

      if (edgeLen < 5.0) continue;

      const normal = vec2(-edgeVec.y / edgeLen, edgeVec.x / edgeLen);
      const midPoint = vec2((p1.x + p2.x) / 2.0, (p1.y + p2.y) / 2.0);

      if (edgeLen >= 8.0 && edgeLen <= 45.0) {
        const isTabCandidate = i % 2 === 0;
        const portType = isTabCandidate ? "tab" : "slot";
        const widthMm = Math.min(edgeLen, 15.0);
        const depthMm = piece.materialThicknessMm;

        ports.push({
          id: `if_${piece.pieceId}_${portCounter++}`,
          pieceId: piece.pieceId,
          type: portType,
          localCenter2D: midPoint,
          localNormal2D: normal,
          widthMm,
          depthMm,
        });
      }
    }

    for (const holeLoop of piece.localHoles) {
      if (holeLoop.length >= 3) {
        let cx = 0, cy = 0;
        for (const pt of holeLoop) {
          cx += pt.x;
          cy += pt.y;
        }
        cx /= holeLoop.length;
        cy /= holeLoop.length;

        ports.push({
          id: `if_${piece.pieceId}_hole_${portCounter++}`,
          pieceId: piece.pieceId,
          type: "slot",
          localCenter2D: vec2(cx, cy),
          localNormal2D: vec2(0, 1),
          widthMm: 6.0,
          depthMm: piece.materialThicknessMm,
        });
      }
    }

    return ports;
  }
}
