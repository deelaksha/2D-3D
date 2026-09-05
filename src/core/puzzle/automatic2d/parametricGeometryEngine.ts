/**
 * Parametric Geometry Engine (Phase 85 - Stage 6).
 *
 * Embeds physical connector features (tabs, slots, notches, dovetails) into
 * the 2D piece boundaries, generating the exact physical cutting contour
 * (exactBoundary) and recomputing exact piece dimensions.
 */

import type { Vec2 } from "@/core/model/types";
import type { PartitionedPiece } from "../boundarypartition/types";
import type {
  GeneratedConnection2D,
  GeneratedPiece2D,
  PieceDimensions2D,
  DesignSpecification2D,
} from "./types";
import { GlobalBoundaryGenerator } from "./globalBoundaryGenerator";

interface EdgeFeature {
  offsetT: number;
  widthMm: number;
  depthMm: number;
  isMale: boolean;
  type: string;
}

export class ParametricGeometryEngine {
  /**
   * Generates exact piece boundaries and dimensions with all physical connectors embedded.
   */
  public static generatePieces(
    partitionedPieces: PartitionedPiece[],
    connections: GeneratedConnection2D[],
    pieceInterfacesMap: Map<string, any[]>,
    pieceConnectorParamsMap: Map<string, any[]>,
    spec: DesignSpecification2D
  ): GeneratedPiece2D[] {
    const stockThicknessMm = spec.material?.stockThicknessMm ?? spec.thicknessMm ?? 3.0;
    const materialObj = {
      id: spec.material?.id ?? "cardboard_stock",
      name: spec.material?.name ?? "Cardboard Stock",
      stockThicknessMm,
      kerfMm: spec.material?.kerfMm ?? 0.1,
    };

    // Index connections by piece
    const pieceConnectionsMap = new Map<string, { conn: GeneratedConnection2D; isPieceA: boolean }[]>();
    for (const p of partitionedPieces) {
      pieceConnectionsMap.set(p.id, []);
    }

    for (const conn of connections) {
      pieceConnectionsMap.get(conn.pieceA)?.push({ conn, isPieceA: true });
      pieceConnectionsMap.get(conn.pieceB)?.push({ conn, isPieceA: false });
    }

    const generatedPieces: GeneratedPiece2D[] = [];

    for (const partPiece of partitionedPieces) {
      const pId = partPiece.id;
      const rawBoundary = [...partPiece.vertices];
      const attachedConns = pieceConnectionsMap.get(pId) || [];

      // Generate exact boundary by embedding connector tabs/slots
      const exactBoundary = this.embedConnectorsIntoBoundary(
        rawBoundary,
        attachedConns,
        partPiece.centroid
      );

      // Recompute geometric properties from exact boundary
      const areaMm2 = Math.abs(GlobalBoundaryGenerator.calculatePolygonArea(exactBoundary));
      const perimeterMm = GlobalBoundaryGenerator.calculatePolygonPerimeter(exactBoundary);
      const bounds = GlobalBoundaryGenerator.calculateBounds(exactBoundary);
      const widthMm = Number((bounds.maxX - bounds.minX).toFixed(3));
      const heightMm = Number((bounds.maxY - bounds.minY).toFixed(3));

      const dimensions: PieceDimensions2D = {
        widthMm,
        heightMm,
        thicknessMm: stockThicknessMm,
        areaMm2: Number(areaMm2.toFixed(3)),
        perimeterMm: Number(perimeterMm.toFixed(3)),
        bounds,
      };

      const interfaces = pieceInterfacesMap.get(pId) || [];
      const connectorParameters = pieceConnectorParamsMap.get(pId) || [];

      // Collect unique neighbor IDs
      const neighborPieceIds = Array.from(
        new Set(
          attachedConns.map((c) => (c.isPieceA ? c.conn.pieceB : c.conn.pieceA))
        )
      );

      const generatedPiece: GeneratedPiece2D = {
        id: pId,
        pieceId: pId,
        name: partPiece.name || `Piece_${pId}`,
        exactBoundary,
        rawBoundary,
        dimensions,
        interfaces,
        connectorParameters,
        material: materialObj,
        thickness: stockThicknessMm,
        isBorderPiece: partPiece.isBorderPiece,
        neighborPieceIds,
        centroid: partPiece.centroid,
      };

      generatedPieces.push(generatedPiece);
    }

    return generatedPieces;
  }

