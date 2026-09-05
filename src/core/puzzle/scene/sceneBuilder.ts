/**
 * Renderer-Independent 3D Scene Builder (Phase 93).
 *
 * Transforms authoritative CAD puzzle artifacts into a complete, renderer-independent
 * scene graph. Deep-clones all geometric buffers to guarantee that downstream rendering
 * clients or viewers cannot modify or corrupt the underlying CAD models.
 */

import { uid } from "@/core/model/ids";
import type { Vec3 } from "@/core/model/types";
import type { Box3D } from "../geometry/types";
import type { CoordinateFrame3D, RigidTransform3D } from "../framesystem/types";
import { transformPoint, transformVector } from "../framesystem/transformEngine";
import type { ConvertedPuzzle3D, GeneratedPiece3D, RetainedConnection3D } from "../piece3d/types";
import type { PuzzleGenerationResult } from "../highlevelapi/types";
import { RenderGeometryFactory } from "./renderGeometry";
import type {
  RenderGeometry,
  Scene,
  SceneBuildOptions,
  SceneConnection,
  SceneCoordinateAxes,
  SceneDisplayProperties,
  SceneMaterial,
  SceneMetadata,
  SceneObject,
} from "./types";

export class SceneBuilder {
  /**
   * Builds a complete Scene from a PuzzleGenerationResult (Phase 92).
   */
  public static buildFromPuzzle(
    result: PuzzleGenerationResult,
    options: SceneBuildOptions = {}
  ): Scene {
    const puzzle3D: ConvertedPuzzle3D = {
      puzzleId: result.designSpecification.id || "puzzle_3d",
      specification: result.designSpecification,
      pieces: result.pieces3D,
      connections: result.connectors.map((c) => ({
        connectionId: c.id,
        pieceAId: c.pieceA,
        pieceBId: c.pieceB,
        interfaceAId: c.interfaceA.id,
        interfaceBId: c.interfaceB.id,
        connectorType: c.connectorType,
        parameters: { ...c.parameters },
        clearanceMm: c.clearance,
        allowedAngleDeg: c.allowedAngle,
      })),
      validation: {
        isValid: result.validationReport.isValid,
        issues: [],
        pieceValidations: [],
      },
      metadata: {
        convertedAt: new Date().toISOString(),
        executionDurationMs: result.generationStatistics.totalDurationMs,
        generatorVersion: "Phase 93 (v1.0)",
      },
    };

    const pieceTransforms: Record<string, RigidTransform3D> = result.assembly.pieceTransforms || {};
    const appliedAngles: Record<string, number> = result.assembly.appliedAngles || {};

    return this.buildFromAssembly(puzzle3D, pieceTransforms, appliedAngles, options);
  }

