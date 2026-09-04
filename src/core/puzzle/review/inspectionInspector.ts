/**
 * Inspection Snapshot Engine (Phase 62).
 *
 * Extracts and formats all 11 inspection domains from a dataset item
 * into a strongly-typed, comprehensive InspectionSnapshot for human review:
 *   1. source drawing
 *   2. pieces
 *   3. piece boundaries
 *   4. interfaces
 *   5. connection graph
 *   6. dimensions
 *   7. parametric features
 *   8. material constraints
 *   9. 3D reconstruction
 *   10. assembly transforms
 *   11. validation results
 */
import type { Vec2 } from "@/core/model/types";
import type { RealDatasetExample } from "../realdata/types";
import type { AnnotationState, InspectionSnapshot } from "./types";
import { PuzzleAssemblyGraph } from "../graph/graph";
import type { AssemblyConnectionEdge, PuzzlePieceNode } from "../graph/types";

export class InspectionInspector {
  /**
   * Generates a complete 11-domain inspection snapshot from a RealDatasetExample.
   */
  static inspect(example: RealDatasetExample, state: AnnotationState = "UNREVIEWED"): InspectionSnapshot {
    // 1. Source Drawing
    const sourceDrawing = {
      sourceFile: example.provenance.source_file || example.source2DDrawingPath || "unknown",
      detectedFormat: example.provenance.raw_ref?.detectedFormat || "UNKNOWN",
      sizeBytes: example.provenance.raw_ref?.sizeBytes || 0,
      sha256: example.provenance.source_version || example.provenance.raw_ref?.sha256 || "",
      drawingPath: example.source2DDrawingPath,
    };

    // 2. Pieces
    const pieces = (example.pieces || []).map((p) => ({
      pieceId: p.pieceId,
      name: p.name,
      materialId: example.puzzle.materialSpecification.materialId,
      vertexCount: p.localPolygon2D ? p.localPolygon2D.length : 0,
    }));

    // 3. Piece Boundaries
    const pieceBoundaries: InspectionSnapshot["pieceBoundaries"] = {};
    for (const p of example.pieces || []) {
      const loop: Vec2[] = p.localPolygon2D || [];
      const area = this.calculatePolygonArea(loop);
      const perimeter = this.calculatePolygonPerimeter(loop);
      pieceBoundaries[p.pieceId] = {
        loop,
        area: Number(area.toFixed(2)),
        perimeter: Number(perimeter.toFixed(2)),
        isClosed: loop.length >= 3,
      };
    }

    // 4. Interfaces
    const interfaces = (example.interfaces || []).map((iface) => ({
      interfaceId: iface.interfaceId,
      owningPieceId: iface.owningPieceId,
      type: iface.interfaceType,
      genderRole: iface.genderRole,
      widthMm: iface.profileWidthMm,
      depthMm: iface.profileDepthMm,
      normal: iface.localFrame.normal,
    }));

    const ifaceMap = new Map<string, (typeof interfaces)[0]>();
    for (const iface of interfaces) {
      ifaceMap.set(iface.interfaceId, iface);
    }

    // 5. Connection Graph
    const nodes: PuzzlePieceNode[] = (example.pieces || []).map((p) => ({
      pieceId: p.pieceId,
      interfaceIds: interfaces.filter((i) => i.owningPieceId === p.pieceId).map((i) => i.interfaceId),
    }));

    const edges: AssemblyConnectionEdge[] = [];
    const inspectionEdges: InspectionSnapshot["connectionGraph"]["edges"] = [];

    for (const c of example.connections || []) {
      const ifA = ifaceMap.get(c.interfaceAId);
      const ifB = ifaceMap.get(c.interfaceBId);

      inspectionEdges.push({
        connectionId: c.connectionId,
        interfaceAId: c.interfaceAId,
        interfaceBId: c.interfaceBId,
        pieceAId: ifA?.owningPieceId,
        pieceBId: ifB?.owningPieceId,
        angleDeg: c.joiningAngleDeg,
      });

      if (ifA && ifB) {
        edges.push({
          connectionId: c.connectionId,
          sourcePieceId: ifA.owningPieceId,
          sourceInterfaceId: ifA.interfaceId,
          targetPieceId: ifB.owningPieceId,
          targetInterfaceId: ifB.interfaceId,
          connectionType: c.connectionType,
          joiningAngleDeg: c.joiningAngleDeg,
          status: "valid",
        });
      }
    }

    let isFullyConnected = true;
    let connectedComponentsCount = 1;

    if (nodes.length > 1) {
      try {
        const graph = new PuzzleAssemblyGraph(nodes, edges);
        const components = graph.getConnectedComponents();
        connectedComponentsCount = components.length;
        isFullyConnected = components.length === 1;
      } catch {
        isFullyConnected = edges.length >= nodes.length - 1;
      }
    }

    const connectionGraph = {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      isFullyConnected,
      connectedComponentsCount,
      edges: inspectionEdges,
    };

    // 6. Dimensions
    const dimensions: InspectionSnapshot["dimensions"] = {};
    for (const p of example.pieces || []) {
      dimensions[p.pieceId] = {
        widthMm: p.designParameters.widthMm,
        heightMm: p.designParameters.heightMm,
        thicknessMm: p.designParameters.thicknessMm,
      };
    }

    // 7. Parametric Features
    const parametricFeatures: InspectionSnapshot["parametricFeatures"] = [];
    for (const p of example.pieces || []) {
      parametricFeatures.push(
        {
          featureId: `feat_${p.pieceId}_w`,
          owningPieceId: p.pieceId,
          name: "width",
          type: "linear",
          value: p.designParameters.widthMm,
        },
        {
          featureId: `feat_${p.pieceId}_h`,
          owningPieceId: p.pieceId,
          name: "height",
          type: "linear",
          value: p.designParameters.heightMm,
        },
        {
          featureId: `feat_${p.pieceId}_t`,
          owningPieceId: p.pieceId,
          name: "thickness",
          type: "material",
          value: p.designParameters.thicknessMm,
        }
      );

      if (p.designParameters.tabWidthMm !== undefined) {
        parametricFeatures.push({
          featureId: `feat_${p.pieceId}_tab_w`,
          owningPieceId: p.pieceId,
          name: "tabWidth",
          type: "interface_profile",
          value: p.designParameters.tabWidthMm,
        });
      }
      if (p.designParameters.tabDepthMm !== undefined) {
        parametricFeatures.push({
          featureId: `feat_${p.pieceId}_tab_d`,
          owningPieceId: p.pieceId,
          name: "tabDepth",
          type: "interface_profile",
          value: p.designParameters.tabDepthMm,
        });
      }
    }

    // 8. Material Constraints
    const materialConstraints = {
      stockWidthMm: example.puzzle.materialSpecification.stockWidthMm,
      stockHeightMm: example.puzzle.materialSpecification.stockHeightMm,
      thicknessMm: example.puzzle.materialSpecification.thicknessMm,
      materialId: example.puzzle.materialSpecification.materialId,
      grainAngleDeg: 0,
      kerf: 0.1,
    };

    // 9. 3D Reconstruction
    const reconstruction3D: InspectionSnapshot["reconstruction3D"] = {};
    for (const p of example.pieces || []) {
      const bounds = example.pieceSolids3D[p.pieceId] || p.localSolid3DBounds || {
        min: { x: -50, y: -50, z: -1.5 },
        max: { x: 50, y: 50, z: 1.5 },
      };
      const dx = Math.abs(bounds.max.x - bounds.min.x);
      const dy = Math.abs(bounds.max.y - bounds.min.y);
      const dz = Math.abs(bounds.max.z - bounds.min.z);
      reconstruction3D[p.pieceId] = {
        min: bounds.min,
        max: bounds.max,
        volumeEstimateMm3: Number((dx * dy * dz).toFixed(1)),
      };
    }

    // 10. Assembly Transforms
    const assemblyTransforms = {
      pieceTransforms: example.assembly.pieceTransforms,
      assemblySequence: example.assembly.assemblySequence,
    };

    // 11. Validation Results
    const validationResults = {
      isValid: example.qualitySummary?.status === "PASS" || example.validation.isValid,
      overallScore: example.qualitySummary?.score ?? example.validation.overallScore ?? 1.0,
      failureReasons: example.qualitySummary?.failureReasons || example.failureReasons || [],
      reviewReasons: example.qualitySummary?.reviewReasons || [],
      geometryValid: example.qualitySummary?.geometryValid ?? true,
      connectionValid: example.qualitySummary?.connectionValid ?? true,
      assemblyValid: example.qualitySummary?.assemblyValid ?? true,
    };

    return {
      exampleId: example.itemId,
      state,
      sourceDrawing,
      pieces,
      pieceBoundaries,
      interfaces,
      connectionGraph,
      dimensions,
      parametricFeatures,
      materialConstraints,
      reconstruction3D,
      assemblyTransforms,
      validationResults,
    };
  }

  private static calculatePolygonArea(pts: Vec2[]): number {
    if (!pts || pts.length < 3) return 0;
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area) / 2.0;
  }

  private static calculatePolygonPerimeter(pts: Vec2[]): number {
    if (!pts || pts.length < 2) return 0;
    let perimeter = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = pts[j].x - pts[i].x;
      const dy = pts[j].y - pts[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    return perimeter;
  }
}
