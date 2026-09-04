/**
 * Autonomous 2D Interface and Connector Generator.
 *
 * Synthesizes complementary mating interfaces and connection candidates across
 * shared internal boundaries, and compiles raw partitions into fully typed GeneratedPiece objects.
 */

import type { ID, Shape, Vec2 } from "@/core/model/types";
import type { ParametricDesignSpecification } from "../ailayer/types";
import type {
  Autonomous2DGenerationOptions,
  BoundarySegment2D,
  GeneratedConnectionCandidate,
  GeneratedInterface,
  GeneratedPiece,
  PieceBoundary2D,
} from "./types";
import type { PartitionLayoutResult } from "./layouts/types";
import {
  distance2D,
  normalize2D,
  polygonArea,
  polygonCentroid,
  polygonPerimeter,
  computeBoundingBox,
} from "./geometry2D";

export class AutonomousConnectorGenerator {
  public static generate(
    partition: PartitionLayoutResult,
    spec: ParametricDesignSpecification,
    options?: Autonomous2DGenerationOptions
  ): {
    pieces: GeneratedPiece[];
    interfaces: GeneratedInterface[];
    connectionCandidates: GeneratedConnectionCandidate[];
    outerBoundarySegments: BoundarySegment2D[];
  } {
    const stockThicknessMm = spec.material?.stockThicknessMm ?? 3.0;
    const materialId = spec.material?.materialId ?? "mat_cardboard_default";
    const patternStr = (options?.jointPattern || spec.connection_preferences?.defaultType || "tab_slot").toLowerCase();
    const pattern: "tab_slot" | "finger" | "dovetail" | "interlock" =
      patternStr.includes("finger")
        ? "finger"
        : patternStr.includes("dovetail")
        ? "dovetail"
        : patternStr.includes("interlock")
        ? "interlock"
        : "tab_slot";

    const clearanceMm = options?.clearanceMm ?? 0.15;

    const allInterfaces: GeneratedInterface[] = [];
    const connectionCandidates: GeneratedConnectionCandidate[] = [];

    // Map to collect interfaces attached to each piece
    const pieceInterfaceMap = new Map<string, GeneratedInterface[]>();
    const pieceInternalSegmentsMap = new Map<string, BoundarySegment2D[]>();

    for (const rawPiece of partition.pieces) {
      pieceInterfaceMap.set(rawPiece.pieceId, []);
      pieceInternalSegmentsMap.set(rawPiece.pieceId, []);
    }

    // Process each shared edge
    for (const sharedEdge of partition.sharedEdges) {
      const edgeLen = distance2D(sharedEdge.start, sharedEdge.end);
      if (edgeLen < 1e-3) continue;

      const midPoint: Vec2 = {
        x: Number(((sharedEdge.start.x + sharedEdge.end.x) / 2).toFixed(4)),
        y: Number(((sharedEdge.start.y + sharedEdge.end.y) / 2).toFixed(4)),
      };

      const tangentA = normalize2D({
        x: sharedEdge.end.x - sharedEdge.start.x,
        y: sharedEdge.end.y - sharedEdge.start.y,
      });

      // Outward normal from Piece A toward Piece B
      const normalA: Vec2 = {
        x: Number((-tangentA.y).toFixed(5)),
        y: Number((tangentA.x).toFixed(5)),
      };

      // Inward normal for Piece B (facing A)
      const normalB: Vec2 = {
        x: Number((-normalA.x).toFixed(5)),
        y: Number((-normalA.y).toFixed(5)),
      };

      const tangentB: Vec2 = {
        x: Number((-tangentA.x).toFixed(5)),
        y: Number((-tangentA.y).toFixed(5)),
      };

      const featureWidthMm = Number(Math.max(6.0, Math.min(edgeLen * 0.45, 25.0)).toFixed(2));
      const featureDepthMm = Number(Math.max(2.5, Math.min(stockThicknessMm * 1.5, 8.0)).toFixed(2));

      const ifAId = `if_${sharedEdge.pieceAId}_to_${sharedEdge.pieceBId}`;
      const ifBId = `if_${sharedEdge.pieceBId}_to_${sharedEdge.pieceAId}`;

      const ifA: GeneratedInterface = {
        id: ifAId,
        pieceId: sharedEdge.pieceAId,
        neighborPieceId: sharedEdge.pieceBId,
        name: `Interface ${sharedEdge.pieceAId} -> ${sharedEdge.pieceBId}`,
        edgeIndex: sharedEdge.edgeIndexA,
        position: midPoint,
        normal: normalA,
        tangent: tangentA,
        role: "insert",
        pattern,
        widthMm: featureWidthMm,
        depthMm: featureDepthMm,
        toleranceMm: clearanceMm,
        matingInterfaceId: ifBId,
      };

      const ifB: GeneratedInterface = {
        id: ifBId,
        pieceId: sharedEdge.pieceBId,
        neighborPieceId: sharedEdge.pieceAId,
        name: `Interface ${sharedEdge.pieceBId} -> ${sharedEdge.pieceAId}`,
        edgeIndex: sharedEdge.edgeIndexB,
        position: midPoint,
        normal: normalB,
        tangent: tangentB,
        role: "receiver",
        pattern,
        widthMm: featureWidthMm,
        depthMm: featureDepthMm,
        toleranceMm: clearanceMm,
        matingInterfaceId: ifAId,
      };

      allInterfaces.push(ifA, ifB);
      pieceInterfaceMap.get(sharedEdge.pieceAId)?.push(ifA);
      pieceInterfaceMap.get(sharedEdge.pieceBId)?.push(ifB);

      // Register internal segments
      pieceInternalSegmentsMap.get(sharedEdge.pieceAId)?.push({
        id: `seg_${ifAId}`,
        pieceId: sharedEdge.pieceAId,
        start: sharedEdge.start,
        end: sharedEdge.end,
        lengthMm: edgeLen,
        isOuter: false,
        edgeIndex: sharedEdge.edgeIndexA,
        neighborPieceId: sharedEdge.pieceBId,
        interfaceId: ifAId,
      });

      pieceInternalSegmentsMap.get(sharedEdge.pieceBId)?.push({
        id: `seg_${ifBId}`,
        pieceId: sharedEdge.pieceBId,
        start: sharedEdge.end,
        end: sharedEdge.start,
        lengthMm: edgeLen,
        isOuter: false,
        edgeIndex: sharedEdge.edgeIndexB,
        neighborPieceId: sharedEdge.pieceAId,
        interfaceId: ifBId,
      });

      // Register connection candidate
      connectionCandidates.push({
        candidateId: `cand_${sharedEdge.pieceAId}_${sharedEdge.pieceBId}`,
        interfaceAId: ifAId,
        interfaceBId: ifBId,
        pieceAId: sharedEdge.pieceAId,
        pieceBId: sharedEdge.pieceBId,
        compatible: true,
        connectionType: pattern === "finger" ? "interlock" : "tab_slot",
        profileCompatibility: {
          widthDeltaMm: 0,
          depthDeltaMm: 0,
          fitQuality: "exact",
        },
        matingGeometry: {
          contactCenter: midPoint,
          contactNormal: normalA,
        },
        requiredClearanceMm: clearanceMm,
        confidence: 1.0,
        reason: `Autonomous deterministic complementary ${pattern} connection`,
      });
    }

    // Build GeneratedPiece instances
    const pieces: GeneratedPiece[] = [];

    for (const rawPiece of partition.pieces) {
      const area = polygonArea(rawPiece.vertices);
      const perimeter = polygonPerimeter(rawPiece.vertices);
      const centroid = polygonCentroid(rawPiece.vertices);
      const bbox = computeBoundingBox(rawPiece.vertices);
      const widthMm = Number((bbox.maxX - bbox.minX).toFixed(2));
      const heightMm = Number((bbox.maxY - bbox.minY).toFixed(2));

      const pieceBoundary: PieceBoundary2D = {
        vertices: rawPiece.vertices,
        areaMm2: Number(area.toFixed(2)),
        perimeterMm: Number(perimeter.toFixed(2)),
        centroid,
      };

      const outerSegs = partition.outerSegments.filter((os) => os.pieceId === rawPiece.pieceId);
      const internalSegs = pieceInternalSegmentsMap.get(rawPiece.pieceId) || [];
      const pieceInterfaces = pieceInterfaceMap.get(rawPiece.pieceId) || [];

      // Contour for 2D rendering & 3D extrusion
      const contour: Shape = {
        kind: "polygon",
        x: bbox.minX,
        y: bbox.minY,
        width: widthMm,
        height: heightMm,
        rotation: 0,
        nodes: rawPiece.vertices.map((v) => ({
          x: Number((v.x - bbox.minX).toFixed(2)),
          y: Number((v.y - bbox.minY).toFixed(2)),
        })),
        closed: true,
      };

      pieces.push({
        id: rawPiece.pieceId,
        name: rawPiece.name,
        boundary: pieceBoundary,
        outerBoundary: outerSegs,
        internalEdges: internalSegs,
        contour,
        dimensions: {
          widthMm,
          heightMm,
          thicknessMm: stockThicknessMm,
        },
        thicknessMm: stockThicknessMm,
        materialId,
        interfaces: pieceInterfaces,
        parameters: {
          width: { name: "width", defaultValue: widthMm, minValue: 1 },
          height: { name: "height", defaultValue: heightMm, minValue: 1 },
          thickness: { name: "thickness", defaultValue: stockThicknessMm, minValue: 0.5 },
        },
        parameterValues: {
          width: widthMm,
          height: heightMm,
          thickness: stockThicknessMm,
        },
        localOrigin: { x: bbox.minX, y: bbox.minY },
        layoutMetadata: rawPiece.layoutMetadata,
      });
    }

    return {
      pieces,
      interfaces: allInterfaces,
      connectionCandidates,
      outerBoundarySegments: partition.outerSegments,
    };
  }
}