  /**
   * Builds a complete Scene from a ConvertedPuzzle3D and solved piece transforms.
   */
  public static buildFromAssembly(
    puzzle3D: ConvertedPuzzle3D,
    pieceTransforms: Record<string, RigidTransform3D>,
    appliedAngles: Record<string, number> = {},
    options: SceneBuildOptions = {}
  ): Scene {
    const sceneId = uid("scene_");
    const sceneName = options.sceneName || `Scene: ${puzzle3D.puzzleId}`;
    const materials: Record<string, SceneMaterial> = {};
    const pieces: SceneObject[] = [];
    const connectors: SceneObject[] = [];
    const connections: SceneConnection[] = [];

    // 1. Establish Default / Base Material Library
    this.populateBaseMaterials(materials, puzzle3D, options);

    // 2. Build Renderable Pieces
    for (let i = 0; i < puzzle3D.pieces.length; i++) {
      const cadPiece = puzzle3D.pieces[i];
      const transform = pieceTransforms[cadPiece.pieceId] || this.createIdentityTransform();

      // Resolve Material
      const materialId = this.resolveMaterialId(cadPiece, i, options);
      const material = materials[materialId] || materials["default_material"];

      // Deep-clone geometry buffer from CAD piece
      const renderGeometry = RenderGeometryFactory.fromSolidMeshBuffer(
        cadPiece.solid.localMesh,
        options.generateWireframeIndices !== false
      );

      const pieceObject: SceneObject = {
        id: uid("scene_piece_"),
        name: cadPiece.name || `Piece ${cadPiece.pieceId}`,
        kind: "piece",
        geometry: renderGeometry,
        transform: { ...transform },
        worldTransform: { ...transform },
        materialId: material.id,
        displayProperties: { ...material.displayProperties },
        pieceId: cadPiece.pieceId,
        connectionIds: [...cadPiece.connectorIds],
        cadGeometryRef: cadPiece.solid.pieceId,
        isImmutableCadCopy: true,
      };

      pieces.push(pieceObject);
    }

    // 3. Build Connections & Connection Visualizations
    for (const conn of puzzle3D.connections) {
      const transformA = pieceTransforms[conn.pieceAId] || this.createIdentityTransform();
      const transformB = pieceTransforms[conn.pieceBId] || this.createIdentityTransform();

      const pieceA = puzzle3D.pieces.find((p) => p.pieceId === conn.pieceAId);
      const pieceB = puzzle3D.pieces.find((p) => p.pieceId === conn.pieceBId);

      const ifaceA = pieceA?.interfaces.find((ifc) => ifc.id === conn.interfaceAId);
      const ifaceB = pieceB?.interfaces.find((ifc) => ifc.id === conn.interfaceBId);

      const originA = ifaceA?.localFrame.origin || { x: 0, y: 0, z: 0 };
      const originB = ifaceB?.localFrame.origin || { x: 0, y: 0, z: 0 };

      const worldPosA = transformPoint(transformA, originA);
      const worldPosB = transformPoint(transformB, originB);

      const midPoint: Vec3 = {
        x: Number(((worldPosA.x + worldPosB.x) / 2).toFixed(3)),
        y: Number(((worldPosA.y + worldPosB.y) / 2).toFixed(3)),
        z: Number(((worldPosA.z + worldPosB.z) / 2).toFixed(3)),
      };

      const normalA = ifaceA?.localFrame.normal || { x: 0, y: 1, z: 0 };
      const worldNormalA = transformVector(transformA, normalA);

      const appliedAngle = appliedAngles[conn.connectionId] ?? conn.allowedAngleDeg ?? 180;

      // Status indicator color (Green for mated/aligned, Orange for non-zero angles)
      const isMated = Math.hypot(
        worldPosA.x - worldPosB.x,
        worldPosA.y - worldPosB.y,
        worldPosA.z - worldPosB.z
      ) < 1.0;
      const statusColor = isMated ? "#2ECC71" : "#E67E22";

      // Pairing line object
      const lineGeom = RenderGeometryFactory.createLineSegment(worldPosA, worldPosB);
      const pairingLine: SceneObject = {
        id: uid("scene_conn_line_"),
        name: `Line: ${conn.connectionId}`,
        kind: "connection_marker",
        geometry: lineGeom,
        transform: this.createIdentityTransform(),
        worldTransform: this.createIdentityTransform(),
        materialId: "mat_connection_line",
        displayProperties: {
          color: statusColor,
          opacity: 0.9,
          transparent: true,
          roughness: 0.5,
          metalness: 0.1,
          wireframe: false,
          visible: options.includeConnectionVisualizations !== false,
          castShadow: false,
          receiveShadow: false,
        },
        pieceId: conn.pieceAId,
        connectionIds: [conn.connectionId],
        cadGeometryRef: conn.connectionId,
        isImmutableCadCopy: true,
      };

      // Junction status marker object
      const markerGeom = RenderGeometryFactory.createMarker(midPoint, 4.0);
      const statusMarker: SceneObject = {
        id: uid("scene_conn_marker_"),
        name: `Marker: ${conn.connectionId}`,
        kind: "connector",
        geometry: markerGeom,
        transform: this.createIdentityTransform(),
        worldTransform: this.createIdentityTransform(),
        materialId: "mat_connection_marker",
        displayProperties: {
          color: statusColor,
          opacity: 1.0,
          transparent: false,
          roughness: 0.3,
          metalness: 0.6,
          wireframe: false,
          visible: options.includeConnectionVisualizations !== false,
          castShadow: true,
          receiveShadow: true,
        },
        pieceId: conn.pieceAId,
        connectionIds: [conn.connectionId],
        cadGeometryRef: conn.connectionId,
        isImmutableCadCopy: true,
      };

      connectors.push(statusMarker);

      connections.push({
        id: uid("scene_conn_"),
        connectionId: conn.connectionId,
        pieceAId: conn.pieceAId,
        pieceBId: conn.pieceBId,
        interfaceAId: conn.interfaceAId,
        interfaceBId: conn.interfaceBId,
        connectorType: conn.connectorType,
        state: isMated ? "MATED" : "ENGAGED",
        joiningAngleDeg: appliedAngle,
        visualization: {
          startPoint: worldPosA,
          endPoint: worldPosB,
          midPoint,
          normal: worldNormalA,
          color: statusColor,
          pairingLine,
          statusMarker,
        },
      });
    }

    // 4. Build Coordinate Axes
    const axisSizeMm = options.axisSizeMm ?? 30.0;
    const coordinateAxes: SceneCoordinateAxes = {
      worldAxes: [],
    };

    if (options.includeCoordinateAxes !== false) {
      coordinateAxes.worldAxes = this.buildCoordinateAxes(
        this.createIdentityTransform(),
        axisSizeMm,
        "world"
      );
    }

    if (options.includePieceLocalAxes) {
      coordinateAxes.pieceLocalAxes = {};
      for (const piece of puzzle3D.pieces) {
        const tr = pieceTransforms[piece.pieceId] || this.createIdentityTransform();
        coordinateAxes.pieceLocalAxes[piece.pieceId] = this.buildCoordinateAxes(
          tr,
          axisSizeMm * 0.5,
          `piece_${piece.pieceId}`
        );
      }
    }

    // 5. Compute Global Scene Bounding Box
    const boundingBox = this.computeSceneBoundingBox(pieces);

    // 6. Assemble Scene Metadata
    const cadSourceFingerprint = this.computeFingerprint(puzzle3D);
    const metadata: SceneMetadata = {
      puzzleId: puzzle3D.puzzleId,
      title: sceneName,
      pieceCount: puzzle3D.pieces.length,
      connectionCount: puzzle3D.connections.length,
      boundingBox,
      createdAt: new Date().toISOString(),
      version: "1.0.0",
      cadSourceFingerprint,
    };

    return {
      id: sceneId,
      name: sceneName,
      pieces,
      connectors,
      assemblyTransforms: { ...pieceTransforms },
      materials,
      connections,
      coordinateAxes,
      metadata,
    };
  }