  /**
   * Injects male protrusions and female cutouts into a polygon loop.
   */
  private static embedConnectorsIntoBoundary(
    rawVertices: Vec2[],
    attachedConns: { conn: GeneratedConnection2D; isPieceA: boolean }[],
    centroid: Vec2
  ): Vec2[] {
    if (attachedConns.length === 0 || rawVertices.length < 3) {
      return [...rawVertices];
    }

    const n = rawVertices.length;
    const newVertices: Vec2[] = [];

    // Map features to the closest polygon edge
    for (let i = 0; i < n; i++) {
      const v1 = rawVertices[i];
      const v2 = rawVertices[(i + 1) % n];

      newVertices.push({ ...v1 });

      const edgeLen = Math.hypot(v2.x - v1.x, v2.y - v1.y);
      if (edgeLen < 1.0) continue;

      const dx = (v2.x - v1.x) / edgeLen;
      const dy = (v2.y - v1.y) / edgeLen;
      const edgeTangent: Vec2 = { x: dx, y: dy };

      // Candidate outward normal from piece along this edge
      const norm1: Vec2 = { x: -edgeTangent.y, y: edgeTangent.x };
      const edgeMid = { x: (v1.x + v2.x) / 2, y: (v1.y + v2.y) / 2 };
      const fromCentroid = { x: edgeMid.x - centroid.x, y: edgeMid.y - centroid.y };

      // Normal pointing away from centroid is the outward normal
      const dotOut = norm1.x * fromCentroid.x + norm1.y * fromCentroid.y;
      const outwardNormal: Vec2 = dotOut >= 0 ? norm1 : { x: edgeTangent.y, y: -edgeTangent.x };

      // Find any connectors positioned on this edge
      const edgeFeatures: {
        distFromV1: number;
        widthMm: number;
        depthMm: number;
        isMale: boolean;
        type: string;
      }[] = [];

      for (const { conn, isPieceA } of attachedConns) {
        const pos = conn.placementLocation?.worldPosition;
        if (!pos) continue;

        // Project pos onto line (v1 -> v2)
        const proj = (pos.x - v1.x) * dx + (pos.y - v1.y) * dy;
        const perpDist = Math.abs((pos.x - v1.x) * (-dy) + (pos.y - v1.y) * dx);

        // Check if connector falls near this edge
        if (proj > 2.0 && proj < edgeLen - 2.0 && perpDist < 4.0) {
          const isMale = isPieceA;
          const widthMm = isMale ? conn.parameters.tabWidth : conn.parameters.slotWidth;
          const depthMm = isMale ? conn.parameters.tabDepth : conn.parameters.slotDepth;

          edgeFeatures.push({
            distFromV1: proj,
            widthMm: Math.min(widthMm, edgeLen * 0.7),
            depthMm,
            isMale,
            type: conn.connectorType,
          });
        }
      }

      // Sort features by distance along the edge
      edgeFeatures.sort((a, b) => a.distFromV1 - b.distFromV1);

      // Embed each feature into the boundary
      for (const feat of edgeFeatures) {
        const halfW = feat.widthMm / 2;
        const startDist = Math.max(0.5, feat.distFromV1 - halfW);
        const endDist = Math.min(edgeLen - 0.5, feat.distFromV1 + halfW);

        const pStart: Vec2 = {
          x: Number((v1.x + edgeTangent.x * startDist).toFixed(4)),
          y: Number((v1.y + edgeTangent.y * startDist).toFixed(4)),
        };

        const pEnd: Vec2 = {
          x: Number((v1.x + edgeTangent.x * endDist).toFixed(4)),
          y: Number((v1.y + edgeTangent.y * endDist).toFixed(4)),
        };

        // Direction multiplier: +1 outward for male, -1 inward for female
        const dir = feat.isMale ? 1.0 : -1.0;

        if (feat.type === "interlock") {
          // Dovetail bulb shape
          const flare = feat.isMale ? 1.2 : 0.85;
          const ext1: Vec2 = {
            x: Number((pStart.x + outwardNormal.x * feat.depthMm * dir - edgeTangent.x * (feat.widthMm * 0.1 * dir)).toFixed(4)),
            y: Number((pStart.y + outwardNormal.y * feat.depthMm * dir - edgeTangent.y * (feat.widthMm * 0.1 * dir)).toFixed(4)),
          };
          const ext2: Vec2 = {
            x: Number((pEnd.x + outwardNormal.x * feat.depthMm * dir + edgeTangent.x * (feat.widthMm * 0.1 * dir)).toFixed(4)),
            y: Number((pEnd.y + outwardNormal.y * feat.depthMm * dir + edgeTangent.y * (feat.widthMm * 0.1 * dir)).toFixed(4)),
          };
          newVertices.push(pStart, ext1, ext2, pEnd);
        } else {
          // Rectangular tab or slot
          const ext1: Vec2 = {
            x: Number((pStart.x + outwardNormal.x * feat.depthMm * dir).toFixed(4)),
            y: Number((pStart.y + outwardNormal.y * feat.depthMm * dir).toFixed(4)),
          };
          const ext2: Vec2 = {
            x: Number((pEnd.x + outwardNormal.x * feat.depthMm * dir).toFixed(4)),
            y: Number((pEnd.y + outwardNormal.y * feat.depthMm * dir).toFixed(4)),
          };
          newVertices.push(pStart, ext1, ext2, pEnd);
        }
      }
    }

    return newVertices;
  }
}
