/**
 * Connector Synthesis Engine (Phase 85 - Stages 4 & 5).
 *
 * Integrates:
 *  - Automatic Connector Placement Engine (Phase 84) to compute structurally safe positions.
 *  - Automatic Connector Generation Engine (Phase 83) to generate complementary joints.
 */

import { ConnectorPlacementEngine } from "../connectorplacement/connectorPlacementEngine";
import type {
  ConnectorPlacementRequest,
  InterfaceEdgeInput,
  PlacementPieceInput,
  PlacedConnectorLocation,
} from "../connectorplacement/types";
import { AutomaticConnectorEngine } from "../connectorgeneration/automaticConnectorEngine";
import type {
  ConnectorGenerationRequest,
  ConnectorType,
} from "../connectorgeneration/types";
import type { PuzzleAssemblyGraph } from "../graph/graph";
import type { PartitionedPiece } from "../boundarypartition/types";
import type { CanonicalInterfaceEdge } from "./connectionGraphBuilder";
import type { DesignSpecification2D, GeneratedConnection2D } from "./types";

export class ConnectorSynthesisEngine {
  /**
   * Synthesizes and places all physical connectors along shared interface edges.
   */
  public static synthesize(
    pieces: PartitionedPiece[],
    edges: CanonicalInterfaceEdge[],
    graph: PuzzleAssemblyGraph,
    spec: DesignSpecification2D
  ): {
    connections: GeneratedConnection2D[];
    pieceInterfacesMap: Map<string, any[]>;
    pieceConnectorParamsMap: Map<string, any[]>;
    placementReport: any;
  } {
    const stockThicknessMm = spec.material?.stockThicknessMm ?? spec.thicknessMm ?? 3.0;
    const materialId = spec.material?.id ?? "cardboard_stock";
    const preferredType: ConnectorType = spec.preferredConnectorType ?? "tab_slot";
    const joiningAngle = spec.targetJoiningAngleDeg ?? 180.0;
    const clearanceOverride = spec.clearanceOverrideMm;

    // 1. Prepare inputs for ConnectorPlacementEngine (Phase 84)
    const placementPieces: PlacementPieceInput[] = pieces.map((p) => ({
      id: p.id,
      name: p.name,
      vertices: p.vertices,
      thicknessMm: stockThicknessMm,
      materialId,
    }));

    const placementEdges: InterfaceEdgeInput[] = edges.map((e) => ({
      id: e.edgeId,
      pieceAId: e.pieceAId,
      pieceBId: e.pieceBId,
      start: e.start,
      end: e.end,
      lengthMm: e.lengthMm,
      normal: e.normal,
      tangent: e.tangent,
      preferredPlacementMode: spec.placementMode ?? "auto",
      preferredType,
    }));

    const placementRequest: ConnectorPlacementRequest = {
      pieces: placementPieces,
      edges: placementEdges,
      materialConstraints: {
        stockThicknessMm,
        minCornerMarginMm: spec.minFeatureSizeMm ?? 5.0,
        minBridgeWidthMm: 4.0,
        minInterConnectorGapMm: 6.0,
        kerfMm: spec.material?.kerfMm ?? 0.1,
      },
      difficulty: spec.difficulty ?? "medium",
      forceAsymmetric: spec.placementMode === "asymmetric",
    };

    const placementResult = ConnectorPlacementEngine.optimizePlacements(placementRequest);

    // 2. Map placed locations by edgeId, with fallback if an edge was rejected
    const edgePlacementsMap = new Map<string, PlacedConnectorLocation[]>();
    for (const pl of placementResult.allPlacedConnectors) {
      if (!edgePlacementsMap.has(pl.edgeId)) {
        edgePlacementsMap.set(pl.edgeId, []);
      }
      edgePlacementsMap.get(pl.edgeId)!.push(pl);
    }

    // Ensure every interface edge has at least one connector
    for (const edge of edges) {
      if (!edgePlacementsMap.has(edge.edgeId) || edgePlacementsMap.get(edge.edgeId)!.length === 0) {
        // Fallback: create a single centered placement
        const fallbackLocation: PlacedConnectorLocation = {
          connectorId: `fallback_conn_${edge.edgeId}`,
          edgeId: edge.edgeId,
          pieceAId: edge.pieceAId,
          pieceBId: edge.pieceBId,
          parametricOffsetT: 0.5,
          worldPosition: edge.midpoint,
          normal: edge.normal,
          tangent: edge.tangent,
          widthMm: Math.max(4.0, Math.min(edge.lengthMm * 0.4, 20.0)),
          depthMm: Math.max(2.0, stockThicknessMm),
          clearanceMm: clearanceOverride ?? (stockThicknessMm <= 3.0 ? 0.15 : 0.2),
          cornerMarginStartMm: edge.lengthMm * 0.3,
          cornerMarginEndMm: edge.lengthMm * 0.3,
          placementMode: "single",
        };
        edgePlacementsMap.set(edge.edgeId, [fallbackLocation]);
      }
    }

    // 3. For each placed connector, generate complementary pair via AutomaticConnectorEngine (Phase 83)
    const connections: GeneratedConnection2D[] = [];
    const pieceInterfacesMap = new Map<string, any[]>();
    const pieceConnectorParamsMap = new Map<string, any[]>();

    for (const p of pieces) {
      pieceInterfacesMap.set(p.id, []);
      pieceConnectorParamsMap.set(p.id, []);
    }

    const edgeMap = new Map<string, CanonicalInterfaceEdge>();
    for (const e of edges) {
      edgeMap.set(e.edgeId, e);
    }

    for (const [edgeId, placedList] of edgePlacementsMap.entries()) {
      const edge = edgeMap.get(edgeId);
      if (!edge) continue;

      for (const placed of placedList) {
        const genRequest: ConnectorGenerationRequest = {
          pieceA: {
            id: edge.pieceAId,
            thicknessMm: stockThicknessMm,
            materialId,
            edgeLengthMm: edge.lengthMm,
          },
          pieceB: {
            id: edge.pieceBId,
            thicknessMm: stockThicknessMm,
            materialId,
            edgeLengthMm: edge.lengthMm,
          },
          interface: {
            contactCenter: placed.worldPosition,
            contactNormal: placed.normal,
            contactTangent: placed.tangent,
            edgeLengthMm: edge.lengthMm,
            preferredType,
            targetJoiningAngleDeg: joiningAngle,
            clearanceOverrideMm: clearanceOverride,
          },
        };

        const { connectorPair } = AutomaticConnectorEngine.createConnector(genRequest);

        // Register in PuzzleAssemblyGraph
        graph.addConnectionEdge({
          connectionId: connectorPair.connectionId,
          sourcePieceId: edge.pieceAId,
          sourceInterfaceId: connectorPair.interfaceA.id,
          targetPieceId: edge.pieceBId,
          targetInterfaceId: connectorPair.interfaceB.id,
          connectionType: connectorPair.type,
          joiningAngleDeg: connectorPair.allowedAngleRange.nominalAngleDeg,
          status: "ACTIVE",
          metadata: {
            clearanceMm: connectorPair.clearance,
            edgeId: edge.edgeId,
          },
        });

        // Store interfaces and params on respective pieces
        pieceInterfacesMap.get(edge.pieceAId)?.push(connectorPair.interfaceA);
        pieceInterfacesMap.get(edge.pieceBId)?.push(connectorPair.interfaceB);
        pieceConnectorParamsMap.get(edge.pieceAId)?.push(connectorPair.parameters);
        pieceConnectorParamsMap.get(edge.pieceBId)?.push(connectorPair.parameters);

        // Build GeneratedConnection2D object satisfying Phase 85 specs
        const connection: GeneratedConnection2D = {
          id: connectorPair.connectionId,
          connectionId: connectorPair.connectionId,
          pieceA: edge.pieceAId,
          pieceB: edge.pieceBId,
          interfaceA: connectorPair.interfaceA,
          interfaceB: connectorPair.interfaceB,
          connectorType: connectorPair.type,
          parameters: connectorPair.parameters,
          clearance: connectorPair.clearance,
          allowedAngle: connectorPair.allowedAngleRange.nominalAngleDeg,
          advancedConnection: connectorPair.advancedConnection,
          placementLocation: {
            parametricOffsetT: placed.parametricOffsetT,
            worldPosition: placed.worldPosition,
            normal: placed.normal,
            tangent: placed.tangent,
          },
        };

        connections.push(connection);
      }
    }

    return {
      connections,
      pieceInterfacesMap,
      pieceConnectorParamsMap,
      placementReport: placementResult.report,
    };
  }
}