  /**
   * Builds an RGB coordinate frame triad (X=Red, Y=Green, Z=Blue).
   */
  private static buildCoordinateAxes(
    transform: RigidTransform3D,
    lengthMm: number,
    prefix: string
  ): SceneObject[] {
    const axes: ("x" | "y" | "z")[] = ["x", "y", "z"];
    const colors: Record<"x" | "y" | "z", string> = {
      x: "#E74C3C", // Red
      y: "#2ECC71", // Green
      z: "#3498DB", // Blue
    };

    return axes.map((axis) => {
      const geom = RenderGeometryFactory.createAxisLine(axis, lengthMm);
      return {
        id: uid(`axis_${prefix}_${axis}_`),
        name: `${prefix.toUpperCase()} Axis ${axis.toUpperCase()}`,
        kind: "axis",
        geometry: geom,
        transform: { ...transform },
        worldTransform: { ...transform },
        materialId: `mat_axis_${axis}`,
        displayProperties: {
          color: colors[axis],
          opacity: 1.0,
          transparent: false,
          roughness: 0.5,
          metalness: 0.1,
          wireframe: false,
          visible: true,
          castShadow: false,
          receiveShadow: false,
        },
        cadGeometryRef: undefined,
        isImmutableCadCopy: true,
      };
    });
  }

