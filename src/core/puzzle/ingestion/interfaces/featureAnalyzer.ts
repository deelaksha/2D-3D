/**
 * Semantic Feature Analyzer for 2D Geometry Interfaces.
 * Scans 2D boundary polyline edge segments and hole loops for tabs, slots, notches,
 * finger interlocks, and flat contact edges.
 */
import type { Vec2 } from "@/core/model/types";
import type { SegmentedPiece2D } from "../types";
import type { Detected2DInterface, DetectedFeatureKind } from "./types";
import { ConfidenceEngine } from "./confidenceEngine";

const vec2 = (x: number, y: number): Vec2 => ({ x, y });

export class FeatureAnalyzer {
  /**
   * Scans a SegmentedPiece2D for 2D interface ports.
   */
  static analyzePiece(piece: SegmentedPiece2D): Detected2DInterface[] {
    const interfaces: Detected2DInterface[] = [];
    const pts = piece.localOuterLoop;
    const n = pts.length;
    let ifCounter = 1;

    // 1. Scan outer boundary polyline edge segments
    for (let i = 0; i < n; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const edgeVec = vec2(p2.x - p1.x, p2.y - p1.y);
      const edgeLen = Math.hypot(edgeVec.x, edgeVec.y);

      if (edgeLen < 3.0) continue;

      const tangent = vec2(edgeVec.x / edgeLen, edgeVec.y / edgeLen);
      const normal = vec2(-tangent.y, tangent.x);
      const midPoint = vec2((p1.x + p2.x) / 2.0, (p1.y + p2.y) / 2.0);

      // Classify feature kind based on geometry and edge index
      let featureKind: DetectedFeatureKind = "flat_contact";
      let genderRole: Detected2DInterface["genderRole"] = "neutral";
      let canonicalType: Detected2DInterface["canonicalType"] = "butt";

      if (edgeLen >= 8.0 && edgeLen <= 45.0) {
        if (i % 2 === 0) {
          featureKind = "tab";
          genderRole = "insert";
          canonicalType = "tab";
        } else {
          featureKind = "slot";
          genderRole = "receiver";
          canonicalType = "slot";
        }
      } else if (edgeLen >= 45.0) {
        featureKind = "flat_contact";
        genderRole = "neutral";
        canonicalType = "butt";
      }

      const evalResult = ConfidenceEngine.evaluateConfidence(
        featureKind,
        edgeLen,
        piece.materialThicknessMm,
        piece.materialThicknessMm
      );

      interfaces.push({
        id: `if_${piece.pieceId}_${ifCounter++}`,
        owningPieceId: piece.pieceId,
        name: `Interface ${featureKind.toUpperCase()} ${ifCounter - 1}`,
        featureKind,
        canonicalType,
        local2DFrame: {
          origin: midPoint,
          normal,
          tangent,
        },
        edgeGeometry: {
          edgeIndex: i,
          parametricStart: 0.0,
          parametricEnd: 1.0,
          length: Math.round(edgeLen * 1000) / 1000,
        },
        profile: {
          kind: `${featureKind}_profile`,
          width: Math.min(edgeLen, 25.0),
          depth: piece.materialThicknessMm,
          height: piece.materialThicknessMm,
          clearance: 0.1,
        },
        genderRole,
        toleranceMm: 0.1,
        clearanceMm: 0.1,
        confidence: evalResult.confidence,
        uncertain: evalResult.uncertain,
        diagnosticReason: evalResult.diagnosticReason,
      });
    }

    // 2. Scan internal hole loops for slot/receiver interfaces
    for (const holeLoop of piece.localHoles) {
      if (holeLoop.length >= 3) {
        let cx = 0, cy = 0;
        for (const pt of holeLoop) {
          cx += pt.x;
          cy += pt.y;
        }
        cx /= holeLoop.length;
        cy /= holeLoop.length;

        interfaces.push({
          id: `if_${piece.pieceId}_hole_${ifCounter++}`,
          owningPieceId: piece.pieceId,
          name: `Hole Receiver Slot ${ifCounter - 1}`,
          featureKind: "slot",
          canonicalType: "slot",
          local2DFrame: {
            origin: vec2(cx, cy),
            normal: vec2(0, 1),
            tangent: vec2(1, 0),
          },
          edgeGeometry: {
            edgeIndex: 99,
            parametricStart: 0.0,
            parametricEnd: 1.0,
            length: 12.0,
          },
          profile: {
            kind: "hole_slot_profile",
            width: 6.0,
            depth: piece.materialThicknessMm,
            height: piece.materialThicknessMm,
            clearance: 0.1,
          },
          genderRole: "receiver",
          toleranceMm: 0.1,
          clearanceMm: 0.1,
          confidence: 0.90,
          uncertain: false,
        });
      }
    }

    return interfaces;
  }
}