  /**
   * Initializes default material library based on puzzle material and display options.
   */
  private static populateBaseMaterials(
    materials: Record<string, SceneMaterial>,
    puzzle3D: ConvertedPuzzle3D,
    options: SceneBuildOptions
  ): void {
    const defaultColor = this.getMaterialColor(puzzle3D.specification?.material?.id || "wood");
    const opacity = options.defaultOpacity ?? 1.0;

    materials["default_material"] = {
      id: "default_material",
      name: "Default Material",
      displayProperties: {
        color: defaultColor,
        opacity,
        transparent: opacity < 1.0,
        roughness: 0.7,
        metalness: 0.05,
        wireframe: false,
        visible: true,
        castShadow: true,
        receiveShadow: true,
      },
    };

    materials["mat_connection_line"] = {
      id: "mat_connection_line",
      name: "Connection Line",
      displayProperties: {
        color: "#2ECC71",
        opacity: 0.9,
        transparent: true,
        roughness: 0.5,
        metalness: 0.0,
        wireframe: false,
        visible: true,
        castShadow: false,
        receiveShadow: false,
      },
    };

    materials["mat_connection_marker"] = {
      id: "mat_connection_marker",
      name: "Connection Marker",
      displayProperties: {
        color: "#2ECC71",
        opacity: 1.0,
        transparent: false,
        roughness: 0.3,
        metalness: 0.5,
        wireframe: false,
        visible: true,
        castShadow: true,
        receiveShadow: true,
      },
    };

    // Distinct piece palettes if requested
    const distinctColors = [
      "#4A90E2", "#50E3C2", "#F5A623", "#E74C3C",
      "#9B59B6", "#1ABC9C", "#F39C12", "#D35400",
      "#27AE60", "#2980B9", "#8E44AD", "#16A085",
      "#E67E22", "#C0392B", "#BDC3C7", "#7F8C8D",
    ];

    for (let i = 0; i < distinctColors.length; i++) {
      const matId = `mat_piece_${i}`;
      materials[matId] = {
        id: matId,
        name: `Piece Material ${i + 1}`,
        displayProperties: {
          color: distinctColors[i],
          opacity,
          transparent: opacity < 1.0,
          roughness: 0.6,
          metalness: 0.1,
          wireframe: false,
          visible: true,
          castShadow: true,
          receiveShadow: true,
        },
      };
    }
  }

  private static resolveMaterialId(
    piece: GeneratedPiece3D,
    index: number,
    options: SceneBuildOptions
  ): string {
    if (options.colorScheme === "distinct_pieces") {
      return `mat_piece_${index % 16}`;
    }
    return "default_material";
  }

  private static getMaterialColor(materialId: string): string {
    const id = materialId.toLowerCase();
    if (id.includes("cardboard")) return "#C4A482"; // Warm kraft cardboard
    if (id.includes("plywood") || id.includes("birch")) return "#DEB887"; // Birch plywood
    if (id.includes("hardwood") || id.includes("wood")) return "#8B5A2B"; // Rich hardwood
    if (id.includes("acrylic") || id.includes("plastic")) return "#E0F7FA"; // Semi-translucent acrylic
    return "#B0BEC5";
  }

  private static computeSceneBoundingBox(pieces: SceneObject[]): Box3D {
    if (pieces.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const piece of pieces) {
      const tr = piece.worldTransform;
      const b = piece.geometry.bounds;

      // Transform all 8 corners of local bounds by world transform
      const corners: Vec3[] = [
        { x: b.min.x, y: b.min.y, z: b.min.z },
        { x: b.max.x, y: b.min.y, z: b.min.z },
        { x: b.min.x, y: b.max.y, z: b.min.z },
        { x: b.max.x, y: b.max.y, z: b.min.z },
        { x: b.min.x, y: b.min.y, z: b.max.z },
        { x: b.max.x, y: b.min.y, z: b.max.z },
        { x: b.min.x, y: b.max.y, z: b.max.z },
        { x: b.max.x, y: b.max.y, z: b.max.z },
      ];

      for (const corner of corners) {
        const transformed = transformPoint(tr, corner);
        if (transformed.x < minX) minX = transformed.x;
        if (transformed.y < minY) minY = transformed.y;
        if (transformed.z < minZ) minZ = transformed.z;
        if (transformed.x > maxX) maxX = transformed.x;
        if (transformed.y > maxY) maxY = transformed.y;
        if (transformed.z > maxZ) maxZ = transformed.z;
      }
    }

    return {
      min: { x: Number(minX.toFixed(3)), y: Number(minY.toFixed(3)), z: Number(minZ.toFixed(3)) },
      max: { x: Number(maxX.toFixed(3)), y: Number(maxY.toFixed(3)), z: Number(maxZ.toFixed(3)) },
    };
  }

  private static computeFingerprint(puzzle3D: ConvertedPuzzle3D): string {
    const totalVertices = puzzle3D.pieces.reduce(
      (acc, p) => acc + p.solid.localMesh.positions.length,
      0
    );
    const totalFaces = puzzle3D.pieces.reduce(
      (acc, p) => acc + p.solid.localMesh.indices.length,
      0
    );
    return `cad_${puzzle3D.puzzleId}_p${puzzle3D.pieces.length}_v${totalVertices}_f${totalFaces}`;
  }

  private static createIdentityTransform(): RigidTransform3D {
    return {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      matrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    };
  }
}
